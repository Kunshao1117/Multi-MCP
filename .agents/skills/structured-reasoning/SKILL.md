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

```
Task complexity?
├── Architecture decision with multiple trade-offs → Use
├── Deep debugging requiring multi-layer analysis → Use
├── Multi-option comparison → Use
└── Simple Q&A / fact lookup / creative writing → Do NOT use
```

## Procedure (操作流程)

### Step 1: Initialize (初始化)
Call `sequentialthinking` with:
- `totalThoughts`: 5-15 (estimate by complexity)
- `thoughtNumber`: 1
- `nextThoughtNeeded`: true

### Step 2: Iterate (迭代推理)

| Action | Parameters |
|--------|------------|
| Linear progression | Increment `thoughtNumber`, set `nextThoughtNeeded: true` |
| Revise earlier step | Set `isRevision: true` + `revisesThought: N` |
| Branch to alternative | Set `branchFromThought: N` + `branchId` |
| Extend analysis | Increase `totalThoughts` |

### Step 3: Conclude (結論)
Set `nextThoughtNeeded: false` ONLY when:
- Hypothesis generated AND verified
- Analysis synthesized into actionable output

## Constraints (約束)
- Keep `totalThoughts` as low as practical — long chains consume context
- FORBIDDEN: invoking for tasks resolvable with direct reasoning

## Done When (驗證標準)
- Final thought: `nextThoughtNeeded: false`
- Conclusion: clear, actionable recommendation
- Token investment justified by analysis quality
