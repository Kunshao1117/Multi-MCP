---
name: delegation-strategy
description: >
  Channel selection decision tree for task delegation.
  Use when: 委派瀏覽器任務、使用 browser_subagent、CLI 分析委派、
  或任何涉及 委派/管道選擇/delegation 的決策。
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
1. **Read-Only Source Code** — 禁止修改專案原始碼
2. **Report-Only Write** — 只能寫入 `.agents/logs/` 目錄
3. **Self-Context via Memory** — CLI 可主動讀取 `mem-*` 建立上下文

## 3. CLI Delegation Details (委派細節)

> 完整 CLI 委派流程、提示詞骨架、能力矩陣見 `references/` 子目錄：
> - `references/cli-delegation-sop.md` — 檔案傳令模式與清理協議
> - `references/cli-prompt-skeleton.md` — 通用提示詞骨架
> - `references/cli-capability-matrix.md` — 可用工具與已知限制

## 4. Deadlock Breaker (死鎖熔斷)

If validation loop fails **3 consecutive times**: Break → `notify_user` → Wait for Director.

## 5. Constraints (約束)

- MCP servers are **tool extensions**, NOT delegation targets
- Adding/removing MCP follows `tech-stack-protocol` §4 governance
