/**
 * Multi-MCP Gateway CLI — MCP 市集
 * npm 即時搜尋、精選推薦清單、批次安裝、手動輸入。
 */
import { existsSync, readFileSync } from 'node:fs';
import { ask, pause, header, c, CATALOG_PATH, getAllMcpNames } from './shared.js';
import { installMCP } from './install-flow.js';

/** npm 搜尋結果條目 */
interface NpmSearchResult {
  name: string;
  description: string;
  version: string;
}

/** 推薦清單條目 */
interface CatalogEntry {
  name: string;
  package: string;
  description: string;
  authRequired: boolean;
}

/** 推薦清單結構 */
interface Catalog {
  version: string;
  categories: Record<string, CatalogEntry[]>;
}

/** 市集主選單 */
export async function marketplaceMenu(rescanFn: () => Promise<void>): Promise<void> {
  while (true) {
    header('🛒 MCP 市集');
    console.log(`  ${c.bold}[1]${c.reset} 🔍 搜尋 npm（即時查詢）`);
    console.log(`  ${c.bold}[2]${c.reset} ⭐ 推薦清單（精選常用 MCP）`);
    console.log(`  ${c.bold}[3]${c.reset} ✏️  手動輸入來源（URL / 套件名）`);
    console.log(`  ${c.bold}[0]${c.reset} ↩️  返回\n`);

    const choice = await ask('> ');
    switch (choice) {
      case '1': await npmSearch(rescanFn); break;
      case '2': await catalogMenu(rescanFn); break;
      case '3': await installMCP(rescanFn); break;
      case '0': return;
    }
  }
}

/** npm 即時搜尋 */
async function npmSearch(rescanFn: () => Promise<void>): Promise<void> {
  header('🔍 搜尋 npm');
  const query = await ask('? 搜尋關鍵字（如 supabase、github）: ');
  if (!query) return;

  console.log(`\n  ${c.dim}搜尋中...${c.reset}\n`);

  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=keywords:mcp+${encodeURIComponent(query)}&size=10`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as { objects: Array<{ package: NpmSearchResult }> };
    const results = data.objects ?? [];

    if (results.length === 0) {
      console.log('  找不到相關的 MCP 套件');
      await pause();
      return;
    }

    console.log(`  ${c.bold}搜尋結果：${c.reset}\n`);
    results.forEach((obj, i) => {
      const pkg = obj.package;
      console.log(`  ${c.bold}[${i + 1}]${c.reset} ${c.cyan}${pkg.name}${c.reset} ${c.dim}v${pkg.version}${c.reset}`);
      console.log(`      ${pkg.description ?? '（無說明）'}`);
    });
    console.log(`\n  ${c.dim}輸入編號直接安裝，0 返回${c.reset}`);

    const pick = await ask('\n> ');
    if (pick === '0' || !pick) return;

    const idx = parseInt(pick) - 1;
    if (idx >= 0 && idx < results.length) {
      const pkgName = results[idx].package.name;
      // 檢查是否已安裝
      if (getAllMcpNames().includes(pkgName)) {
        console.log(`\n  ${c.yellow}⚠️ 「${pkgName}」已安裝${c.reset}`);
        await pause();
        return;
      }
      console.log(`\n  → 準備安裝 ${c.cyan}${pkgName}${c.reset}...\n`);
      console.log(`  ${c.dim}提示：安裝流程中的「來源」欄位請貼上：${pkgName}${c.reset}\n`);
      await installMCP(rescanFn);
    }
  } catch (err) {
    console.log(`  ${c.red}❌ 搜尋失敗: ${(err as Error).message}${c.reset}`);
    await pause();
  }
}

/** 從推薦清單安裝（支援批次選取） */
async function catalogMenu(rescanFn: () => Promise<void>): Promise<void> {
  header('⭐ 推薦清單');

  const catalogPath = CATALOG_PATH;
  if (!existsSync(catalogPath)) {
    console.log('  ⚠️ 推薦清單檔案不存在（mcp-catalog.json）');
    await pause();
    return;
  }

  let catalog: Catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  } catch {
    console.log('  ❌ 推薦清單格式錯誤');
    await pause();
    return;
  }

  const installedNames = new Set(getAllMcpNames());
  const allEntries: CatalogEntry[] = [];

  for (const [category, entries] of Object.entries(catalog.categories)) {
    console.log(`\n  ${c.bold}${category}${c.reset}`);
    for (const entry of entries) {
      allEntries.push(entry);
      const idx = allEntries.length;
      const auth = entry.authRequired ? `${c.yellow}🔑${c.reset}` : `${c.green}🆓${c.reset}`;
      const installed = installedNames.has(entry.name) ? ` ${c.dim}(已安裝)${c.reset}` : '';
      console.log(`  ${c.bold}[${idx}]${c.reset} ${auth} ${c.cyan}${entry.name}${c.reset}${installed}`);
      console.log(`      ${entry.description}`);
    }
  }

  console.log(`\n  ${c.dim}輸入編號安裝（可用逗號批次選取，如 1,3,5），0 返回${c.reset}`);
  const input = await ask('\n> ');
  if (!input || input === '0') return;

  const indices = input.split(',')
    .map((s) => parseInt(s.trim()) - 1)
    .filter((i) => i >= 0 && i < allEntries.length);
  if (indices.length === 0) return;

  // 過濾已安裝
  const toInstall = indices.filter((i) => !installedNames.has(allEntries[i].name));
  const skipped = indices.length - toInstall.length;
  if (skipped > 0) {
    console.log(`\n  ${c.dim}跳過 ${skipped} 個已安裝的 MCP${c.reset}`);
  }

  if (toInstall.length === 0) {
    console.log(`\n  ${c.yellow}所選的 MCP 皆已安裝${c.reset}`);
    await pause();
    return;
  }

  console.log(`\n  📦 將安裝 ${toInstall.length} 個 MCP...\n`);
  for (const idx of toInstall) {
    const entry = allEntries[idx];
    console.log(`  ─── ${c.cyan}${entry.name}${c.reset} (${entry.package}) ───`);
    console.log(`  ${c.dim}提示：安裝流程中的「來源」欄位請貼上：${entry.package}${c.reset}\n`);
    await installMCP(rescanFn);
    console.log('');
  }
}
