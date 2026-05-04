---
name: 08-1_audit_infra(基礎盤點)
description: "[Phase 1/3] 基礎設施與記憶拓樸盤點。執行依賴安全掃描、記憶卡對齊、死碼與孤兒檔案偵測。"
trigger: manual
required_skills:
  - memory-ops
  - tech-stack-protocol
---

# [08-1_audit_infra] Infrastructure & Memory System Audit

**[SECURITY & COMPLIANCE MANDATE]**
- Role: Master Agent
- Operating Constraint: READ-ONLY analysis + Memory Card UPDATE. DO NOT modify project source code during this workflow.
- Instruction Layer: ALL logic checks must remain in Technical English.
- Target Output: Provide a summary of the Memory Map and direct the Director to trigger `/08-2_audit_logic`.

## 1. Global Workspace Security Scan

**Directive**: Analyze the project's dependency manifest (`package.json`) and configuration files to establish a security baseline.
1. Scan for any known Common Vulnerabilities and Exposures (CVEs) in `package.json`.
2. Identify deprecated or abandoned packages.
3. Check for exposed hardcoded secrets or API keys in configuration files (e.g., `.env.example`, `vercel.json`).
4. **[Env Var Parity]**: Search the codebase for `process.env.*` usage and cross-reference with `.env.example`. Identify any "ghost" environment variables that are used in code but missing from the template.

## 2. Memory System Initialization Check

**Directive**: Verify the core Antigravity paths.
1. Determine `workspace_root`, `project_root`, and `.agents_dir`.
2. IF `AGENTS.md` or the directory is empty THEN
   - `[HALT]` Output: "🔴 初始化失敗。系統未載入記憶。請先執行 `/02_blueprint` 建立架構與記憶卡。"
3. IF `_system.md` is missing inside `.agents/cartridges/` THEN
   - Trigger the `Migration Protocol` (Section 4) immediately.

## 3. Progressive Memory Skill Mapping

**Directive**: Traverse all memory skills in `.agents/cartridges/` and `.agents/project_skills/` to ensure full coverage of the active codebase.

1. **Phase A (Structure Scan)**
   - Read the `SKILL.md` for every card in the `cartridges` and `project_skills` directories.
2. **Phase B (Gap Detection & Orphan Files)**
   - Compare the documented files against the physical project structure.
   - Detect "Orphan Files" (files > 50 lines that are not mapped to ANY memory card).
   - IF orphan files exist THEN generate a list and propose which card they belong to, OR propose creating a new card.
3. **Phase C (Staleness & Schema Compliance)**
   - Check every card for the required metadata (Name, Core Entity, Scope, Timestamp).
   - Calculate Staleness Score (days since last update). IF score > 10 THEN mark for regeneration.
   - Check Granularity: IF a single card tracks > 8 files THEN output a warning recommending splitting the card.
   - IF a card tracks files that no longer exist THEN mark the card as `_archived`.
4. **Phase D (System Memory Refresh)**
   - Read `package.json` and compare it with the active stack documented in `_system.md`. Highlight any deltas.
5. **Phase E (Cross-Reference Integrity)**
   - Verify that all cards have a valid `## Relations` section pointing to other existing cards. Detect dead links.
6. **Phase F (Workflow-Skill Binding Verification)**
   - Ensure that any workflow defining `memory_awareness: true` has the corresponding `memory-ops` skill loaded.
7. **Phase G (Project Skills Health)**
   - Scan `.agents/project_skills/`. Ensure each skill has a clear `Use when:` and `DO NOT use when:` clause.

## 4. Migration Protocol (Cartridge System Fallback)

**Directive**: IF the memory system uses the legacy `knowledge/` structure instead of `.agents/cartridges/` THEN:
1. Initialize `.agents/cartridges/_system.md` mapping to the new format.
2. Inform the Director that a memory migration is underway.

## 5. Interface Layer (Output Mandate)

**[STRICT RULE]**: Output the following summary in **Traditional Chinese**. Do NOT output any English logic instructions.

> ### 🟢 基礎盤點已完成
> 
> **狀態摘要**：
> - 孤兒檔案偵測：[列出結果]
> - 記憶卡過期警報：[列出結果]
> - 依賴安全掃描：[列出結果]
> 
> 記憶卡系統已對齊完畢。請總監接續輸入 `@[/08-2_audit_logic]` 啟動深層原始碼審計。
