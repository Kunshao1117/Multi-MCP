---
name: excel-ops
description: >
  Excel 試算表操作食譜：工作簿管理、資料寫入、格式化、圖表生成、樞紐分析表。
  MCP Server: excel
  Use when: 呼叫 excel 相關工具、資料匯出/報告生成/試算表/圖表/樞紐分析 的場景。
metadata:
  author: antigravity
  version: "5.3"
  origin: framework
  memory_awareness: none
  mcp_servers: [excel]
  tool_scope: ["mcp:excel"]
---

# Excel Ops — Spreadsheet Recipes

> This skill covers 18 tools across workbook management, data operations, formatting, charts, and pivot tables.

## Recipe 1: Create & Populate Report (建立與填充報告)

1. `create_workbook` — Create new workbook（建立新工作簿，指定檔名）
2. `write_data_to_excel` — Write structured data to worksheet（寫入結構化資料）
   - Use `startCell: "A1"` for header row, data starts from A2
   - Data format: 2D array `[["Header1","Header2"],["val1","val2"]]`
3. `format_range` — Apply formatting to headers（格式化標題列：粗體、背景色）
4. `validate_excel_range` — Verify range reference before operations（操作前驗證範圍）

## Recipe 2: Formula & Calculation (公式與計算)

1. `apply_formula` — Apply formula to a cell（套用公式）
   - Common formulas: `=SUM(B2:B100)`, `=AVERAGE(C2:C50)`, `=COUNTIF(D:D,"error")`
2. `validate_formula_syntax` — Validate formula before applying（先驗證語法再套用）
3. Use `copy_range` to replicate formulas across rows

## Recipe 3: Chart Generation (圖表生成)

1. Ensure data is populated in worksheet first
2. `create_chart` — Generate chart from data range
   - Types: `bar`, `line`, `pie`, `column`, `area`, `scatter`
   - Specify `dataRange`, `chartTitle`, `xAxisLabel`, `yAxisLabel`
3. Place chart on a separate worksheet for clean presentation

## Recipe 4: Pivot Table Analysis (樞紐分析表)

1. Ensure raw data is in a flat table format (headers + rows)
2. `create_pivot_table` — Create pivot table
   - Define `rows`, `columns`, `values`, `aggregation` (sum/count/average)
3. Use for multi-dimensional data analysis（多維度資料分析）

## Recipe 5: Worksheet Management (工作表管理)

1. `create_worksheet` — Add new sheet to workbook
2. `rename_worksheet` — Rename for clarity
3. `copy_worksheet` — Duplicate existing sheet as template
4. `delete_worksheet` — Clean up temporary sheets
5. `merge_cells` / `unmerge_cells` — For report header formatting

## Gotchas (踩坑點)

- ⚠️ **`file_path` is REQUIRED for ALL 18 tools** — every Excel tool needs a workbook file path. Omitting it causes `Received undefined` error. Specify output path for new workbooks, source path for existing ones（所有 18 個工具皆須傳入 `file_path`，缺少會報錯）
- ⚠️ **Use absolute paths** for `file_path` (e.g., `D:\\Projects\\reports\\audit.xlsx`). Relative paths may cause file-not-found errors（使用絕對路徑，避免找不到檔案）
- ⚠️ Always call `validate_excel_range` before `write_data_to_excel` to confirm range is valid（寫入前驗證範圍）
- ⚠️ Always call `validate_formula_syntax` before `apply_formula`（套用公式前驗證語法）
- ⚠️ `write_data_to_excel` overwrites existing data in target range — check first（會覆寫既有資料）
- ⚠️ Chart `dataRange` must reference populated cells with headers（圖表範圍需含標題列）

## Common Use Cases (常見應用場景)

| 場景 | 推薦 Recipe |
|------|:----------:|
| 審計報告匯出 | Recipe 1 + 2 |
| 測試結果比較表 | Recipe 1 + 3 |
| 效能指標追蹤 | Recipe 1 + 3 |
| 多維度資料分析 | Recipe 1 + 4 |
| 專案健康狀態儀表板 | Recipe 1 + 2 + 3 |
