# tauri-mw-store

[![npm version](https://badge.fury.io/js/tauri-mw-store.svg?icon=si%3Anpm)](https://badge.fury.io/js/tauri-mw-store)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> English Documentation | [中文文档](./README.md)

🚀 **Declarative global state management + persistent store + window initialization config, built for Tauri multi-window apps.**

A declarative state management library designed specifically for Tauri applications, providing type-safe global state, automatic persistence, and declarative window event configuration.

## ✨ Features

- 🎯 **Schema-driven**: Define your entire store structure upfront with full TypeScript support
- 🔄 **Multi-window sync**: Automatic state synchronization across all application windows
- 💾 **Smart persistence**: Flexible persistence strategies (immediate save, save on close, or memory-only)
- 🪝 **React hooks**: Clean, intuitive hooks for seamless React integration
- 🎪 **Window events**: Declarative window event management with type safety
- 🛡️ **Type safety**: Full TypeScript support with automatic type inference
- ⚡ **Zero config**: Works out of the box with sensible defaults
- 🧹 **Auto cleanup**: Automatically removes orphaned persistent keys

## 📦 Installation

```bash
npm install tauri-mw-store
# or
yarn add tauri-mw-store
# or
bun add tauri-mw-store
```

### Tauri Configuration

**Only required if your Store Schema includes persistent keys:**

1. Install the store plugin:

```bash
bun tauri add store
```

2. Add permissions to `src-tauri/capabilities/default.json`:

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

**Important Notes:**
- The `windows` array must include all window identifiers that use the store
- If your window URL path uses kebab-case (e.g., `user-profile`), you must use camelCase in permissions (e.g., `userProfile`) to avoid errors

**Note:** If your app only uses in-memory state (no persistence), you can skip installing the Tauri Store plugin and configuring permissions.

## 🚀 Quick Start

### 1. Define Your Types (Optional)

```typescript
// src/types/index.ts
export interface AppConfig {
  theme: 'light' | 'dark';
  autoStart: boolean;
  language: string;
}

export enum EventKey {
  CONFIG_UPDATED = 'config-updated',
  USER_ACTION = 'user-action'
}
```

### 2. Create Your Store

```typescript
// src/store/appStore.ts
import { createMWStore, storeConfig } from 'tauri-mw-store';
import type { AppConfig } from '@/types';

export const {
  initAppStore,
  getConfig,
  setConfig,
  useConfig,
  onConfigChange,
  getNewVersionDownloaded,
  setNewVersionDownloaded,
  useNewVersionDownloaded,
} = createMWStore({
  config: storeConfig({
    default: {
      theme: 'light',
      autoStart: false,
      language: 'en'
    } as AppConfig,
    persist: true // Enables persistence with default 'onClose' strategy
  }),
  
  newVersionDownloaded: storeConfig({
    default: false,
    // No persist option = memory-only state
  })
});
```

### 3. Initialize Your Store

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initAppStore } from '@/store/appStore';
import App from './App';

// Initialize store before rendering
initAppStore().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

### 4. Use in Components

```typescript
// src/components/Settings.tsx
import React from 'react';
import { useConfig, setConfig, onConfigChange } from '@/store/appStore';

function Settings() {
  const config = useConfig();
  
  const handleThemeChange = async (theme: 'light' | 'dark') => {
    if (!config) return;
    
    // Update config and sync to all windows
    await setConfig({ ...config, theme });
  };
  
  // Listen for config changes from other windows
  React.useEffect(() => {
    const unsubscribe = onConfigChange((newConfig) => {
      console.log('Config updated from another window:', newConfig);
    });
    
    return unsubscribe;
  }, []);
  
  if (!config) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Settings</h2>
      <button onClick={() => handleThemeChange('light')}>
        Light Theme
      </button>
      <button onClick={() => handleThemeChange('dark')}>
        Dark Theme
      </button>
      <p>Current theme: {config.theme}</p>
    </div>
  );
}
```

### 5. Listen for State Changes (Optional)

```typescript
// src/components/ConfigListener.tsx
import React from 'react';
import { onConfigChange } from '@/store/appStore';

function ConfigListener() {
  React.useEffect(() => {
    const unsubscribe = onConfigChange((config) => {
      console.log('Config changed:', config);
      // Handle config changes (e.g., update UI theme)
    });
    
    return unsubscribe;
  }, []);
  
  return null;
}
```

## 🎪 Window Event Management

```typescript
// src/main.tsx
import { defineWindowEvents, window } from 'tauri-mw-store';
import { EventKey } from '@/types';
import { initAppStore, setNewVersionDownloaded } from '@/store/appStore';

// Initialize store first
initAppStore().then(() => {
  // Define window events
  defineWindowEvents({
    main: window({
      [EventKey.CONFIG_UPDATED]: (data) => {
        console.log('Main window received config update:', data);
      },
      'version-update-available': async (data) => {
        console.log('New version available:', data);
        await setNewVersionDownloaded(true);
      }
    }),
    
    settings: window({
      [EventKey.USER_ACTION]: (data) => {
        console.log('Settings window received user action:', data);
      },
      'install-update': () => {
        console.log('Installing update...');
      }
    })
  });
  
  // Render app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

## 📚 API Reference

### createMWStore(schema)

Creates a multi-window store with the specified schema.

**Parameters:**
- `schema`: Store schema object defining keys and their configurations

**Returns:** Object containing getter, setter, and hook functions for each key

### storeConfig(options)

Defines configuration for a store key.

**Parameters:**
- `options.default`: Default value for the key
- `options.persist`: Persistence configuration
  - `true`: Enable persistence with 'onClose' strategy
  - `false`: Disable persistence (memory-only)
  - `{ saveStrategy: 'immediate' | 'onClose' }`: Custom persistence strategy

### useStoreState(key, options?)

Low-level React hook, typically not used directly.

**Parameters:**
- `key`: State key name
- `options.syncOnMount`: Whether to sync current state from other windows when component mounts (default: true)
  - `true`: Component will fetch latest state value from other windows on mount
  - `false`: Component will use default value on mount, no sync from other windows

### defineWindowEvents(config)

Defines window event configuration.

**Parameters:**
- `config`: Window event configuration object

**Returns:** Controller object with `dispose()` method for cleanup

### window(config)

Helper function for creating window configurations with type safety.

## 🔧 Advanced Usage

### Custom Persistence Strategies

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
  // Immediate save: Persist immediately on every state change (for critical config)
  config: storeConfig({
    default: null as AppConfig | null,
    persist: { saveStrategy: 'immediate' }
  }),
  
  // Delayed save: Persist only when window closes (default strategy, for user preferences)
  userSession: storeConfig({
    default: { isLoggedIn: false, username: '' },
    persist: true // equivalent to { saveStrategy: 'onClose' }
  }),
  
  // No persistence: Memory-only (for temporary state)
  tempData: { message: '', timestamp: Date.now() }
});
```

### Conditional Sync and Window-Specific Operations

```typescript
// src/components/LocalSettings.tsx
import { useConfig, setConfig } from '@/store/appStore';

function LocalSettings() {
  // syncOnMount: false - Use default value on mount, don't sync from other windows
  // Useful for independent configurations or temporary settings
  const config = useConfig({ syncOnMount: false });
  
  const saveAndSync = async () => {
    // Manually sync to all windows
    await setConfig(newConfig, "all");
  };
  
  const saveToSpecificWindow = async () => {
    // Sync only to specific windows
    await setConfig(newConfig, ["settings", "main"]);
  };
  
  return (
    <div>
      {/* Local configuration interface */}
      <button onClick={saveAndSync}>Save & Sync to All Windows</button>
      <button onClick={saveToSpecificWindow}>Save to Specific Windows</button>
    </div>
  );
}
```

### Get All Stored Keys

```typescript
import { getAllStoredKeys } from 'tauri-mw-store';

// Debug: View all persisted keys
const keys = await getAllStoredKeys();
console.log('Stored keys:', keys);
```

## 📖 Real-World Example

Here's how [FloatingOne](https://github.com/Huaguang-XinZhe/FloatingOne) uses this library:

### Project Structure

```
src/
├── types/
│   └── index.ts          # Type definitions
├── store/
│   └── appStore.ts       # Store configuration
├── pages/
│   └── settings.tsx      # Settings page
└── main.tsx              # App entry point
```

### Complete Usage Flow

1. **Define app config types** (`src/types/index.ts`)
2. **Create store** (`src/store/appStore.ts`)
3. **Initialize at entry point** (`src/main.tsx`)
4. **Use in components** (`src/pages/settings.tsx`)

This pattern works particularly well for desktop apps that need to sync configuration across multiple windows, such as settings windows, main windows, etc.

## 🛠️ Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/Huaguang-XinZhe/tauri-mw-store.git
cd tauri-mw-store

# Install dependencies
bun install

# Build the library
bun run build

# Test in your Tauri project
cd /path/to/your-tauri-app
bun add file:../tauri-mw-store
```

### Publishing New Versions

```bash
# Publish patch version (bug fixes)
bun run release:patch

# Publish minor version (new features)
bun run release:minor

# Publish major version (breaking changes)
bun run release:major
```

For detailed release process, see [RELEASE.md](RELEASE.md).

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📞 Support

If you find this project useful, please give it a ⭐️!

---

**Author:** huaguang <2475096613@qq.com>  
**Repository:** https://github.com/Huaguang-XinZhe/tauri-mw-store