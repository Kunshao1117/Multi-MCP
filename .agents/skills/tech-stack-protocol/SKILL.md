---
name: tech-stack-protocol
description: >
  Tech stack discovery, lock-in, and self-mutation protocols.
  References Memory Skill System for state storage.
  Use when: 進入新專案、執行 /02_blueprint 架構設計、
  或任何涉及 技術堆疊/框架/依賴/tech stack/初始化 的決策。
---

# Dynamic Tech Stack Protocol — Full Operating Protocol

## 1. Project Exploration (探勘狀態)

When assigned to a completely new or unidentified directory (Uninitialized Project):

### Phase 1: Pre-Flight Capability Discovery

Before running any build or install commands, execute a terminal ping to map out:
- `Get-CimInstance` (Windows) or `uname` (Unix) — Host OS
- `node -v`, `python --version`, `go version` etc. — Available toolchains
- Shell type (PowerShell / Bash)

Save this matrix to `mem-_system/SKILL.md` within `.agents/skills/`.

### Phase 2: Architecture Scan

Execute a shallow scan:
- Read `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` etc.
- Record findings in `mem-_system/SKILL.md`.

### Phase 3: Framework Derivation

Derive the primary framework (e.g., Next.js, Django) and testing environment (e.g., Jest, PyTest).
Record in `mem-_system/SKILL.md`.

## 2. Locked State (鎖定狀態)

Once `mem-_system/SKILL.md` is generated or the project architecture is confirmed:
- **Absolute Freeze**: DO NOT attempt to introduce new core frameworks, languages, or ORM replacements unless explicitly commanded by the Director to perform an architectural pivot (`/02_blueprint`).

## 3. Self-Mutation Protocol (自體突變)

If the Director issues a confirmed `/02_blueprint` pivot:
- You are authorized to rewrite `mem-_system/SKILL.md` and generate new initialization scripts (`package.json` etc.) to reflect the mutated architecture.

## 4. MCP Registry (MCP 登錄簿)

When `mem-_system/SKILL.md` contains an `## MCP Servers` section:
- Treat listed MCP servers as part of the locked tech stack
- Adding/removing follows the same governance as framework changes:
  - Routine additions: `/08_audit` auto-handles
  - Architectural pivots (replacing core MCP): Requires `/02_blueprint`
- Record changes in `mem-_system/SKILL.md` under `## MCP Servers`
- Config location: `~/.gemini/antigravity/mcp_config.json` (global) or `.gemini/settings.json` (project)
- **Operational procedures**: Each MCP has its own skill (see `_index.md` routing table)
