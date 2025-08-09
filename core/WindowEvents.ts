import { listen, emit } from "@tauri-apps/api/event";
import { Window } from "@tauri-apps/api/window";

export type EventHandler = () => void | Promise<void>;

export type WindowEventsConfig = {
  [windowLabel: string]: {
    listeners?: Record<string, EventHandler>;
    emitOnInit?: Array<string | { event: string; payload?: any }>;
    onInit?: () => void | Promise<void>;
  };
};

export type WindowEventsController = {
  dispose: () => void;
};

/**
 * 根据当前窗口标签，按声明式配置注册事件监听与初始化触发。
 * 使用者仅需在入口处调用一次。
 */
export async function defineWindowEvents(
  config: WindowEventsConfig
): Promise<WindowEventsController | undefined> {
  const currentLabel = Window.getCurrent().label;
  const current = config[currentLabel];
  if (!current) return undefined;

  const unsubs: Array<() => void> = [];

  // 注册监听
  if (current.listeners) {
    for (const [eventName, handler] of Object.entries(current.listeners)) {
      const un = await listen(eventName, () => handler());
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

  // 运行自定义初始化钩子
  if (current.onInit) {
    await current.onInit();
  }

  return {
    dispose: () => {
      unsubs.forEach((u) => u());
    },
  };
}
