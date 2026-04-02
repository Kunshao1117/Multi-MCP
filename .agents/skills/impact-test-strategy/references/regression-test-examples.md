# Regression Test Examples

> Common regression test patterns organized by bug type.
> Use these as starting points when generating regression tests after `/04_fix`.

## Pattern 1: Validation Bypass (驗證繞過)

```typescript
describe('Regression: {bug description}', () => {
  it('should not regress: previously accepted invalid input', async () => {
    // The exact invalid input that previously bypassed validation
    const invalidPayload = { /* the payload that caused the bug */ };
    
    const response = await request({
      method: 'POST',
      url: '{route}',
      body: invalidPayload,
    });
    
    // Should now be properly rejected
    expect(response.status).toBe(400);
  });
});
```

## Pattern 2: Null Reference (空值引用)

```typescript
describe('Regression: {bug description}', () => {
  it('should not regress: null value no longer causes crash', () => {
    // The exact null/undefined scenario that caused the crash
    const result = targetFunction(null);
    
    // Should handle gracefully, not throw
    expect(result).toBeDefined();
    // or: expect(() => targetFunction(null)).not.toThrow();
  });
});
```

## Pattern 3: Wrong Status Code (錯誤狀態碼)

```typescript
describe('Regression: {bug description}', () => {
  it('should not regress: returns correct status for {scenario}', async () => {
    const response = await request({
      method: '{method}',
      url: '{route}',
      body: { /* the exact payload from the bug report */ },
    });
    
    // Previously returned {wrong_code}, should now return {correct_code}
    expect(response.status).toBe({correct_code});
  });
});
```

## Pattern 4: Missing Data Transformation (資料轉換遺漏)

```typescript
describe('Regression: {bug description}', () => {
  it('should not regress: response includes required field', async () => {
    const response = await request({
      method: 'GET',
      url: '{route}',
    });
    
    // The field that was missing previously
    expect(response.body).toHaveProperty('{field_name}');
    expect(response.body.{field_name}).toBeDefined();
  });
});
```

## Pattern 5: Race Condition (競爭條件)

```typescript
describe('Regression: {bug description}', () => {
  it('should not regress: concurrent operations do not conflict', async () => {
    // Simulate the concurrent operations that previously caused conflict
    const [result1, result2] = await Promise.all([
      operation1(),
      operation2(),
    ]);
    
    // Both should succeed without corrupting state
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Verify final state is consistent
    const finalState = await getState();
    expect(finalState).toMatchObject(/* expected consistent state */);
  });
});
```
