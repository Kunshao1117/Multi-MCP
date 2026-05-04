---
description: 第二階段（共 2 階段）— 授權實體執行已核准的修復。寫入磁碟、更新記憶卡、執行回歸測試。需 /04-1_fix_plan 的明確 GO 授權。
required_skills:
  [memory-ops, security-sre, test-patterns, impact-test-strategy, trunk-ops]
memory_awareness: full
---

# [WORKFLOW: FIX EXECUTE (修復執行)]


## 1. Authorization Check

- [ASSERT] Confirm the current conversation context contains explicit Director authorization from `04-1_fix_plan`.
- [ASSERT] Confirm `implementation_plan.md` artifact exists and has been reviewed by the Director.
- [ASSERT] Call `task_boundary` to switch to `EXECUTION` mode.

## 2. Physical Fix Execution

> [LOAD SKILL] Before writing fix to disk, you MUST consult:
> `view_file .agents/skills/security-sre/SKILL.md`

- [EXECUTE] Apply the fix strictly as defined in `implementation_plan.md`. Modify only the target files and lines specified.
- [FORBIDDEN] Do NOT touch any file outside the approved plan scope.

## 3. Mandatory Distillation

- [EXECUTE] Immediately after writing the fix:
  1. Append the lesson to the affected memory skill's `## Known Issues` or `## Module Lessons`.
  2. Update the memory skill's frontmatter (`last_updated`, `staleness: 0`).
- [EXECUTE] Execute `impact-test-strategy` skill § 3 to auto-generate a regression test for this fix.
- [ASSERT] If the same module has surfaced the same class of bug more than twice, RECOMMEND creating a defensive skill via `/12_skill_forge`.

## 4. Automated Re-Verification Loop

[FIX CIRCUIT BREAKER] Post-patch verification:
- Run regression tests on patched files.
- IF (Tests PASS): Chain to `/06_test` silently.
- IF (Tests FAIL - regression detected):
  - IF ([SUDO] detected in Director prompt): Bypass revert. Keep dirty patch. Warn Director.
  - ELSE: Auto-revert patch (`git checkout` on affected files). Trigger auto-repair loop (max 2 attempts).
  - IF (FAIL after 2 attempts): [HALT] Output exactly: 「🔴 [FIX HALT] 修復導致回歸且自動修復失敗 (2/2)。已退版。請總監介入。」

## COMPLETION GATE

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | Permissions based on the security gate matrix。
- **Memory Update**: After executing the fix, update all affected memory card SKILL.md files.

---

`...EOF... — Agent inference context physically terminates here.`
