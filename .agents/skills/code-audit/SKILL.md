---
name: code-audit
description: >
  [Audit] CLI-delegated code scanning procedures: ESLint, npm audit, TypeScript check, TODO markers.
  Use when: 執行 ESLint 品質掃描/npm audit 安全掃描/TypeScript 型別檢查/環境變數一致性檢查 的場景。
  DO NOT use when: 執行 /08_audit 的語義推理分析（用 audit-engine）、單次修復或重構（用 /04_fix 或 /05_refactor）。
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

Multi-step scan, execute in order (see `references/scan-task-prompt.md` for full prompt):

1. **ESLint quality scan** — Use project-local `npm run lint` or `npx eslint .`（品質掃描）
2. **Dependency security scan** — Use terminal-native audit commands（如 `npm audit` 或 `yarn audit`）
3. **TypeScript type check** — `npx tsc --noEmit`（僅 TS 專案）
4. **TODO marker statistics** — grep TODO/FIXME/HACK/XXX/TEMP（代辦標記統計）
5. **Environment variable consistency** — Compare `.env.example` against `process.env` references（環境變數一致性）

> Full prompt templates and report formats in `references/` subdirectory.

## 2. Master Agent Analysis (主腦分析層)

After CLI scan completes, Master Agent supplements with AI-exclusive analysis（主腦補充 AI 專屬分析）.
In `/08_audit`, these items are decomposed into `audit-engine` §1–§4 + workflow §3.5 steps B/C/E/F/J — do NOT re-execute here（在 /08 健檢中，以下項目由 `audit-engine` 和工作流步驟細分承接，不需重複執行）:

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
