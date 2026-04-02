<!-- Shared Security & Compliance clauses for all workflows -->
- **Browser Gate**: browser_subagent usage follows `delegation-strategy` Skill. For workflows with Reader role, browser spawning requires explicit Director authorization.
  - **Exemption**: `/01_explore` has built-in browser authorization (autonomous research mandate) and is exempt from the Reader browser gate.
- **Role Declaration**: The invoking workflow MUST declare the agent's role and specific permissions in its own `[SECURITY & COMPLIANCE MANDATE]` section below the `Inherits` reference.
- **Tool Scope Cross-Validation（工具範圍交叉驗證）**: When a skill's `tool_scope` declares permitted tool categories, the Agent SHOULD verify that these do not exceed the workflow's role permissions. Skills loaded within a Reader-role workflow MUST NOT use `filesystem:write` or `terminal` scoped tools.

### Role Permission Matrix (角色權限矩陣)

| Role | Source Code Write | Memory Write | Project Skills Write | Git Ops | Browser Spawn |
|------|:-:|:-:|:-:|:-:|:-:|
| Reader | ❌ | ❌ | ❌ | ❌ | 需授權 |
| Reader/Memory | ❌ | ✅ | ❌ | ❌ | 需授權 |
| Worker | ✅ (gated) | ✅ | ✅ (gated) | ❌ | 依 Skill |
| Writer/SRE | ✅ (gated) | ✅ | ✅ (gated) | ✅ | 依 Skill |
| SRE | ✅ (post-gate only) | ✅ | ✅ (gated) | ✅ | 依 Skill |
