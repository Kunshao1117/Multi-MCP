/**
 * Multi-MCP Gateway CLI — 認證管理
 * 多帳號認證的新增、切換、更新、刪除操作選單，
 * 以及同步認證（反向偵測 + 自動補全）功能。
 */
import {
  ask, pause, header,
  getAllMcpNames, getEnvVarsFromConfig,
} from './shared.js';
import { matchInstallHint, getAuthGuide } from '../auth-guides.js';
import {
  loadCredentials, addAccount, switchAccount,
  removeAccount, updateAccountValue, syncToEnvFile,
  maskValue, parseEnvFile,
} from '../credential-store.js';

// ═══════════════════════════════════
// 認證管理（入口：選擇 MCP）
// ═══════════════════════════════════

/** 認證管理主選單——列出所有 MCP 並選擇進入詳細操作 */
export async function authMenu(): Promise<void> {
  while (true) {
    header('🔑 認證管理');
    const allNames = getAllMcpNames();
    const creds = loadCredentials();

    if (allNames.length === 0) {
      console.log('  (尚無安裝)');
      await pause();
      return;
    }

    allNames.forEach((name, i) => {
      const c = creds[name];
      const icon = c?.active && c.accounts[c.active] ? '✅' : '⚙️';
      const acct = c?.active ? ` [${c.active}]` : '';
      const count = c ? ` (${Object.keys(c.accounts).length} 個帳號)` : '';
      console.log(`  [${i + 1}] ${icon} ${name}${acct}${count}`);
    });
    console.log('  [S] 🔒 同步認證（自動偵測 + 補全）');
    console.log('\n  [0] ↩️ 返回主選單\n');

    const choice = await ask('? 選擇 MCP: ');
    if (choice === '0') return;
    if (choice === 'S') {
      await syncAuthMenu();
      continue;
    }

    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < allNames.length) {
      await mcpAuthDetail(allNames[idx]);
    }
  }
}

// ═══════════════════════════════════
// 認證管理（詳細：單一 MCP 帳號操作）
// ═══════════════════════════════════

/** 單一 MCP 的帳號管理——新增、切換、更新、刪除 */
async function mcpAuthDetail(mcpName: string): Promise<void> {
  const creds = loadCredentials();

  while (true) {
    header(`🔑 ${mcpName} — 認證管理`);
    const entry = creds[mcpName];

    if (entry && Object.keys(entry.accounts).length > 0) {
      console.log(`  認證方式: ${entry.authType} | 環境變數: ${entry.envVar}\n`);
      console.log('  帳號清單:');
      const labels = Object.keys(entry.accounts);
      labels.forEach((label, i) => {
        const isActive = label === entry.active;
        const icon = isActive ? '🟢' : '⚪';
        const val = maskValue(entry.accounts[label].value);
        const tag = isActive ? ' (使用中)' : '';
        console.log(`  [${i + 1}] ${icon} ${label}  ${val}${tag}`);
      });
    } else {
      console.log('  尚無儲存的帳號\n');
    }

    console.log('\n  [A] ➕ 新增帳號  [S] 🔄 切換帳號');
    console.log('  [U] ✏️ 更新密鑰  [D] 🗑️ 刪除帳號');
    console.log('  [0] ↩️ 返回\n');

    const choice = (await ask('> ')).toUpperCase();

    switch (choice) {
      case 'A': {
        const label = (await ask('? 帳號標籤（如「個人」「公司」）: ')).trim();
        if (!label) {
          console.log('\n  ❌ 操作取消：帳號標籤不可為空');
          await pause();
          break;
        }
        
        const envVarAsk = entry?.envVar ?? (await ask('? 環境變數名稱: ')).trim().toUpperCase();
        if (!envVarAsk) {
          console.log('\n  ❌ 操作取消：環境變數名稱不可為空');
          await pause();
          break;
        }
        
        const value = (await ask('? Token / 密鑰值: ')).trim();
        if (!value) {
          console.log('\n  ❌ 操作取消：密鑰值不可為空');
          await pause();
          break;
        }

        addAccount(creds, mcpName, label, value, envVarAsk);
        syncToEnvFile(creds);
        console.log(`\n  ✅ 帳號「${label}」已新增`);
        await pause();
        break;
      }
      case 'S': {
        if (!entry || Object.keys(entry.accounts).length === 0) {
          console.log('  尚無帳號可切換');
          await pause();
          break;
        }
        const labels = Object.keys(entry.accounts);
        labels.forEach((l, i) => {
          const isActive = l === entry.active;
          console.log(`  [${i + 1}] ${isActive ? '🟢' : '⚪'} ${l}`);
        });
        const idx = parseInt(await ask('\n? 切換到: ')) - 1;
        if (idx >= 0 && idx < labels.length) {
          switchAccount(creds, mcpName, labels[idx]);
          console.log(`\n  ✅ 已切換到「${labels[idx]}」`);
          console.log('  🔄 gateway.env 已同步更新');
        }
        await pause();
        break;
      }
      case 'U': {
        if (!entry || Object.keys(entry.accounts).length === 0) {
          console.log('  尚無帳號可更新');
          await pause();
          break;
        }
        const labels = Object.keys(entry.accounts);
        labels.forEach((l, i) => console.log(`  [${i + 1}] ${l}`));
        
        const idxAsk = (await ask('\n? 更新哪個帳號 (輸入編號，0 退出): ')).trim();
        const idx = parseInt(idxAsk) - 1;
        if (idx >= 0 && idx < labels.length) {
          const newVal = (await ask('? 新的 Token / 密鑰值: ')).trim();
          if (newVal) {
            updateAccountValue(creds, mcpName, labels[idx], newVal);
            console.log(`\n  ✅「${labels[idx]}」已更新`);
          } else {
            console.log('\n  ❌ 操作取消：密鑰值不可為空');
          }
        } else if (idxAsk && idxAsk !== '0') {
           console.log('\n  ❌ 無效的選項');
        }
        await pause();
        break;
      }
      case 'D': {
        if (!entry || Object.keys(entry.accounts).length === 0) {
          console.log('  尚無帳號可刪除');
          await pause();
          break;
        }
        const labels = Object.keys(entry.accounts);
        labels.forEach((l, i) => console.log(`  [${i + 1}] ${l}`));
        const idx = parseInt(await ask('\n? 刪除哪個帳號: ')) - 1;
        if (idx >= 0 && idx < labels.length) {
          const ok = (await ask(`  確定刪除「${labels[idx]}」？(y/N): `)).toLowerCase();
          if (ok === 'y') {
            removeAccount(creds, mcpName, labels[idx]);
            console.log(`\n  ✅「${labels[idx]}」已刪除`);
          }
        }
        await pause();
        break;
      }
      case '0':
        return;
    }
  }
}

// ═══════════════════════════════════
// 同步認證（反向偵測 + 自動補全）
// ═══════════════════════════════════

/** 掃描所有 MCP 的認證狀態，自動從 gateway.env 匯入已有的密鑰 */
export async function syncAuthMenu(): Promise<void> {
  header('🔒 同步認證');
  const allNames = getAllMcpNames();
  const creds = loadCredentials();
  const envValues = parseEnvFile();

  if (allNames.length === 0) {
    console.log('  (尚無安裝的 MCP)\n');
    await pause();
    return;
  }

  // 找出缺少認證的 MCP
  const missing: Array<{ name: string; envVar: string; existingValue?: string }> = [];

  for (const name of allNames) {
    if (creds[name] && Object.keys(creds[name].accounts).length > 0) continue;

    // 查詢已知指南取得所需環境變數
    const guide = getAuthGuide(name);
    const envVars = guide.requiredEnvVars;

    if (envVars.length === 0) {
      // 第二層：嘗試從安裝提示查詢
      const hint = matchInstallHint(name);
      if (hint && hint.hint.envVar) {
        const val = envValues[hint.hint.envVar];
        missing.push({ name, envVar: hint.hint.envVar, existingValue: val });
        continue;
      }
      // 第三層：從 MCP 設定檔推斷（讀取 env 欄位和 ${VAR} 引用）
      const configVars = getEnvVarsFromConfig(name);
      if (configVars.length > 0) {
        for (const cv of configVars) {
          const val = envValues[cv];
          missing.push({ name, envVar: cv, existingValue: val });
        }
        continue;
      }
      continue;
    }

    for (const ev of envVars) {
      const val = envValues[ev];
      missing.push({ name, envVar: ev, existingValue: val });
    }
  }

  if (missing.length === 0) {
    console.log('  ✅ 所有已安裝的 MCP 認證皆已同步\n');
    await pause();
    return;
  }

  console.log(`  🔍 發現 ${missing.length} 個 MCP 缺少認證紀錄:\n`);

  let imported = 0;
  let needSetup = 0;

  for (const item of missing) {
    if (item.existingValue) {
      // gateway.env 已有值 → 自動匯入
      console.log(`  ✅ ${item.name}: 從 gateway.env 匯入 (${item.envVar})`);
      addAccount(creds, item.name, '預設', item.existingValue, item.envVar);
      imported++;
    } else {
      // gateway.env 無值 → 提示使用者
      console.log(`  ⚠️ ${item.name}: 需要 ${item.envVar}`);
      const guide = getAuthGuide(item.name);
      if (guide.docsUrl) {
        console.log(`     📖 取得位置: ${guide.docsUrl}`);
      }
      needSetup++;
    }
  }

  if (imported > 0) {
    syncToEnvFile(creds);
    console.log(`\n  📦 已匯入 ${imported} 個認證紀錄`);
  }
  if (needSetup > 0) {
    console.log(`\n  💡 有 ${needSetup} 個 MCP 需要手動設定密鑰`);
    console.log('     請進入 [4] 認證管理 逐一設定');
  }

  await pause();
}


