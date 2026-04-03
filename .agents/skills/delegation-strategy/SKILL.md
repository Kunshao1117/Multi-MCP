---
name: delegation-strategy
description: >
  Channel selection decision tree for task delegation.
  Use when: 委派瀏覽器任務、使用 browser_subagent、CLI 分析委派、
  或任何涉及 委派/管道選擇/delegation 的決策。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read"]
---

# Delegation Strategy (委派策略)

## 1. Channel Selection Matrix (管道選擇矩陣)

Evaluate in this order:

1. **Browser/UI task?** → Use **browser_subagent**. Load `browser-testing` Skill
2. **Real-time tool access?** (Maps, reasoning, design) → Use **MCP tools** directly
3. **Isolated analysis context needed?**
   - 3a. **Tool scanning with large output?** → CLI fire-and-forget. Load `code-audit`
   - 3b. **Broad codebase diagnosis?** → CLI fire-and-forget. Load `code-diagnosis`
4. **None of above?** → Master Agent handles directly

> **Hot-Path Exclusion**: CLI is NOT for tasks needing immediate feedback on code just written. Use `run_command` directly.

| Channel | Context | Speed | Output |
|---------|---------|-------|--------|
| browser_subagent | Isolated (DOM) | Slow | Browser report |
| MCP tools | Shared (main) | Fast | Tool responses |
| CLI fire-and-forget | Isolated (CLI) | Medium | File on disk |

## 2. CLI Role Boundary (CLI 角色邊界)

CLI = **read-only analytical subagent**. Three absolute constraints:
1. **Read-Only Source Code** — FORBIDDEN from modifying project source code
2. **Report-Only Write** — Can only write to `.agents/logs/` directory
3. **Self-Context via Memory** — CLI reads memory cards for context

## 3. CLI Delegation Details (委派細節)

> Full CLI delegation flow, prompt skeletons, and capability matrix in `references/` subdirectory:
> - `references/cli-delegation-sop.md` — File-based command pattern and cleanup protocol
> - `references/cli-prompt-skeleton.md` — Universal prompt skeleton
> - `references/cli-capability-matrix.md` — Available tools and known limitations

## 4. Deadlock Breaker (死鎖熔斷)

If validation loop fails **3 consecutive times**: Break → `notify_user` → Wait for Director.

### Counter Persistence (計數器持久化)

Do NOT rely on conversational memory for failure counting. Use a state file:

```
On each validation failure:
├── Read `.gemini/validation_state.json` (create if missing: { "attempts": 0 })
├── Increment attempts
├── Write back to `.gemini/validation_state.json`
└── If attempts >= 3 → Break → notify_user → Reset file to { "attempts": 0 }

On validation success:
└── Delete or reset `.gemini/validation_state.json` to { "attempts": 0 }
```

## 5. Constraints (約束)

- MCP servers are **tool extensions**, NOT delegation targets
- Adding/removing MCP follows `tech-stack-protocol` §4 governance
