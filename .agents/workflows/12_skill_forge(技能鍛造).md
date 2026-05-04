---
description: 從健檢發現、除錯方法論或總監指令中萃取可重用模式，建立新的專案衍生技能。
required_skills: [skill-factory, memory-ops]
memory_awareness: full
skill_generation: true
---

# [WORKFLOW: SKILL FORGE (技能鍛造)]


## 1. Trigger Conditions (觸發條件)

This workflow is triggered by one of the following:

- Director explicitly requests a new project skill（總監明確指示建立新技能）
- `/08_audit` Phase G recommends a new skill based on pattern detection（健檢偵測到跨模組重複模式）
- `/04_fix` or `/07_debug` recommends distilling a methodology（修復/除錯後發現可萃取方法論）

## 0.5 Backfill Gate（現有技能補齊閘門）

每次進入此工作流時，先執行以下冪等腳本，掃描 `project_skills/` 下所有子目錄，對缺少對應符號連結的技能自動補建（已存在則略過）：

```powershell
$agentsRoot = Join-Path $workspace '.agents'
$skillsDir  = Join-Path $agentsRoot 'skills'
$projDir    = Join-Path $agentsRoot 'project_skills'

if (Test-Path $projDir) {
    Get-ChildItem $projDir -Directory | ForEach-Object {
        $linkPath = Join-Path $skillsDir "project-$($_.Name)"
        if (-not (Test-Path $linkPath)) {
            New-Item -ItemType SymbolicLink -Path $linkPath -Target $_.FullName | Out-Null
            Write-Host "[v] [Backfill] project-$($_.Name) 符號連結已補建"
        }
    }
    Write-Host "[OK] Backfill 完成。"
}
```

其中 `$workspace` 為當前 Workspace 根目錄（由主腦帶入）。

> [LOAD SKILL] §2 設計前，必須讀取：
> `view_file .agents/skills/skill-factory/SKILL.md`

## 2. Skill Design Planning

- You MUST call `task_boundary` to enter `PLANNING` mode.
- Load the `skill-factory` skill and read its `references/skill-template.md` for the standard format.
- Generate a draft `implementation_plan.md` containing:
  1. 【技能名稱與描述】(Proposed name in kebab-case + functional description)
  2. 【觸發場景】(When should this skill be loaded)
  3. 【操作步驟草稿】(Draft instructions)
  4. 【參考資源需求】(Whether references/ subdirectory is needed)

## 3. Director Review Gate

- **Halt**: Call `notify_user` with `implementation_plan.md` in `PathsToReview` and prompt:
  `[技能鍛造閘門] 專案衍生技能草稿已完成。請總監審閱。若同意，請輸入 GO 授權建立。`
- Wait for Director's GO signal.

## 4. Skill Generation (Execution)

Upon approval:

1. Call `task_boundary` to switch to `EXECUTION` mode.
2. Create the skill directory under `.agents/project_skills/{skill-name}/`.
3. Write `SKILL.md` following the `skill-factory` template. Frontmatter MUST include:
   ```yaml
   metadata:
     author: antigravity
     version: "1.0"
     origin: project
     memory_awareness: none|read|full
   ```
4. Create `references/` subdirectory if the skill requires L3 resources.
5. Update `.agents/skills/_index.md` to register the new project skill with keywords.
6. **[LOAD SKILL 義務更新]** 新技能建立後，MUST 宣告「此技能應加入哪些工作流的 `[LOAD SKILL]` 閘門」，並執行相應工作流的修改。

> [LOAD SKILL] 若需更新記憶卡：
> `view_file .agents/skills/memory-ops/SKILL.md`

## 5. Verification

[FORGE VALIDATION GATE] Post-generation structural check:
- IF ([SUDO] detected in Director prompt): Skip structural validation.
- ELSE:
  - Read back the generated SKILL.md.
  - IF (YAML frontmatter is NOT parseable): Auto-regenerate frontmatter. (Max 2 retries).
  - IF (Body sections do NOT match §4 order): Auto-reorder. (Max 2 retries).
  - IF (Generated skill does NOT contain [SILENT GATE] or equivalent):
    - Inject Silent Gate template into the generated skill.
    - Warn: 「This ensures all offspring skills carry the Trinity DNA.」
- Proceed to quality scan.

// turbo

- Run `.agents/scripts/Measure-SkillQuality.ps1 -Target {skill-path}` — ALL items MUST be 🟢. If any 🔴 → fix and re-scan.
- Execute symlink registration for IDE zero-touch discovery:
  ```powershell
  $agentsRoot = Join-Path $workspace '.agents'
  $skillsDir  = Join-Path $agentsRoot 'skills'
  $linkPath   = Join-Path $skillsDir  "project-${skillName}"
  $targetPath = Join-Path $agentsRoot "project_skills\${skillName}"
  if (-not (Test-Path $linkPath)) {
      New-Item -ItemType SymbolicLink -Path $linkPath -Target $targetPath | Out-Null
      Write-Host "[v] 符號連結已建立：project-${skillName}"
  } else {
      Write-Host "[OK] 符號連結已存在，略過：project-${skillName}"
  }
  ```
  其中 `$skillName` 為本次鍛造的技能名稱。
- Verify: `Test-Path (Join-Path $skillsDir "project-${skillName}\SKILL.md")` 回傳 `True` → 感知驗證通過。

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Worker` | Permissions based on the security gate matrix。衍生技能目錄寫入授權。
