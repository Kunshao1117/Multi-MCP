---
name: code-audit
description: >
  CLI-delegated code scanning procedures, scan report format, and cross-boundary analysis patterns.
  Use when: 執行 /08_audit 深度審計、需要 ESLint/安全 工具掃描、
  或任何涉及 程式碼品質掃描/安全漏洞掃描/工具報告解讀 的場景。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: read
  tool_scope: ["filesystem:read", "terminal"]
---

# Code Audit — Scan Operating Protocol

> **Prerequisite**: Load `delegation-strategy` skill first for CLI delegation SOP.

## 1. Scan Flow (掃描流程)

Six-step scan, execute in order:

1. **ESLint quality scan** — Use project-local `npm run lint` or `npx eslint .`（品質掃描）
2. **Dependency security scan** — Use terminal-native audit commands（如 `npm audit` 或 `yarn audit`）
4. **TypeScript type check** — `npx tsc --noEmit`（僅 TS 專案）
5. **TODO marker statistics** — grep TODO/FIXME/HACK/XXX/TEMP（代辦標記統計）
6. **Environment variable consistency** — Compare `.env.example` against `process.env` references（環境變數一致性）

> Full prompt templates and report formats in `references/` subdirectory.

## 2. Master Agent Analysis (主腦分析層)

After CLI scan completes, Master Agent supplements with AI-exclusive analysis（主腦補充 AI 專屬分析）:
- **Module Relationship** — Compare import dependency graph against memory card relation declarations（比對依賴圖與記憶卡關聯宣告）
- **API Integration** — Match frontend fetch calls against backend route definitions（前後端串接比對）
- **Dead Code** — Files not imported by any module, excluding entry points（未被引用的檔案）
- **Key Function Survival** — Verify that key decision functions in memory cards still exist（關鍵函式存活驗證）
- **Data Layer** — Compare model structures against API response structures（模型與 API 回應結構比對）

## 3. Batch Strategy (分批策略)

When there are more than 5 module memory cards, process 3 modules per batch. Confirm with Director between batches before continuing（每批 3 個模組，批次間向總監確認）。

## 4. References (參考資料)

- `references/scan-task-prompt.md` — Complete CLI scan task prompt
- `references/scan-report-template.md` — Scan report standard format
- `references/tool-command-reference.md` — Tool command reference and prerequisites
