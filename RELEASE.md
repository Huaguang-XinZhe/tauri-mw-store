# 发布脚本使用说明

本项目包含多种发布脚本，用于自动化版本管理、构建和发布流程。

## 脚本文件

- `release.js` - Node.js 版本（推荐）
- `release.ps1` - PowerShell 版本
- `release.bat` - Windows 批处理版本

## 功能特性

✅ **自动版本管理** - 支持 patch、minor、major 版本升级  
✅ **构建项目** - 使用 bun 进行清理和构建  
✅ **发布到 npm** - 自动发布到 npm 仓库  
✅ **Git 集成** - 自动提交版本更改并创建标签  
✅ **安全检查** - 检查未提交的更改  
✅ **彩色输出** - 友好的命令行界面

## 使用方法

### 方法一：使用 npm scripts（推荐）

```bash
# Patch 版本升级 (2.0.1 -> 2.0.2)
bun run release:patch

# Minor 版本升级 (2.0.1 -> 2.1.0)
bun run release:minor

# Major 版本升级 (2.0.1 -> 3.0.0)
bun run release:major

# 默认 patch 升级
bun run release
```

### 方法二：直接运行脚本

```bash
# Node.js 版本
node release.js patch
node release.js minor
node release.js major

# PowerShell 版本 (Windows)
.\release.ps1 patch
.\release.ps1 minor
.\release.ps1 major

# 批处理版本 (Windows)
release.bat patch
release.bat minor
release.bat major
```

## 版本类型说明

| 类型      | 说明         | 示例          |
| --------- | ------------ | ------------- |
| **patch** | 修复补丁版本 | 2.0.1 → 2.0.2 |
| **minor** | 次要功能版本 | 2.0.1 → 2.1.0 |
| **major** | 主要版本更新 | 2.0.1 → 3.0.0 |

## 发布流程

1. 🔍 **检查 Git 状态** - 检测未提交的更改
2. 🔢 **更新版本号** - 自动递增版本号并更新 package.json
3. 🧹 **清理构建** - 删除旧的 dist 目录
4. 🔨 **构建项目** - 使用 tsup 构建项目
5. 📤 **发布到 npm** - 发布到 npm 仓库
6. 📝 **Git 操作** - 提交所有更改（包括构建产物、发布脚本等）、创建标签、推送到远程

## 注意事项

### 发布前准备

- ✅ 确保已登录 npm 账户：`npm login`
- ✅ 确保具有包的发布权限
- ✅ 提交所有代码更改（脚本会检查）
- ✅ 确保项目能正常构建

### 环境要求

- Node.js 16+
- bun（用于构建）
- Git（用于版本控制）
- npm（用于发布）

### Git 提交策略

发布脚本会自动提交以下内容：

- ✅ 版本号更新（`package.json`）
- ✅ 构建产物（`dist/` 目录）
- ✅ 发布脚本本身（如果是首次添加）
- ✅ 其他待提交的更改

### 手动回滚

如果发布出现问题，可以手动回滚：

```bash
# 回滚版本号
git reset --hard HEAD~1

# 删除标签
git tag -d v版本号
git push origin :refs/tags/v版本号

# 取消发布 (24小时内)
npm unpublish tauri-mw-store@版本号
```

## 故障排除

### 常见问题

1. **npm 发布失败**

   - 检查是否已登录：`npm whoami`
   - 检查包名是否冲突
   - 检查网络连接

2. **Git 操作失败**

   - 检查是否有 Git 远程仓库
   - 检查是否有推送权限
   - 手动执行 Git 命令

3. **构建失败**
   - 检查 TypeScript 编译错误
   - 确保所有依赖已安装：`bun install`

### 调试模式

如需查看详细的执行过程，可以直接运行脚本查看输出信息。

## 自定义配置

可以修改 `package.json` 中的 scripts 部分来调整发布行为：

```json
{
  "scripts": {
    "release": "node release.js",
    "release:patch": "node release.js patch",
    "release:minor": "node release.js minor",
    "release:major": "node release.js major",
    "prepublishOnly": "bun run clean && bun run build"
  }
}
```

`prepublishOnly` 钩子确保每次发布前都会自动清理和构建，提供额外的安全保障。
