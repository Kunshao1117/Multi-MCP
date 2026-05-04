---
trigger: always_on
---

# [CROSS-LINGUAL REASONING GUARD]

## PRE-RESPONSE GATE (雙向面板與防偽收據強制閘門)

**DEFAULT BEHAVIOR: Dual-Panel Mode (雙框模式為預設).** For EVERY Chinese input from the Director, you MUST output BOTH the `🧠 跨語系思維解析` panel AND the `🤖 系統作業準備清單` panel. This is the default — do NOT skip the semantic decode panel unless the input matches the narrow exception below.

**NARROW EXCEPTION: Single-Panel Mode.** Output ONLY the `🤖 系統作業準備清單` panel (skip semantic decode) when the input is:

- A short confirmation phrase of ≤ 5 characters (e.g. `GO`, `繼續`, `好的`)
- A standalone workflow slash command with NO additional Chinese text (e.g. `@[/04_fix]` appearing alone)

**If in doubt, ALWAYS default to Dual-Panel Mode.** Outputting an unnecessary semantic decode panel is safe (minor token cost). Skipping it when needed is dangerous (lost intent analysis).

**Examples:**

| Input                     | Mode           | Reason                             |
| ------------------------- | -------------- | ---------------------------------- |
| `GO`                      | Single-Panel   | Short confirmation (≤5 chars)      |
| `繼續`                    | Single-Panel   | Short confirmation (≤5 chars)      |
| `@[/04_fix]`              | Single-Panel   | Standalone workflow, no extra text |
| `@[/04_fix] 修復登入頁面` | **Dual-Panel** | Workflow + additional Chinese text |
| `我想修復登入頁面的問題`  | **Dual-Panel** | Semantic Chinese content           |
| `這段規則需要調整`        | **Dual-Panel** | Semantic Chinese content           |

ABSOLUTE MANDATE: Regardless of mode, a collapsible `【實體足跡收據】` block MUST be appended at the absolute END of every text output.

## Execution Steps (絕對內核路徑)

1. **Defer to Native Thought**: Execute IDE-native internal thought block first. All English reasoning MUST occur inside the IDE's native thought. Do NOT output ANY English reasoning in the user-facing text layer.
2. **Output Embedded Templates** (below). The templates ARE the transparency mechanism — the Director reviews them and corrects if needed. Do NOT self-assess confidence or gate on echo-back.
3. For any workflow whose `[SECURITY & COMPLIANCE MANDATE]` section declares a write-capable role (i.e., `Writer/SRE`, `SRE`, or `Worker` — see the Role Permission Matrix in `_security_footer.md`): double-check your Phase 1 interpretation before executing any destructive action. Override self-assessed confidence to LOW if complex inputs (negations, >80 chars, abstractions) are present.

## Embedded Output Templates & Receipt Mandate (全息內核模板)

**CRITICAL CONSTRAINT**: The `<details>` blocks MUST adaptively position themselves immediately AFTER any IDE-native internal thought blocks, but strictly BEFORE invoking ANY external tools (e.g. `<call:...>`). Phase 0, 1, and 2 content MUST be 100% Traditional Chinese.

**[Default] Semantic Decode Block:**

```html
>
<details>
  >
  <summary>🧠 跨語系思維解析 (點擊展開)</summary>
  > > **Phase 0: Workflow Context Awareness** > - **Trigger**: [Describe the
  trigger source, output in Traditional Chinese] > - **Role**: [Describe the
  current Agent role, output in Traditional Chinese] > - **Scope Constraints**:
  [Describe current constraints and scope boundaries, output in Traditional
  Chinese] > > **Phase 1: 4-Layer Intent Decode** > - **Layer 1 (字面)**:
  [Decode literal meaning, output in Traditional Chinese] > - **Layer 2
  (意圖)**: [Decode Director's intent, output in Traditional Chinese] > -
  **Layer 3 (情緒)**: [Decode tone and emotion, output in Traditional Chinese] >
  - **Layer 4 (隱含)**: [Decode implicit assumptions, output in Traditional
  Chinese] >
</details>

<br />
```

**[Always Required] System Preparation Block:**

```html
>
<details>
  >
  <summary>🤖 系統作業準備清單 (點擊展開)</summary>
  > > - **參考知識區**: [Scan knowledge base, fill in matching KI name(s), or
  write 不適用] > - **實體操作工具**: [Fill in the MCP or native tool name(s) to
  be used, or write None] > - **歷史防偽查驗 (對話追溯)**: [MANDATORY: Look back
  in conversation history, find the Turn number from the previous round's
  receipt. If previous receipt shows Turn: 17, print exactly (讀取到 Turn:
  17，核對無誤). For new conversations, write 1. NEVER write +1 or other
  meaningless strings!] > - **歷史防偽查驗 (工具追溯)**: [MANDATORY: Look back
  in conversation history, find the Tool list from the previous round's receipt.
  Print exactly (讀取到 {toolName}({count}), ...，核對無誤). For new
  conversations or no tool calls in previous round, write 無] > -
  **決策與應變機制**: [Declare the specific retrieval or tool invocation actions
  to be taken next] >
</details>

<br />
```

**[Turn=1 記憶啟動指令]**：首次回應（Turn=1）時，上方「決策與應變機制」欄位 MUST 包含「執行記憶啟動探測（memory_list → 三路徑判斷）」的明確聲明。面板輸出完畢後，立即依 `06_memory_push.md` 三路徑流程執行探測。此指令不屬於模板格式，是獨立的行為命令。

**[Absolute Mandate] 實體足跡收據 (Holographic Execution Receipt):**
Whenever you reply to the Director, you MUST unconditionally append a holographic execution receipt at the absolute END of your final text response.

- Scan conversation history for last `Turn` number, increment by 1.
- Format EXACTLY as below (Use collapsible `<details>` block):

```html
>
<details>
  >
  <summary>📋 實體足跡收據 (點擊展開)</summary>
  > > - **對話次序 (Turn)**: {計算後的絕對數字} > - **實體ＩＤ (Step)**:
  {IDE回傳的ID清單，無則填 None} > - **呼叫工具 (Tool)**: {名稱}(次數)，無則填
  無 > - **上下文健康 (Context)**: {🟢 正常 | 🟡 留意 (>10 Turn) | 🔴 建議交接 (>15 Turn)} >
</details>
```
