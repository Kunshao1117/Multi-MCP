---
name: skill-factory
description: >
  Skill generation SOP for creating new project-specific skills.
  Enforces format compliance, Director review gate, and project_skills/ isolation.
  Use when: 需要建立新的專案衍生技能、從健檢建議萃取技能、
  或任何涉及 技能產生/自動繁衍/建立新技能 的場景。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: full
  tool_scope: ["filesystem:write"]
---

# Skill Factory — Project Skill Generation Protocol

## 1. Trigger Conditions (觸發條件)

```
Trigger?
├── Director explicitly instructs skill creation → Proceed
├── /08_audit Phase G detects recurring patterns across 3+ modules → Proceed
├── /04_fix or /07_debug identifies reusable methodology → Proceed
└── None of above → Do NOT invoke this skill
```

## 2. Pre-Generation Checklist

- [ ] No existing framework skill covers this functionality
- [ ] No existing project skill covers this functionality
- [ ] Pattern is genuinely reusable (applies to 2+ future scenarios)
- [ ] Skill name follows kebab-case convention (1-64 characters)

## 3. Generation Procedure

### Step 1: Name & Scope Definition
1. Choose a descriptive kebab-case name (1-64 characters)
2. **Project skills MUST use a project-code prefix** to prevent collision with future framework skills:
   - Format: `{project-code}-{skill-name}` (e.g., `bartendermap-booking-rules`, `myapp-auth-patterns`)
   - Project code: short 2–12 char identifier matching the project (e.g., `bartendermap`, `myapp`)
   - Framework core skills NEVER use a hyphenated project-code prefix — collision is impossible by design
3. Define scope — what it covers and what it does NOT cover

### Step 2: Write SKILL.md
1. Read references/skill-template.md → 取得標準模板
2. Read references/skill-style-guide.md → 取得書寫風格規範
3. Frontmatter MUST include `metadata.origin: project`
4. `description` MUST include English + Chinese keywords for IDE trigger matching

### Step 3: Create Directory Structure
```
.agents/project_skills/{skill-name}/
├── SKILL.md           ← Core instruction file (required)
└── references/        ← Optional L3 resources
    └── ...
```

### Step 4: Register in Skill Index
1. Append one row to `.agents/project_skills/_index.md` with the new skill's keywords
2. Do NOT modify `.agents/skills/_index.md` — it is reserved for core framework skills

### Step 5: Verify Symlink Resolution
1. Confirm discoverable via `.agents/skills/_project/{skill-name}/SKILL.md`

## 4. Format Compliance Rules

### Frontmatter Standard
```yaml
---
name: {skill-name}
description: >
  {English description}.
  Use when: {中文觸發條件描述}。
metadata:
  author: antigravity
  version: "1.0"
  origin: project
  memory_awareness: none|read|full
  tool_scope: ["{scope}"]
---
```

### Body Content Standard
SKILL.md body MUST follow this section order:
1. `# {Skill Name} — {Subtitle}`
2. `## Trigger Conditions` — Decision tree or condition list
3. `## Procedure` — Numbered steps with L3 references inline
4. `## Gotchas` — ⚠️ warnings (if applicable)
5. `## Constraints` — Boundaries and limitations

### §4.5 Writing Style Rules (書寫風格規範)

Read references/skill-style-guide.md for the complete guide. Summary:

```
Every sentence in SKILL.md:
├── Directly affects AI's next action? → Keep
│   ├── Numbered steps / decision trees / rule lists
│   ├── Code examples / lookup tables / gotchas / interpretation
│   └── L3 trigger: "Read references/{file}.md"
└── Does NOT affect action? → Delete or rewrite
    ├── FORBIDDEN: "This skill teaches/enables/provides/extends..."
    ├── FORBIDDEN: "this is because...", "the purpose is..."
    ├── FORBIDDEN: rationale inside decision trees ("→ because...")
    └── Rewrite: narrative openings → decision trees
```

### §4.6 Token Budget (Token 預算約束)

| Constraint | Limit |
|-----------|-------|
| SKILL.md line count | < 500 lines |
| L2 token estimate | < 5,000 tokens (char count ÷ 3) |
| Overflow handling | Move details to `references/` as L3 resources |

### §4.7 agentskills.io Compatibility

| Field | Rule |
|-------|------|
| `name` | kebab-case, ≤ 64 characters |
| `description` | < 1024 characters |
| Directory | `{skill-name}/SKILL.md` + optional `references/` |

## 5. Director Review Gate（總監審核閘門）

1. Call `notify_user` with SKILL.md path in `PathsToReview`
2. Prompt: `[技能鍛造] 新的專案衍生技能已建立：{技能功能名稱}。請總監審閱。`
3. Skill is NOT active until Director approves

## 6. Quality Scan Gate（品質掃描閘門）

```
After generating SKILL.md:
1. Run: .agents/scripts/Measure-SkillQuality.ps1 -Target {skill-directory-path}
2. All items 🟢 → Pass → Submit for Director review
3. Any 🔴 → Fix → Re-scan
4. Read references/skill-quality-checklist.md for detailed criteria
```
