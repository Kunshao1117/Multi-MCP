/**
 * Multi-MCP Gateway CLI — 工具瀏覽器
 * 互動式搜尋與瀏覽已安裝的工具。
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ask, pause, header, c, PROJECT_ROOT } from './shared.js';
import { searchTools } from '../registry.js';
import type { ToolRegistry } from '../types.js';

/** 工具瀏覽器主流程 */
export async function toolBrowserMenu(): Promise<void> {
  const registryPath = resolve(PROJECT_ROOT, 'registry.json');
  if (!existsSync(registryPath)) {
    header('🔍 工具瀏覽器');
    console.log('  ⚠️ 集成表不存在，請先執行「重新掃描工具」');
    await pause();
    return;
  }

  let registry: ToolRegistry;
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
  } catch {
    header('🔍 工具瀏覽器');
    console.log('  ❌ 集成表格式錯誤');
    await pause();
    return;
  }

  while (true) {
    header('🔍 工具瀏覽器');

    // 顯示伺服器總覽
    const serverNames = Object.keys(registry.servers);
    console.log(`  ${c.dim}已載入 ${serverNames.length} 個 MCP 伺服器${c.reset}\n`);
    for (const name of serverNames) {
      const entry = registry.servers[name];
      console.log(`  ${c.cyan}${name}${c.reset} — ${entry.tool_count} 個工具`);
    }

    console.log(`\n  ${c.dim}輸入關鍵字搜尋工具，或直接按 Enter 返回${c.reset}`);
    const query = await ask('\n🔍 ');
    if (!query) return;

    const results = searchTools(registry, query, { limit: 15 });
    if (results.length === 0) {
      console.log(`\n  ${c.yellow}找不到符合「${query}」的工具${c.reset}`);
      await pause();
      continue;
    }

    console.log(`\n  ${c.bold}搜尋結果（${results.length} 個）：${c.reset}\n`);
    results.forEach((r, i) => {
      console.log(`  ${c.bold}[${i + 1}]${c.reset} ${c.cyan}${r.name}${c.reset}`);
      console.log(`      ${c.dim}${r.server}${c.reset} — ${r.description || '（無說明）'}`);
    });

    console.log(`\n  ${c.dim}輸入編號查看詳細參數，0 返回${c.reset}`);
    const pick = await ask('\n> ');
    if (!pick || pick === '0') continue;

    const idx = parseInt(pick) - 1;
    if (idx >= 0 && idx < results.length) {
      const tool = results[idx];
      console.log(`\n  ${c.bold}${c.cyan}${tool.name}${c.reset}`);
      console.log(`  ${c.dim}伺服器: ${tool.server}${c.reset}`);
      console.log(`  ${tool.description}\n`);
      console.log(`  ${c.bold}參數結構：${c.reset}`);
      console.log(
        JSON.stringify(tool.inputSchema, null, 2)
          .split('\n')
          .map((l) => `  ${c.dim}${l}${c.reset}`)
          .join('\n'),
      );
      await pause();
    }
  }
}
