/**
 * Multi-MCP Gateway CLI — MCP 管理
 * 檢視已安裝的 MCP、移除 MCP、重新掃描工具。
 */
import { existsSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ask, pause, header,
  CONFIG_PATH, MCPS_DIR, REGISTRY_PATH,
  loadMcpsByCategory, getAllMcpNames, findMcpCategory,
} from './shared.js';
import {
  loadCredentials, saveCredentials, syncToEnvFile,
} from '../credential-store.js';
import { loadConfig } from '../config-loader.js';
import { scanAndGenerateRegistry } from '../registry.js';

// ═══════════════════════════════════
// 檢視已安裝的 MCP
// ═══════════════════════════════════

/** 列出所有已安裝的 MCP（按分類顯示） */
export async function viewMCPs(): Promise<void> {
  header('📋 已安裝的 MCP');
  const categories = loadMcpsByCategory();
  const creds = loadCredentials();
  const catNames = Object.keys(categories);

  if (catNames.length === 0) {
    console.log('  (尚無安裝)\n');
    await pause();
    return;
  }

  for (const cat of catNames) {
    const mcps = categories[cat];
    const mcpNames = Object.keys(mcps);
    if (mcpNames.length === 0) continue;
    console.log(`  🏷️ ${cat}`);
    for (const name of mcpNames) {
      const sc = mcps[name];
      const isRemote = sc.args.includes('mcp-remote');
      const source = isRemote
        ? sc.args[sc.args.indexOf('mcp-remote') + 1]
        : sc.args.filter((a) => a !== '-y')[0];
      const cred = creds[name];
      const icon = cred?.active && cred.accounts[cred.active] ? '✅' : '❓';
      const acct = cred?.active ? ` [${cred.active}]` : '';
      console.log(`     ${icon} ${name}${acct}`);
      console.log(`        ${isRemote ? '🌐 遠端' : '📦 npm'}: ${source}`);
    }
    console.log('');
  }
  await pause();
}

// ═══════════════════════════════════
// 移除 MCP
// ═══════════════════════════════════

/** 移除指定的 MCP（含認證清理、空分類提示） */
export async function removeMCP(rescanFn: () => Promise<void>): Promise<void> {
  header('➖ 移除 MCP');
  const categories = loadMcpsByCategory();
  const allNames = getAllMcpNames();

  if (allNames.length === 0) {
    console.log('  (尚無安裝)');
    await pause();
    return;
  }

  // 按分類顯示
  let idx = 1;
  const indexMap: Array<{ name: string; category: string }> = [];
  for (const [cat, mcps] of Object.entries(categories)) {
    console.log(`  🏷️ ${cat}`);
    for (const name of Object.keys(mcps)) {
      console.log(`  [${idx}] ${name}`);
      indexMap.push({ name, category: cat });
      idx++;
    }
  }

  const choice = await ask('\n? 輸入編號或名稱（0 返回）: ');
  if (choice === '0') return;

  const selected = /^\d+$/.test(choice) ? indexMap[parseInt(choice) - 1] : undefined;
  const target = selected?.name ?? choice;
  const targetCat = selected?.category ?? findMcpCategory(target);

  if (!targetCat) {
    console.log('  ❌ 找不到');
    await pause();
    return;
  }

  const confirm = (await ask(`\n  確定要移除 "${target}"？(y/N): `)).toLowerCase();
  if (confirm !== 'y') return;

  // 刪除 JSON 檔
  const filePath = resolve(MCPS_DIR, targetCat, `${target}.json`);
  if (existsSync(filePath)) unlinkSync(filePath);

  // 若分類資料夾變空，提示刪除
  const remaining = readdirSync(resolve(MCPS_DIR, targetCat)).filter((f) => f.endsWith('.json'));
  if (remaining.length === 0) {
    const delCat = (await ask(`  分類「${targetCat}」已無 MCP，刪除資料夾？(Y/n): `)).toLowerCase();
    if (delCat !== 'n') {
      const { rmSync } = await import('node:fs');
      rmSync(resolve(MCPS_DIR, targetCat), { recursive: true });
    }
  }

  // 同步移除認證
  const creds = loadCredentials();
  if (creds[target]) {
    delete creds[target];
    saveCredentials(creds);
    syncToEnvFile(creds);
  }

  console.log(`\n  ✅ "${target}" 已移除`);
  const doScan = (await ask('\n? 重新掃描？(Y/n): ')).toLowerCase();
  if (doScan !== 'n') await rescanFn();
  else await pause();
}

// ═══════════════════════════════════
// 重新掃描工具
// ═══════════════════════════════════

/** 呼叫閘道器掃描程式重新建立工具集成表 */
export async function rescan(): Promise<void> {
  console.log('\n  🔄 掃描中...\n');
  try {
    const config = loadConfig(CONFIG_PATH);
    await scanAndGenerateRegistry(config, REGISTRY_PATH);
    console.log('\n  ✅ 掃描完成！');
  } catch {
    console.log('\n  ⚠️ 掃描失敗');
  }
  await pause();
}
