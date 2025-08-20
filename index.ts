// 导出核心 API
export { createMWStore, storeConfig } from "./core/SchemaStore";
// export { useStoreState } from "./hooks/useStoreState";
export { defineWindowEvents } from "./core/WindowEvents";

// 导出类型（供用户使用）
// export type { StoreKeyConfig } from "./core/SchemaStore";
// export type { UseStoreStateOptions } from "./hooks/useStoreState";

// 底层 API（通常通过 createMWStore 生成的 api 使用，但保留导出供高级用户使用）
// export { getState, setState, subscribe } from "./core/StoreManager";

// 维护 API（供调试和清理使用）
export { getAllStoredKeys } from "./core/StoreManager";
