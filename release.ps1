# PowerShell 发布脚本
param(
    [Parameter(Position = 0)]
    [ValidateSet("patch", "minor", "major")]
    [string]$VersionType = "patch"
)

# 颜色输出函数
function Write-ColorOutput {
    param([string]$Text, [string]$Color = "White")
    
    switch ($Color) {
        "Red" { Write-Host $Text -ForegroundColor Red }
        "Green" { Write-Host $Text -ForegroundColor Green }
        "Yellow" { Write-Host $Text -ForegroundColor Yellow }
        "Blue" { Write-Host $Text -ForegroundColor Blue }
        "Cyan" { Write-Host $Text -ForegroundColor Cyan }
        default { Write-Host $Text }
    }
}

# 执行命令并检查结果
function Invoke-SafeCommand {
    param([string]$Command, [string]$Description)
    
    Write-ColorOutput "`n📦 $Description..." "Blue"
    Write-ColorOutput "执行命令: $Command" "Cyan"
    
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "命令执行失败，退出码: $LASTEXITCODE"
        }
        Write-ColorOutput "✅ $Description 完成" "Green"
    }
    catch {
        Write-ColorOutput "❌ $Description 失败: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# 更新版本号
function Update-Version {
    param([string]$Type)
    
    Write-ColorOutput "`n🔢 更新版本号..." "Blue"
    
    # 读取当前 package.json
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $currentVersion = $packageJson.version
    
    Write-ColorOutput "当前版本: $currentVersion" "Cyan"
    
    # 解析版本号
    $versionParts = $currentVersion.Split('.')
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1] 
    $patch = [int]$versionParts[2]
    
    # 计算新版本号
    switch ($Type) {
        "major" { $newVersion = "$($major + 1).0.0" }
        "minor" { $newVersion = "$major.$($minor + 1).0" }
        "patch" { $newVersion = "$major.$minor.$($patch + 1)" }
        default { $newVersion = "$major.$minor.$($patch + 1)" }
    }
    
    Write-ColorOutput "新版本: $newVersion" "Green"
    
    # 更新 package.json
    $packageJson.version = $newVersion
    $packageJson | ConvertTo-Json -Depth 32 | Set-Content "package.json" -Encoding UTF8
    
    Write-ColorOutput "✅ 版本号更新完成" "Green"
    return $newVersion
}

# 主执行流程
try {
    Write-ColorOutput "🚀 开始发布流程...`n" "Blue"
    
    # 1. 检查 Git 状态
    Write-ColorOutput "📋 检查 Git 状态..." "Blue"
    try {
        $gitStatus = git status --porcelain 2>$null
        if ($gitStatus) {
            Write-ColorOutput "⚠️  检测到未提交的更改:" "Yellow"
            Write-Output $gitStatus
            Write-ColorOutput "建议先提交所有更改后再发布" "Yellow"
            
            $continue = Read-Host "是否继续发布? (y/N)"
            if ($continue -notin @("y", "Y", "yes", "Yes")) {
                Write-ColorOutput "❌ 发布已取消" "Red"
                exit 1
            }
        }
    }
    catch {
        Write-ColorOutput "⚠️  无法检查 Git 状态，可能不在 Git 仓库中" "Yellow"
    }
    
    # 2. 更新版本号
    $newVersion = Update-Version $VersionType
    
    # 3. 清理旧的构建文件
    Invoke-SafeCommand "bun run clean" "清理旧的构建文件"
    
    # 4. 构建项目
    Invoke-SafeCommand "bun run build" "构建项目"
    
    # 5. 跳过测试（项目暂无测试）
    Write-ColorOutput "⏭️  跳过测试阶段" "Blue"
    
    # 6. 发布到 npm
    Write-ColorOutput "`n📤 发布到 npm..." "Blue"
    Write-ColorOutput "执行命令: npm publish" "Cyan"
    
    try {
        npm publish
        if ($LASTEXITCODE -ne 0) {
            throw "npm publish 失败"
        }
        Write-ColorOutput "✅ 发布完成" "Green"
    }
    catch {
        Write-ColorOutput "❌ 发布失败: $($_.Exception.Message)" "Red"
        exit 1
    }
    
    # 7. Git 操作（如果在 Git 仓库中）
    try {
        # 添加所有更改（包括发布脚本、构建产物等）
        Invoke-SafeCommand "git add ." "添加所有更改到 Git"
        Invoke-SafeCommand "git commit -m `"chore: release v$newVersion`"" "提交发布更改"
        Invoke-SafeCommand "git tag v$newVersion" "创建 Git 标签"
        
        # 获取当前分支名
        $currentBranch = (git branch --show-current).Trim()
        Invoke-SafeCommand "git push origin $currentBranch" "推送到远程仓库 ($currentBranch)"
        Invoke-SafeCommand "git push origin v$newVersion" "推送标签到远程仓库"
    }
    catch {
        Write-ColorOutput "⚠️  Git 操作失败，可能需要手动处理" "Yellow"
        Write-ColorOutput "可以手动执行以下命令：" "Cyan"
        Write-ColorOutput "git add ." "Cyan"
        Write-ColorOutput "git commit -m `"chore: release v$newVersion`"" "Cyan" 
        Write-ColorOutput "git tag v$newVersion" "Cyan"
        Write-ColorOutput "git push origin main && git push origin v$newVersion" "Cyan"
    }
    
    # 发布成功
    Write-ColorOutput "`n🎉 发布成功！" "Green"
    Write-ColorOutput "📦 包名: tauri-mw-store" "Green"
    Write-ColorOutput "🔢 版本: $newVersion" "Green"
    Write-ColorOutput "🌐 npm: https://www.npmjs.com/package/tauri-mw-store" "Green"
}
catch {
    Write-ColorOutput "`n❌ 发布过程中出现错误: $($_.Exception.Message)" "Red"
    exit 1
}
