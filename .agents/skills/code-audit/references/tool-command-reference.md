# 工具指令對照表

> 此為 `code-audit` 技能的參考資料。

## MCP 工具（透過 Gateway）

| Tool | Gateway Call | Purpose |
|------|-------------|---------|
| ESLint | `eslint__lint-files` | 程式碼品質掃描 |
| Snyk SAST | `snyk__snyk_code_scan` | 原始碼安全掃描 |
| Snyk SCA | `snyk__snyk_sca_scan` | 依賴套件漏洞掃描 |
| Snyk IaC | `snyk__snyk_iac_scan` | 基礎設施設定掃描 |
| Snyk Container | `snyk__snyk_container_scan` | 容器映像掃描 |
| Supabase Advisors | `supabase__get_advisors` | 資料庫效能建議 |

## CLI Shell 指令

| Tech Stack | Type Check |
|------------|------------|
| Next.js / TypeScript | `npx tsc --noEmit` |
| Python / Django | `mypy .` |
| Go | `go vet ./...` |

## CLI 內建工具

| Tool | Purpose |
|------|---------|
| `grep_search` | 代辦標記統計、環境變數搜尋 |
| `read_file` | 讀取 .env.example、設定檔 |
| `write_file` | 寫入 scan_report.md |

## 前置條件

- `~/.gemini/settings.json` 必須設定 `multi-mcp-gateway`
- 專案需安裝 ESLint（`package.json` 中有 eslint 依賴）
- Snyk MCP 需完成認證（`snyk__snyk_auth`）
