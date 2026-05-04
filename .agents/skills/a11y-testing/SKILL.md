---
name: a11y-testing
description: >
  [MCP: a11y] Accessibility scanning recipes: WCAG violation detection, result interpretation, and remediation.
  MCP Server: a11y
  Use when: 需要 WCAG 無障礙掃描/無障礙違規修復建議 的場景。
  DO NOT use when: 一般 E2E 視覺測試（用 browser-testing）、效能測量（用 performance-audit）。
metadata:
  author: antigravity
  version: "5.2"
  origin: framework
  memory_awareness: none
  mcp_servers: [a11y]
  tool_scope: ["mcp:a11y", "browser"]
---

# Accessibility Testing — 無障礙測試食譜

## 1. Scan Flow (掃描流程)

### Prerequisites (前置條件)

- Browser must be open and navigated to the target page
  （瀏覽器必須已開啟並導航到目標頁面）
- Page must be fully loaded (wait for skeleton/loading to complete)
  （頁面必須完全載入）

### Scanning Procedure (掃描步驟)

1. Call `scanAccessibility` with the current page URL
   （呼叫 `scanAccessibility` 掃描當前頁面）
2. Parse results by severity: critical → serious → moderate → minor
   （按嚴重程度解析結果）
3. For each violation, extract:
   - **Rule ID**: The WCAG rule that was violated（違反的 WCAG 規則）
   - **Impact**: How severe the violation is（嚴重程度）
   - **Target**: CSS selector of the affected element（受影響元素）
   - **Description**: What the problem is（問題描述）
   - **Help URL**: Link to remediation guidance（修復指引連結）

## 2. WCAG Target Level (WCAG 目標等級)

### Default Target (預設目標)

- **WCAG 2.1 Level AA** — This is the industry standard minimum
  （WCAG 2.1 AA 等級是業界最低標準）

### Override Protocol (覆寫協定)

If `_system` memory card contains an `## Accessibility` section with a different target level, use that instead.
（若系統記憶卡指定不同的無障礙等級，則使用該設定）

## 3. Common Violations & Fixes (常見違規與修復)

| Violation                                       | Impact   | Fix                                                     |
| ----------------------------------------------- | -------- | ------------------------------------------------------- |
| Missing alt text on images（圖片缺少替代文字）  | Critical | Add descriptive `alt` attribute to `<img>` tags         |
| Insufficient color contrast（色彩對比不足）     | Serious  | Adjust foreground/background colors to meet 4.5:1 ratio |
| Missing form labels（表單缺少標籤）             | Critical | Add `<label>` elements or `aria-label` attributes       |
| Missing heading structure（標題層次不完整）     | Moderate | Ensure proper h1→h2→h3 hierarchy                        |
| Missing language attribute（缺少語言屬性）      | Serious  | Add `lang` attribute to `<html>` tag                    |
| Non-descriptive link text（連結文字不具描述性） | Moderate | Replace "click here" with descriptive text              |
| Missing skip navigation（缺少跳轉導航）         | Moderate | Add "Skip to content" link at page top                  |
| Keyboard trap（鍵盤陷阱）                       | Critical | Ensure all interactive elements are keyboard-escapable  |

## 4. Integration with Workflows (工作流整合)

### In /06_test (測試工作流)

After visual E2E testing, add an accessibility scan step:
（視覺 E2E 測試後，新增無障礙掃描步驟）

1. Run `scanAccessibility` on each tested page
2. Include accessibility results in `walkthrough.md`
3. If critical violations found → trigger `/04_fix` for remediation

### In /08_audit (健檢工作流)

Add as Phase H — Accessibility Audit:
（新增為 Phase H — 無障礙審計）

1. Scan all major pages listed in memory cards
2. Include results in the Traffic Light Health Report
3. Critical a11y violations = 🔴 Red Light

## Constraints (限制與邊界)

- This skill ONLY covers automated scanning — it cannot catch all accessibility issues
  （本技能僅涵蓋自動化掃描，無法捕捉所有無障礙問題）
- Manual testing (screen reader, keyboard navigation) requires Director involvement
  （手動測試需要總監參與）
- Scanning requires the browser to be open — combine with `browser-testing` skill
  （掃描需要瀏覽器開啟，需與瀏覽器測試技能配合）
