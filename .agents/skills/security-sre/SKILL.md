---
name: security-sre
description: >
  [Quality] Zero-trust validation, credential isolation, and structured logging standards.
  Use when: 建構或修改後端 API 端點、設計認證/授權流程、處理機敏資訊（密碼/API key/環境變數）的場景。
  DO NOT use when: 純前端 UI 開發（用 ui-ux-standards）、讀取或審查程式碼而不寫入、/03-1_experiment 沙盒模式。
metadata:
  author: antigravity
  version: "5.2"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read"]
---

# Security & Reliability Engineering — Full Operating Protocol

## 1. Zero-Trust Validation (實體驗證器)

```
[VALIDATION GATE] For EVERY API route or DB write operation:
├── [SUDO] detected? → Skip validation requirement.
├── Active workflow is /03_sketch? → Skip.
├── Zod/Joi schema defined for this endpoint's payload?
│   ├── YES → Proceed silently.
│   └── NO  → [HALT] 「🔴 [SEC HALT] API 端點 {path} 缺少 Schema 驗證。」
│             DO NOT proceed. Generate Zod schema first.
└── Gate cleared.
```

- FORBIDDEN: relying on type casting or assuming runtime data matches TypeScript interfaces
- **Example**:
  ```typescript
  const CreatePostSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    status: z.enum(["draft", "published"]),
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

- NEVER expose internal stack traces or DB query strings to frontend/API responses
- Return standardized HTTP status codes + human-readable JSON:
  ```json
  { "error": "Internal server error. Please try again later." }
  ```
- MUST write error details to log file (`/logs/error.log`) or stdout via logging library (Winston/Pino)

## 4. Structured Logging Standard (結構化日誌標準)

### Log Format (日誌格式)

All backend log entries MUST use JSON structured format:

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

| Field       | Type              | Description                                       |
| ----------- | ----------------- | ------------------------------------------------- |
| `timestamp` | ISO 8601 (+08:00) | When the event occurred（事件發生時間）           |
| `level`     | enum              | `error` / `warn` / `info` / `debug`（日誌等級）   |
| `module`    | string            | Which module generated this log（產生日誌的模組） |
| `message`   | string            | Human-readable description（人類可讀的描述）      |

### Optional Fields (選填欄位)

| Field        | Type   | Description                                                         |
| ------------ | ------ | ------------------------------------------------------------------- |
| `traceId`    | string | Distributed trace ID for cross-service correlation（分散式追蹤 ID） |
| `details`    | object | Additional context-specific data（額外上下文資料）                  |
| `userId`     | string | Requesting user ID, if applicable（請求的使用者 ID）                |
| `statusCode` | number | HTTP status code, if applicable（HTTP 狀態碼）                      |

### Log Level Guidelines (日誌等級指引)

| Level   | When to Use                                          |
| ------- | ---------------------------------------------------- |
| `error` | Operation failed, requires attention                 |
| `warn`  | Succeeded but unexpected conditions                  |
| `info`  | Important business events (login, resource creation) |
| `debug` | Diagnostic info — suppress in production             |

### AI Log Query Templates (AI 日誌查詢模板)

Grep patterns for log search:

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
