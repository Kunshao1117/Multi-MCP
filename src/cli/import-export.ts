/** Legacy export could expose literal secrets in commands/arguments/env. Keep it disabled. */
export async function importExportMenu(): Promise<void> {
  console.log('舊版匯入／匯出已停用。設定可能含有密鑰，請勿直接分享；請使用 Multi-MCP Manager 管理設定。');
}
