<!-- Shared Security & Compliance clauses for all workflows -->

```
[ROLE LOCK GATE] At workflow entry:
├── Verify Agent role matches workflow declaration.
│   ├── Match → Proceed silently.
│   └── Mismatch → [HALT] 「🔴 [ROLE HALT] 角色權限不符，拒絕執行。」
├── [SUDO] detected? → Allow Role Impersonation. Override role to Writer/SRE.
└── Proceed to workflow body.
```
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

### Turbo Safety Gate (Turbo 安全攔截閘門)

Even when `// turbo-all` is annotated in a workflow, you MUST set `SafeToAutoRun: false` if the command contains ANY of the following destructive patterns:

| Pattern | 風險說明 |
|---------|---------|
| `reset --hard` | 不可逆版本回滾，永久丟失提交 |
| `Remove-Item -Recurse` | 遞迴刪除目錄，無法復原 |
| `rm -rf` | Unix 遞迴強制刪除 |
| `DROP TABLE` / `DROP DATABASE` | 資料庫物理刪除 |
| `Format-Volume` | 磁碟格式化 |
| `git clean -fd` | 未追蹤檔案永久清除 |

These commands require explicit Director confirmation regardless of turbo annotation. `SafeToAutoRun` MUST remain `false` even under `// turbo-all`.
