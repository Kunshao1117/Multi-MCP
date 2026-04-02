# Hook / State Machine Test Template

> Use this template when writing tests for React Hooks, state machines, or state management logic.
> Covers: initial state, state transitions, and error states.

## Template Structure

```typescript
import { describe, it, expect } from '{test-framework}';
import { renderHook, act } from '@testing-library/react-hooks';
import { {hookName} } from '{module-path}';

describe('{hookName}', () => {
  // ── Initial State (初始狀態) ──
  describe('初始狀態', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => {hookName}());
      expect(result.current.state).toBe(/* initial state */);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should accept initial parameters', () => {
      const { result } = renderHook(() => {hookName}(/* params */));
      expect(result.current.state).toBe(/* expected initial */);
    });
  });

  // ── State Transitions (狀態轉換) ──
  describe('狀態轉換', () => {
    it('should transition to loading state on trigger', async () => {
      const { result } = renderHook(() => {hookName}());
      act(() => {
        result.current.trigger();
      });
      expect(result.current.isLoading).toBe(true);
    });

    it('should transition to success state with data', async () => {
      const { result, waitForNextUpdate } = renderHook(() => {hookName}());
      act(() => {
        result.current.trigger();
      });
      await waitForNextUpdate();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(/* expected data */);
    });

    it('should handle sequential state changes correctly', async () => {
      const { result } = renderHook(() => {hookName}());
      // First action
      act(() => { result.current.actionA(); });
      expect(result.current.state).toBe('stateA');
      // Second action
      act(() => { result.current.actionB(); });
      expect(result.current.state).toBe('stateB');
    });
  });

  // ── Error States (錯誤狀態) ──
  describe('錯誤狀態', () => {
    it('should transition to error state on failure', async () => {
      // Mock API to fail
      const { result, waitForNextUpdate } = renderHook(() => {hookName}());
      act(() => {
        result.current.trigger();
      });
      await waitForNextUpdate();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeNull();
    });

    it('should allow recovery from error state', async () => {
      const { result } = renderHook(() => {hookName}());
      // Enter error state
      act(() => { result.current.reset(); });
      expect(result.current.error).toBeNull();
      expect(result.current.state).toBe(/* initial state */);
    });
  });

  // ── Cleanup (清理) ──
  describe('清理', () => {
    it('should clean up on unmount', () => {
      const { unmount } = renderHook(() => {hookName}());
      // Ensure no errors or memory leaks on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});
```

## For Non-React State Machines (非 React 狀態機)

```typescript
describe('{stateMachineName}', () => {
  it('should start in initial state', () => {
    const machine = create{StateMachine}();
    expect(machine.currentState).toBe('idle');
  });

  it('should transition on valid event', () => {
    const machine = create{StateMachine}();
    machine.send('START');
    expect(machine.currentState).toBe('running');
  });

  it('should ignore invalid events in current state', () => {
    const machine = create{StateMachine}();
    machine.send('INVALID_EVENT');
    expect(machine.currentState).toBe('idle'); // unchanged
  });
});
```
