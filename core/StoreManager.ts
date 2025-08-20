import { emit, listen } from "@tauri-apps/api/event";
import { persistentAdapter } from "./PersistentAdaper";
import { ListenerRegistry } from "./ListenerRegistry";
import { Window } from "@tauri-apps/api/window";

interface StoreOptions {
  immediateKeys?: string[];
  onCloseKeys?: string[];
  /**
   * 是否在初始化时自动清理不再需要的持久化键
   * @default true
   */
  autoCleanup?: boolean;
}

export class StoreManager {
  private state: Record<string, any> = {};
  private initialState: Record<string, any> = {};
  private immediateKeys: Set<string> = new Set();
  private onCloseKeys: Set<string> = new Set();
  private readonly windowLabel: string;
  private readonly autoCleanup: boolean;

  /**
   * @param initialState 初始状态
   * @param options 持久化选项
   */
  constructor(initialState: Record<string, any>, options?: StoreOptions) {
    this.windowLabel = Window.getCurrent().label;
    this.initialState = { ...initialState };
    this.state = { ...initialState };
    this.autoCleanup = options?.autoCleanup ?? true;

    if (options) {
      this.immediateKeys = new Set(options.immediateKeys || []);
      this.onCloseKeys = new Set(options.onCloseKeys || []);
    }
  }

  /**
   * 从持久化存储加载所有持久化状态
   */
  public async loadPersistedState(allPersistedKeys: Set<string>) {
    if (allPersistedKeys.size > 0) {
      const persistedState = await persistentAdapter.load(allPersistedKeys);
      this.state = { ...this.state, ...persistedState };
    }
  }

  /**
   * 通知所有持久化状态的监听器
   */
  public notifyPersistedKeys(allPersistedKeys: Set<string>) {
    for (const key of allPersistedKeys) {
      ListenerRegistry.notify(key, this.state[key]);
    }
  }

  /**
   * 初始化：加载持久化状态并设置窗口关闭监听
   */
  public async hydrate() {
    // 获取当前配置的所有持久化键
    const allPersistedKeys = new Set([
      ...this.immediateKeys,
      ...this.onCloseKeys,
    ]);

    // 自动清理不再需要的持久化键
    if (this.autoCleanup) {
      try {
        const orphanedKeys = await persistentAdapter.cleanupOrphanedKeys(
          allPersistedKeys
        );
        if (orphanedKeys.length > 0) {
          console.log(`已清理 ${orphanedKeys.length} 个孤立的持久化键`);
        }
      } catch (error) {
        console.warn("清理孤立键时出错:", error);
      }
    }

    // 只有存在需要持久化的 key 时才执行加载
    if (allPersistedKeys.size > 0) {
      await this.loadPersistedState(allPersistedKeys);
      this.notifyPersistedKeys(allPersistedKeys);
    }

    // 内置窗口关闭监听
    if (this.onCloseKeys.size > 0) {
      this.setupWindowCloseListener();
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

    // 根据保存策略持久化
    if (this.immediateKeys.has(key)) {
      // 立即保存策略
      await persistentAdapter.save(key, value);
    }
    // onClose 策略的 key 不在这里保存，等窗口关闭时批量保存
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

      // 根据保存策略持久化
      if (this.immediateKeys.has(key)) {
        // 立即保存策略
        await persistentAdapter.save(key, value);
      }
      // onClose 策略的 key 不在这里保存，等窗口关闭时批量保存
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

  /**
   * 设置窗口关闭监听，自动保存 onClose 策略的状态
   */
  private setupWindowCloseListener(): void {
    try {
      Window.getCurrent().onCloseRequested(async () => {
        console.log("窗口即将关闭，正在保存状态...");
        await this.saveOnCloseKeys();
        // // 调试延迟
        // await new Promise((resolve) => setTimeout(resolve, 3000));
        // console.log("状态保存完成");
      });
    } catch (error) {
      console.warn("设置窗口关闭监听失败:", error);
    }
  }

  /**
   * 保存所有使用 onClose 策略的状态
   * 内部方法，由窗口关闭监听自动调用
   */
  private async saveOnCloseKeys(): Promise<void> {
    const savePromises: Promise<void>[] = [];

    for (const key of this.onCloseKeys) {
      savePromises.push(persistentAdapter.save(key, this.state[key]));
    }

    // 并行保存所有状态
    await Promise.all(savePromises);
  }

  /**
   * 获取当前存储中的所有键
   */
  public async getAllStoredKeys(): Promise<string[]> {
    return await persistentAdapter.getAllKeys();
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
  options?: StoreOptions
) {
  if (windowStoreManager) return; // 简化：允许仅初始化一次

  windowStoreManager = new StoreManager(initialState, options);
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

/**
 * 获取当前存储中的所有键（用于调试）
 */
export async function getAllStoredKeys(): Promise<string[]> {
  return getStoreManagerInternal().getAllStoredKeys();
}
