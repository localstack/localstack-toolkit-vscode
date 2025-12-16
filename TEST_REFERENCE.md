# Test Quick Reference Guide

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run watch:tsc
npm test
```

### Specific Suite
```bash
npm test -- --grep "Authentication"
npm test -- --grep "Container Status"
npm test -- --grep "Setup Plugin"
```

## Test File Locations

```
src/test/
├── helpers/              # Test utilities
│   ├── mocks.ts         # Mock factories
│   └── test-utils.ts    # Test helpers
├── integration/          # Integration tests
│   ├── extension-lifecycle.test.ts
│   ├── setup-plugin.test.ts
│   ├── manage-plugin.test.ts
│   └── status-bar-plugin.test.ts
└── *.test.ts            # Unit tests
```

## Common Test Patterns

### Basic Unit Test
```typescript
import * as assert from "node:assert";
import { createMockOutputChannel } from "./helpers/mocks.ts";

suite("Feature Test Suite", () => {
  test("should do something", () => {
    const result = myFunction("input");
    assert.strictEqual(result, "expected");
  });
});
```

### Async Test
```typescript
test("should handle async operations", async () => {
  const result = await asyncFunction();
  assert.strictEqual(result, "expected");
});
```

### Test with Setup/Teardown
```typescript
suite("Feature", () => {
  let mockOutput: ReturnType<typeof createMockOutputChannel>;
  
  beforeEach(() => {
    mockOutput = createMockOutputChannel();
  });
  
  afterEach(() => {
    // cleanup
  });
  
  test("should work", () => {
    // test code
  });
});
```

### Test with Temp Directory
```typescript
import { createTempTestDir, cleanupTempDir } from "./helpers/test-utils.ts";

let testDir: string;

beforeEach(async () => {
  testDir = await createTempTestDir();
});

afterEach(async () => {
  await cleanupTempDir(testDir);
});
```

### Error Testing
```typescript
import { assertThrowsAsync } from "./helpers/test-utils.ts";

test("should throw error", async () => {
  await assertThrowsAsync(
    async () => await functionThatThrows(),
    "Expected error message"
  );
});
```

### Wait for Condition
```typescript
import { waitFor } from "./helpers/test-utils.ts";

test("should eventually be true", async () => {
  await waitFor(() => someCondition === true, {
    timeout: 5000,
    interval: 100
  });
});
```

## Mock Helpers

### Mock Output Channel
```typescript
const mockOutput = createMockOutputChannel();
// Use in function calls
someFunction(mockOutput);
// Check logged messages
const messages = mockOutput.getMessages();
```

### Mock Exec
```typescript
const mockExec = createMockExec(
  new Map([
    ["docker inspect", { stdout: "...", stderr: "" }],
    ["localstack --version", { stdout: "1.0.0", stderr: "" }]
  ])
);
```

### Mock Fetch
```typescript
const mockFetch = createMockFetch(
  new Map([
    ["/_localstack/health", { ok: true, status: 200, json: {...} }]
  ])
);
global.fetch = mockFetch as any;
```

### Function Spy
```typescript
import { FunctionSpy } from "./helpers/test-utils.ts";

const spy = new FunctionSpy<[string], void>();
someFunction(spy.call.bind(spy));

assert.ok(spy.wasCalled());
assert.strictEqual(spy.getCallCount(), 1);
assert.ok(spy.wasCalledWith("expected-arg"));
```

## Assertions

### Basic Assertions
```typescript
assert.strictEqual(actual, expected);
assert.notStrictEqual(actual, unexpected);
assert.ok(condition);
assert.deepStrictEqual(actualObj, expectedObj);
```

### Custom Assertions
```typescript
import { assertDefined } from "./helpers/test-utils.ts";

assertDefined(maybeUndefined, "Should be defined");
```

## Test Organization

### Suite Hierarchy
```typescript
suite("Feature", () => {
  suite("Sub-feature", () => {
    test("specific behavior", () => {
      // test
    });
  });
});
```

### Test Naming
- ✅ `should return true when condition is met`
- ✅ `should throw error for invalid input`
- ✅ `should update status on container start`
- ❌ `test1`
- ❌ `works`

## Debugging Tests

### Run Single Test
```bash
npm test -- --grep "specific test name"
```

### Add Console Logs
```typescript
test("debugging", () => {
  console.log("Debug info:", value);
  assert.ok(true);
});
```

### Use Debugger
1. Add breakpoint in VS Code
2. Use "Debug Test" CodeLens
3. Or run: `F5` with test file open

## Common Issues

### Test Timeout
```typescript
// Increase timeout
test("slow test", async function() {
  this.timeout(10000); // 10 seconds
  // test code
});
```

### Flaky Tests
- Add proper async/await
- Use waitFor for eventual conditions
- Check for race conditions
- Ensure proper cleanup

### Import Errors
```bash
npm run compile  # Rebuild before testing
npm run check-types  # Check TypeScript errors
```

## CI/CD

Tests run automatically on:
- Pull requests
- Push to main
- Pre-release builds

Local pre-commit:
```bash
npm test && npm run check-types
```

## Resources

- Full guide: [TESTING.md](./TESTING.md)
- Test plan: [TESTING_PLAN.md](./TESTING_PLAN.md)
- Mocha docs: https://mochajs.org/
- VS Code testing: https://code.visualstudio.com/api/working-with-extensions/testing-extension
