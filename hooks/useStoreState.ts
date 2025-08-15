import { useEffect, useState } from "react";
import { ListenerRegistry } from "../core/ListenerRegistry";
import { getDefaultState, requestStateSync } from "../core/StoreManager";
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

    // 如果是同步模式，主动请求同步最新状态
    // 注意：requestStateSync 内部已经会通知监听器，
    // 所以这里不需要再手动 setValue，监听器会自动处理
    if (sync && windowLabel !== "main") {
      // 非主窗口才同步
      requestStateSync<T>(key);
    }

    return () => unsubscribe();
  }, [key, sync]);

  return value;
}
