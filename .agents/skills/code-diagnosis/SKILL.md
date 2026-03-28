---
name: code-diagnosis
description: >
  CLI-delegated code reading and diagnostic analysis procedures.
  Use when: 執行 /07_debug 除錯時需要大範圍閱讀原始碼、
  跨模組故障定位、或任何涉及 程式碼診斷/大範圍原始碼分析/故障調查 的場景。
---

# Code Diagnosis — Diagnostic Analysis Protocol

> **Prerequisite**: Load `delegation-strategy` skill first for CLI delegation SOP.

## 1. Trigger Conditions (觸發條件)

委派給 CLI 的條件（符合任一即可）：
- 故障涉及 **3 個以上**的模組
- 需要讀取超過 **15 個**原始碼檔案
- 故障**跨越系統邊界**（前端↔後端、API↔資料庫）
- Director 明確要求

以上皆不符合時，主腦直接處理。

## 2. Diagnosis Flow (診斷流程)

1. 主腦構建 CLI 任務提示詞（用 `delegation-strategy` 骨架 + 本技能的診斷區塊）
2. CLI 讀取記憶模組 → 讀取追蹤檔案 → 標記可疑區域 → 寫入報告
3. 主腦複查報告，補充 CLI 盲點（運行時行為、外部服務互動）
4. 綜合 CLI 報告與主腦證據，產出最終根因分析

> **Scope Control**: 超過 30 個檔案時，縮小範圍只指定最相關的記憶模組。

## 3. Master Agent Review (主腦複查)

- **驗證可疑區域** — 結合架構知識判斷 CLI 的懷疑是否合理
- **補充盲點** — 運行時行為、部署設定、外部服務互動
- **綜合產出** — 合併為最終根因分析報告

## 4. References (參考資料)

- `references/diagnosis-task-prompt.md` — 完整診斷任務提示詞
- `references/diagnosis-report-template.md` — 診斷報告標準格式
