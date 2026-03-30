---
description: 
---

<!-- Shared Completion Gate for all Writer/Worker workflows -->
Before reporting completion to the Director, verify ALL of the following:
- [ ] **Memory Diff Check**: List ALL source files you modified in this session. Cross-reference against memory cards' Tracked Files. If overlap found → use the `memory-ops` skill and call `cartridge-system__memory_update` to update those memory cards NOW. If no memory cards exist in this project → skip.
- [ ] Memory Update Summary included in output
- [ ] **Interface Layer Check (介面層檢查)**: The completion report uses business-level descriptions, NOT raw code identifiers. Memory Update Summary must describe WHAT CHANGED in business terms (e.g., "更新了安全模組的已知問題" instead of "updated security memory card Known Issues section").
- [ ] **Granularity Gate (粒度閘門)**: For each memory card updated in this session, verify trackedFiles count ≤ 8. If exceeded → propose split to Director before reporting completion.
