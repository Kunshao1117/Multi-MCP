/**
 * Multi-MCP Gateway CLI — 版本檢查
 * 比對已安裝的 npm MCP 套件與最新版本。
 */
import { pause, header, c, loadMcpsByCategory, type McpServerDef } from './shared.js';

interface VersionResult {
  name: string;
  packageName: string;
  latest?: string;
  status: 'latest' | 'error' | 'skip';
  error?: string;
}

/** 從 MCP 設定解析 npm 套件名（排除遠端 MCP） */
function extractPackageName(config: McpServerDef): string | null {
  if (config.args.includes('mcp-remote')) return null;
  // args 通常是 ['-y', '@scope/package@latest'] 或 ['-y', 'package-name@latest']
  const pkgArg = config.args.find((a) => a !== '-y' && !a.startsWith('-'));
  if (!pkgArg) return null;
  return pkgArg.replace(/@latest$/, '').replace(/@\^.*$/, '');
}

/** 查詢 npm 最新版本 */
async function fetchLatestVersion(packageName: string): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { version: string };
  return data.version;
}

/** 版本檢查主流程 */
export async function versionCheckMenu(): Promise<void> {
  header('🔄 版本檢查');
  const categories = loadMcpsByCategory();
  const results: VersionResult[] = [];

  const allMcps: Array<{ name: string; config: McpServerDef }> = [];
  for (const mcps of Object.values(categories)) {
    for (const [name, config] of Object.entries(mcps)) {
      allMcps.push({ name, config });
    }
  }

  if (allMcps.length === 0) {
    console.log('  (尚無安裝的 MCP)');
    await pause();
    return;
  }

  console.log(`  🔍 正在查詢 ${allMcps.length} 個 MCP 的版本...\n`);

  for (const { name, config } of allMcps) {
    const packageName = extractPackageName(config);
    if (!packageName) {
      results.push({ name, packageName: '(遠端)', status: 'skip' });
      console.log(`  ${c.dim}⏭️  ${name}（遠端 MCP）${c.reset}`);
      continue;
    }

    try {
      const latest = await fetchLatestVersion(packageName);
      results.push({ name, packageName, latest, status: 'latest' });
      console.log(`  ${c.green}✅ ${name}${c.reset} — ${c.cyan}${packageName}${c.reset} ${c.dim}v${latest} 最新${c.reset}`);
    } catch (err) {
      const msg = (err as Error).message;
      results.push({ name, packageName, status: 'error', error: msg });
      console.log(`  ${c.yellow}⚠️  ${name}${c.reset} — ${c.red}查詢失敗${c.reset} ${c.dim}(${msg})${c.reset}`);
    }
  }

  // 摘要
  const latest = results.filter((r) => r.status === 'latest').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  console.log(`\n  ─────────────────────────`);
  console.log(`  ${c.bold}結果：${c.green}最新 ${latest}${c.reset} / ${c.yellow}無法查詢 ${errors}${c.reset} / ${c.dim}跳過 ${skipped}${c.reset}`);

  await pause();
}
