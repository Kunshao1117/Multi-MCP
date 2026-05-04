---
trigger: model_decision
description: 禁用詞彙強制規範。在生成面向總監的輸出、撰寫實作計畫、或審查變更描述文字時載入。將裸露的程式碼識別符對映至介面層所需的商業層級描述。
---

# [ANTIGRAVITY FORBIDDEN VOCABULARY]

## 1. Scope & Activation

Load this rule ONLY when:
- Generating Director-facing text outputs (reports, summaries, confirmations)
- Writing implementation plan change descriptions
- Reviewing or producing task completion narratives

Do NOT load for: internal tool invocations, YAML fields, schema definitions.

## 2. Forbidden Vocabulary Mapping (禁用詞彙對照表)

| ❌ Raw Code Identifier | ✅ Business Description (zh-TW) |
| ---------------------- | ------------------------------- |
| `memory/*/SKILL.md`    | 模組記憶                        |
| `Tracked Files`        | 追蹤的檔案清單                  |
| `Key Decisions`        | 歷史決策紀錄                    |
| `Module Lessons`       | 模組教訓                        |
| `Known Issues`         | 已知問題                        |
| `staleness`            | 記憶過期指數                    |
| `memory-ops`           | 記憶操作指引                    |
| `project_skills/`      | 專案衍生技能                    |
| `skill-factory`        | 技能工廠                        |
| `_project`             | 衍生技能連結                    |

## 3. Enforcement Rule

Before finalizing ANY Director-facing text:
1. Scan for occurrences of column 1 identifiers above.
2. Replace with column 2 equivalents.
3. If a technical term has no mapping, accompany it with a plain-language explanation in parentheses.
