import { listen, emit } from "@tauri-apps/api/event";
import { Window } from "@tauri-apps/api/window";

export type EventHandler<T = any> = (context?: T) => void | Promise<void>;

export type WindowEventsConfig<T = any> = {
  [windowLabel: string]: {
    listeners?: Record<string, EventHandler<T>>;
    emitOnInit?: Array<string | { event: string; payload?: any }>;
    onInit?: () => T | Promise<T>;
  };
};

export type WindowEventsController = {
  dispose: () => void;
};

/**
 * 根据当前窗口标签，按声明式配置注册事件监听与初始化触发。
 * 使用者仅需在入口处调用一次。
 *
 * 支持 onInit 返回共享状态，供 EventHandler 使用：
 * @example
 * ```ts
 * await defineWindowEvents({
 *   main: {
 *     onInit: () => {
 *       const updater = new VersionUpdateUtils();
 *       return { updater }; // 返回共享状态
 *     },
 *     listeners: {
 *       [EventKey.CHECK_UPDATE]: ({ updater }) => updater.checkForUpdates(),
 *       [EventKey.INSTALL_REQUEST]: ({ updater }) => updater.askAndInstall(),
 *     },
 *   },
 * });
 * ```
 */
export async function defineWindowEvents<T = any>(
  config: WindowEventsConfig<T>
): Promise<WindowEventsController | undefined> {
  const currentLabel = Window.getCurrent().label;
  const current = config[currentLabel];
  if (!current) return undefined;

  const unsubs: Array<() => void> = [];

  // 先运行自定义初始化钩子，获取共享状态
  let sharedContext: T | undefined;
  if (current.onInit) {
    sharedContext = await current.onInit();
  }

  // 注册监听（现在可以访问共享状态）
  if (current.listeners) {
    for (const [eventName, handler] of Object.entries(current.listeners)) {
      const un = await listen(eventName, () => handler(sharedContext));
      unsubs.push(() => un());
    }
  }

  // 触发初始化 emit
  if (current.emitOnInit?.length) {
    for (const item of current.emitOnInit) {
      if (typeof item === "string") {
        await emit(item);
      } else {
        await emit(item.event, item.payload);
      }
    }
  }

  return {
    dispose: () => {
      unsubs.forEach((u) => u());
    },
  };
}
