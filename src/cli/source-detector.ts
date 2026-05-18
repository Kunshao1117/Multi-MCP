/**
 * Multi-MCP Gateway CLI — 來源偵測與認證探測
 * 支援 GitHub URL、npm 套件名、遠端 MCP URL 三種來源格式辨識，
 * 以及試啟動 MCP 偵測所需環境變數。
 */
import { ask, DATA_DIR, type McpServerDef } from './shared.js';
import { createDownstreamEnv } from '../subprocess-env.js';

// ─── 試啟動認證偵測 ───

/** 常見的環境變數關鍵字後綴 */
const AUTH_SUFFIXES = ['TOKEN', 'KEY', 'SECRET', 'PASSWORD', 'CREDENTIAL', 'API_KEY', 'ACCESS_KEY'];
/** 排除的系統環境變數 */
const SYSTEM_VARS = new Set(['NODE_ENV', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'PWD', 'HOSTNAME', 'NODE_OPTIONS', 'NPM_CONFIG_CACHE']);

/** 從文字中擷取可能的環境變數名稱 */
export function extractEnvVarNames(text: string): string[] {
  const vars = new Set<string>();
  // 模式 1：包含認證關鍵字的大寫變數名
  const pattern1 = /\b([A-Z][A-Z0-9_]{2,})\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern1.exec(text)) !== null) {
    const name = match[1];
    if (SYSTEM_VARS.has(name)) continue;
    if (AUTH_SUFFIXES.some((s) => name.includes(s))) {
      vars.add(name);
    }
  }
  // 模式 2：${VAR_NAME} 格式的引用
  const pattern2 = /\$\{([A-Z][A-Z0-9_]+)\}/g;
  while ((match = pattern2.exec(text)) !== null) {
    if (!SYSTEM_VARS.has(match[1])) vars.add(match[1]);
  }
  return [...vars];
}

/**
 * 試啟動 MCP 伺服器，分析錯誤輸出以推斷所需環境變數
 * 啟動後等待 3 秒即自動終止
 */
export async function probeAuthRequirements(config: McpServerDef): Promise<string[]> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    let output = '';
    try {
      const child = spawn(config.command, config.args, {
        cwd: DATA_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: createDownstreamEnv(config.env ?? {}),
        shell: true,
      });
      child.stderr?.on('data', (data: Buffer) => { output += data.toString(); });
      child.stdout?.on('data', (data: Buffer) => { output += data.toString(); });
      child.on('error', () => resolve([]));
      // 3 秒後自動終止
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        resolve(extractEnvVarNames(output));
      }, 3000);
      // 如果過程提前結束（通常是因為缺少認證而報錯）
      child.on('exit', () => {
        clearTimeout(timer);
        resolve(extractEnvVarNames(output));
      });
    } catch {
      resolve([]);
    }
  });
}

// ─── 來源偵測 ───

/** 來源偵測結果 */
export interface DetectedSource {
  type: 'npm' | 'remote' | 'unknown';
  packageName?: string;
  remoteUrl?: string;
  suggestedName?: string;
}

/** 偵測 MCP 來源格式（GitHub URL / npm 套件名 / 遠端 MCP URL） */
export async function detectSource(input: string): Promise<DetectedSource> {
  // 遠端 MCP URL（https:// 開頭，非 GitHub）
  if (input.startsWith('https://') && !input.includes('github.com')) {
    const name = input.replace('https://', '').split('/')[0]
      .replace(/\.mcp\..*$/, '').replace(/\./g, '-');
    return { type: 'remote', remoteUrl: input, suggestedName: name };
  }
  // GitHub URL → 抓 package.json
  if (input.includes('github.com')) {
    console.log('  🔍 從 GitHub 取得套件資訊...');
    const match = input.match(/github\.com\/([^/]+)\/([^/\s#]+)/);
    if (!match) return { type: 'unknown' };
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/package.json`,
      );
      if (res.ok) {
        const pkg = (await res.json()) as { name?: string; workspaces?: unknown };
        if (pkg.name) {
          // Monorepo 偵測：若含 workspaces 欄位或套件名與 repo 名完全一致且不含 server 關鍵字
          const looksLikeMonorepo = !!pkg.workspaces
            || (pkg.name === `@${owner}/${cleanRepo}` && !cleanRepo.includes('server'));
          if (looksLikeMonorepo) {
            console.log(`\n  ⚠️ 偵測到 Monorepo（根套件: ${pkg.name}）`);
            console.log('  🔍 此倉庫可能包含多個子套件，根套件名可能不是你要安裝的。');
            console.log('  💡 建議直接輸入正確的 npm 套件名（如 @scope/server-xxx）\n');
            const manualPkg = await ask(`? 請確認套件名 [${pkg.name}]: `);
            const finalPkg = manualPkg || pkg.name;
            return {
              type: 'npm',
              packageName: finalPkg,
              suggestedName: finalPkg.split('/').pop()?.replace(/^(mcp-)?server-/, '') ?? cleanRepo,
            };
          }
          return {
            type: 'npm',
            packageName: pkg.name,
            suggestedName: cleanRepo.replace(/^mcp-server-/, ''),
          };
        }
      }
    } catch {
      /* 降級到用 repo 名 */
    }
    return { type: 'npm', packageName: cleanRepo, suggestedName: cleanRepo.replace(/^mcp-server-/, '') };
  }
  // npm 套件名
  if (input.startsWith('@') || (!input.includes('://') && !input.includes(' '))) {
    const suggested = input.split('/').pop()?.replace(/^mcp-server-/, '').replace(/@.*$/, '') ?? input;
    return { type: 'npm', packageName: input, suggestedName: suggested };
  }
  return { type: 'unknown' };
}
