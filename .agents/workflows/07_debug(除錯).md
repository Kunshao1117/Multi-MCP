---
description: Analyzes stack traces and logs. Translates technical failures into plain-text business impact.
required_skills: [memory-ops, delegation-strategy, code-diagnosis]
memory_awareness: read
---

# [WORKFLOW: DEBUG (除錯)]

> **Required Skills**: Load `memory-ops` skill before proceeding. Load `code-diagnosis` skill if CLI diagnostic delegation is needed.

## 0. Memory Recall (記憶載入)
- Check the IDE-injected skill list for memory cards relevant to the failing module.
- Load relevant memory card SKILL.md files — check `## Known Issues` to determine if this is a documented problem.

## 1. Hardened Evidence Collection
- **Absolute Ban**: DO NOT invent or assume bug causes.
- You MUST actively use terminal tools (`cat`, `tail`, or read terminal IDs) to extract logs from the target process, browser console inputs, or the `/logs` directory based on the Director's description.

## 1.5 CLI Code Diagnosis (CLI 程式碼診斷 — 可選步驟)

> **Trigger**: Evaluate the `code-diagnosis` skill §1 trigger conditions. If ANY condition is met, execute this step. Otherwise, skip to §2.

When triggered:
1. Load `delegation-strategy` skill for the generic CLI delegation SOP (§3)
2. Load `code-diagnosis` skill for the diagnostic prompt template (§2)
3. Construct the diagnosis prompt:
   - **fault_symptoms**: Summarize the evidence collected in §1 (stack traces, error messages, Director's description)
   - **suspect_modules**: List the memory modules most likely related to the fault
4. Execute the CLI delegation following `delegation-strategy` §3 (operate-then-abandon)
5. Inform the Director: 「CLI 程式碼診斷已啟動。完成後請通知我繼續。」
6. **Wait** for the Director to confirm CLI has finished
7. Read the diagnosis report: `view_file` on `{agents_dir}/logs/diagnosis_report.md`
8. Follow `code-diagnosis` §4 review guide to validate CLI's findings
9. Incorporate validated findings into §2 Root Cause Translation

## 2. Root Cause Translation
- Generate a Root Cause Analysis (RCA) Artifact in **Traditional Chinese (繁體中文)**.
- **Structure**:
  1. 【故障症狀】(What is broken physically)
  2. 【日誌實證】(Exact excerpt of the error trace found)
  3. 【CLI 診斷摘要】(Summary of CLI diagnosis findings, if §1.5 was executed — omit if not)
  4. 【根因白話文解析】(Why it broke, translated into plain business logic)
  5. 【概念修復方案】(Proposed architectural fix)
- **Halt**: Output: `[防線鎖定] 數位鑑識完畢。若總監同意修復方向，請輸入 /fix 啟動修復程序。`

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Reader Agent`. You are STRICTLY FORBIDDEN from modifying physical source code.
