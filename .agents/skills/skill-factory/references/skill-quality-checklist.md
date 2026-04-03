# 技能品質檢查清單（Skill Quality Checklist）

品質掃描腳本 `Measure-SkillQuality.ps1` 依據本清單判定技能合規性。

## 檢查項目

### 1. 行數限制
- **規則**: SKILL.md < 500 行
- **判定**: 🟢 合格 / 🔴 超標
- **修正**: 超出部分移至 `references/` 作為 L3 資源

### 2. Token 預算
- **規則**: 字元數 ÷ 3 < 5,000
- **判定**: 🟢 合格 / 🔴 超標
- **依據**: agentskills.io L2 限制 <5,000 tokens

### 3. 教學禁用詞
- **規則**: 不含以下模式
  - `This skill teaches`
  - `This skill enables`
  - `This skill provides`
  - `This skill extends`
  - `this is because`
  - `the purpose is`
  - `the reason is`
- **判定**: 🟢 乾淨 / 🔴 發現禁用詞
- **修正**: 參考 `skill-style-guide.md` §2 替代方案

### 4. Frontmatter 完整性
- **必要欄位**:
  - `name` — kebab-case 技能名稱
  - `description` — 功能描述（含中文觸發關鍵字）
  - `metadata.author` — 作者
  - `metadata.version` — 版本號
  - `metadata.origin` — `framework` 或 `project`
- **判定**: 🟢 完整 / 🔴 缺少欄位

### 5. agentskills.io 相容性
- **name**: kebab-case，≤ 64 字元
- **description**: < 1024 字元
- **判定**: 🟢 相容 / 🔴 不符

### 6. L3 內嵌狀態
- **條件**: 僅在技能含 `references/` 目錄時檢查
- **規則**: 步驟中含 `Read references/` 或引用 `references/*.md`
- **判定**: 🟢 已內嵌 / 🟡 未內嵌 / — 無 references

## 總評判定邏輯

```
任何 🔴 → 總評 🔴（不合格）
無 🔴 但有 🟡 → 總評 🟡（警告）
全部 🟢 → 總評 🟢（合格）
```
