<!-- Shared Security & Compliance clauses for all workflows -->
- **Browser Gate**: browser_subagent usage follows `delegation-strategy` Skill. For workflows with Reader role, browser spawning requires explicit Director authorization.
  - **Exemption**: `/01_explore` has built-in browser authorization (autonomous research mandate) and is exempt from the Reader browser gate.
- **Audit Trail**: Governed by Core Mandate §7. Log major workflow phase completions to `.agents/logs/audit_trail.jsonL`.
- **Role Declaration**: The invoking workflow MUST declare the agent's role and specific permissions in its own `[SECURITY & COMPLIANCE MANDATE]` section below the `Inherits` reference.

### Role Permission Matrix (角色權限矩陣)

| Role | Source Code Write | Memory Write | Git Ops | Browser Spawn |
|------|:-:|:-:|:-:|:-:|
| Reader | ❌ | ❌ | ❌ | 需授權 |
| Reader/Memory | ❌ | ✅ | ❌ | 需授權 |
| Worker | ✅ (gated) | ✅ | ❌ | 依 Skill |
| Writer/SRE | ✅ (gated) | ✅ | ✅ | 依 Skill |
| SRE | ✅ (post-gate only) | ✅ | ✅ | 依 Skill |
