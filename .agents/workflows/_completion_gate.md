---
description: 
---

<!-- Shared Completion Gate for all Writer/Worker workflows -->
Before reporting completion to the Director, verify ALL of the following:
- [ ] **Memory Diff Check**: List ALL source files you modified in this session. Cross-reference against memory cards' Tracked Files. If overlap found → use the `memory-ops` skill to update those memory cards NOW (write_to_file → memory_commit). If no memory cards exist in this project → skip.
- [ ] **Commit Verification (歸卡驗證)**: For EVERY memory card updated in this session, confirm that `memory_commit` was called AFTER the last write. If any card was written but not committed → call `memory_commit` NOW before proceeding.
- [ ] **New File Attribution (新建檔案歸屬)**: If ANY new source files were created in this session, verify each file appears in at least one memory card's Tracked Files. If untracked files exist → execute memory-ops § 4.5.
- [ ] Memory Update Summary included in output
- [ ] **Interface Layer Check (介面層檢查)**: The completion report uses business-level descriptions, NOT raw code identifiers. Memory Update Summary must describe WHAT CHANGED in business terms (e.g., "更新了安全模組的已知問題" instead of "updated security memory card Known Issues section").
- [ ] **Granularity Gate (粒度閘門)**: For each memory card updated in this session, verify trackedFiles count ≤ 8. If exceeded → propose split to Director before reporting completion.
- [ ] **Skill Distillation Check (技能萃取檢查)**: If this session revealed a reusable pattern, debugging methodology, or operational recipe that does NOT already exist in any framework or project skill, RECOMMEND creating a new project skill via `/12_skill_forge`. This is a suggestion, not a blocker.