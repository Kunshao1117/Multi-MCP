---
description: 第二階段（共 2 階段）— 授權實體執行已核准的建構計畫。寫入磁碟、歸檔新檔案記憶卡、更新受影響記憶卡、執行測試。需 /03_build 的明確 GO 授權。
required_skills: [memory-ops, security-sre, code-quality, test-patterns, trunk-ops]
memory_awareness: full
---

# [WORKFLOW: BUILD — EXECUTE (建構執行)]


> **前置條件**: 本工作流須由 `/03_build(建構計畫)` 的 GO 授權後方可執行。

## 0. Precondition Check（前置條件確認）

[PRECONDITION GATE] Verify authorization before any disk write:
- IF (Not triggered by an explicit GO approval from /03_build):
  - [HALT] Output exactly: 「🔴 [AUTH HALT] 未收到建構計畫授權。請先執行 /03_build 並取得 GO 確認。」
- ELSE:
  - Load `implementation_plan.md` to identify [NEW] and [MODIFY] file lists. Proceed to §1.

## 1. Physical Write（實體寫入磁碟）

- 呼叫 `task_boundary` 切換至 `EXECUTION` 模式。
- 依 `implementation_plan.md` 的 diff 清單，將所有變更**寫入物理磁碟**。
- 寫入順序：**依賴者先於被依賴者**（底層模組先寫，上層模組後寫）。

// turbo

## 2. New File Memory Card Archiving（新建檔案歸卡歸檔）

[MEM ARCHIVE GATE] For every [NEW] file in implementation_plan.md:
- IF (An existing memory card already tracks this module's scope):
  - [LOAD SKILL] `view_file .agents/skills/memory-ops/SKILL.md`
  - Append new file to that card's `## Tracked Files` section. Update `last_updated`.
- ELSE (No existing card found):
  - [LOAD SKILL] `view_file .agents/skills/memory-ops/SKILL.md`
  - Create a new memory card. Populate: Tracked Files, Key Decisions, Relations, Applicable Skills.
- CONSTRAINT: Memory card descriptions MUST include Traditional Chinese keywords.
- HALT CHECK: If card creation/update fails, [HALT] and output: 「🔴 [MEM HALT] 新建模組尚未完成歸卡。」 Do NOT proceed to §3.

## 3. Modified File Memory Update（修改檔案記憶卡更新）

[MEM UPDATE GATE] For every [MODIFY] file in implementation_plan.md:
- IF (Found the memory card tracking this file):
  - Update Key Decisions, Known Issues, Module Lessons, and `last_updated`.
- ELSE (Card not found):
  - [LOAD SKILL] `view_file .agents/skills/memory-ops/SKILL.md` and create it.
- HALT CHECK: If card update fails, [HALT] and output: 「🔴 [MEM HALT] 記憶卡尚未更新。」 Do NOT proceed to §4.

## 4. Unit Test Generation（單元測試熔斷器）

> [LOAD SKILL] 執行測試前，必須讀取：
> `view_file .agents/skills/test-patterns/SKILL.md`

[TEST CIRCUIT BREAKER] After §1–§3 complete:
- Consult `test-patterns` skill §1 to decide if unit tests are required.
- IF (Unit tests NOT required): Proceed to §5 silently.
- IF (Unit tests required): Run tests.
  - IF (Tests FAIL): Trigger auto-repair loop (max 3 attempts).
  - IF (FAIL after 3 attempts): [HALT] Output exactly: 「🔴 [BUILD HALT] 單元測試修復失敗 (3/3)。請總監介入診斷。」
- IF (Tests PASS or auto-repaired): Chain to §5.

> ⚠️ 此正規工作流**嚴禁使用 [SUDO] 破窗**。品質不達標就是死鎖。

// turbo

## 5. Automated Chaining to Test（自動串聯視覺測試）

- 單元測試通過後，**必須自主觸發** `/06_test` 工作流，對自身的修改執行視覺驗證。
- **禁止**要求總監手動執行測試工作流。

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | Permissions based on the security gate matrix。
- **Memory Update**: MANDATORY — §2 與 §3 強制執行，不可略過。違反即 HALT。
