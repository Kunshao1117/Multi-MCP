---
name: tech-stack-protocol
description: >
  Tech stack discovery, lock-in, and self-mutation protocols.
  References Memory Skill System for state storage.
  Use when: 進入新專案、執行 /02_blueprint 架構設計、
  或任何涉及 技術堆疊/框架/依賴/tech stack/初始化 的決策。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: full
  tool_scope: ["filesystem:read", "mcp:cartridge-system"]
---

# Dynamic Tech Stack Protocol — Full Operating Protocol

## 1. Project Exploration (探勘狀態)

```
Project state?
├── No `.agents/memory/_system/SKILL.md` exists → Execute Phase 1/2/3 below
└── `_system` exists with populated tech stack → Skip to §2 Locked State
```

### Phase 1: Pre-Flight Capability Discovery

1. Run `Get-CimInstance` (Windows) or `uname` (Unix) → Host OS
2. Run `node -v`, `python --version`, `go version` → Available toolchains
3. Detect shell type (PowerShell / Bash)
4. Save matrix to `.agents/memory/_system/SKILL.md`

### Phase 2: Architecture Scan

1. Read `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` etc.
2. Record findings in `.agents/memory/_system/SKILL.md`

### Phase 3: Framework Derivation

1. Derive primary framework (e.g., Next.js, Django) and testing environment (e.g., Jest, PyTest)
2. Record in `.agents/memory/_system/SKILL.md`

## 2. Locked State (鎖定狀態)

Once `_system` SKILL.md is generated:
- **Absolute Freeze**: Do NOT introduce new core frameworks, languages, or ORM replacements
- Exception: Director explicitly commands `/02_blueprint` architectural pivot

## 3. Self-Mutation Protocol (自體突變)

Triggered by confirmed `/02_blueprint` pivot:
1. Rewrite `.agents/memory/_system/SKILL.md`
2. Generate new initialization scripts (`package.json` etc.)

## 4. MCP Registry (MCP 登錄簿)

When `.agents/memory/_system/SKILL.md` contains an `## MCP Servers` section:
- Treat listed MCP servers as part of the locked tech stack
- Adding/removing follows the same governance as framework changes:
  - Routine additions: `/08_audit` auto-handles
  - Architectural pivots (replacing core MCP): Requires `/02_blueprint`
- Record changes in `.agents/memory/_system/SKILL.md` under `## MCP Servers`
- Config location: `~/.gemini/antigravity/mcp_config.json` (global) or `.gemini/settings.json` (project)
- **Operational procedures**: Each MCP has its own skill (see `_index.md` routing table)
