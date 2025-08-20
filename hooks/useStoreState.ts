import { useEffect, useState } from "react";
import { ListenerRegistry } from "../core/ListenerRegistry";
import {
  getDefaultState,
  getState,
  requestStateSync,
} from "../core/StoreManager";
import { Window } from "@tauri-apps/api/window";

export interface UseStoreStateOptions {
  /** 是否同步其他窗口对应 key 的状态，默认为 true */
  sync?: boolean;
}

export function useStoreState<T = any>(
  key: string,
  options: UseStoreStateOptions = {}
): T {
  const { sync = true } = options;

  // 初始化：总是使用默认值，不管是否同步
  // 因为同步是异步的，useState 执行时还没有同步的值
  const [value, setValue] = useState<T>(() => getDefaultState<T>(key));

  useEffect(() => {
    const windowLabel = Window.getCurrent().label;

    // 监听变化的逻辑始终保持
    const unsubscribe = ListenerRegistry.addListener(key, (value) => {
      console.log("useStoreState", windowLabel, key, value);
      setValue(value as T);
    });

    if (sync) {
      if (windowLabel !== "main") {
        // 非主窗口：主动请求同步最新状态
        requestStateSync<T>(key);
      } else {
        // 主窗口：直接检查当前状态，因为 hydrate 可能已经完成
        // 使用 setTimeout 确保在 microtask 队列后执行，让 hydrate 有机会完成
        setTimeout(() => {
          try {
            const currentValue = getState<T>(key);
            const defaultValue = getDefaultState<T>(key);

            // 简单的值比较：如果当前值与默认值不同，说明已经 hydrate 了
            if (currentValue !== defaultValue) {
              console.log(
                "useStoreState 主窗口检测到 hydrate 后的值",
                key,
                currentValue
              );
              setValue(currentValue);
            }
          } catch (error) {
            // Store 可能还没初始化，忽略错误
            console.log("useStoreState 主窗口检查状态时出错", error);
          }
        }, 0);
      }
    }

    return () => unsubscribe();
  }, [key, sync]);

  return value;
}
