# Testing Guide for LocalStack Toolkit VS Code Extension

## Overview

This document describes the testing strategy and implementation for the LocalStack Toolkit VS Code extension. The goal is to ensure comprehensive test coverage that catches breaking changes and regressions in main functionalities.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Mocking Guidelines](#mocking-guidelines)
- [CI/CD Integration](#cicd-integration)
- [Coverage Goals](#coverage-goals)

## Testing Strategy

Our testing approach uses a three-tier pyramid:

### 1. Unit Tests (70% of tests)

Unit tests focus on individual functions and utilities in isolation. They:
- Test single functions with various inputs
- Mock external dependencies (file system, network, Docker)
- Execute quickly (milliseconds per test)
- Provide detailed failure information

**Covered Modules:**
- `src/utils/authenticate.ts` - Authentication token management
- `src/utils/cli.ts` - LocalStack CLI interactions
- `src/utils/configure-aws.ts` - AWS profile configuration
- `src/utils/container-status.ts` - Docker container monitoring
- `src/utils/license.ts` - License validation and activation
- `src/utils/manage.ts` - Start/stop operations
- `src/utils/ini-parser.ts` - INI file parsing (already covered)
- `src/utils/json-lines-stream.ts` - JSON streaming (already covered)

### 2. Integration Tests (25% of tests)

Integration tests verify that multiple components work together correctly. They:
- Test plugin interactions with VS Code APIs
- Verify command registration and execution
- Test state management across components
- Mock VS Code extension context

**Covered Plugins:**
- Setup wizard workflow
- Start/Stop LocalStack management
- Status bar updates and commands
- Log streaming
- AWS profile configuration flow

### 3. E2E Tests (5% of tests)

End-to-end tests verify complete user workflows. They:
- Test extension activation/deactivation
- Verify full setup wizard flow
- Test complete container lifecycle
- Validate error recovery scenarios

## Test Structure

```
src/test/
├── helpers/
│   ├── mocks.ts           # Mock utilities (output channel, exec, spawn, fetch)
│   └── test-utils.ts      # Test helpers (assertions, spies, waitFor)
├── integration/
│   ├── extension-lifecycle.test.ts  # Extension activation/deactivation
│   ├── setup-plugin.test.ts         # Setup wizard integration
│   ├── manage-plugin.test.ts        # Start/stop integration
│   └── status-bar-plugin.test.ts    # Status bar integration
├── authenticate.test.ts    # Authentication utils tests
├── cli.test.ts            # CLI utils tests
├── configure-aws.test.ts  # AWS configuration tests (existing)
├── container-status.test.ts # Container status tracking tests
├── ini-parser.test.ts     # INI parser tests (existing)
├── json-lines-stream.test.ts # JSON streaming tests (existing)
├── license.test.ts        # License utils tests
└── manage.test.ts         # Manage utils tests
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run watch:tsc
# In another terminal:
npm test
```

### Run Specific Test Suite
```bash
npm test -- --grep "Authentication"
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Writing Tests

### Test File Template

```typescript
import * as assert from "node:assert";
import { afterEach, beforeEach } from "mocha";
import { createMockOutputChannel } from "./helpers/mocks.ts";

suite("Feature Test Suite", () => {
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  beforeEach(() => {
    mockOutputChannel = createMockOutputChannel();
  });

  afterEach(() => {
    // Cleanup
  });

  suite("Sub-feature", () => {
    test("should behave correctly", () => {
      // Arrange
      const input = "test";
      
      // Act
      const result = someFunction(input);
      
      // Assert
      assert.strictEqual(result, "expected");
    });
  });
});
```

### Best Practices

1. **Use Descriptive Test Names**
   - ✅ `should return true when license is valid`
   - ❌ `test license check`

2. **Follow AAA Pattern** (Arrange, Act, Assert)
   ```typescript
   test("should parse valid JSON", () => {
     // Arrange
     const input = '{"key": "value"}';
     
     // Act
     const result = parseJson(input);
     
     // Assert
     assert.deepStrictEqual(result, { key: "value" });
   });
   ```

3. **Test Edge Cases**
   - Empty inputs
   - Null/undefined values
   - Error conditions
   - Boundary values

4. **Use Mocks for External Dependencies**
   - File system operations
   - Network requests
   - Docker commands
   - VS Code APIs

5. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` for setup
   - Use `afterEach` for cleanup

## Mocking Guidelines

### Mock Output Channel
```typescript
import { createMockOutputChannel } from "./helpers/mocks.ts";

const mockOutputChannel = createMockOutputChannel();
// Use in tests
const messages = mockOutputChannel.getMessages();
```

### Mock Exec Commands
```typescript
import { createMockExec } from "./helpers/mocks.ts";

const mockExec = createMockExec(
  new Map([
    ["docker inspect", { stdout: "...", stderr: "" }],
    ["localstack --version", { stdout: "1.0.0", stderr: "" }]
  ])
);
```

### Mock HTTP Requests
```typescript
import { createMockFetch } from "./helpers/mocks.ts";

const mockFetch = createMockFetch(
  new Map([
    ["/_localstack/health", { ok: true, status: 200, json: {...} }]
  ])
);
global.fetch = mockFetch as any;
```

### Mock File System
```typescript
import { createTempTestDir, cleanupTempDir } from "./helpers/test-utils.ts";

const testDir = await createTempTestDir();
// ... test logic ...
await cleanupTempDir(testDir);
```

## Mocking Implementation Needed

The current test files are structured but require full mocking implementation. To complete the tests:

### 1. Implement Module-Level Mocking

Some utilities need module-level mocking to test properly:

```typescript
// For cli.ts tests
import * as td from 'testdouble'; // Consider adding testdouble library
const { execLocalStack } = await td.replaceEsm('../utils/cli.ts');
```

### 2. Mock VS Code APIs

Create comprehensive VS Code API mocks:

```typescript
// src/test/helpers/vscode-mocks.ts
export function createMockExtensionContext() {
  return {
    subscriptions: [],
    globalState: new Map(),
    workspaceState: new Map(),
    // ... other context properties
  };
}
```

### 3. Implement Dependency Injection

Consider refactoring some utilities to accept dependencies as parameters for easier testing:

```typescript
// Before
export async function startLocalStack(outputChannel) {
  const result = await execLocalStack(['start'], { outputChannel });
}

// After (more testable)
export async function startLocalStack(
  outputChannel,
  deps = { execLocalStack }
) {
  const result = await deps.execLocalStack(['start'], { outputChannel });
}
```

## CI/CD Integration

### GitHub Actions Workflow

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Run type check
      run: npm run check-types
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      if: always()
```

### Pre-commit Hooks

Add to `package.json`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test && npm run check-types"
    }
  }
}
```

## Coverage Goals

### Target Coverage Metrics

- **Overall Coverage**: 80% minimum
- **Critical Paths**: 95% minimum
  - Authentication flow
  - Container start/stop
  - Setup wizard
  - License activation
- **Utility Functions**: 90% minimum
- **Integration Points**: 85% minimum

### Critical Functionality to Test

1. **Setup Wizard** (High Priority)
   - CLI installation (local and global)
   - Authentication with browser redirect
   - License activation with retry logic
   - AWS profile configuration
   - Docker image pulling

2. **Container Management** (High Priority)
   - Start LocalStack with auth token
   - Stop LocalStack gracefully
   - Status transitions (stopped → starting → running → stopping → stopped)
   - Health check monitoring

3. **Status Tracking** (High Priority)
   - Container status detection
   - LocalStack health monitoring
   - Status bar updates
   - Event-driven status changes

4. **Configuration** (Medium Priority)
   - AWS profile creation and updates
   - INI file parsing and serialization
   - Custom CLI location handling

5. **Telemetry** (Medium Priority)
   - Event tracking
   - Session ID generation and persistence
   - Error tracking

### Regression Detection

Tests should catch these common regression scenarios:

1. **Breaking Changes in Docker API**
   - Container inspection format changes
   - Event stream format changes

2. **LocalStack CLI Changes**
   - Command argument changes
   - Output format changes
   - License validation changes

3. **VS Code API Changes**
   - Extension context changes
   - Command registration changes
   - Status bar API changes

4. **File Format Changes**
   - AWS config/credentials format
   - Auth token storage format
   - License cache format

## Next Steps for Complete Implementation

To fully implement the testing strategy:

1. **Add Testdouble or Sinon** for better mocking capabilities
2. **Implement VS Code API mocks** for extension context, commands, windows
3. **Complete mock implementations** in existing test files
4. **Add test coverage reporting** with NYC or similar tool
5. **Set up CI/CD pipeline** with automated test runs
6. **Add integration tests** that use actual Docker (in CI environment)
7. **Document test data** requirements and fixtures
8. **Create test utilities** for common setup/teardown scenarios

## Contributing

When adding new features:

1. Write tests before implementation (TDD)
2. Ensure tests cover happy path and error cases
3. Update this documentation if test strategy changes
4. Verify tests pass locally before submitting PR
5. Aim for >80% coverage on new code

## Troubleshooting

### Common Issues

**Tests fail with "module not found"**
- Run `npm run compile` before testing
- Check that TypeScript compilation succeeded

**Tests timeout**
- Increase timeout in test configuration
- Check for unresolved promises
- Verify mocks are properly configured

**Flaky tests**
- Add proper async/await handling
- Use `waitFor` helper for eventual consistency
- Avoid time-dependent assertions

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Node.js Assert Documentation](https://nodejs.org/api/assert.html)
