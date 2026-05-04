---
description: 打包日誌與進行遠端推播
---

# [WORKFLOW: COMMIT EXECUTE (授權備份)]

## 1. SNAPSHOT_AND_RECORD

[EXECUTE] Parse uncommitted diffs via `git diff`.
[EXECUTE] Write `CHANGELOG.md` natively in Traditional Chinese based on changes.
[CONSTRAINT] DO NOT modify memory card staleness. The scan phase is structurally isolated.

## 2. PRE_COMMIT_BUFFER

[EXECUTE] Formulate a Conventional Commit message in Traditional Chinese based on the diffs.

## 3. AUTHORIZATION_GATE

[IF-THEN-HALT]
- 印出擬定的 Commit Message 與變更紀錄。
- Print: "【防線鎖定】準備遠端備份。請輸入 GO 核准備份或要求修改註解。"
- HALT: SUSPEND GENERATION IMMEDIATELY. Require Director input exactly `GO` to proceed.

## 4. COMMIT_AND_PUSH

> [LOAD SKILL] 收到 GO 授權後，讀取推播技能：
> `view_file .agents/skills/github-ops/SKILL.md`

[EXECUTE ONLY UPON GO]
Run: `git add .`
Run: `git commit -m "{Message}"`
Run: `git push`

## 5. COMPLETION_GATE

[EXECUTE] Inherits: `.agents/workflows/_completion_gate.md`

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | 寫入與推送權限