---
name: security-sre
description: >
  Zero-trust validation, credential isolation procedures, and physical error handling/logging standards.
  Use when: 建構後端 API、處理資料庫寫入、設計認證流程、
  或任何涉及 安全/驗證/Zod/密碼/環境變數/error handling 的任務。
metadata:
  author: antigravity
  version: "5.2"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read"]
---

# Security & Reliability Engineering — Full Operating Protocol

> This skill extends Core Mandate §11 (Cross-Cutting Quality Constraints) — Security section.
> It provides concrete validation examples and error handling patterns. Principle-level descriptions live in Core Mandate; this skill focuses on implementation specifics.

## 1. Zero-Trust Validation (實體驗證器)

- NEVER trust incoming data (from APIs, DBs, or the Director's raw inputs).
- You MUST generate explicit physical validators (e.g., Zod, Joi, or custom validation schemas) for every incoming payload or DB write.
- Stop relying on type casting or assuming the runtime data matches the TypeScript interfaces.
- **Example**:
  ```typescript
  const CreatePostSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    status: z.enum(['draft', 'published']),
  });
  ```

## 2. Credential Isolation (機密隔離)

- **Absolute Ban**: NEVER hard-code API keys, database URLs, JWT Secrets, or any sensitive credentials into source files.
- You MUST force the architecture to extract these values via `process.env`.
- Ensure a `.env.example` file is maintained outlining the required environment variables:
  ```env
  # .env.example
  DATABASE_URI=
  PAYLOAD_SECRET=
  S3_BUCKET=
  S3_ACCESS_KEY_ID=
  S3_SECRET_ACCESS_KEY=
  ```

## 3. Physical Error Handling & Logging (實體錯誤處理)

- **Suppression Constraint**: NEVER expose internal stack traces or database query strings to the frontend UI/API responses.
- Catch errors gracefully and return standardized HTTP status codes and non-technical, human-readable JSON error messages:
  ```json
  { "error": "Internal server error. Please try again later." }
  ```
- **Backend Logging**: You MUST physically write error details and stack traces to a local log file (e.g., `/logs/error.log`) or standard output using a robust logging library (e.g., Winston, Pino) for debugging purposes.

## 4. Structured Logging Standard (結構化日誌標準)

### Log Format (日誌格式)

All backend log entries MUST use JSON structured format:
（所有後端日誌必須使用 JSON 結構化格式）

```json
{
  "timestamp": "2026-04-02T09:30:00+08:00",
  "level": "error",
  "module": "media-upload",
  "message": "Failed to register uploaded file in CMS",
  "traceId": "abc-123-def",
  "details": { "fileName": "photo.jpg", "uploadId": "xyz" }
}
```

### Required Fields (必填欄位)

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 (+08:00) | When the event occurred（事件發生時間） |
| `level` | enum | `error` / `warn` / `info` / `debug`（日誌等級） |
| `module` | string | Which module generated this log（產生日誌的模組） |
| `message` | string | Human-readable description（人類可讀的描述） |

### Optional Fields (選填欄位)

| Field | Type | Description |
|-------|------|-------------|
| `traceId` | string | Distributed trace ID for cross-service correlation（分散式追蹤 ID） |
| `details` | object | Additional context-specific data（額外上下文資料） |
| `userId` | string | Requesting user ID, if applicable（請求的使用者 ID） |
| `statusCode` | number | HTTP status code, if applicable（HTTP 狀態碼） |

### Log Level Guidelines (日誌等級指引)

| Level | When to Use |
|-------|------------|
| `error` | Operation failed and requires attention（操作失敗，需要關注） |
| `warn` | Operation succeeded but with unexpected conditions（操作成功但有異常狀況） |
| `info` | Important business events（重要的業務事件：登入、建立資源等） |
| `debug` | Detailed diagnostic info — suppress in production（詳細診斷資訊，正式環境不輸出） |

### AI Log Query Templates (AI 日誌查詢模板)

When debugging, use these grep patterns to search logs:
（除錯時使用以下 grep 模板搜尋日誌）

```bash
# Find all errors in the last hour（搜尋最近一小時的錯誤）
grep '"level":"error"' /logs/app.log | tail -50

# Find logs for a specific module（搜尋特定模組的日誌）
grep '"module":"media-upload"' /logs/app.log

# Find logs for a specific trace（搜尋特定追蹤 ID 的日誌）
grep '"traceId":"abc-123"' /logs/app.log

# Find errors with specific status codes（搜尋特定狀態碼的錯誤）
grep '"statusCode":500' /logs/app.log
```
