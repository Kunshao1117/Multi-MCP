---
name: code-audit
description: >
  CLI-delegated code scanning procedures, scan report format, and cross-boundary analysis patterns.
  MCP Server: eslint, snyk
  Use when: 執行 /08_audit 深度審計、需要 ESLint/Snyk 工具掃描、
  或任何涉及 程式碼品質掃描/安全漏洞掃描/工具報告解讀 的場景。
---

# Code Audit — Scan Operating Protocol

> **Prerequisite**: Load `delegation-strategy` skill first for CLI delegation SOP.

## 1. Scan Flow (掃描流程)

六步掃描，依序執行：

1. **ESLint 品質掃描** — 優先用專案本地 `npx eslint`，無安裝時改用 MCP `eslint__lint-files`
2. **Snyk 原始碼安全掃描** — MCP `snyk__snyk_code_scan`
3. **Snyk 依賴漏洞掃描** — MCP `snyk__snyk_sca_scan`
4. **TypeScript 型別檢查** — `npx tsc --noEmit`（僅 TS 專案）
5. **代辦標記統計** — grep TODO/FIXME/HACK/XXX/TEMP
6. **環境變數一致性** — 比對 `.env.example` 與 `process.env` 引用

> 完整提示詞和報告模板見 `references/` 子目錄。

## 2. Master Agent Analysis (主腦分析層)

CLI 掃描完成後，主腦補充 AI 專屬分析：
- **Module Relationship** — 比對 import 依賴圖與記憶模組的關聯宣告
- **API Integration** — 前端 fetch 呼叫與後端路由定義比對
- **Dead Code** — 未被任何模組引用的檔案（排除入口點）
- **Key Function Survival** — 記憶模組中的關鍵決策函式是否仍存在
- **Data Layer** — 模型結構與 API 回應結構比對

## 3. Batch Strategy (分批策略)

超過 5 個記憶模組時，每批 3 個模組，批次間向 Director 確認是否繼續。

## 4. References (參考資料)

- `references/scan-task-prompt.md` — 完整 CLI 掃描任務提示詞
- `references/scan-report-template.md` — 掃描報告標準格式
- `references/tool-command-reference.md` — 工具指令對照表與前置條件
