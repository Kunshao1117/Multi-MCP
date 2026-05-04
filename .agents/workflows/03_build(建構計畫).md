---
description: 第一階段（共 2 階段）— 載入記憶、生成實作計畫、等待總監核准。支援沙盒模式（快速原型，繞過審查）。核准 GO 後，自動串連 /03-2_build_execute。
required_skills: [memory-ops, tech-stack-protocol]
memory_awareness: read
---

# [WORKFLOW: BUILD — PLAN (建構計畫)]


## 0. Execution Identity（角色識別 — 必讀）

[MODE GATE] Classify execution context before proceeding:
- IF (Director explicitly invoked /03-1_experiment or used keyword "實驗"/"沙盒"):
  - [SANDBOX MODE] Write code IMMEDIATELY to disk. Skip §1–§4.
  - Do NOT run linters, tests, or security scans. Do NOT update memory cards.
  - Dirty code, hardcoded values, and placeholder logic are PERMITTED.
  - Report completion with mandatory warning:
    「⚠️ 實驗模式產出，不具生產級品質。若需正式納入基準，請退回 /03_build 重新建構。」
- ELSE:
  - [PRODUCTION MODE] Continue to §1.

> [LOAD SKILL] §1 執行前，必須讀取：
> `view_file .agents/skills/memory-ops/SKILL.md`

## 1. Memory Recall（記憶載入）

- 從 IDE 注入的技能清單中，找出與目標模組相關的記憶卡。
- 載入相關記憶卡的 `SKILL.md`，了解模組架構、追蹤檔案、決策記錄、已知問題。
- 查看 `## Relations` 段落，確認可能被此次建構影響的跨模組依賴關係。
- 查看 `## Applicable Skills` 段落，確認應載入的操作技能已啟動。

## 2. Context & Blueprint Acquisition（情境與藍圖讀取）

- 使用已載入的記憶技能，理解模組架構與當前狀態。
- 嚴格遵守 `/02_blueprint` 或總監指定的藍圖 / 實作計畫。
- 根據 Glob 模式，自動套用 `.agents/rules/` 中所有適用的規範。

> [LOAD SKILL] §3 產出計畫並涉及程式碼時，必須讀取：
> 1. `view_file .agents/skills/code-quality/SKILL.md`
> 2. `view_file .agents/skills/security-sre/SKILL.md`

## 3. Planning Mode & Diff Generation（規劃模式與差異生成）

- **必須**呼叫 `task_boundary` 進入 `PLANNING` 模式。
- 將所有新程式碼或修改寫入**隔離的沙盒記憶體**。
- **嚴禁**在此階段寫入物理檔案系統。
- 產出詳細的 `implementation_plan.md` Artifact，附上程式碼 `diff`，並明確標記：
  - **[MODIFY]**：修改的現有檔案
  - **[NEW]**：本次建構將新建的原始碼檔案（後續歸卡流程依賴此清單）
  - **[DELETE]**：將被刪除的檔案

## 4. Code Review Gate（程式碼審查閘門）

- **停止**：呼叫 `notify_user`，將 `implementation_plan.md` 放入 `PathsToReview`，並輸出：
  > `[最高授權閘門] 實體建構計畫已完成。請總監審閱上方計畫。系統防護中。請輸入 GO 授權覆寫，或留言退回。`
- **等待 GO 指令**。收到核准後，**必須**呼叫 `task_boundary` 切換至 `EXECUTION` 模式，並立即觸發 `/03-2_build_execute` 工作流繼續執行。

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | Permissions based on the security gate matrix。
- **Memory Update**: READ-ONLY at this stage — 實體寫入與記憶歸卡在 `/03-2_build_execute` 執行。
