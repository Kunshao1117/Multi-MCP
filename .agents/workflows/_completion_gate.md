---
description: 所有 Writer/Worker 工作流共用的靜默完成閘門。
---

<!-- Shared Completion Gate for all Writer/Worker workflows -->
Execute ALL checks below SILENTLY. Output NOTHING when checks pass.
Output ONLY when a check FAILS — use the halt message format.

```
[COMPLETION GATE — SILENT MODE]
├── [SUDO] detected in session? → Skip ALL checks. Force complete.
├── [HALT MANDATE] Writer/Worker 角色結案前，Check 0–3 中任一 FAIL → 必須 HALT，禁止靜默跳過。
├── Check 0: Circuit Breaker — same task retried > MAX_RETRY (3) per tool?
│   ├── Count failures PER TOOL (e.g., browser failures don't affect CLI retry budget).
│   ├── Only TRANSIENT errors count toward retry limit (semantic/infrastructure errors bypass).
│   └── FAIL → [HALT] 「🔴 [CIRCUIT BREAK] 同一任務已重試 {N} 次仍失敗。強制中止，請總監介入決策。」
│             Attach: last 3 error summaries for Director review.
├── Check 1: Memory Diff — modified files reflected in memory cards?
│   └── FAIL → [HALT] 「🔴 [GATE HALT] 記憶卡未同步。完成閘門強制中止，禁止結案。」
├── Check 2: Commit Verification — memory_commit called after last write?
│   └── FAIL → [HALT] 「🔴 [GATE HALT] 記憶卡寫入但未 memory_commit。完成閘門強制中止。」
├── Check 3: New File Attribution — new files tracked in memory cards?
│   └── FAIL → [HALT] 「🔴 [GATE HALT] 新建檔案未歸入記憶卡。完成閘門強制中止。」
├── Check 4: Interface Layer — completion uses business language?
│   └── FAIL → Self-correct internally. No output needed.
├── Check 5: Granularity — trackedFiles ≤ 8 per card?
│   └── FAIL → 「🟡 [GATE WARN] 記憶卡過載，建議拆分。」
├── Check 6: Skill Distillation — reusable pattern detected?
│   └── If yes → RECOMMEND /12_skill_forge (non-blocking).
├── Check 7: Documentation Sync — public/framework docs may need update?
│   ├── Did code modifications alter public interfaces, architecture, or workflows?
│   ├── YES → Check related `README.md`, `/docs`, or framework rule files for staleness.
│   │   ├── Docs outdated? → 「🔴 [GATE FAIL] 公共文件需同步更新。」
│   │   └── Docs synced? → Pass.
│   └── NO → Skip silently.
└── ALL PASS → Proceed silently. Zero output.
```