#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { exit } from 'process';

// 颜色输出函数
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
};

// 执行命令并显示输出
function runCommand(command, description) {
  try {
    console.log(colors.blue(`\n📦 ${description}...`));
    console.log(colors.cyan(`执行命令: ${command}`));
    
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'inherit' 
    });
    
    console.log(colors.green(`✅ ${description} 完成`));
    return output;
  } catch (error) {
    console.error(colors.red(`❌ ${description} 失败:`));
    console.error(colors.red(error.message));
    exit(1);
  }
}

// 版本类型
const VERSION_TYPES = {
  patch: 'patch',
  minor: 'minor', 
  major: 'major'
};

// 增加版本号
function bumpVersion(type = 'patch') {
  console.log(colors.blue('\n🔢 更新版本号...'));
  
  // 读取当前 package.json
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const currentVersion = packageJson.version;
  
  console.log(colors.cyan(`当前版本: ${currentVersion}`));
  
  // 解析版本号
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  console.log(colors.green(`新版本: ${newVersion}`));
  
  // 更新 package.json
  packageJson.version = newVersion;
  writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(colors.green('✅ 版本号更新完成'));
  return newVersion;
}

// 主函数
async function main() {
  console.log(colors.blue('🚀 开始发布流程...\n'));
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  
  // 验证版本类型
  if (!Object.keys(VERSION_TYPES).includes(versionType)) {
    console.error(colors.red(`❌ 无效的版本类型: ${versionType}`));
    console.log(colors.yellow('支持的版本类型: patch, minor, major'));
    exit(1);
  }
  
  try {
    // 1. 检查是否有未提交的更改
    console.log(colors.blue('📋 检查 Git 状态...'));
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (gitStatus.trim()) {
        console.log(colors.yellow('⚠️  检测到未提交的更改:'));
        console.log(gitStatus);
        console.log(colors.yellow('建议先提交所有更改后再发布'));
        
        // 询问是否继续
        const readline = await import('readline/promises');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await rl.question(colors.yellow('是否继续发布? (y/N): '));
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(colors.red('❌ 发布已取消'));
          exit(1);
        }
      }
    } catch (error) {
      console.log(colors.yellow('⚠️  无法检查 Git 状态，可能不在 Git 仓库中'));
    }
    
    // 2. 更新版本号
    const newVersion = bumpVersion(versionType);
    
    // 3. 清理旧的构建文件
    runCommand('bun run clean', '清理旧的构建文件');
    
    // 4. 构建项目
    runCommand('bun run build', '构建项目');
    
    // 5. 跳过测试（项目暂无测试）
    console.log(colors.blue('⏭️  跳过测试阶段'));
    
    // 6. 发布到 npm
    console.log(colors.blue('\n📤 发布到 npm...'));
    console.log(colors.cyan('执行命令: npm publish'));
    
    try {
      execSync('npm publish', { 
        encoding: 'utf8', 
        stdio: 'inherit' 
      });
      console.log(colors.green('✅ 发布完成'));
    } catch (error) {
      console.error(colors.red('❌ 发布失败:'));
      console.error(colors.red(error.message));
      exit(1);
    }
    
    // 7. Git 操作（如果在 Git 仓库中）
    try {
      // 添加所有更改（包括发布脚本、构建产物等）
      runCommand(`git add .`, '添加所有更改到 Git');
      runCommand(`git commit -m "chore: release v${newVersion}`, '提交发布更改');
      runCommand(`git tag v${newVersion}`, '创建 Git 标签');
      
      // 获取当前分支名
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      runCommand(`git push origin ${currentBranch}`, `推送到远程仓库 (${currentBranch})`);
      runCommand(`git push origin v${newVersion}`, '推送标签到远程仓库');
    } catch (error) {
      console.log(colors.yellow('⚠️  Git 操作失败，可能需要手动处理'));
      console.log(colors.cyan('可以手动执行以下命令：'));
      console.log(colors.cyan(`git add .`));
      console.log(colors.cyan(`git commit -m "chore: release v${newVersion}"`));
      console.log(colors.cyan(`git tag v${newVersion}`));
      console.log(colors.cyan(`git push origin main && git push origin v${newVersion}`));
    }
    
    console.log(colors.green(`\n🎉 发布成功！`));
    console.log(colors.green(`📦 包名: tauri-mw-store`));
    console.log(colors.green(`🔢 版本: ${newVersion}`));
    console.log(colors.green(`🌐 npm: https://www.npmjs.com/package/tauri-mw-store`));
    
  } catch (error) {
    console.error(colors.red('\n❌ 发布过程中出现错误:'));
    console.error(colors.red(error.message));
    exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error(colors.red('发布脚本执行失败:'));
  console.error(colors.red(error.message));
  exit(1);
});
