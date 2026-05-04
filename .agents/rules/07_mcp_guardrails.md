---
trigger: model_decision
description: 外部工具操作防護欄。在呼叫高風險的 MCP 工具（如資料庫操作、雲端部署、程式碼推送）時適用。
---

# [ANTIGRAVITY MCP GUARDRAILS]

## 1. MCP Human-In-The-Loop Gate (高風險外部工具攔截)

```
[MCP HITL GATE] Before executing ANY state-mutating MCP tool:
├── Is the MCP action purely READ-ONLY (e.g., list, get, search, query docs)?
│   └── YES → Check §2 Tool-Level Permission Matrix for override. If 🟢 LOW → Skip gate. Proceed silently.
├── Does the Director prompt contain [SUDO]?
│   └── YES → Skip this gate entirely. Proceed without constraints.
├── Is the action STATE-MUTATING (e.g., write, update, delete, deploy, push)?
│   └── YES → Agent MUST first output a Justification Block:
│         【操作理由】為什麼需要執行此操作（商業語言描述）
│         【影響範圍】此操作可能影響的系統或資料
│         【回滾方案】若操作失敗的復原策略
│         THEN → [HALT] 「🔴 [MCP HALT] 偵測到破壞性外部工具呼叫 ({ToolName})。請總監輸入 [SUDO] 或明確同意。」
│         DO NOT execute the tool. Stop current task.
└── All clear → Execute tool.
```

- **Definition**: A state-mutating MCP tool is any tool that changes remote infrastructure, database schemas/data, or version control states (e.g., `supabase__apply_migration`, `github__push`, `cloudflare-ops` container modifications).
- **Enforcement**: This is a strict safety bound to prevent accidental destructive actions by the AI.

## 2. Tool-Level Permission Matrix (工具級權限分級)

When a specific tool is listed below, its risk level OVERRIDES the general READ/WRITE classification in §1.
When a tool is NOT listed, fall back to §1 READ/WRITE classification.

| Tool Name | Risk Level | Approval Gate |
|-----------|-----------|---------------|
| `supabase.execute_sql` (non-SELECT) | 🔴 HIGH | Director approval + Justification Block |
| `supabase.apply_migration` | 🔴 HIGH | Director approval + Justification Block |
| `supabase.deploy_edge_function` | 🔴 HIGH | Director approval + Justification Block |
| `github.create_or_update_file` | 🟡 MEDIUM | Justification Block (auto-logged) |
| `github.push_files` | 🟡 MEDIUM | Justification Block (auto-logged) |
| `cloudflare.container_*` (mutating) | 🟡 MEDIUM | Justification Block (auto-logged) |
| `supabase.execute_sql` (SELECT only) | 🟢 LOW | Auto-proceed |
| `supabase.list_tables` | 🟢 LOW | Auto-proceed |
| `supabase.search_docs` | 🟢 LOW | Auto-proceed |
| `supabase.get_logs` | 🟢 LOW | Auto-proceed |
| `supabase.list_*` | 🟢 LOW | Auto-proceed |
| `supabase.get_*` | 🟢 LOW | Auto-proceed |
| `github.search_repositories` | 🟢 LOW | Auto-proceed |
| `github.get_*` | 🟢 LOW | Auto-proceed |
| `github.list_*` | 🟢 LOW | Auto-proceed |
| `cloudflare.kv_get` | 🟢 LOW | Auto-proceed |
| `cloudflare.accounts_list` | 🟢 LOW | Auto-proceed |
