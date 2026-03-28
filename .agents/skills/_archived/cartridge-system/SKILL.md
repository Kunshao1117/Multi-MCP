---
name: cartridge-system
description: >
  Antigravity Cartridge Memory System full operating protocol.
  Covers Pre-Flight reading (7 steps), Post-Flight writing (5 steps),
  cartridge structure, and lifecycle management.
  Use when: 任何涉及 卡帶/cartridge/Pre-Flight/Post-Flight/記憶系統 的工作流。
---

# Cartridge Memory System — Full Operating Protocol

## Quick Reference (速查索引)

| Protocol | Section | Steps | Trigger |
|----------|---------|-------|---------|
| Pre-Flight | §2 | 8 steps | Before ANY coding workflow |
| Post-Flight | §3 | 5 steps + Skill Impact Map + activated_skills | After EVERY coding workflow (mandatory completion condition) |
| Write Constraints | §4 | — | When updating cartridges |
| Lifecycle | §5 | — | Cartridge creation/archival (only via /08_audit) |

## 1. Cartridge Architecture (卡帶結構)

Cartridges are located at `.agents/cartridges/`, organized as modular JSON files by functional domain:

- **_index.json**: Master index with `project_root`, all cartridge names, bilingual keyword descriptions, and type (active/reference).
- **_system/cartridge.json** [reference]: Tech stack, dependencies, external services, config files.
- **{feature}/cartridge.json** [active]: Per-feature knowledge — source_paths, ui_elements, key_functions, decisions, known_issues, relations, current_state, staleness_score.

*(Note: Cross-cutting lessons are managed in `.agents/logs/episodic_log.md` instead of cartridges to facilitate Log Rotation).*

## 2. Pre-Flight Protocol (卡帶讀取協定)

Before executing ANY coding workflow (/03_build, /04_fix, /05_refactor), you MUST execute in order:

1. Read `_index.json` — get `project_root` and all cartridge descriptions.
2. Match the user's instruction keywords against cartridge `description` fields (bilingual matching: English + Chinese).
3. Load matched **active** cartridge(s) via `view_file`.
   - **Staleness Check**: If a cartridge's `staleness_score` > 10, you MUST autonomously trigger `/08_audit_index(專案健檢)` to regenerate it before proceeding.
4. Check `relations` — if the task may affect related modules, load adjacent cartridges.
5. Read `.agents/logs/episodic_log.md` for cross-cutting pitfalls.
6. **Log Size Guard**: After reading `episodic_log.md`, check its line count. If it exceeds **300 lines**, output a warning to the Director: `⚠️ episodic_log.md 已超過 300 行，建議執行 /08_audit_index 進行日誌封存。` — then continue the workflow (do NOT block).
7. Construct absolute file paths: `project_root` + `source_paths` entries → use for `view_file`.
8. **reference** cartridges (_system) are loaded ONLY when the task involves tech stack, dependencies, or deployment.

- **Single Source of Truth**: To recall project structure, you MUST query the Cartridge System, NOT conversational history.

## 3. Post-Flight Protocol (卡帶存回協定)

**A coding workflow is NOT complete until cartridges are updated. Post-Flight is a MANDATORY completion condition. Skipping Post-Flight = FAILED task.**

BEFORE outputting any completion report to the Director, you MUST:

1. Identify which cartridge(s) were affected.
2. Update each affected cartridge using `replace_file_content` on specific JSON fields (NEVER full rewrite):
   - `source_paths`: Add/remove if files were created/deleted/renamed.
   - `ui_elements`: Add if new UI components were created.
   - `key_functions`: Update if interfaces changed.
   - `decisions`: Append if new architectural decisions were made.
   - `known_issues`: Append if new issues/pitfalls were discovered.
   - `relations`: Update if cross-module dependencies changed.
   - `current_state`: ALWAYS update — what was done, what's next, any blockers.
   - `staleness_score`: ALWAYS reset to `0` when the cartridge is successfully updated.
3. If a cross-cutting lesson was learned (not module-specific), append to `.agents/logs/episodic_log.md`.
4. Update `_index.json` last_updated timestamp for affected cartridges.
5. Include a **Cartridge Update Summary** in the completion output:
   - Which cartridges were updated
   - What changed (e.g., "auth: updated current_state, added known_issue")
   - If NO cartridges were affected (rare), explicitly state: "No cartridges affected."

### Skill Impact Map (技能影響速查)

When the following skills were activated during the workflow, pay extra attention to these cartridge fields during Post-Flight:

| Activated Skill | Cartridge Fields to Check |
|----------------|--------------------------|
| code-quality | `source_paths` (file splits/renames), `key_functions` (interface changes) |
| security-sre | `key_functions` (new validators), `known_issues` (security findings) |
| ui-ux-standards | `ui_elements` (component renames), `decisions` (i18n choices) |
| test-automation-strategy | `known_issues` (test failures), `current_state` (test coverage status) |
| delegation-strategy | `current_state` (delegation outcomes) |
| tech-stack-protocol | `_system/cartridge.json` (stack changes) |

### Activated Skills Recording (技能啟用紀錄)

When updating `current_state` during Post-Flight, include an `activated_skills` list documenting which skills were loaded for this task. This provides the next AI session with a hint on which skills were relevant for similar work.

## 4. Write Mode Constraints (寫入模式限制)

- **No Full Rewrite**: Use `replace_file_content` on specific JSON fields. NEVER rewrite the entire cartridge file.
- **Language**: Cartridge content MUST be in English for token efficiency. Bilingual keywords in `description` fields are the ONLY place Chinese appears. This is an explicit exemption from the Traditional Chinese documentation mandate.

## 5. Lifecycle Management (卡帶生命週期)

- **Creation**: New cartridges are created by `/02_blueprint` (initial setup) or `/08_audit_index` (detecting uncovered modules).
- **Archival**: When `/08_audit_index` detects a module's source files no longer exist, move the cartridge folder to `_archived/`.
- **Migration**: When entering a project with `.agents/` but no `cartridges/`, `/08_audit_index` auto-initializes the cartridge system.
- **Integrity**: Cartridge creation and archival are managed ONLY by `/08_audit_index`. Other workflows only read and append-update.
- **Path Accuracy**: All `source_paths` MUST be verified against the actual filesystem. `project_root` MUST be an absolute path that works with the AI's `view_file` tool.
- **Schema Reference**: See `.agents/cartridges/SCHEMA.md` for the canonical field definitions and type constraints.

### Staleness Calculation (過時計算)

- **Reset to 0**: When Post-Flight successfully updates the cartridge.
- **+1 per commit**: `/09_commit_log` compares `git diff --name-only` against each cartridge's `source_paths`. If any source file was modified but the cartridge was NOT updated in the same session, increment `staleness_score` by 1.
- **Threshold**: `staleness_score` > 10 triggers mandatory regeneration via `/08_audit_index`.

### Schema Lifecycle（Schema 生命週期）

- **Seed**: `SCHEMA.md` is deployed as a base template by `Deploy-Antigravity.ps1`. It defines universal required fields for all projects.
- **Extension**: `/02_blueprint` SHOULD extend the "Project Extensions" section of `SCHEMA.md` with project-specific fields based on `_system/cartridge.json` tech_stack.
- **Validation**: `/08_audit` Phase C validates all cartridges against `SCHEMA.md` (base + extensions).
- **Regeneration**: If `SCHEMA.md` is missing, `/02_blueprint` or `/08_audit` MUST regenerate it using the base field definitions from §1 of this Skill.

