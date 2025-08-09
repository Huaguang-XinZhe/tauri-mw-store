import { useEffect, useState } from "react";
import { ListenerRegistry } from "../core/ListenerRegistry";
import { getState } from "../core/StoreManager";

export function useStoreState<T = any>(key: string): T {
  const [value, setValue] = useState<T>(() => getState<T>(key));

  useEffect(() => {
    const unsubscribe = ListenerRegistry.addListener(key, (value) => {
      console.log("useStoreState", key, value);
      setValue(value as T);
    });
    return () => unsubscribe();
  }, [key]);

  return value;
}
