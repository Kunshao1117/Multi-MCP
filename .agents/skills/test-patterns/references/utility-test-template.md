# Utility Function Test Template

> Use this template when writing tests for utility/service functions.
> Covers: normal values, boundary values, and exceptional values.

## Template Structure

```typescript
import { describe, it, expect } from '{test-framework}';
import { {functionName} } from '{module-path}';

describe('{functionName}', () => {
  // ── Normal Values (正常值) ──
  describe('正常輸入', () => {
    it('should return expected result for typical input', () => {
      const result = {functionName}(/* typical input */);
      expect(result).toBe(/* expected output */);
    });

    it('should handle multiple valid inputs correctly', () => {
      const testCases = [
        { input: /* value1 */, expected: /* result1 */ },
        { input: /* value2 */, expected: /* result2 */ },
      ];
      testCases.forEach(({ input, expected }) => {
        expect({functionName}(input)).toBe(expected);
      });
    });
  });

  // ── Boundary Values (邊界值) ──
  describe('邊界值', () => {
    it('should handle empty input', () => {
      expect({functionName}('')).toBe(/* expected for empty */);
    });

    it('should handle minimum valid value', () => {
      expect({functionName}(/* min value */)).toBe(/* expected */);
    });

    it('should handle maximum valid value', () => {
      expect({functionName}(/* max value */)).toBe(/* expected */);
    });

    it('should handle single element collections', () => {
      expect({functionName}([/* single item */])).toBe(/* expected */);
    });
  });

  // ── Exceptional Values (異常值) ──
  describe('異常輸入', () => {
    it('should throw or return error for null/undefined', () => {
      expect(() => {functionName}(null)).toThrow();
      // or: expect({functionName}(null)).toBeNull();
    });

    it('should handle unexpected types gracefully', () => {
      // If function expects string but receives number
      expect(() => {functionName}(123 as any)).toThrow();
    });

    it('should handle malformed input', () => {
      expect(() => {functionName}(/* malformed */)).toThrow();
    });
  });

  // ── Idempotency / Side Effects (冪等性/副作用) ── optional
  describe('冪等性（如適用）', () => {
    it('should produce same result when called multiple times', () => {
      const result1 = {functionName}(/* input */);
      const result2 = {functionName}(/* input */);
      expect(result1).toEqual(result2);
    });
  });
});
```
