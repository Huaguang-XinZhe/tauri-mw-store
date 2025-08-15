import { defineStore, getState, setState, subscribe } from "./StoreManager";
import { useStoreState, UseStoreStateOptions } from "../hooks/useStoreState";

export type StoreKeyConfig<T> = {
  default: T;
  persist?:
    | boolean
    | {
        /** 保存策略：'immediate' = 立即保存，'onClose' = 窗口关闭时保存 */
        saveStrategy?: "immediate" | "onClose";
      };
};

// 内部使用的类型，不导出
type StoreValue<T = any> = StoreKeyConfig<T> | T;
type StoreSchema = Record<string, StoreValue>;

// 改进的类型推断：更准确地识别配置对象
type InferValue<C> =
  // 如果是配置对象（有 default 属性）
  C extends { default: infer T }
    ? T
    : // 否则直接使用值类型
      C;

type Accessors<S extends StoreSchema> = {
  /** 初始化 store */
  initAppStore: () => Promise<void>;
} & {
  // getXxx
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

// 内部使用的类型，不导出
type SchemaStore<S extends StoreSchema> = {
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
  const immediateKeys: string[] = [];
  const onCloseKeys: string[] = [];

  Object.entries(schema).forEach(([key, conf]) => {
    // 处理简写方式：如果是对象且有 default 属性，则为完整配置
    if (typeof conf === "object" && conf !== null && "default" in conf) {
      initialState[key] = conf.default;

      if (conf.persist) {
        if (typeof conf.persist === "object") {
          // 使用配置的保存策略，默认为 'onClose'
          const saveStrategy = conf.persist.saveStrategy || "onClose";
          if (saveStrategy === "immediate") {
            immediateKeys.push(key);
          } else {
            onCloseKeys.push(key);
          }
        } else {
          // 简写形式 persist: true，默认使用 'onClose' 策略
          onCloseKeys.push(key);
        }
      }
    } else {
      // 简写方式：直接作为默认值，不持久化
      initialState[key] = conf;
    }
  });

  async function init() {
    await defineStore(initialState, {
      immediateKeys,
      onCloseKeys,
    });
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
  const api = Object.keys(schema).reduce(
    (acc, key) => {
      const cap = capitalize(key);
      (acc as any)[`get${cap}`] = () => getState(key) as any;
      (acc as any)[`set${cap}`] = (v: any, emitToWindows?: string[] | "all") =>
        setState(key, v, emitToWindows ?? "all");
      (acc as any)[`use${cap}`] = (options?: UseStoreStateOptions) =>
        useStoreState(key, options);
      (acc as any)[`on${cap}Change`] = (cb: (v: any) => void) =>
        subscribe(key, cb);
      return acc;
    },
    {
      // 添加 initAppStore 方法到 api 对象
      initAppStore: init,
    } as Accessors<S>
  );

  return {
    init,
    get,
    set,
    subscribe: subscribeKey,
    api,
  };
}
