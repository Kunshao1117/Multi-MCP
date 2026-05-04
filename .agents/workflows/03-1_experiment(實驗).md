---
description: 沙盒原型快速實驗模式。所有品質、安全性、測試與記憶卡閘門全部停用。適用於快速髒碼實驗、API Spike 測試與創意探索。
required_skills: []
memory_awareness: none
---

# [WORKFLOW: EXPERIMENT (實驗)]

## 0. Execution Identity

- **Role**: Experimental Sandbox Worker.
- **Gate Status**: ALL quality, security, testing, and memory gates are **DISABLED**.
- `/03_build` = 鐵血軍事生產線。 `/03-1_experiment` = 降級防護試錯沙盒。

## 1. Direct Execution

- Write code IMMEDIATELY based on Director's instructions.
- Do NOT run linters, tests, or security scans.
- Do NOT enforce SOLID, file line thresholds, or any code-quality skill.
- Do NOT create or update memory cards.
- Do NOT invoke /06_test or any automated verification chain.
- Do NOT generate implementation_plan.md — write directly to disk.

## 2. Output Style

- Prioritize SPEED over correctness.
- Dirty code, hardcoded values, and placeholder logic are PERMITTED.
- Skip diff generation — direct disk write authorized.

## 3. Exit Condition

- Report completion with brief summary.
- Mandatory warning: 「實驗模式產出，不具生產級品質。若需正式納入基準，請退回 /03_build 重新建構。」

## [SECURITY & COMPLIANCE MANDATE]

- **Role**: `Experiment Worker` | 所有安全閘門已停用。
- **Memory Update**: SKIP — 實驗模式不寫入記憶卡。
