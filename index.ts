// 导出最小 API：隐藏 StoreManager 实例
export { getState, setState, subscribe } from "./core/StoreManager";
export { useStoreState } from "./hooks/useStoreState";
export { defineWindowEvents } from "./core/WindowEvents";
export { createMWStore } from "./core/SchemaStore";
