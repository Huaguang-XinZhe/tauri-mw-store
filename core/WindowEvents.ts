import { listen, emit } from "@tauri-apps/api/event";
import { Window } from "@tauri-apps/api/window";

export type EventHandler<T = void> = T extends void
  ? () => void | Promise<void>
  : (context: T) => void | Promise<void>;

export type WindowConfig<T = void> = {
  listeners?: Record<string, EventHandler<T>>;
  emitOnInit?: Array<string | { event: string; payload?: any }>;
  onInit?: () => T | Promise<T>;
};

export type WindowEventsConfig = {
  [windowLabel: string]: WindowConfig<any>;
};

export type WindowEventsController = {
  dispose: () => void;
};

/**
 * 根据当前窗口标签，按声明式配置注册事件监听与初始化触发。
 * 使用者仅需在入口处调用一次。
 *
 * onInit 返回的值会自动作为 listeners 中所有处理器的参数：
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
 *   settings: {
 *     onInit: () => console.log("✅ 设置窗口初始化完成"),
 *     emitOnInit: [EventKey.CHECK_UPDATE],
 *   },
 * });
 * ```
 */
export async function defineWindowEvents(
  config: WindowEventsConfig
): Promise<WindowEventsController | undefined> {
  const currentLabel = Window.getCurrent().label;
  const current = config[currentLabel];
  if (!current) return undefined;

  const unsubs: Array<() => void> = [];

  // 先运行自定义初始化钩子，获取共享状态
  let context: any = undefined;
  if (current.onInit) {
    context = await current.onInit();
  }

  // 注册监听
  if (current.listeners) {
    for (const [eventName, handler] of Object.entries(current.listeners)) {
      const un = await listen(eventName, () => {
        // 如果 onInit 有返回值，传递给 handler；否则不传参数
        if (context !== undefined) {
          (handler as any)(context);
        } else {
          (handler as any)();
        }
      });
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
