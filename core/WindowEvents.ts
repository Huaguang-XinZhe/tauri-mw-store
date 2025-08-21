import { listen, emit } from "@tauri-apps/api/event";
import { Window } from "@tauri-apps/api/window";

// 事件处理器类型
export type EventHandler<T> = T extends void | undefined
  ? () => void | Promise<void>
  : (context: T) => void | Promise<void>;

// 窗口配置类型
export type WindowConfig<T = void> = {
  listeners?: Record<string, EventHandler<T>>;
  emitOnInit?: Array<string | { event: string; payload?: any }>;
  onInit?: () => T | Promise<T>;
};

// 辅助函数：创建类型安全的窗口配置
export function window<T>(config: WindowConfig<T>): WindowConfig<T> {
  return config;
}

// 配置类型：支持每个窗口有自己的类型
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
 * import { defineWindowEvents, window } from "tauri-mw-store";
 *
 * await defineWindowEvents({
 *   // 使用 window() 辅助函数获得完整的类型提示
 *   main: window({
 *     onInit: () => {
 *       const updater = new VersionUpdateUtils();
 *       return { updater }; // 返回共享状态
 *     },
 *     listeners: {
 *       // 这里会有完整的类型提示：({ updater }: { updater: VersionUpdateUtils })
 *       [EventKey.CHECK_UPDATE]: ({ updater }) => updater.checkForUpdates(),
 *       [EventKey.INSTALL_REQUEST]: ({ updater }) => updater.askAndInstall(),
 *     },
 *   }),
 *
 *   // 无返回值的窗口
 *   settings: window({
 *     onInit: () => console.log("✅ 设置窗口初始化完成"),
 *     listeners: {
 *       // 这里的 handler 不接收任何参数
 *       [EventKey.SOME_EVENT]: () => console.log("处理事件"),
 *     },
 *     emitOnInit: [EventKey.CHECK_UPDATE],
 *   }),
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
  let context: unknown = undefined;
  if (current.onInit) {
    context = await current.onInit();
  }

  // 注册监听
  if (current.listeners) {
    for (const [eventName, handler] of Object.entries(current.listeners)) {
      const un = await listen(eventName, () => {
        // 如果 onInit 有返回值，传递给 handler；否则不传参数
        if (context !== undefined && context !== null) {
          (handler as (ctx: unknown) => void | Promise<void>)(context);
        } else {
          (handler as () => void | Promise<void>)();
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
