# 診斷任務提示詞

> 此為 `code-diagnosis` 技能的詳細參考資料。

構建提示詞時，使用 `delegation-strategy` 的 `references/cli-prompt-skeleton.md` 骨架，填入：
- **role_name**: `程式碼診斷分析員`
- **output_path**: `{agents_dir}/logs/diagnosis_report.md`
- **task_description**: 使用以下診斷區塊

## 診斷任務區塊

填入 `{fault_symptoms}` 和 `{suspect_modules}` 後使用：

```
## 故障症狀
{fault_symptoms}

## 分析任務
1. 先讀取上方記憶模組，了解各模組的架構、追蹤的檔案、歷史決策和已知問題
2. 逐一讀取相關模組的所有追蹤檔案
3. 特別關注以下面向：
   - 資料流：追蹤資料從輸入到輸出的完整路徑
   - 錯誤處理：檢查是否有缺失的 try-catch 或未處理的邊界條件
   - 型別不一致：函式參數和回傳值是否一致
   - 模組邊界：import/export 是否正確
   - 狀態管理：非同步操作的時序、競爭條件
4. 標記所有可疑的程式碼區域，按可能性從高到低排序
5. 對每個可疑區域，附上具體的程式碼片段和懷疑理由
```

> **Scope Control**: 超過 30 個檔案時，主腦應縮小範圍，只指定最相關的記憶模組。
