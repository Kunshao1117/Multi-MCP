/**
 * Multi-MCP Gateway CLI — 共用基礎設施
 * 路徑常數、互動式輸入、設定檔讀寫等所有 CLI 模組共用的基礎工具。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

// ─── ANSI 色碼 ───

/** ANSI 色碼常數（供所有 CLI 模組共用） */
export const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  white:   '\x1b[97m',
  gray:    '\x1b[90m',
};

// ─── 路徑常數 ───

const __dirname = dirname(fileURLToPath(import.meta.url));
/** 專案根目錄 */
export const PROJECT_ROOT = resolve(__dirname, '..', '..');
/** 閘道器設定檔路徑 */
export const CONFIG_PATH = resolve(PROJECT_ROOT, 'gateway.config.json');
/** MCP 分類目錄根路徑 */
export const MCPS_DIR = resolve(PROJECT_ROOT, 'mcps');

// ─── readline 單例 ───

/** 全域 readline 實例（所有 CLI 模組共用） */
export const rl = createInterface({ input: process.stdin, output: process.stdout });

/** 互動式提問，回傳使用者輸入（自動去除前後空白） */
export const ask = (q: string): Promise<string> =>
  new Promise((r) => rl.question(q, (a) => r(a.trim())));

/** 暫停等待使用者按 Enter */
export const pause = (): Promise<void> =>
  new Promise((r) => rl.question('\n按 Enter 返回...', () => r()));

/**
 * 智慧輸入讀取：支援單行文字與多行 JSON
 *
 * 核心設計：**完全用 rl.on('line') 取代 rl.question()**
 *
 * readline 的 question() 在消費第一行時不觸發 line 事件，
 * 導致後續的 on('line') 監聽器無法攔截使用者一次性貼入的多行 JSON。
 * 此函式透過 stdout.write 顯示 prompt + 純 line 事件監聽來避免競爭。
 *
 * 行為：
 * - 單行輸入：第一行不以 { 開頭 → 立即 resolve（等同 ask）
 * - 多行 JSON：從 { 開始累積，括號計數歸零後 resolve
 * - 超時保護：連續 300ms 無新行且括號未平衡 → 強制 resolve（容錯）
 */
export function askJsonOrLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    const lines: string[] = [];
    let depth = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (result: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      rl.removeListener('line', onLine);
      resolve(result);
    };

    const onLine = (line: string) => {
      const trimmed = line.trim();
      lines.push(trimmed);

      // 第一行若不是 { 開頭 → 單行模式，直接回傳
      if (lines.length === 1 && !trimmed.startsWith('{')) {
        settle(trimmed);
        return;
      }

      // JSON 累積模式：計算括號深度
      depth += (trimmed.match(/\{/g) ?? []).length - (trimmed.match(/\}/g) ?? []).length;

      if (depth <= 0) {
        // 括號平衡 → JSON 完整
        settle(lines.join('\n'));
      } else {
        // 仍未平衡 → 重設超時等待下一行
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => settle(lines.join('\n')), 300);
      }
    };

    rl.on('line', onLine);
  });
}


// ─── 型別定義 ───

/** 閘道器設定檔結構 */
export interface GatewayConfigFile {
  gateway: Record<string, unknown>;
}

/** MCP 伺服器啟動設定 */
export interface McpServerDef {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// ─── 設定檔讀寫 ───

/** 載入閘道器設定 */
export const loadGatewayConfig = (): GatewayConfigFile =>
  JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

/** 讀取 mcps/ 資料夾結構：回傳 { 分類名: { MCP名: 設定 } } */
export function loadMcpsByCategory(): Record<string, Record<string, McpServerDef>> {
  const result: Record<string, Record<string, McpServerDef>> = {};
  if (!existsSync(MCPS_DIR)) return result;
  for (const entry of readdirSync(MCPS_DIR)) {
    const entryPath = resolve(MCPS_DIR, entry);
    if (!statSync(entryPath).isDirectory()) continue;
    result[entry] = {};
    for (const file of readdirSync(entryPath)) {
      if (!file.endsWith('.json')) continue;
      const mcpName = file.replace(/\.json$/, '');
      try {
        result[entry][mcpName] = JSON.parse(readFileSync(resolve(entryPath, file), 'utf-8'));
      } catch { /* 略過損壞的檔案 */ }
    }
  }
  return result;
}

/** 儲存單一 MCP 設定檔到分類資料夾 */
export function saveMcpConfig(category: string, name: string, config: McpServerDef): void {
  const catDir = resolve(MCPS_DIR, category);
  if (!existsSync(catDir)) mkdirSync(catDir, { recursive: true });
  writeFileSync(resolve(catDir, `${name}.json`), JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/** 取得所有 MCP 名稱列表 */
export function getAllMcpNames(): string[] {
  const categories = loadMcpsByCategory();
  const names: string[] = [];
  for (const mcps of Object.values(categories)) {
    names.push(...Object.keys(mcps));
  }
  return names;
}

/** 找出 MCP 所屬分類 */
export function findMcpCategory(mcpName: string): string | undefined {
  const categories = loadMcpsByCategory();
  for (const [cat, mcps] of Object.entries(categories)) {
    if (mcpName in mcps) return cat;
  }
  return undefined;
}

/** 顯示頁面標題 */
export function header(title: string): void {
  console.clear();
  const line = '═'.repeat(38);
  console.log(`${c.cyan}╔${line}╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  ${c.bold}${title.padEnd(35)}${c.reset} ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚${line}╝${c.reset}\n`);
}

/** 顯示分組標題 */
export function sectionTitle(icon: string, title: string): void {
  console.log(`\n  ${c.bold}${icon} ${title}${c.reset}`);
}

/** 從 MCP 設定檔推斷所需環境變數（讀取 env 欄位和 args 裡的 ${VAR} 引用） */
export function getEnvVarsFromConfig(mcpName: string): string[] {
  const cat = findMcpCategory(mcpName);
  if (!cat) return [];
  try {
    const filePath = resolve(MCPS_DIR, cat, `${mcpName}.json`);
    if (!existsSync(filePath)) return [];
    const config = JSON.parse(readFileSync(filePath, 'utf-8')) as McpServerDef;
    const vars: Set<string> = new Set();
    // 從 env 欄位取
    if (config.env) {
      for (const val of Object.values(config.env)) {
        const m = val.match(/^\$\{(.+)\}$/);
        if (m) vars.add(m[1]);
      }
    }
    // 從 args 裡的 ${VAR} 引用取
    for (const arg of config.args) {
      const m = arg.match(/\$\{(.+)\}/);
      if (m) vars.add(m[1]);
    }
    return [...vars];
  } catch {
    return [];
  }
}
