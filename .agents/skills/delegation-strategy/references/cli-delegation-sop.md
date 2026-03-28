# CLI 委派標準作業流程（完整版）

> 此為 `delegation-strategy` 技能的詳細參考資料。主檔已精簡，需要完整步驟時載入此文件。

## Step 0: 路徑解析（必須最先完成）

主腦必須解析兩個獨立路徑：

| 佔位符 | 尋找方式 | 範例 |
|--------|---------|------|
| `{project_root}` | 包含 `package.json`、`src/` 的目錄 | `D:\System_Module\bartender-map` |
| `{agents_dir}` | 包含 `.agents/` 的目錄（可能是 project_root 的上層） | `D:\System_Module\.agents` |

> **關鍵**：這兩個路徑不保證是父子關係。主腦必須從工作空間根目錄向上搜尋來獨立確定。

## 檔案傳令模式

> **原因**：終端輸入緩衝區有長度限制，長提示詞可能被截斷。改用檔案傳令。

```
Step 1: Master → write_to_file: {agents_dir}/logs/cli_task.md
        （用提示詞骨架構建任務，寫入檔案）

Step 2: Master → run_command: gemini (Cwd: {agents_dir} 的父目錄)
        （在工作空間根目錄啟動 CLI）

Step 3: Master → send_command_input: 請讀取 {agents_dir}/logs/cli_task.md 並執行其中定義的任務
        （送出短指令，使用絕對路徑）

Step 4: Master → send_command_input: \n
        （按 Enter 送出，必須是獨立的 send_command_input）

Step 5: Master → 棄管（不再讀取終端輸出）

Step 6: CLI 自行讀取任務檔案 → 執行分析 → 寫結果報告

Step 7: 總監通知主腦 CLI 已完成

Step 8: Master → view_file: <結果報告路徑>

Step 9: Master → 清理
```

## 清理協議

主腦讀完並處理結果報告後：

1. **刪除任務檔案**：移除 `.agents/logs/cli_task.md`
2. **刪除結果報告**：移除結果檔案（如 `scan_report.md`）
3. **時機**：清理在主腦完全將結果納入自己產出後執行。絕不在處理完成前刪除。

> **理由**：這些是暫時性中繼檔案。主腦的產出才是最終留存文件。
