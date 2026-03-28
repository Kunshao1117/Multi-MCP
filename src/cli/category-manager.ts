/**
 * Multi-MCP Gateway CLI — 分類管理
 * 分類的新增、移動 MCP、重新命名、刪除空分類。
 */
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ask, pause, header,
  MCPS_DIR,
  loadMcpsByCategory, getAllMcpNames, findMcpCategory,
} from './shared.js';

/** 分類管理互動選單 */
export async function categoryMenu(): Promise<void> {
  while (true) {
    header('🏷️ 分類管理');
    const categories = loadMcpsByCategory();
    const catNames = Object.keys(categories);

    if (catNames.length === 0) {
      console.log('  (尚無分類)\n');
    } else {
      catNames.forEach((cat, i) => {
        const mcps = Object.keys(categories[cat]);
        console.log(`  [${i + 1}] ${cat} (${mcps.length} 個 MCP)`);
        mcps.forEach((m) => console.log(`       • ${m}`));
        console.log('');
      });
    }

    console.log('  [A] ➕ 新增分類');
    console.log('  [M] 🔀 移動 MCP 到其他分類');
    console.log('  [R] ✏️ 重新命名分類');
    console.log('  [D] 🗑️ 刪除空分類');
    console.log('  [0] ↩️ 返回\n');

    const choice = (await ask('> ')).toUpperCase();
    switch (choice) {
      case 'A': {
        const name = await ask('? 新分類名稱: ');
        if (name) {
          mkdirSync(resolve(MCPS_DIR, name), { recursive: true });
          console.log(`\n  ✅ 分類「${name}」已建立`);
        }
        await pause();
        break;
      }
      case 'M': {
        const allNames = getAllMcpNames();
        if (allNames.length === 0) {
          console.log('  尚無 MCP 可移動');
          await pause();
          break;
        }
        allNames.forEach((n, i) => console.log(`  [${i + 1}] ${n}`));
        const sIdx = parseInt(await ask('\n? 選擇 MCP: ')) - 1;
        if (sIdx >= 0 && sIdx < allNames.length) {
          const mcpName = allNames[sIdx];
          const oldCat = findMcpCategory(mcpName);
          const cats = Object.keys(categories);
          cats.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
          console.log('  [N] 新增分類');
          const cChoice = await ask('? 移動到: ');
          const targetCat = cChoice.toUpperCase() === 'N'
            ? await ask('? 新分類名稱: ')
            : cats[parseInt(cChoice) - 1];
          if (targetCat && targetCat !== oldCat) {
            const targetDir = resolve(MCPS_DIR, targetCat);
            if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
            const oldPath = resolve(MCPS_DIR, oldCat!, `${mcpName}.json`);
            const newPath = resolve(targetDir, `${mcpName}.json`);
            renameSync(oldPath, newPath);
            console.log(`\n  ✅ "${mcpName}" 已從「${oldCat}」移到「${targetCat}」`);
          }
        }
        await pause();
        break;
      }
      case 'R': {
        if (catNames.length === 0) {
          console.log('  尚無分類可重新命名');
          await pause();
          break;
        }
        catNames.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
        const rIdx = parseInt(await ask('\n? 選擇分類: ')) - 1;
        if (rIdx >= 0 && rIdx < catNames.length) {
          const newName = await ask('? 新名稱: ');
          if (newName) {
            renameSync(resolve(MCPS_DIR, catNames[rIdx]), resolve(MCPS_DIR, newName));
            console.log(`\n  ✅ 「${catNames[rIdx]}」已重新命名為「${newName}」`);
          }
        }
        await pause();
        break;
      }
      case 'D': {
        const emptyCats = catNames.filter((c) => Object.keys(categories[c]).length === 0);
        if (emptyCats.length === 0) {
          console.log('  沒有空的分類可刪除');
          await pause();
          break;
        }
        emptyCats.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
        const dIdx = parseInt(await ask('\n? 選擇要刪除的空分類: ')) - 1;
        if (dIdx >= 0 && dIdx < emptyCats.length) {
          const { rmSync } = await import('node:fs');
          rmSync(resolve(MCPS_DIR, emptyCats[dIdx]), { recursive: true });
          console.log(`\n  ✅ 「${emptyCats[dIdx]}」已刪除`);
        }
        await pause();
        break;
      }
      case '0':
        return;
    }
  }
}
