import { emit, listen } from "@tauri-apps/api/event";
import { persistentAdapter } from "./PersistentAdaper";
import { ListenerRegistry } from "./ListenerRegistry";
import { Window } from "@tauri-apps/api/window";

interface StoreOptions {
  persistedKeys?: string[];
}

export class StoreManager {
  private state: Record<string, any> = {};
  private persistedKeys: Set<string> = new Set();

  /**
   * 允许第二个参数直接传 persistedKeys（string[]），也兼容原有的 options 写法
   * @param initialState 初始状态
   * @param optionsOrPersistedKeys 可以是 StoreOptions 或 string[]（persistedKeys）
   */
  constructor(
    initialState: Record<string, any>,
    optionsOrPersistedKeys?: StoreOptions | string[]
  ) {
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
   */
  public async hydrate() {
    await this.loadPersistedStateOnly();
    this.notifyPersistedKeys();
  }

  public get(key: string) {
    return this.state[key];
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
      sourceWindow: Window.getCurrent().label,
      targetWindows: target,
    });
  }

  public async listenToIncomingUpdates() {
    listen("store-update", async (event) => {
      const { key, value, sourceWindow, targetWindows } = event.payload as any;

      const currentWindow = Window.getCurrent().label;
      if (sourceWindow === currentWindow) return; // Ignore own events
      if (targetWindows !== "all" && !targetWindows.includes(currentWindow))
        return;

      this.state[key] = value;
      ListenerRegistry.notify(key, value);

      // Persist if needed
      if (this.persistedKeys.has(key)) {
        await persistentAdapter.save(key, value);
      }
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
