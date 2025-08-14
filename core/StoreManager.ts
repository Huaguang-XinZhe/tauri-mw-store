import { emit, listen } from "@tauri-apps/api/event";
import { persistentAdapter } from "./PersistentAdaper";
import { ListenerRegistry } from "./ListenerRegistry";
import { Window } from "@tauri-apps/api/window";

interface StoreOptions {
  persistedKeys?: string[];
}

export class StoreManager {
  private state: Record<string, any> = {};
  private initialState: Record<string, any> = {};
  private persistedKeys: Set<string> = new Set();
  private readonly windowLabel: string;

  /**
   * 允许第二个参数直接传 persistedKeys（string[]），也兼容原有的 options 写法
   * @param initialState 初始状态
   * @param optionsOrPersistedKeys 可以是 StoreOptions 或 string[]（persistedKeys）
   */
  constructor(
    initialState: Record<string, any>,
    optionsOrPersistedKeys?: StoreOptions | string[]
  ) {
    this.windowLabel = Window.getCurrent().label;
    this.initialState = { ...initialState };
    this.state = { ...initialState };

    if (Array.isArray(optionsOrPersistedKeys)) {
      this.persistedKeys = new Set(optionsOrPersistedKeys);
    } else if (optionsOrPersistedKeys?.persistedKeys) {
      this.persistedKeys = new Set(optionsOrPersistedKeys.persistedKeys);
    }
  }

  /**
   * 仅负责从持久化适配器读取并合并状态（单一职责：加载）
   */
  public async loadPersistedStateOnly() {
    const persistedState = await persistentAdapter.load(this.persistedKeys);
    this.state = { ...this.state, ...persistedState };
  }

  /**
   * 在完成持久化加载后，统一对需要持久化的 key 触发一次通知（单一职责：通知）
   */
  public notifyPersistedKeys() {
    for (const key of this.persistedKeys) {
      ListenerRegistry.notify(key, this.state[key]);
    }
  }

  /**
   * 为了简化调用方，提供一个显式的 hydrate，内部按顺序完成加载与通知
   * 如果没有持久化的 key，跳过加载以避免插件和权限问题
   */
  public async hydrate() {
    // 只有存在需要持久化的 key 时才执行加载
    if (this.persistedKeys.size > 0) {
      await this.loadPersistedStateOnly();
      this.notifyPersistedKeys();
    }
  }

  public get(key: string) {
    return this.state[key];
  }

  public getDefaultValue(key: string) {
    return this.initialState[key];
  }

  /**
   * 请求其他窗口同步指定 key 的最新状态
   *
   * 工作流程：
   * 1. 向其他窗口发送同步请求
   * 2. 等待响应（最多1秒）
   * 3. 如果收到响应，更新状态并返回新值
   * 4. 如果超时，返回当前值
   */
  public async requestSync(key: string): Promise<any> {
    return new Promise((resolve) => {
      let cleanupListener: (() => void) | null = null;

      // 超时机制：1秒后如果没有响应，使用当前值
      const timeoutId = setTimeout(() => {
        if (cleanupListener) {
          cleanupListener(); // 清理事件监听器
        }
        resolve(this.state[key]); // 返回当前值
      }, 1000);

      // 监听同步响应事件
      listen("store-sync-response", (event) => {
        const { key: responseKey, value, targetWindow } = event.payload as any;

        // 检查是否是我们要的响应
        if (responseKey === key && targetWindow === this.windowLabel) {
          // 收到正确响应，清理资源
          clearTimeout(timeoutId);
          if (cleanupListener) {
            cleanupListener();
          }

          // 更新本地状态并通知所有监听器
          this.state[key] = value;
          ListenerRegistry.notify(key, value);

          // 返回同步的值
          resolve(value);
        }
      }).then((unlistenFunction) => {
        // 保存清理函数，用于超时或成功时清理监听器
        cleanupListener = unlistenFunction;
      });

      // 发送同步请求给其他窗口
      emit("store-sync-request", {
        key,
        requestWindow: this.windowLabel,
      });
    });
  }

  public async set(
    key: string,
    value: any,
    emitToWindows: string[] | "all" = "all"
  ) {
    this.state[key] = value;

    // Notify listeners in current window
    ListenerRegistry.notify(key, value);

    // Emit to other windows
    await this.emitToOtherWindows(key, value, emitToWindows);

    // Persist if needed
    if (this.persistedKeys.has(key)) {
      await persistentAdapter.save(key, value);
    }
  }

  private async emitToOtherWindows(
    key: string,
    value: any,
    target: string[] | "all"
  ) {
    await emit("store-update", {
      key,
      value,
      sourceWindow: this.windowLabel,
      targetWindows: target,
    });
  }

  public async listenToIncomingUpdates() {
    listen("store-update", async (event) => {
      const { key, value, sourceWindow, targetWindows } = event.payload as any;

      if (sourceWindow === this.windowLabel) return; // Ignore own events
      if (targetWindows !== "all" && !targetWindows.includes(this.windowLabel))
        return;

      this.state[key] = value;
      ListenerRegistry.notify(key, value);

      // Persist if needed
      if (this.persistedKeys.has(key)) {
        await persistentAdapter.save(key, value);
      }
    });

    // 监听同步请求
    listen("store-sync-request", async (event) => {
      const { key, requestWindow } = event.payload as any;

      if (requestWindow === this.windowLabel) return; // Ignore own requests

      // 响应同步请求，发送当前状态
      await emit("store-sync-response", {
        key,
        value: this.state[key],
        sourceWindow: this.windowLabel,
        targetWindow: requestWindow,
      });
    });
  }
}

let windowStoreManager: StoreManager | null = null;

function getStoreManagerInternal(): StoreManager {
  if (!windowStoreManager) {
    throw new Error("StoreManager 尚未创建，请先调用 defineStore 初始化");
  }
  return windowStoreManager;
}

export async function defineStore(
  initialState: Record<string, any>,
  optionsOrPersistedKeys?: StoreOptions | string[]
) {
  if (windowStoreManager) return; // 简化：允许仅初始化一次

  windowStoreManager = new StoreManager(initialState, optionsOrPersistedKeys);
  await windowStoreManager.hydrate();
  await windowStoreManager.listenToIncomingUpdates();
}

// 对外暴露的最小 API：避免暴露 StoreManager 实例
export function getState<T = any>(key: string): T {
  return getStoreManagerInternal().get(key);
}

export function getDefaultState<T = any>(key: string): T {
  return getStoreManagerInternal().getDefaultValue(key);
}

export async function requestStateSync<T = any>(key: string): Promise<T> {
  return getStoreManagerInternal().requestSync(key);
}

export async function setState(
  key: string,
  value: any,
  emitToWindows: string[] | "all" = "all"
) {
  return getStoreManagerInternal().set(key, value, emitToWindows);
}

export function subscribe(key: string, callback: (value: any) => void) {
  return ListenerRegistry.addListener(key, callback);
}
