# API Route Test Template

> Use this template when writing tests for API route handlers.
> Adapt the framework-specific syntax based on `_system` memory card's tech stack.

## Template Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '{test-framework}';
// Import the route handler or test client

describe('{HTTP_METHOD} {route_path}', () => {
  // ── Setup ──
  beforeEach(() => {
    // Initialize test database state or mock services
  });

  afterEach(() => {
    // Clean up test state
  });

  // ── Happy Path ──
  describe('正常請求 (Happy Path)', () => {
    it('should return {expected_status} with valid payload', async () => {
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}',
        body: { /* valid payload */ },
        headers: { Authorization: 'Bearer {valid_token}' },
      });
      expect(response.status).toBe({expected_status});
      expect(response.body).toMatchObject({ /* expected shape */ });
    });
  });

  // ── Validation Errors (400) ──
  describe('格式錯誤 (Validation)', () => {
    it('should return 400 when required fields are missing', async () => {
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}',
        body: { /* incomplete payload */ },
      });
      expect(response.status).toBe(400);
    });

    it('should return 400 when field types are invalid', async () => {
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}',
        body: { /* wrong types */ },
      });
      expect(response.status).toBe(400);
    });
  });

  // ── Authentication (401) ──
  describe('未登入 (Unauthenticated)', () => {
    it('should return 401 without auth token', async () => {
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}',
        body: { /* valid payload */ },
        // No Authorization header
      });
      expect(response.status).toBe(401);
    });
  });

  // ── Authorization (403) ──
  describe('無權限 (Unauthorized)', () => {
    it('should return 403 with insufficient permissions', async () => {
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}',
        body: { /* valid payload */ },
        headers: { Authorization: 'Bearer {limited_token}' },
      });
      expect(response.status).toBe(403);
    });
  });

  // ── Not Found (404) ──
  describe('資源不存在 (Not Found)', () => {
    it('should return 404 for non-existent resource', async () => {
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}/non-existent-id',
      });
      expect(response.status).toBe(404);
    });
  });

  // ── Server Error Isolation (500) ──
  describe('伺服器錯誤隔離 (Error Isolation)', () => {
    it('should return 500 without leaking internals on DB failure', async () => {
      // Mock database to throw
      const response = await request({
        method: '{HTTP_METHOD}',
        url: '{route_path}',
        body: { /* valid payload */ },
      });
      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('query');
    });
  });
});
```
