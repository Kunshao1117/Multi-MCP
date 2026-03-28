/**
 * Multi-MCP Gateway CLI — 狀態儀表板
 * 顯示系統摘要：MCP 數量、認證狀態、工具數量、上次掃描時間。
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { c, PROJECT_ROOT, getAllMcpNames } from './shared.js';
import { loadCredentials } from '../credential-store.js';

/** 計算相對時間描述 */
function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

/** 渲染狀態儀表板（一行摘要） */
export function renderDashboard(): void {
  // MCP 數量
  const allNames = getAllMcpNames();
  const mcpCount = allNames.length;

  // 認證比例
  const creds = loadCredentials();
  const authedCount = allNames.filter((n) => {
    const entry = creds[n];
    return entry?.active && entry.accounts[entry.active];
  }).length;

  // 工具數量 + 掃描時間
  const registryPath = resolve(PROJECT_ROOT, 'registry.json');
  let toolCount = '--';
  let scanTime = '尚未掃描';
  if (existsSync(registryPath)) {
    try {
      const reg = JSON.parse(readFileSync(registryPath, 'utf-8'));
      toolCount = String(Object.keys(reg.all_tools ?? {}).length);
      if (reg.generated_at) scanTime = relativeTime(reg.generated_at);
    } catch { /* 忽略解析錯誤 */ }
  }

  const authColor = authedCount === mcpCount ? c.green : c.yellow;
  console.log(
    `${c.dim}📊 MCP ${c.cyan}${mcpCount}${c.reset}${c.dim} 個 ｜ ` +
    `🔑 認證 ${authColor}${authedCount}/${mcpCount}${c.reset}${c.dim} ｜ ` +
    `🔧 工具 ${c.cyan}${toolCount}${c.reset}${c.dim} 個 ｜ ` +
    `🕐 ${scanTime}${c.reset}\n`,
  );
}
