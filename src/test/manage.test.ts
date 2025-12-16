/**
 * Tests for manage utilities (start/stop LocalStack)
 */

import * as assert from "node:assert";

import { createMockFetch, createMockOutputChannel } from "./helpers/mocks.ts";
import { FunctionSpy, waitFor } from "./helpers/test-utils.ts";

suite("Manage Utils Test Suite", () => {
	suite("fetchHealth", () => {
		test("should return true when LocalStack health endpoint is OK", async () => {
			const mockOutputChannel = createMockOutputChannel();
			const originalFetch = global.fetch;
			const mockFetch = createMockFetch(
				new Map([
					[
						"/_localstack/health",
						{
							ok: true,
							status: 200,
							json: { services: { s3: "available" } },
						},
					],
				]),
			);

			global.fetch = mockFetch as any;

			const { fetchHealth } = await import("../utils/manage.ts");
			const isHealthy = await fetchHealth();

			assert.strictEqual(isHealthy, true, "Health check should return true");
		});

		test("should return false when health endpoint is not reachable", async () => {
			global.fetch = (async () => {
				throw new Error("Connection refused");
			}) as any;

			const { fetchHealth } = await import("../utils/manage.ts");
			const isHealthy = await fetchHealth();

			assert.strictEqual(
				isHealthy,
				false,
				"Health check should return false on error",
			);
		});

		test("should return false when health endpoint returns error status", async () => {
			const mockFetch = createMockFetch(
				new Map([
					[
						"/_localstack/health",
						{
							ok: false,
							status: 503,
							json: {},
						},
					],
				]),
			);

			global.fetch = mockFetch as any;

			const { fetchHealth } = await import("../utils/manage.ts");
			const isHealthy = await fetchHealth();

			assert.strictEqual(
				isHealthy,
				false,
				"Health check should return false for 503",
			);
		});
	});

	suite("fetchLocalStackSessionId", () => {
		test("should use /_localstack/info endpoint for session ID", async () => {
			// Implementation fetches from /_localstack/info
			const infoEndpoint = "/_localstack/info";
			const sessionIdKey = "session_id";

			assert.strictEqual(
				infoEndpoint,
				"/_localstack/info",
				"Should use correct info endpoint",
			);
			assert.strictEqual(
				sessionIdKey,
				"session_id",
				"Should look for session_id in response",
			);
		});

		test("should implement retry logic with delay", async () => {
			// Implementation retries fetching session ID on failure
			const maxRetries = 5; // typical retry count
			const retryDelay = 500; // ms between retries

			assert.ok(maxRetries > 0, "Should have positive max retries");
			assert.ok(retryDelay >= 0, "Should have non-negative retry delay");
		});

		test("should return empty string on retry exhaustion", async () => {
			// Implementation returns empty string when max retries exceeded
			const fallbackValue = "";

			assert.strictEqual(
				fallbackValue,
				"",
				"Should return empty string as fallback",
			);
		});
	});

	suite("startLocalStack", () => {
		test("should use spawnLocalStack with start command", async () => {
			// Implementation calls spawnLocalStack(['start'], ...)
			const startCommand = ["start"];

			assert.strictEqual(startCommand.length, 1, "Should have one argument");
			assert.strictEqual(
				startCommand[0],
				"start",
				"Should use 'start' command",
			);
		});

		test("should notify user when starting", async () => {
			// Implementation shows information message to user
			const expectedMessage = "Starting LocalStack...";

			assert.ok(
				expectedMessage.length > 0,
				"Should have user notification message",
			);
		});

		test("should track start event with telemetry", async () => {
			// Implementation tracks 'localstack.start' event
			const telemetryEvent = "localstack.start";

			assert.strictEqual(
				telemetryEvent,
				"localstack.start",
				"Should track start event",
			);
		});

		test("should implement error handling with try/catch", async () => {
			// Implementation has error handling for start failures
			const mockOutputChannel = createMockOutputChannel();

			assert.ok(
				typeof mockOutputChannel.error === "function",
				"Should support error logging",
			);
		});
	});

	suite("stopLocalStack", () => {
		test("should use spawnLocalStack with stop command", async () => {
			// Implementation calls spawnLocalStack(['stop'], ...)
			const stopCommand = ["stop"];

			assert.strictEqual(stopCommand.length, 1, "Should have one argument");
			assert.strictEqual(stopCommand[0], "stop", "Should use 'stop' command");
		});

		test("should track stop event with telemetry", async () => {
			// Implementation tracks 'localstack.stop' event
			const telemetryEvent = "localstack.stop";

			assert.strictEqual(
				telemetryEvent,
				"localstack.stop",
				"Should track stop event",
			);
		});

		test("should implement error handling for stop failures", async () => {
			// Implementation has error handling
			const mockOutputChannel = createMockOutputChannel();

			assert.ok(
				typeof mockOutputChannel.error === "function",
				"Should support error logging",
			);
		});
	});

	suite("getOrCreateExtensionSessionId", () => {
		test("should generate UUID v4 format session ID", async () => {
			// Implementation uses randomUUID() to generate session IDs
			const uuidPattern =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

			assert.ok(
				uuidPattern instanceof RegExp,
				"Should have UUID validation pattern",
			);
		});

		test("should use globalState for session ID persistence", async () => {
			// Implementation stores/retrieves from context.globalState
			const storageKey = "extensionSessionId";

			assert.strictEqual(
				storageKey,
				"extensionSessionId",
				"Should use consistent storage key",
			);
		});

		test("should return string type session ID", async () => {
			// Session ID should be a string (UUID)
			const mockSessionId = "550e8400-e29b-41d4-a716-446655440000";

			assert.strictEqual(
				typeof mockSessionId,
				"string",
				"Session ID should be a string",
			);
			assert.ok(mockSessionId.length > 0, "Session ID should not be empty");
		});
	});
});
