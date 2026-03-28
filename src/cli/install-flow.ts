/**
 * Multi-MCP Gateway CLI — 安裝流程
 * 安裝新 MCP 的完整流程，含三層認證辨識（已知提示 → 試啟動偵測 → 手動輸入）
 * 以及分類選擇。
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ask, pause, header, askJsonOrLine,
  MCPS_DIR,
  getAllMcpNames, saveMcpConfig,
  type McpServerDef,
} from './shared.js';
import { detectSource, probeAuthRequirements } from './source-detector.js';
import { matchInstallHint } from '../auth-guides.js';
import {
  loadCredentials, addAccount, syncToEnvFile,
} from '../credential-store.js';

/** 安裝新 MCP 的完整互動流程 */
export async function installMCP(rescanFn: () => Promise<void>): Promise<void> {
  header('➕ 安裝新的 MCP');
  console.log('  支援格式：');
  console.log('  • GitHub URL: https://github.com/owner/repo');
  console.log('  • npm 套件名: @scope/package-name');
  console.log('  • 遠端 MCP URL: https://xxx.example.com/mcp\n');

  // 使用 askJsonOrLine 取代 ask——
  // 完全用 rl.on('line') 收集行，避免 question() 與 on('line') 事件競爭
  const input = await askJsonOrLine('? 請貼上 MCP 來源（0 返回）:\n> ');
  if (!input || input === '0') return;


  // ─── mcpServers JSON 格式快速路徑 ───
  // 支援使用者直接貼入 Claude / Cline 格式 MCP 設定
  const mcpServersParsed = tryParseMcpServersJson(input);
  if (mcpServersParsed) {
    const { name: parsedName, config: parsedConfig } = mcpServersParsed;
    console.log(`\n  ✅ 解析為本地 MCP：${parsedName}`);
    if (getAllMcpNames().includes(parsedName)) {
      console.log(`\n  ⚠️ "${parsedName}" 已存在`);
      await pause();
      return;
    }
    const targetCategory = await askCategory();
    saveMcpConfig(targetCategory, parsedName, parsedConfig);
    console.log(`\n  ✅ "${parsedName}" 已新增到分類「${targetCategory}」`);
    const doScan = (await ask('\n? 立即掃描工具？(Y/n): ')).toLowerCase();
    if (doScan !== 'n') await rescanFn();
    else await pause();
    return;
  }

  // ─── 扁平 JSON 格式快速路徑 ───
  // 支援 { "name": "...", "command": "...", "args": [...] } 格式
  const flatParsed = tryParseFlatJson(input);
  if (flatParsed) {
    const { name: parsedName, config: parsedConfig } = flatParsed;
    console.log(`\n  ✅ 解析為本地 MCP：${parsedName}`);
    if (getAllMcpNames().includes(parsedName)) {
      console.log(`\n  ⚠️ "${parsedName}" 已存在`);
      await pause();
      return;
    }
    const targetCategory = await askCategory();
    saveMcpConfig(targetCategory, parsedName, parsedConfig);
    console.log(`\n  ✅ "${parsedName}" 已新增到分類「${targetCategory}」`);
    const doScan = (await ask('\n? 立即掃描工具？(Y/n): ')).toLowerCase();
    if (doScan !== 'n') await rescanFn();
    else await pause();
    return;
  }

  const source = await detectSource(input);
  if (source.type === 'unknown') {
    console.log('\n  ❌ 無法辨識來源格式');
    await pause();
    return;
  }

  // 嘗試自動辨識已知 MCP
  const knownMatch = matchInstallHint(input);

  const nameDefault = knownMatch?.name ?? source.suggestedName ?? 'my-mcp';
  const name = (await ask(`\n? 命名（工具前綴）[${nameDefault}]: `)) || nameDefault;

  // 檢查是否已存在
  if (getAllMcpNames().includes(name)) {
    console.log(`\n  ⚠️ "${name}" 已存在`);
    await pause();
    return;
  }

  // 組裝啟動設定
  const serverConfig: McpServerDef = source.type === 'remote'
    ? { command: 'npx', args: ['-y', 'mcp-remote', source.remoteUrl!] }
    : { command: 'npx', args: ['-y', `${source.packageName}@latest`] };

  // ─── 認證設定 ───
  if (knownMatch) {
    // === 自動引導模式（已知 MCP）===
    const hint = knownMatch.hint;
    console.log(`\n  ✨ 辨識為已知 MCP: ${knownMatch.name}`);
    console.log(`  📋 認證方式: ${hint.tokenLabel}`);
    if (hint.tokenUrl) console.log(`  📖 取得位置: ${hint.tokenUrl}`);

    if (hint.tokenPassMethod === 'none') {
      console.log('  ℹ️  此 MCP 使用瀏覽器授權，首次連線時自動開啟瀏覽器');
    } else {
      const tokenValue = await ask(`\n? ${hint.tokenLabel}: `);
      const label = (await ask('? 帳號標籤（如「個人」「公司」）: ')) || '預設';

      if (tokenValue) {
        if (hint.tokenPassMethod === 'arg' && hint.argFlag) {
          serverConfig.args.push(hint.argFlag, `\${${hint.envVar}}`);
        } else if (hint.tokenPassMethod === 'header' && hint.headerTemplate) {
          serverConfig.args.push('--header', hint.headerTemplate);
        }
        const creds = loadCredentials();
        addAccount(creds, name, label, tokenValue, hint.envVar);
        syncToEnvFile(creds);
        console.log(`\n  ✅ 帳號「${label}」已設定`);
      }
    }
  } else {
    // === 自動偵測模式（未知 MCP）===
    console.log('\n  🔍 正在分析認證需求（試啟動中，請稍候…）');
    const detected = await probeAuthRequirements(serverConfig);

    if (detected.length > 0) {
      console.log(`  ✨ 偵測到需要: ${detected.join(', ')}`);
      const creds = loadCredentials();
      for (const envVar of detected) {
        const value = await ask(`\n? ${envVar}: `);
        if (value) {
          const label = (await ask('? 帳號標籤（如「個人」「公司」）: ')) || '預設';
          serverConfig.env = { ...serverConfig.env, [envVar]: `\${${envVar}}` };
          addAccount(creds, name, label, value, envVar);
          console.log(`  ✅ 帳號「${label}」已設定`);
        }
      }
      syncToEnvFile(creds);
    } else {
      // 偵測不到 → 回退手動模式
      console.log('  ℹ️  未偵測到特定認證需求');
      const needsToken = (await ask('? 需要 Token / 密鑰嗎？(y/N): ')).toLowerCase();
      if (needsToken === 'y') {
        const envVar = (await ask('? 環境變數名稱（如 MY_API_TOKEN）: ')).toUpperCase();
        const value = await ask('? Token 值: ');
        const label = (await ask('? 帳號標籤: ')) || '預設';
        const method = await ask('? 傳遞方式: [1] 環境變數 [2] 命令參數 [3] Header（預設 1）: ');

        if (method === '2') {
          const flag = await ask('? 參數名稱（如 --api-key）: ');
          serverConfig.args.push(flag, `\${${envVar}}`);
        } else if (method === '3') {
          const hdr = await ask('? Header 格式（如 Authorization: Bearer ${TOKEN}）: ');
          serverConfig.args.push('--header', hdr);
        } else {
          serverConfig.env = { ...serverConfig.env, [envVar]: `\${${envVar}}` };
        }

        if (envVar && value) {
          const creds = loadCredentials();
          addAccount(creds, name, label, value, envVar);
          syncToEnvFile(creds);
          console.log(`\n  ✅ 帳號「${label}」已設定`);
        }
      }
    }
  }

  // ─── 分類選擇 ───
  const targetCategory = await askCategory();

  saveMcpConfig(targetCategory, name, serverConfig);
  console.log(`\n  ✅ "${name}" 已新增到分類「${targetCategory}」`);

  const doScan = (await ask('\n? 立即掃描工具？(Y/n): ')).toLowerCase();
  if (doScan !== 'n') await rescanFn();
  else await pause();
}

// ─── 輔助函式 ───

/**
 * 嘗試解析 mcpServers JSON 格式（Claude / Cline 設定）
 * 若格式符合則回傳第一個伺服器的名稱與設定，否則回傳 null
 */
function tryParseMcpServersJson(
  raw: string,
): { name: string; config: McpServerDef } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const servers = obj['mcpServers'] as Record<string, unknown> | undefined;
    if (!servers || typeof servers !== 'object') return null;
    const entries = Object.entries(servers);
    if (entries.length === 0) return null;
    const [name, rawCfg] = entries[0];
    if (!name) return null;
    const cfg = rawCfg as { command?: unknown; args?: unknown; env?: unknown };
    if (typeof cfg.command !== 'string') return null;
    const args = Array.isArray(cfg.args)
      ? (cfg.args as unknown[]).map(String)
      : [];
    const env =
      cfg.env && typeof cfg.env === 'object' && !Array.isArray(cfg.env)
        ? (cfg.env as Record<string, string>)
        : undefined;
    return { name, config: { command: cfg.command, args, ...(env ? { env } : {}) } };
  } catch {
    return null;
  }
}

/**
 * 嘗試解析扁平 JSON 格式（含 name / command / args 欄位）
 * 適用於 { "name": "my-mcp", "command": "node", "args": [...] } 格式
 */
function tryParseFlatJson(
  raw: string,
): { name: string; config: McpServerDef } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    // 必須包含 name 與 command 欄位，且不含 mcpServers（避免與上一個解析器衝突）
    if ('mcpServers' in obj) return null;
    if (typeof obj['name'] !== 'string' || !obj['name']) return null;
    if (typeof obj['command'] !== 'string') return null;
    const name = obj['name'];
    const command = obj['command'];
    const args = Array.isArray(obj['args'])
      ? (obj['args'] as unknown[]).map(String)
      : [];
    const env =
      obj['env'] && typeof obj['env'] === 'object' && !Array.isArray(obj['env'])
        ? (obj['env'] as Record<string, string>)
        : undefined;
    return { name, config: { command, args, ...(env ? { env } : {}) } };
  } catch {
    return null;
  }
}

/** 互動式選擇或新增分類 */
async function askCategory(): Promise<string> {
  const existingCats = existsSync(MCPS_DIR)
    ? readdirSync(MCPS_DIR).filter((e) => statSync(resolve(MCPS_DIR, e)).isDirectory())
    : [];
  if (existingCats.length > 0) {
    console.log('\n  🏷️ 選擇分類:');
    existingCats.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
    console.log('  [N] 新增分類');
    const catChoice = await ask('> ');
    if (catChoice.toUpperCase() === 'N') {
      return (await ask('? 新分類名稱: ')) || '未分類';
    }
    const catIdx = parseInt(catChoice) - 1;
    return (catIdx >= 0 && catIdx < existingCats.length)
      ? existingCats[catIdx]
      : '未分類';
  }
  return (await ask('\n? 分類名稱（留空則爲「未分類」）: ')) || '未分類';
}
