# tauri-mw-store

[![npm version](https://badge.fury.io/js/tauri-mw-store.svg?icon=si%3Anpm)](https://badge.fury.io/js/tauri-mw-store)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> [English Documentation](./README.en.md) | 中文文档

🚀 **声明式全局状态管理 + 持久化 Store + 窗口初始化配置，专为 Tauri 多窗口应用设计。**

一个专为 Tauri 应用设计的声明式状态管理库，提供类型安全的全局状态、自动持久化存储和声明式窗口事件配置。

## ✨ 特性

- 🔄 **多窗口状态同步** - 自动在多个窗口间同步状态变化
- 💾 **持久化存储** - 支持状态持久化到本地存储
- 🎯 **类型安全** - 完整的 TypeScript 支持和类型推断
- ⚛️ **React 集成** - 提供易用的 React hooks
- 📋 **Schema 驱动** - 基于 schema 的配置，自动生成类型安全的 API
- 🎛️ **灵活配置** - 支持立即保存和窗口关闭时保存两种策略
- 🧹 **自动清理** - 自动清理不再需要的持久化键
- 🪟 **窗口事件管理** - 声明式的窗口事件配置

## 📦 安装

```bash
# 使用 bun
bun add tauri-mw-store

# 使用 npm
npm install tauri-mw-store

# 使用 yarn
yarn add tauri-mw-store
```

### 依赖要求

- React >= 18
- @tauri-apps/api >= 1.5.0
- @tauri-apps/plugin-store >= 2.3.0

### Tauri 配置

**仅当你的 Store Schema 中有键声明为持久化时才需要以下配置：**

1. 安装 store 插件：

```bash
bun tauri add store
```

2. 在 `src-tauri/capabilities/default.json` 中添加权限：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": ["main", "settings"],
  "permissions": [
    "store:default"
  ]
}
```

**重要提示：**
- `windows` 数组中需要包含所有使用 store 的窗口标识符
- 如果窗口 URL 路径是横杠分隔的（如 `user-profile`），在声明权限时必须改成驼峰命名（如 `userProfile`），否则会报错

**注意：** 如果你的应用只使用内存状态（无持久化），则无需安装 Tauri Store 插件和配置权限。

## 🚀 快速开始

### 1. 定义类型（可选）

```typescript
// src/types/index.ts
export interface AppConfig {
  tips: string[];
  autoRotate: boolean;
  rotateInterval: number;
  theme: 'light' | 'dark' | 'system';
  autoStart: boolean;
}
```

### 2. 创建 Store

```typescript
// src/store/appStore.ts
import { createMWStore, storeConfig } from 'tauri-mw-store';
import { AppConfig } from '@/types';

// 使用解构导出，获得类型安全的 API
export const {
  initAppStore,
  getConfig,
  setConfig,
  useConfig,
  getNewVersionDownloaded,
  setNewVersionDownloaded,
  useNewVersionDownloaded,
} = createMWStore({
  config: storeConfig({
    default: null as AppConfig | null,
    persist: true, // 窗口关闭时保存（默认策略）
  }),
  newVersionDownloaded: false, // 不持久化的临时状态
});
```

### 3. 初始化 Store

在应用入口处初始化 store（在渲染之前）：

```typescript
// src/main.tsx
import ReactDOM from 'react-dom/client';
import { initAppStore } from './store/appStore';
import App from './App';

// 先初始化 store，加载持久化数据
await initAppStore();

// 然后渲染应用
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

### 4. 在组件中使用

```typescript
// src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { useConfig, getConfig, setConfig } from '@/store/appStore';
import { AppConfig } from '@/types';

function Settings() {
  // 使用 React hook，自动同步多窗口状态
  const config = useConfig();
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>('dark');
  
  // 当配置加载完成时，同步本地状态
  useEffect(() => {
    if (config) {
      setLocalTheme(config.theme);
    }
  }, [config]);
  
  const handleSave = async () => {
    const currentConfig = getConfig();
    if (!currentConfig) return;
    
    const updatedConfig = {
      ...currentConfig,
      theme: localTheme,
      tips: ['新的提示1', '新的提示2'],
    };
    
    // 更新配置，自动同步到所有窗口
    await setConfig(updatedConfig);
    console.log('配置已保存并同步');
  };

  if (!config) {
    return <div>加载配置中...</div>;
  }

  return (
    <div>
      <h2>设置</h2>
      <select value={localTheme} onChange={(e) => setLocalTheme(e.target.value as any)}>
        <option value="light">浅色</option>
        <option value="dark">深色</option>
      </select>
      <button onClick={handleSave}>保存设置</button>
    </div>
  );
}
```

### 5. 监听状态变化（可选）

```typescript
// src/components/ConfigWatcher.tsx
import { useEffect } from 'react';
import { onConfigChange } from '@/store/appStore';

function ConfigWatcher() {
  useEffect(() => {
    // 监听配置变化
    const unsubscribe = onConfigChange((newConfig) => {
      console.log('配置已更新:', newConfig);
      // 可以在这里执行一些副作用，如更新系统托盘等
    });
    
    // 清理监听器
    return unsubscribe;
  }, []);
  
  return null; // 这是一个纯逻辑组件
}
```

## 🪟 窗口事件管理

`tauri-mw-store` 还提供了声明式的窗口事件管理功能，在应用入口处配置：

```typescript
// src/main.tsx
import { defineWindowEvents, window } from 'tauri-mw-store';
import { initAppStore } from './store/appStore';
import VersionUpdateUtils from '@/utils/version-update';
import { EventKey } from './types';

// 先初始化 store
await initAppStore();

// 然后配置窗口事件
await defineWindowEvents({
  // 主窗口配置
  main: window({
    onInit: () => {
      const updater = new VersionUpdateUtils();
      return { updater }; // 返回共享上下文，供事件处理器使用
    },
    listeners: {
      // 完整的类型提示：({ updater }: { updater: VersionUpdateUtils }) => void
      [EventKey.CHECK_UPDATE]: ({ updater }) => updater.checkForUpdates(),
      [EventKey.INSTALL_REQUEST]: ({ updater }) => updater.askAndInstall(),
    },
  }),
  
  // 设置窗口配置
  settings: window({
    onInit: () => {
      console.log('✅ 设置窗口初始化完成');
    },
    emitOnInit: [EventKey.CHECK_UPDATE], // 初始化时触发检查更新
  }),
});
```

**事件类型定义：**

```typescript
// src/types/index.ts
export enum EventKey {
  CHECK_UPDATE = 'check-update',
  INSTALL_REQUEST = 'install-request',
}
```

## 📚 API 参考

### createMWStore(schema)

创建一个基于 schema 的多窗口 store。

**参数：**
- `schema`: Store schema 对象

**返回：** Store API 对象，包含以下方法：

#### Store API 方法

- `initAppStore()`: 初始化 store，加载持久化数据
- `getXxx()`: 获取状态值
- `setXxx(value, emitToWindows?)`: 设置状态值
- `useXxx(options?)`: React hook，获取状态并监听变化
- `onXxxChange(callback)`: 监听状态变化

### storeConfig(config)

创建 store 配置对象的辅助函数。

**参数：**
```typescript
{
  default: T;           // 默认值
  persist?: boolean | { // 持久化配置
    saveStrategy?: 'immediate' | 'onClose'; // 保存策略
  };
}
```

### useStoreState(key, options?)

底层 React hook，通常不需要直接使用。

**参数：**
- `key`: 状态键名
- `options.syncOnMount`: 窗口创建时是否从其他窗口同步当前状态（默认 true）
  - `true`: 窗口创建时会从其他窗口获取最新状态值
  - `false`: 窗口创建时使用默认值，不从其他窗口同步

### defineWindowEvents(config)

定义窗口事件配置。

**参数：**
- `config`: 窗口事件配置对象

**返回：** 控制器对象，包含 `dispose()` 方法用于清理

### window(config)

创建窗口配置的辅助函数，提供类型安全。

## 🔧 高级用法

### 自定义持久化策略

```typescript
// src/store/appStore.ts
export const {
  initAppStore,
  getConfig,
  setConfig,
  useConfig,
  getUserSession,
  setUserSession,
  useUserSession,
  getTempData,
  setTempData,
  useTempData,
} = createMWStore({
  // 立即保存：每次状态变化都立即持久化（适合重要配置）
  config: storeConfig({
    default: null as AppConfig | null,
    persist: { saveStrategy: 'immediate' }
  }),
  
  // 延迟保存：窗口关闭时才持久化（默认策略，适合用户偏好）
  userSession: storeConfig({
    default: { isLoggedIn: false, username: '' },
    persist: true // 等同于 { saveStrategy: 'onClose' }
  }),
  
  // 不持久化：仅在内存中（适合临时状态）
  tempData: { message: '', timestamp: Date.now() }
});
```

### 条件同步和窗口特定操作

```typescript
// src/components/LocalSettings.tsx
import { useConfig, setConfig } from '@/store/appStore';

function LocalSettings() {
  // syncOnMount: false - 窗口创建时不从其他窗口同步状态，使用默认值
  // 适用于需要独立配置或临时设置的场景
  const config = useConfig({ syncOnMount: false });
  
  const saveAndSync = async () => {
    // 手动同步到所有窗口
    await setConfig(newConfig, "all");
  };
  
  const saveToSpecificWindow = async () => {
    // 只同步到特定窗口
    await setConfig(newConfig, ["settings", "main"]);
  };
  
  return (
    <div>
      {/* 本地配置界面 */}
      <button onClick={saveAndSync}>保存并同步到所有窗口</button>
      <button onClick={saveToSpecificWindow}>保存到指定窗口</button>
    </div>
  );
}
```

### 获取所有存储的键

```typescript
import { getAllStoredKeys } from 'tauri-mw-store';

// 调试：查看所有持久化的键
const keys = await getAllStoredKeys();
console.log('Stored keys:', keys);
```

## 📖 实际项目示例

以下是 [FloatingOne](https://github.com/Huaguang-XinZhe/FloatingOne) 项目中的实际使用案例：

### 项目结构

```
src/
├── types/
│   └── index.ts          # 类型定义
├── store/
│   └── appStore.ts       # Store 配置
├── pages/
│   └── settings.tsx      # 设置页面
└── main.tsx              # 应用入口
```

### 完整的使用流程

1. **定义应用配置类型**（`src/types/index.ts`）
2. **创建 Store**（`src/store/appStore.ts`）
3. **在入口初始化**（`src/main.tsx`）
4. **在组件中使用**（`src/pages/settings.tsx`）

这种模式特别适合需要在多个窗口间同步配置的桌面应用，如设置窗口、主窗口等。

## 🛠️ 开发

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Huaguang-XinZhe/tauri-mw-store.git
cd tauri-mw-store

# 安装依赖
bun install

# 构建库
bun run build

# 在你的 Tauri 项目中测试
cd /path/to/your-tauri-app
bun add file:../tauri-mw-store
```

### 发布新版本

```bash
# 发布补丁版本（bug 修复）
bun run release:patch

# 发布次要版本（新功能）
bun run release:minor

# 发布主要版本（破坏性更改）
bun run release:major
```

详细的发布流程请参考 [RELEASE.md](RELEASE.md)。

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如果你觉得这个项目有用，请给它一个 ⭐️！

---

**作者：** huaguang <2475096613@qq.com>  
**仓库：** https://github.com/Huaguang-XinZhe/tauri-mw-store