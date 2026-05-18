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
import { loadConfig } from './config-loader.js';
import { loadRegistry, scanAndGenerateRegistry } from './registry.js';
import { GatewayServer } from './gateway-server.js';
import { setLogLevel, createLogger } from './logger.js';
import { assertDistFresh } from './runtime-guard.js';
import { ensureUserDataDir, getGatewayPaths, getPackageRoot } from './paths.js';

// 在 process.chdir 覆蓋前，先擷取 IDE 注入的原始專案目錄
const IDE_WORKSPACE_ENVS = ['INIT_CWD', 'VSCODE_CWD', 'WORKSPACE_ROOT'] as const;
const detectedWorkspace: string | null =
  IDE_WORKSPACE_ENVS.map((k) => process.env[k] ?? '').find(Boolean) ?? null;

// 自動定位專案根目錄（腳本在 dist/ 或 src/ 下，往上一層即為專案根）
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = getPackageRoot();

const logger = createLogger('main');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command === 'console') {
    ensureUserDataDir();
    await import('./cli.js');
    return;
  }

  const isScanMode = args.includes('--scan');
  const configPath = args.find((a) => a.startsWith('--config='))?.split('=')[1];
  const cliWorkspace = args.find((a) => a.startsWith('--workspace='))?.split('=').slice(1).join('=') ?? null;
  // CLI 參數優先於環境變數偵測
  const initWorkspace = cliWorkspace ?? detectedWorkspace;
  const paths = ensureUserDataDir(getGatewayPaths());
  process.chdir(paths.dataDir);

  try {
    // 載入設定（含 gateway.env 認證檔案）
    const config = loadConfig(configPath ?? paths.configPath);
    setLogLevel(config.gateway.log_level);

    if (isScanMode) {
      // === 掃描模式 ===
      logger.info('=== Multi-MCP Gateway: 掃描模式 ===');
      const registry = await scanAndGenerateRegistry(config, paths.registryPath);
      const totalTools = Object.keys(registry.all_tools).length;
      logger.info(`掃描完成: ${totalTools} 個工具已註冊到集成表`);
      process.exit(0);
    } else {
      // === 伺服器模式 ===
      assertDistFresh({ entryFile: __filename, projectRoot: PROJECT_ROOT });
      logger.info('=== Multi-MCP Gateway: 伺服器模式 ===');
      const registry = loadRegistry(paths.registryPath);
      const server = new GatewayServer(config, registry, initWorkspace);
      if (initWorkspace) {
        logger.info('工作目錄已自動偵測', { workspace: initWorkspace, source: cliWorkspace ? 'cli-arg' : 'env-var' });
      }
      await server.start();
    }
  } catch (err) {
    logger.error('致命錯誤', { error: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  }
}

main();
