---
name: performance-audit
description: >
  [Testing] 效能稽核操作食譜：Lighthouse CLI 掃描、Web Vitals 測量、效能報告生成。
  Use when: 需要 效能測量/Lighthouse/Web Vitals/載入速度/SEO 評分 的場景。
  DO NOT use when: 一般功能測試（用 test-patterns 或 browser-testing）、非效能相關的 UI 驗證。
metadata:
  author: antigravity
  version: "5.3"
  origin: framework
  memory_awareness: none
  tool_scope: ["terminal", "mcp:playwright"]
---

# Performance Audit — Web Vitals Recipes

## Trigger Conditions (觸發條件)

- `/08_audit` §5: Performance assessment (report output stage)
- Pre-deployment performance gate
- Director requests performance report

## Recipe 1: Lighthouse CLI Scan (Lighthouse 命令列掃描)

### Prerequisites (前置條件)

```
npm install -g lighthouse
# 或 npx lighthouse（免安裝）
```

### Execution (執行)

1. Start the development server（確保開發伺服器運行中）
2. Run Lighthouse via terminal:
   ```powershell
   npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless"
   ```
3. For multiple pages, run sequentially:
   ```powershell
   npx lighthouse http://localhost:3000 --output=json --output-path=./report-home.json --chrome-flags="--headless"
   npx lighthouse http://localhost:3000/about --output=json --output-path=./report-about.json --chrome-flags="--headless"
   ```

### Result Interpretation (結果解讀)

| 指標           | 說明             | 目標值 |
| -------------- | ---------------- | :----: |
| Performance    | 整體效能分數     |  ≥ 90  |
| Accessibility  | 無障礙分數       |  ≥ 90  |
| Best Practices | 最佳實踐分數     |  ≥ 90  |
| SEO            | 搜尋引擎優化分數 |  ≥ 90  |

### Key Metrics (關鍵指標)

| 指標 | 全名                      | 良好閾值 |  需改善  |
| ---- | ------------------------- | :------: | :------: |
| LCP  | Largest Contentful Paint  |  ≤ 2.5s  |  > 4.0s  |
| FID  | First Input Delay         | ≤ 100ms  | > 300ms  |
| CLS  | Cumulative Layout Shift   |  ≤ 0.1   |  > 0.25  |
| TTFB | Time to First Byte        | ≤ 800ms  | > 1800ms |
| INP  | Interaction to Next Paint | ≤ 200ms  | > 500ms  |

### Score → Traffic Light Gate (分數→燈號判定閘門)

```
[PERFORMANCE SCORE GATE] Lighthouse score → Traffic Light:
├── ALL four categories ≥ 90 → 🟢 Green
├── ANY category 50–89   → 🟡 Yellow
├── ANY category < 50    → 🔴 Red
└── Key Metrics breach?
    ├── ANY metric exceeds「需改善」threshold → append 🟡 per metric
    └── ALL metrics within「良好閾值」→ No additional flag
```

> This gate is referenced by `/08_audit_index` §5【效能審查】for deterministic traffic light assignment.
> （此閘門被健檢工作流引用，用於確定性的燈號判定）

## Recipe 2: Browser Navigation Metrics (瀏覽器導航效能測量)

Use Playwright MCP for real browser performance measurement:
（使用 Playwright MCP 進行真實瀏覽器效能測量）

1. `browser_navigate` — Navigate to target page
2. `browser_evaluate` — Extract Navigation Timing API data:
   ```javascript
   JSON.stringify(performance.getEntriesByType("navigation")[0]);
   ```
3. `browser_evaluate` — Extract Web Vitals:
   ```javascript
   JSON.stringify({
     domContentLoaded:
       performance.timing.domContentLoadedEventEnd -
       performance.timing.navigationStart,
     loadComplete:
       performance.timing.loadEventEnd - performance.timing.navigationStart,
     resourceCount: performance.getEntriesByType("resource").length,
   });
   ```
4. `browser_network_requests` — Analyze total request count and payload sizes

## Gotchas (踩坑點)

- Lighthouse requires Chrome/Chromium installed on the system（需要 Chrome）
- Run in `--headless` mode for CI/automation（自動化時用無頭模式）
- Development server performance ≠ production — results are relative, not absolute（開發伺服器效能 ≠ 正式環境）
- Run multiple times and average for reliable results（多次執行取平均值）
- Disable browser extensions and close other tabs during testing（測試時關閉擴充和其他分頁）

## Output Format (輸出格式)

When reporting to Director, present as:

```
📊 效能稽核報告 — {頁面名稱}
━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 95/100
✅ Accessibility: 98/100
✅ Best Practices: 92/100
✅ SEO: 100/100

關鍵指標：
  LCP: 1.8s ✅ (目標 ≤ 2.5s)
  CLS: 0.05 ✅ (目標 ≤ 0.1)
  TTFB: 420ms ✅ (目標 ≤ 800ms)
```
