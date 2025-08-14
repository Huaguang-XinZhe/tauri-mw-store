import { defineStore, getState, setState, subscribe } from "./StoreManager";
import { useStoreState, UseStoreStateOptions } from "../hooks/useStoreState";

export type StoreKeyConfig<T> = {
  default: T;
  persist?: boolean;
};

// 简写方式：直接传值作为默认值，不持久化
export type StoreKeyConfigOrValue<T> = StoreKeyConfig<T> | T;

export type StoreSchema = Record<string, StoreKeyConfigOrValue<any>>;

type InferValue<C> = C extends StoreKeyConfig<infer T> ? T : C;

type Accessors<S extends StoreSchema> =
  // getXxx
  {
    [K in keyof S & string as `get${Capitalize<K>}`]: () => InferValue<S[K]>;
  } & {
    // setXxx
    [K in keyof S & string as `set${Capitalize<K>}`]: (
      v: InferValue<S[K]>,
      emitToWindows?: string[] | "all"
    ) => Promise<void>;
  } & {
    // useXxx
    [K in keyof S & string as `use${Capitalize<K>}`]: (
      options?: UseStoreStateOptions
    ) => InferValue<S[K]>;
  } & {
    // onXxxChange
    [K in keyof S & string as `on${Capitalize<K>}Change`]: (
      cb: (v: InferValue<S[K]>) => void
    ) => () => void;
  };

export type SchemaStore<S extends StoreSchema> = {
  init: () => Promise<void>;
  get: <K extends keyof S>(key: K) => InferValue<S[K]>;
  set: <K extends keyof S>(
    key: K,
    value: InferValue<S[K]>,
    emitToWindows?: string[] | "all"
  ) => Promise<void>;
  subscribe: <K extends keyof S>(
    key: K,
    cb: (value: InferValue<S[K]>) => void
  ) => () => void;
  /** 基于 key 自动生成的便捷方法集合 */
  api: Accessors<S>;
};

// 首字母大写
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * 基于 schema 的统一初始化与类型安全访问器生成器
 */
export function createMWStore<S extends StoreSchema>(
  schema: S
): SchemaStore<S> {
  const initialState: Record<string, any> = {};
  const persistedKeys: string[] = [];

  Object.entries(schema).forEach(([key, conf]) => {
    // 处理简写方式：如果是对象且有 default 属性，则为完整配置
    if (typeof conf === "object" && conf !== null && "default" in conf) {
      initialState[key] = conf.default;
      if (conf.persist) persistedKeys.push(key);
    } else {
      // 简写方式：直接作为默认值，不持久化
      initialState[key] = conf;
    }
  });

  async function init() {
    await defineStore(initialState, persistedKeys);
  }

  function get<K extends keyof S>(key: K): InferValue<S[K]> {
    return getState(key as string) as any;
  }

  function set<K extends keyof S>(
    key: K,
    value: InferValue<S[K]>,
    emitToWindows?: string[] | "all"
  ): Promise<void> {
    return setState(
      key as string,
      value,
      emitToWindows ?? "all"
    ) as Promise<void>;
  }

  function subscribeKey<K extends keyof S>(
    key: K,
    cb: (value: InferValue<S[K]>) => void
  ) {
    return subscribe(key as string, cb);
  }

  // 基于 key 生成 getXxx/setXxx/useXxx/onXxxChange
  const api = Object.keys(schema).reduce((acc, key) => {
    const cap = capitalize(key);
    (acc as any)[`get${cap}`] = () => getState(key) as any;
    (acc as any)[`set${cap}`] = (v: any, emitToWindows?: string[] | "all") =>
      setState(key, v, emitToWindows ?? "all");
    (acc as any)[`use${cap}`] = (options?: UseStoreStateOptions) =>
      useStoreState(key, options);
    (acc as any)[`on${cap}Change`] = (cb: (v: any) => void) =>
      subscribe(key, cb);
    return acc;
  }, {} as Accessors<S>);

  return {
    init,
    get,
    set,
    subscribe: subscribeKey,
    api,
  };
}
