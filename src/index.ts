#!/usr/bin/env node
/**
 * Multi-MCP Gateway — 進入點
 * 支援兩種模式：serve（啟動閘道器）和 scan（掃描生成集成表）
 */

// Windows 修正：PowerShell 7 會將 COMSPEC / SHELL 設為 pwsh.exe，
// 導致 cross-spawn 用 cmd.exe 語法 (/d /s /c) 呼叫 pwsh.exe 而失敗。
// 同時清除 SHELL，防止路徑含空格（Program Files）造成 spawn 失敗。
if (process.platform === 'win32') {
  process.env.COMSPEC = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\cmd.exe`
    : 'C:\\Windows\\System32\\cmd.exe';
  delete process.env.SHELL;
}
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveSessionPaths } from './session-paths.js';
import { loadConfig } from './config-loader.js';
import { loadRegistry, scanAndGenerateRegistry } from './registry.js';
import { GatewayServer } from './gateway-server.js';
import { setLogLevel, createLogger } from './logger.js';
import { assertDistFresh } from './runtime-guard.js';
import { ensureUserDataDir, getPackageRoot } from './paths.js';

// 自動定位專案根目錄（腳本在 dist/ 或 src/ 下，往上一層即為專案根）
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = getPackageRoot();

const logger = createLogger('main');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(readPackageVersion());
    return;
  }

  if (command === 'console') {
    console.log([
      'Multi-MCP Gateway 的互動式 CLI 選單已停用。',
      '請改用 Multi-MCP Manager VS Code 延伸模組管理安裝、移除、更新、掃描與認證。',
      'Gateway server 仍可用 npx -y multi-mcp-gateway@latest 作為 MCP runtime 啟動。',
    ].join('\n'));
    return;
  }

  const isScanMode = args.includes('--scan');
  const explicitConfigArg = args.find((a) => a.startsWith('--config='));
  const paths = resolveSessionPaths(args, process.cwd());
  const disabledWorkspaceArg = args.find((a) => a.startsWith('--workspace='));
  if (!explicitConfigArg) ensureUserDataDir(paths);
  process.chdir(paths.dataDir);

  try {
    // 載入設定（含 gateway.env 認證檔案）
    const config = loadConfig(paths.configPath);
    setLogLevel(config.gateway.log_level);
    if (disabledWorkspaceArg) {
      logger.warn('--workspace 啟動參數已停用；請在每次 gateway__call_tool 呼叫中傳入 workspace，避免跨專案共用 Gateway 時誤用固定工作目錄。');
    }

    if (isScanMode) {
      // === 掃描模式 ===
      logger.info('=== Multi-MCP Gateway: 掃描模式 ===');
      const registry = await scanAndGenerateRegistry(config, paths.registryPath);
      const totalTools = Object.keys(registry.all_tools).length;
      const failed = Object.entries(registry.servers).filter(([, server]) => server.stale).map(([name]) => name);
      if (failed.length) {
        logger.error('部分掃描失敗，保留可用舊快取', { servers: failed, totalTools });
        process.exitCode = 1;
      } else {
        logger.info(`掃描完成: ${totalTools} 個工具已註冊到集成表`);
      }
      return;
    } else {
      // === 伺服器模式 ===
      assertDistFresh({ entryFile: __filename, projectRoot: PROJECT_ROOT });
      logger.info('=== Multi-MCP Gateway: 伺服器模式 ===');
      const registry = loadRegistry(paths.registryPath);
      const server = new GatewayServer(config, registry, { configPath: paths.configPath, registryPath: paths.registryPath });
      await server.start();
    }
  } catch (err) {
    logger.error('致命錯誤', { error: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  }
}

function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}

main();
