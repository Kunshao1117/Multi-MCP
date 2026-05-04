---
name: code-diagnosis
description: >
  [Audit] CLI-delegated broad codebase reading and cross-module fault diagnosis.
  Use when: 故障涉及 3+ 模組或需讀取 15+ 檔案的大範圍診斷、跨系統邊界（前後端/API/資料庫）的故障定位。
  DO NOT use when: 單一模組內的簡單除錯（主腦直接處理）、工具掃描（用 code-audit）。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: read
  tool_scope: ["filesystem:read"]
---

# Code Diagnosis — Diagnostic Analysis Protocol

> **Prerequisite**: Load `delegation-strategy` skill first for CLI delegation SOP.

## 1. Trigger Conditions (觸發條件)

Conditions for delegating to CLI（符合任一即可）:

- Fault involves **more than 3** modules（故障涉及 3 個以上模組）
- Requires reading **more than 15** source files（需讀取超過 15 個檔案）
- Fault **crosses system boundaries**（前端↔後端、API↔資料庫）
- Director explicitly requests it（總監明確要求）

If none of the above apply, Master Agent handles directly（以上皆不符合時，主腦直接處理）。

## 2. Diagnosis Flow (診斷流程)

1. Master Agent constructs CLI task prompt (using `delegation-strategy` skeleton + this skill's diagnosis block)
2. CLI reads memory modules → reads tracked files → marks suspicious areas → writes report
3. Master Agent reviews report, supplements CLI blind spots (runtime behavior, external service interactions)
4. Synthesize CLI report and Master Agent evidence into final root cause analysis

> **Scope Control**: When exceeding 30 files, narrow scope to only the most relevant memory modules（超過 30 個檔案時縮小範圍）。

## 3. Master Agent Review (主腦複查)

- **Verify suspicious areas** — Combine architectural knowledge to judge if CLI's suspicions are reasonable（驗證可疑區域）
- **Supplement blind spots** — Runtime behavior, deployment config, external service interactions（補充執行期行為、部署設定、外部服務互動）
- **Synthesize output** — Merge into final root cause analysis report（合併為最終根因分析報告）

## 4. References (參考資料)

- `references/diagnosis-task-prompt.md` — Complete diagnosis task prompt
- `references/diagnosis-report-template.md` — Diagnosis report standard format
