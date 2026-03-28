# CLI 能力矩陣

> 此為 `delegation-strategy` 技能的詳細參考資料。

## 可用工具

| 分類 | 工具 | 備註 |
|------|------|------|
| 檔案讀取 | `read_file`, `list_dir`, `grep_search` | 內建，直接可用 |
| MCP 工具 | `gateway__call_tool` → ESLint, Snyk 等 | 需在 `~/.gemini/settings.json` 設定 `multi-mcp-gateway` |
| Shell 指令 | `run_shell_command` | 僅限互動模式可用 |
| 檔案寫入 | `write_file` | 限定寫入分析報告 |

## 已知限制

| 限制 | 細節 | 繞行方案 |
|------|------|---------|
| `-p` 模式工具封鎖 | CLI 用 `-p` 啟動時 `run_shell_command` 被封鎖 | 必須使用互動模式 |
| MCP 設定獨立 | CLI 的 MCP 設定在 `~/.gemini/settings.json`，不繼承 IDE | 需獨立設定 |
| Enter 鍵分離 | CLI TUI 不解讀 `\n` 為 Enter | 文字和 Enter 分兩次 `send_command_input` |
| ESLint 絕對路徑 | `eslint__lint-files` 需要完整絕對路徑陣列 | 從記憶技能追蹤檔案構建 |
| gitignore 過濾 | `.agents/` 被 gitignore 時工具會跳過 | 改用 `run_shell_command` + `type`/`cat` |
| ESLint MCP 版本衝突 | MCP 內建引擎與專案框架外掛版本衝突 | 改用 `npx eslint` |
