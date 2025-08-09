# tauri-mw-store

多窗口共享状态（Tauri）与 React hooks 的轻量方案，支持 schema 驱动的初始化与自动生成访问器。

## 特性

- 多窗口实时同步（基于 Tauri 事件），跨窗口状态立即一致
- 可选持久化（按 key），仅持久化必要数据
- 自动生成 API：`getXxx / setXxx / useXxx / onXxxChange`，零样板
- `useXxx` 会订阅该 key 的变化，变化后自动触发组件重新渲染
- 声明式窗口事件：`defineWindowEvents` 在入口集中注册监听与初始化触发
- 每窗口单例 `StoreManager`，`defineStore` 幂等
- 轻量打包：提供 ESM 构件、d.ts 声明，支持 tree-shaking

## 快速开始

```ts
// 在 store/appStore.ts 中
import { createSchemaStore, defineWindowEvents } from "@tauri-mw-store";
import { EventKey } from "./types";

export const appStore = createSchemaStore({
  // ⚠️注意！不要用 user_id 这样的 Key，要用驼峰命名法！
  config: { default: null as any, persist: true },
  newVersionDownloaded: { default: false },
});

// 应用入口
export const initAppStore = () => appStore.init();

// 直接导出自动生成的 API
export const {
  getConfig,
  setConfig,
  useConfig,
  onConfigChange,
  getNewVersionDownloaded,
  setNewVersionDownloaded,
  useNewVersionDownloaded,
  onNewVersionDownloadedChange,
} = appStore.api as const;

// 在 main.tsx 中
await initAppStore();

// 声明式窗口事件
await defineWindowEvents({
  main: {
    listeners: {
      [EventKey.CHECK_UPDATE]: () => {
        /* check updates */
      },
      [EventKey.INSTALL_REQUEST]: () => {
        /* ask & install */
      },
    },
    onInit: () => {
      console.log("✅ 主窗口初始化完成");
    },
  },
  settings: {
    emitOnInit: [EventKey.CHECK_UPDATE],
    onInit: () => {
      console.log("✅ 设置窗口初始化完成");
    },
  },
});
```

## 在组件中如何使用

```tsx
// 以设置页为例
import { useEffect } from "react";
import { useConfig, setConfig } from "@/store/appStore";

export function Settings() {
  const config = useConfig(); // useXxx 会监听变化并触发组件重新渲染

  useEffect(() => {
    if (!config) return;
    // 根据 config 做初始化渲染...
  }, [config]);

  const save = async () => {
    const next = { ...config, theme: "dark" };
    await setConfig(next); // 默认广播 "all"
  };

  return <button onClick={save}>保存</button>;
}
```

非 React 环境也可以订阅与读取：

```ts
import { getConfig, onConfigChange } from "@/store/appStore";

const current = getConfig();
const unsubscribe = onConfigChange((next) => {
  console.log("config changed", next);
});

// 需要时记得取消订阅
unsubscribe();
```

## 只同步部分窗口（选择性广播）

任意 `setXxx` 方法都支持第三个参数 `emitToWindows?: string[] | "all"`：

```ts
import { setConfig } from "@/store/appStore";

// 只同步到 main 与 settings 窗口
await setConfig({ theme: "dark" }, ["main", "settings"]);

// 广播到所有窗口（默认行为）
await setConfig({ theme: "dark" });
// 等价于：
await setConfig({ theme: "dark" }, "all");
```

窗口标签可通过 `Window.getCurrent().label` 获取（来自 `@tauri-apps/api/window`）。

## 注意事项与最佳实践

- Key 命名请使用驼峰（如 `newVersionDownloaded`），自动生成的 API 才更自然。
- `createSchemaStore` 只需初始化一次；`defineStore` 内部为幂等实现，重复调用会被忽略。
- 仅标记了 `persist: true` 的键会参与持久化，其他键为内存态跨窗口同步。
- 统一的窗口事件注册用 `defineWindowEvents`，避免分散在业务代码中。

## Keywords

- tauri
- tauri v2
- multi-window
- state sync
- cross-window events
- react hooks
- schema-driven store
- @tauri-apps/plugin-store
- typescript
- esm

## 许可

MIT © huaguang
