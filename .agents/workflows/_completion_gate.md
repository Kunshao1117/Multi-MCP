<!-- Shared Completion Gate for all Writer/Worker workflows -->
Before reporting completion to the Director, verify ALL of the following:
- [ ] **Memory Diff Check**: List ALL source files you modified in this session. Cross-reference against `mem-*` skills' Tracked Files. If overlap found → update those memory skills NOW. If no `mem-*` skills exist in this project → skip.
- [ ] `audit_trail.jsonL` appended
- [ ] Memory Update Summary included in output
- [ ] **Interface Layer Check (介面層檢查)**: The completion report uses business-level descriptions, NOT raw code identifiers. Memory Update Summary must describe WHAT CHANGED in business terms (e.g., "更新了安全模組的已知問題" instead of "updated mem-security/SKILL.md Known Issues section").
