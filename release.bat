@echo off
setlocal enabledelayedexpansion

echo 🚀 开始发布流程...
echo.

:: 设置版本类型，默认为 patch
set "VERSION_TYPE=%~1"
if "%VERSION_TYPE%"=="" set "VERSION_TYPE=patch"

:: 验证版本类型
if not "%VERSION_TYPE%"=="patch" if not "%VERSION_TYPE%"=="minor" if not "%VERSION_TYPE%"=="major" (
    echo ❌ 无效的版本类型: %VERSION_TYPE%
    echo 支持的版本类型: patch, minor, major
    exit /b 1
)

echo 📋 检查项目状态...

:: 检查是否存在 package.json
if not exist "package.json" (
    echo ❌ 未找到 package.json 文件
    exit /b 1
)

:: 使用 Node.js 更新版本号
echo 🔢 更新版本号 ^(%VERSION_TYPE%^)...
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

let newVersion;
switch('%VERSION_TYPE%') {
    case 'major': newVersion = `${major + 1}.0.0`; break;
    case 'minor': newVersion = `${major}.${minor + 1}.0`; break;
    case 'patch': 
    default: newVersion = `${major}.${minor}.${patch + 1}`; break;
}

console.log('当前版本:', pkg.version);
console.log('新版本:', newVersion);

pkg.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ 版本号更新完成');
"

if %errorlevel% neq 0 (
    echo ❌ 版本号更新失败
    exit /b 1
)

:: 清理旧的构建文件
echo.
echo 📦 清理旧的构建文件...
call bun run clean
if %errorlevel% neq 0 (
    echo ❌ 清理失败
    exit /b 1
)

:: 构建项目
echo.
echo 🔨 构建项目...
call bun run build
if %errorlevel% neq 0 (
    echo ❌ 构建失败
    exit /b 1
)

:: 发布到 npm
echo.
echo 📤 发布到 npm...
call npm publish
if %errorlevel% neq 0 (
    echo ❌ 发布失败
    exit /b 1
)

:: 获取新版本号用于 Git 操作
for /f "tokens=*" %%i in ('node -p "JSON.parse(require('fs').readFileSync('package.json')).version"') do set NEW_VERSION=%%i

:: Git 操作（可选）
echo.
echo 📝 Git 操作...
git add . 2>nul
git commit -m "chore: release v%NEW_VERSION%" 2>nul
git tag v%NEW_VERSION% 2>nul

:: 获取当前分支名
for /f "tokens=*" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" set CURRENT_BRANCH=main

git push origin %CURRENT_BRANCH% 2>nul
git push origin v%NEW_VERSION% 2>nul

if %errorlevel% neq 0 (
    echo ⚠️  Git 操作可能失败，请手动检查
    echo 可以手动执行：git add . ^&^& git commit -m "chore: release v%NEW_VERSION%" ^&^& git tag v%NEW_VERSION%
)

echo.
echo 🎉 发布成功！
echo 📦 包名: tauri-mw-store
echo 🔢 版本: %NEW_VERSION%
echo 🌐 npm: https://www.npmjs.com/package/tauri-mw-store

pause
