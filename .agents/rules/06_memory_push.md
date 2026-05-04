---
trigger: model_decision
description: 本規範在每次新對話的首次回應前自動生效。執行路徑由 `01_cross_lingual_guard.md` 的系統準備清單 Turn=1 承諾行聯動觸發。
---

# [MEMORY PUSH MECHANISM — 記憶主動推播機制]

## 觸發時機

本規範在每次新對話的首次回應前自動生效。執行路徑由 `01_cross_lingual_guard.md`
的系統準備清單 Turn=1 承諾行聯動觸發。

## 前置步驟：崩潰復原檢查點偵測

```
對話啟動 → 檢查 .agents/logs/checkpoint.json 是否存在
├── 存在且 status = "in_progress"
│   └── → 輸出「⚠️ 偵測到上次對話的未完成存檔點：
│           工作流: {workflow}，階段: {phase}，時間: {timestamp}。
│           是否從此處繼續？（輸入 GO 繼續 / SKIP 忽略）」
│       → 等待總監決定
├── 存在且 status = "completed"
│   └── → 靜默刪除 checkpoint.json，繼續三路徑探測
└── 不存在
    └── → 繼續三路徑探測
```

Checkpoint format:
```json
{
  "session_id": "conversation-uuid",
  "workflow": "/03_build",
  "phase": "EXECUTION",
  "status": "in_progress",
  "timestamp": "ISO-8601",
  "last_completed_step": "Step description",
  "pending_steps": ["Step 4", "Step 5"]
}
```

## 三路徑結構性探測流程

```
對話啟動 → 呼叫 cartridge-system__memory_list()
├── "_map" 在清單中
│   └── → 呼叫 cartridge-system__memory_read("_map")
│       → 將地圖索引載入上下文（AI 得知所有模組範圍）
├── "_map" 不在清單，但清單非空
│   └── → 若清單包含 "_system"：呼叫 cartridge-system__memory_read("_system")
│       → 輸出「⚠️ _map 導航卡尚未建立，建議執行一次 /02_blueprint 初始化。」
└── 清單為空
    └── → 輸出「📭 本專案尚無記憶卡，以純對話模式繼續。」
        → 不阻塞，繼續回應。
```