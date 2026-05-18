/**
 * Multi-MCP Gateway CLI — 設定匯出 / 匯入
 * 匯出可攜式 MCP 設定檔（不含密鑰），匯入他人分享的設定。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ask, pause, header, c,
  DATA_DIR,
  loadMcpsByCategory, saveMcpConfig, getAllMcpNames,
  type McpServerDef,
} from './shared.js';

/** 匯出格式 */
interface ExportData {
  version: string;
  exported_at: string;
  categories: Record<string, Record<string, McpServerDef>>;
}

/** 匯出/匯入選單 */
export async function importExportMenu(): Promise<void> {
  while (true) {
    header('📦 匯出 / 匯入設定');
    console.log(`  ${c.bold}[1]${c.reset} ⬆️  匯出設定（產生可分享的檔案）`);
    console.log(`  ${c.bold}[2]${c.reset} ⬇️  匯入設定（從檔案匯入）`);
    console.log(`  ${c.bold}[0]${c.reset} ↩️  返回\n`);

    const choice = await ask('> ');
    switch (choice) {
      case '1': await exportConfig(); break;
      case '2': await importConfig(); break;
      case '0': return;
    }
  }
}

/** 匯出設定 */
async function exportConfig(): Promise<void> {
  const categories = loadMcpsByCategory();
  const catNames = Object.keys(categories);

  if (catNames.length === 0) {
    console.log('\n  (尚無安裝的 MCP，無法匯出)');
    await pause();
    return;
  }

  // 清除真實密鑰，保留結構
  const cleanCategories: Record<string, Record<string, McpServerDef>> = {};
  for (const [cat, mcps] of Object.entries(categories)) {
    cleanCategories[cat] = {};
    for (const [name, config] of Object.entries(mcps)) {
      cleanCategories[cat][name] = { ...config };
    }
  }

  const exportData: ExportData = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    categories: cleanCategories,
  };

  const defaultPath = resolve(DATA_DIR, 'gateway-export.json');
  const pathInput = await ask(`? 匯出路徑 [${defaultPath}]: `);
  const outputPath = pathInput || defaultPath;

  writeFileSync(outputPath, JSON.stringify(exportData, null, 2) + '\n', 'utf-8');

  let mcpCount = 0;
  for (const mcps of Object.values(cleanCategories)) mcpCount += Object.keys(mcps).length;

  console.log(`\n  ${c.green}✅ 已匯出 ${mcpCount} 個 MCP 設定到：${c.reset}`);
  console.log(`  ${c.cyan}${outputPath}${c.reset}`);
  console.log(`\n  ${c.dim}💡 此檔案不含密鑰，可以安全分享${c.reset}`);
  await pause();
}

/** 匯入設定 */
async function importConfig(): Promise<void> {
  const inputPath = await ask('? 匯入檔案路徑: ');
  if (!inputPath) return;

  const resolvedPath = resolve(inputPath);
  if (!existsSync(resolvedPath)) {
    console.log(`\n  ${c.red}❌ 檔案不存在: ${resolvedPath}${c.reset}`);
    await pause();
    return;
  }

  let data: ExportData;
  try {
    data = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
  } catch {
    console.log(`\n  ${c.red}❌ 檔案格式錯誤${c.reset}`);
    await pause();
    return;
  }

  if (!data.categories) {
    console.log(`\n  ${c.red}❌ 無效的匯出檔案（缺少 categories）${c.reset}`);
    await pause();
    return;
  }

  const existingNames = new Set(getAllMcpNames());
  let imported = 0;
  let skipped = 0;

  for (const [cat, mcps] of Object.entries(data.categories)) {
    for (const [name, config] of Object.entries(mcps)) {
      if (existingNames.has(name)) {
        console.log(`  ⏭️  ${name}（已存在，跳過）`);
        skipped++;
        continue;
      }
      saveMcpConfig(cat, name, config);
      console.log(`  ${c.green}✅ ${name}${c.reset} → ${cat}`);
      imported++;
    }
  }

  console.log(`\n  📦 匯入完成：新增 ${c.green}${imported}${c.reset} 個，跳過 ${skipped} 個`);
  if (imported > 0) {
    console.log(`  ${c.yellow}💡 新匯入的 MCP 需要設定認證，請進入認證管理${c.reset}`);
  }
  await pause();
}
