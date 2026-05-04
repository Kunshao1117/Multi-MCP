# 掃描任務提示詞

> 此為 `code-audit` 技能的詳細參考資料。填入 `{project_root}` 和 `{file_paths_list}` 後使用。

構建提示詞時，使用 `delegation-strategy` 的 `references/cli-prompt-skeleton.md` 骨架，填入：
- **role_name**: `程式碼品質與安全掃描員`
- **output_path**: `{agents_dir}/logs/scan_report.md`
- **task_description**: 使用以下掃描區塊

## 掃描任務區塊

```
### 1. ESLint 程式碼品質掃描（優先用專案本地工具）
優先使用 run_shell_command 執行：
cd {project_root}; npx eslint --format json .
如果專案沒有安裝 ESLint，則改用 MCP 工具：
gateway__call_tool 呼叫 eslint__lint-files，傳入檔案路徑：
{file_paths_list}
統計：錯誤總數 / 警告總數 / 最常違反的前 5 條規則 / 前 10 項嚴重問題

### 2. Snyk 原始碼安全掃描（MCP 工具）
使用 gateway__call_tool 呼叫 snyk__snyk_code_scan，path 設為 {project_root}
統計：漏洞總數（Critical / High / Medium / Low）/ 前 5 項最嚴重漏洞
> 降級：若 Snyk 認證不可用（snyk__snyk_auth 未完成），跳過此步驟並在報告中注記「Snyk 未認證，已跳過」。

### 3. Snyk 依賴漏洞掃描（MCP 工具）
使用 gateway__call_tool 呼叫 snyk__snyk_sca_scan，path 設為 {project_root}
統計：漏洞總數 / 前 5 項最嚴重的依賴漏洞
> 降級：若 Snyk 認證不可用，改用 `run_shell_command` 執行 `npm audit --json` 或 `yarn audit --json`，並按相同格式統計漏洞。

### 4. TypeScript 型別檢查（僅限 TS 專案）
執行：cd {project_root}; npx tsc --noEmit
統計錯誤總數和前 10 項錯誤。

### 5. 代辦標記統計
使用 grep_search 掃描 TODO / FIXME / HACK / XXX / TEMP 標記。

### 6. 環境變數一致性
讀取 .env.example，搜尋 process.env 引用，比對差異。


```

> **Tech Stack Adaptation**: Python 專案改用 `pylint`/`mypy`/`pip-audit`。
> **File List Construction**: 主腦必須讀取所有記憶卡的追蹤檔案清單來構建路徑。
