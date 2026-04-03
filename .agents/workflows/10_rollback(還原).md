---
description: Ultimate "rewind button" that uses 'git log' and explicit visual diff checks to safely revert the project to a prior stable state.
required_skills: [memory-ops, cross-lingual-guard]
memory_awareness: full
---

# [WORKFLOW: ROLLBACK (還原)]

## 1. Local Git Rollback Analysis
- Run `git log --oneline -n 10` to retrieve the recent history.
- Assess which commit the Director intends to rollback to.

## 2. Blast Radius Artifact (Visual Diff)
- Before executing any hard resets, calculate the blast radius (which files will be lost/reverted).
- You MUST NOT autonomously trigger `git reset --hard` or `git revert` blindly.

## 3. Output Mandate & Authorization Gate (Strictly zh-TW)
You MUST halt and output an Artifact or Response EXACTLY matching this Traditional Chinese template:

【時光回溯協議鎖定】: 正在計算回還原爆炸半徑...
【將復原至節點】: <SHA Hash - Commit Name>
【以下功能的變更將會被永久消除】:
<列出受影響的功能模組，附上對應的檔案路徑。格式範例：「登入驗證功能 (auth/login.ts)」>
> [!CAUTION]
> 總監，以上的程式碼將會徹底消失。確認要扣動扳機？請輸入 GO 授權。

## 4. Execution
- Upon the Director's **GO** signal, execute the precise Git rollback command (e.g. `git reset --hard <hash>`).
- Agent MUST update all affected memory card SKILL.md files to reflect the reset state (revert `## Tracked Files`, `## Key Decisions`, and `status` as needed).

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `SRE` | 權限依安全閘門矩陣。破壞性 Git 操作僅限閘門通過後執行。
