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
import { createMWStore, defineWindowEvents } from "@tauri-mw-store";
import { EventKey } from "./types";

export const appStore = createMWStore({
  // ⚠️注意！不要用 user_id 这样的 Key，要用驼峰命名法！
  config: {
    default: null as any,
    persist: { saveStrategy: "immediate" }, // 立即保存
  },
  theme: {
    default: "light",
    persist: true, // 默认为 onClose 策略
  },
  newVersionDownloaded: { default: false }, // 不持久化
});

// 直接导出自动生成的 API（包含 initAppStore 方法）
export const {
  initAppStore,
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
await initAppStore(); // 自动设置窗口关闭时保存状态

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

## 持久化策略

支持两种持久化保存策略：

### 1. **立即保存 (`immediate`)**

```typescript
{
  config: {
    default: { theme: "light" },
    persist: { saveStrategy: 'immediate' }
  }
}
```

- ✅ 状态改变时立即保存到磁盘
- ✅ 数据安全性高，不会因为意外关闭而丢失
- ⚠️ 频繁修改会有性能影响

### 2. **窗口关闭时保存 (`onClose`, 默认)**

```typescript
{
  theme: { default: "light", persist: true },
  // 等价于
  theme: {
    default: "light",
    persist: { saveStrategy: 'onClose' }
  }
}
```

- ✅ 性能更好，减少磁盘 I/O
- ✅ 适合频繁变化的状态
- ⚠️ 需要正确处理窗口关闭事件

**使用建议**：

- 重要配置（如用户设置）→ `immediate` 策略
- 临时状态（如界面状态）→ `onClose` 策略

## 权限配置

如果您需要使用持久化功能（`persist: true`），需要在 `src-tauri/capabilities/default.json` 中添加 store 权限：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": ["main", "newWindow"],
  "permissions": [
    "core:default",
    "store:default",
    "core:webview:allow-create-webview-window"
  ]
}
```

**重要说明**：

- ✅ 在 `windows` 数组中包含所有需要使用状态管理的窗口标签
- ✅ 在 `permissions` 数组中添加 `"store:default"` 权限
- ✅ 如果没有任何状态需要持久化，将自动跳过 store 插件的加载，无需添加权限

## 注意事项与最佳实践

- **Key 命名**：请使用驼峰（如 `newVersionDownloaded`），自动生成的 API 才更自然。
- **窗口标签命名**：如果窗口的 URL 路径包含横杠分隔（如 `new-window`），窗口标签应使用驼峰命名（如 `newWindow`），否则可能导致权限错误。
- **初始化**：`createMWStore` 只需初始化一次；`defineStore` 内部为幂等实现，重复调用会被忽略。
- **持久化**：仅标记了 `persist: true` 的键会参与持久化，其他键为内存态跨窗口同步。
- **事件注册**：统一的窗口事件注册用 `defineWindowEvents`，避免分散在业务代码中。

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
