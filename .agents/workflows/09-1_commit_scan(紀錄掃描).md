---
description: 單純前置掃描與狀態盤點，列出各項結果
---

# [WORKFLOW: COMMIT SCAN (紀錄掃描)]

## 0. PRECONDITION

[CONSTRAINT] YOU MUST READ THIS EXECUTABLE SCRIPT STRICTLY. DO NOT AUTO-COMPLETE. DO NOT GUESS.

## 1. REPOSITORY_STATUS_CHECK

[EXECUTE] Run: `pwsh .agents/scripts/Invoke-DocScan.ps1 -ProjectRoot {project_root} -AgentsDir {agents_dir}`

## 2. MEMORY_STALENESS_DETECTION

> [LOAD SKILL] 執行過期偵測前，必須讀取：
> `view_file .agents/skills/memory-ops/SKILL.md`

[EXECUTE] Compare `git diff --name-only` against tracked files in Memory System.
[EXECUTE] Analyze `staleness` count for affected memory cards.

## 3. TERMINATION_POINT

[MANDATORY_OUTPUT]
You MUST output the following two lists exactly. If no items match, output "無". DO NOT omit this step.

【狀態清單 1：第 1 步腳本回傳的檔案列表】

- (List of files output by `Invoke-DocScan.ps1`)

【狀態清單 2：過期指數 staleness 大於 0 的記憶卡列表】

- (List of memory cards whose staleness > 0 due to recent diffs)

[SUSPEND_STATE]
Wait for Director's next input.
[COGNITIVE_PRIMING]
Director has two completely valid paths:
Branch A: Director commands you to update specific documents or memory cards. (You will execute updates).
Branch B: Director directly commands `@[/09-2_commit_execute]`. (You will transition).

[FINAL_COMMAND]
Print: "【紀錄掃描結果如上】等待總監指示：您可以指示我更新上述項目，或直接執行 @[/09-2_commit_execute] 進行授權備份。"
STOP GENERATION IMMEDIATELY. NO FURTHER ACTIONS PERMITTED.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader` | 掃描唯讀權限