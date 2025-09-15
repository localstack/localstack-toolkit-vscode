import * as assert from "node:assert";
import { setImmediate } from "node:timers/promises";

import { window } from "vscode";
import type { LogOutputChannel } from "vscode";

import { createValueEmitter } from "../utils/emitter.ts";
import type {
	LocalStackContainerStatus,
	LocalStackContainerStatusTracker,
} from "../utils/localstack-container.ts";
import { createLocalStackInstanceStatusTracker } from "../utils/localstack-instance.ts";
import type {
	HealthStatus,
	HealthStatusTracker,
} from "../utils/localstack-instance.ts";

function createFixtures() {
	const containerStatus = createValueEmitter<LocalStackContainerStatus>();
	const containerStatusTracker: LocalStackContainerStatusTracker = {
		status() {
			return containerStatus.value();
		},
		onChange(callback) {
			containerStatus.onChange(callback);
		},
		dispose() {},
	};

	const healthStatus = createValueEmitter<HealthStatus>();
	const healthCheckStatusTracker: HealthStatusTracker = {
		start() {},
		stop() {},
		status() {
			return healthStatus.value();
		},
		onChange(callback) {
			healthStatus.onChange(callback);
		},
		dispose() {},
	};

	const outputChannel = window.createOutputChannel("LocalStack", {
		log: true,
	});

	const tracker = createLocalStackInstanceStatusTracker(
		containerStatusTracker,
		healthCheckStatusTracker,
		outputChannel,
	);

	return {
		containerStatus,
		healthStatus,
		tracker,
	};
}

suite("LocalStack Instance Test Suite", () => {
	test("Derives LocalStack instance status correctly", async () => {
		const { containerStatus, healthStatus, tracker } = createFixtures();

		///////////////////////////////////////////////////////////////////////////
		containerStatus.setValue(undefined);
		healthStatus.setValue(undefined);
		await setImmediate();
		assert.strictEqual(tracker.status(), undefined);

		///////////////////////////////////////////////////////////////////////////
		containerStatus.setValue("running");
		healthStatus.setValue("unhealthy");
		await setImmediate();
		assert.strictEqual(tracker.status(), "starting");

		///////////////////////////////////////////////////////////////////////////
		containerStatus.setValue("running");
		healthStatus.setValue("healthy");
		await setImmediate();
		assert.strictEqual(tracker.status(), "running");
	});
});
