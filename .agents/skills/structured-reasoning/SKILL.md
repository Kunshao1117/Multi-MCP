---
name: structured-reasoning
description: >
  Sequential Thinking deep reasoning workflow: architecture decisions, debugging, multi-option analysis.
  Use when: 需要 深度推理/架構決策/除錯分析/多方案比較 的複雜場景。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  mcp_servers: [sequentialthinking]
  tool_scope: ["mcp:sequentialthinking"]
---

# Structured Reasoning (結構化推理)

## Trigger Conditions (觸發條件)
- Complex architecture decisions with multiple trade-offs
  （涉及多方權衡的複雜架構決策）
- Deep debugging requiring multi-layer call stack analysis
  （需要追蹤多層呼叫棧的深度除錯）
- Multi-option comparison requiring parallel evaluation
  （需要平行評估的多方案比較）

**NOT recommended for**: Simple Q&A, creative writing, fact lookups
（**不建議用於**：簡單問答、創意寫作、事實查詢）

## Procedure (操作流程)

### Step 1: Initialize (初始化)
Call `sequentialthinking` with:
- `totalThoughts`: Estimate based on task complexity (5-15 typical)
  （依任務複雜度估計步驟數，通常 5-15 步）
- `thoughtNumber`: Start at 1
- `nextThoughtNeeded`: true

### Step 2: Iterate (迭代推理)
Each thought can:
- **Build linearly**: Regular analytical progression
  （線性推進：常規分析步驟）
- **Revise**: Set `isRevision: true` + `revisesThought: N` to correct earlier reasoning
  （修正：標記修正並指向被修正的步驟編號）
- **Branch**: Set `branchFromThought: N` + `branchId` to explore alternatives
  （分支：從特定步驟分叉探索不同方案）
- **Extend**: Increase `totalThoughts` if more analysis needed
  （延伸：需要更多分析時增加總步驟數）

### Step 3: Conclude (結論)
Set `nextThoughtNeeded: false` only when:
- A satisfactory hypothesis has been generated AND verified
  （已產生且驗證了令人滿意的假設）
- The analysis has been synthesized into actionable output
  （分析已綜合為可執行的輸出）

## Constraints (約束)
- **Token Budget**: Long chains consume significant context. Keep `totalThoughts` as low as practical
  （長思維鏈消耗大量上下文，步驟數盡量精簡）
- **Avoid Overuse**: Do NOT invoke for tasks that can be resolved with direct reasoning
  （避免過度使用：直接推理可解決的任務不需要此工具）

## Done When (驗證標準)
- Final thought has `nextThoughtNeeded: false`
- Conclusion provides clear, actionable recommendation
- Analysis quality justifies the token investment
