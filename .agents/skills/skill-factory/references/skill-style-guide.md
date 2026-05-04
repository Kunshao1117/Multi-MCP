# 技能書寫風格指南（Skill Writing Style Guide）

本文件定義 Antigravity 框架技能的書寫標準，所有新建和修改的技能 MUST 遵循此指南。

## 1. 風格決策樹

```
技能中的每一段文字：
├── 會直接影響 AI 的下一步行動？
│   ├── Yes → 保留
│   │   ├── 編號步驟（numbered steps）
│   │   ├── 決策樹（decision trees）
│   │   ├── 規則列表（rule lists，含 MUST/FORBIDDEN）
│   │   ├── 程式碼範例（implementation templates）
│   │   ├── 查找對照表（lookup tables）
│   │   ├── 踩坑點（Gotchas，格式）
│   │   └── 結果解讀（Interpretation，工具回傳值指引）
│   └── No → 刪除或改寫
│       ├── 概念引導句（"This skill teaches/enables/provides..."）→ 刪除
│       ├── 背景解釋（"this is because...", "the purpose is..."）→ 刪除
│       ├── 決策樹內理由（"→ Fast feedback, minimal disruption"）→ 刪除
│       ├── 情境敘述（"When assigned to a new directory..."）→ 改為決策樹
│       └── 哲學陳述（"Design based on user intent..."）→ 改為規則
└── 特殊：結果解讀（Interpretation）
    └── 影響 AI 對回傳值的判斷 → 保留
```

## 2. 禁用詞彙

在 SKILL.md 的 L2 指令區中，以下開頭模式 FORBIDDEN：

| 禁用模式                 | 替代方案                                                     |
| ------------------------ | ------------------------------------------------------------ |
| `This skill teaches...`  | 直接進入步驟或決策樹                                         |
| `This skill enables...`  | 直接進入步驟或決策樹                                         |
| `This skill provides...` | 直接進入步驟或決策樹                                         |
| `This skill extends...`  | 若需引用 Core Mandate，改為在 frontmatter description 中註明 |
| `this is because...`     | 刪除，或改為 Gotcha                                          |
| `the purpose is...`      | 刪除                                                         |
| `the reason is...`       | 刪除                                                         |

## 3. 區塊對照表

| ❌ 教學式                                                                                            | ✅ 命令式                                                                                       |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `This skill teaches the Agent to analyze change impact BEFORE modifying code. It helps determine...` | 移除，直接以 `## 1. Impact Analysis Flow` 開始                                                  |
| `Each thought can: Build linearly: Regular analytical progression (線性推進：常規分析步驟)`          | `Linear: Set nextThoughtNeeded: true, increment thoughtNumber`                                  |
| `When assigned to a completely new or unidentified directory (Uninitialized Project):`               | `Project state? ├── No _system card → Execute Phase 1/2/3 └── _system exists → §2 Locked State` |
| `→ Fast feedback, minimal disruption`                                                                | 刪除（決策樹內不放理由）                                                                        |
| `Before applying jargon isolation, determine the target user persona for the specific UI component:` | `Determine UI target audience: ├── L1 (B2C) → ... ├── L2 (B2B) → ... └── L3 (Dev) → ...`        |

## 4. 結構範本

```markdown
---
name: { kebab-case-name }
description: >
  {English functional description}.
  {MCP Server: xxx (if applicable)}
  Use when: {中文觸發條件}。
metadata:
  author: antigravity
  version: "{x.x}"
  origin: framework|project
  memory_awareness: none|read|full
  tool_scope: ["{scope}"]
---

# {Skill Title} — {Subtitle}

## Section 1: {Topic}

### Step 1: {Action}

1. {Do this}
2. {Do that}
3. Read references/{xxx}.md → {取得什麼}

## Gotchas (踩坑點)

- {Warning}

## Constraints (約束)

- {Rule 1}
- {Rule 2}
```

## 5. L3 參考文件觸發規則

```
技能有 references/ 目錄？
├── Yes → 在步驟中明確寫 "Read references/{filename}.md"
│         指明在哪個步驟讀取、讀取後取得什麼
│         底部允許保留 References 快速索引（僅列檔名）
└── No → 不需處理
```

## 6. 風格密度對照表（Style Density Matrix）

依 `metadata.style` 宣告，控制技能中可使用的元素：

| 元素              | 🔴 `imperative` |  🟡 `hybrid`  |     🟢 `guided`      |
| ----------------- | :-------------: | :-----------: | :------------------: |
| code fence 閘門   |  ✅ 必備（≥1）  | ✅ 限決策節點 |       ❌ 禁止        |
| HALT 停機指令     |     ✅ 必備     | ✅ 限決策節點 |       ❌ 禁止        |
| `[SUDO]` 豁免路徑 |     ✅ 必備     |    ✅ 必備    |      ❌ 不適用       |
| 食譜步驟          |      可有       |    ✅ 主體    |       ✅ 主體        |
| 踩坑點            |     ✅ 可有     |    ✅ 可有    |       ✅ 可有        |
| 結果解讀表        |     ✅ 可有     |    ✅ 可有    |       ✅ 可有        |
| 決策樹            |     ✅ 可有     |    ✅ 可有    | ✅ 可有（不含 HALT） |

### 風格判定原則（選擇依據）

```
新技能的指令風格：
├── 判斷錯誤 → 安全漏洞/資料損壞/記憶污染？ → 🔴
├── 必須產出精確 PASS/FAIL？ → 🔴
├── 必須跨模組完全一致執行？ → 🔴
├── 位於工作流決策節點？ → 🟡
└── 以上皆否 → 🟢
```
