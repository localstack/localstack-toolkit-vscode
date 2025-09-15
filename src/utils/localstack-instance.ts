import type { Disposable, LogOutputChannel } from "vscode";

import { createValueEmitter } from "./emitter.ts";
import type {
	LocalStackContainerStatus,
	LocalStackContainerStatusTracker,
} from "./localstack-container.ts";
import { fetchHealth } from "./manage.ts";
import type { TimeTracker } from "./time-tracker.ts";

export type LocalStackInstanceStatus =
	| "starting"
	| "running"
	| "stopping"
	| "stopped";

export interface LocalStackInstanceStatusTracker extends Disposable {
	status(): LocalStackInstanceStatus | undefined;
	forceContainerStatus(status: LocalStackContainerStatus): void;
	onChange(
		callback: (status: LocalStackInstanceStatus | undefined) => void,
	): void;
}

/**
 * Checks the status of the LocalStack instance in realtime.
 */
export function createLocalStackInstanceStatusTracker(
	containerStatusTracker: LocalStackContainerStatusTracker,
	outputChannel: LogOutputChannel,
	timeTracker: TimeTracker,
): LocalStackInstanceStatusTracker {
	let containerStatus: LocalStackContainerStatus | undefined;
	const status = createValueEmitter<LocalStackInstanceStatus>();

	const healthCheckStatusTracker = createHealthStatusTracker(timeTracker);

	const setStatus = (newStatus: LocalStackInstanceStatus) => {
		status.setValue(newStatus);
	};

	const deriveStatus = () => {
		outputChannel.trace(
			`[localstack-instance-status] containerStatus=${containerStatus} healthCheckStatusTracker=${healthCheckStatusTracker.status()} previousStatus=${status.value()}`,
		);
		const newStatus = getLocalStackStatus(
			containerStatus,
			healthCheckStatusTracker.status(),
			status.value(),
		);
		if (newStatus) {
			setStatus(newStatus);
		}
	};

	containerStatusTracker.onChange((newContainerStatus) => {
		if (containerStatus !== newContainerStatus) {
			containerStatus = newContainerStatus;
			deriveStatus();
		}
	});

	status.onChange((newStatus) => {
		outputChannel.trace(`[localstack-instances-status] status=${newStatus}`);

		if (newStatus === "running") {
			healthCheckStatusTracker.stop();
		}
	});

	containerStatusTracker.onChange((newContainerStatus) => {
		outputChannel.trace(
			`[localstack-instance-status] container=${newContainerStatus} (localstack=${status.value()})`,
		);

		if (newContainerStatus === "running" && status.value() !== "running") {
			healthCheckStatusTracker.start();
		}
	});

	healthCheckStatusTracker.onChange(() => {
		deriveStatus();
	});

	deriveStatus();

	return {
		status() {
			return status.value();
		},
		forceContainerStatus(newContainerStatus) {
			containerStatus = newContainerStatus;
			if (newContainerStatus === "running") {
				status.setValue("starting");
			} else if (newContainerStatus === "stopping") {
				status.setValue("stopping");
			}
		},
		onChange(callback) {
			status.onChange(callback);
		},
		dispose() {
			healthCheckStatusTracker.dispose();
		},
	};
}

function getLocalStackStatus(
	containerStatus: LocalStackContainerStatus | undefined,
	healthStatus: HealthStatus | undefined,
	previousStatus?: LocalStackInstanceStatus,
): LocalStackInstanceStatus | undefined {
	// There's no LS container status yet, so can't derive LS instance status.
	if (containerStatus === undefined) {
		return undefined;
	}

	if (containerStatus === "running" && healthStatus === "healthy") {
		return "running";
	}

	if (containerStatus === "running" && healthStatus === "unhealthy") {
		// When the LS container is running, and the health check fails:
		// - If the previous status was "running", we are likely stopping LS
		// - If the previous status was "stopping", we are still stopping LS
		if (previousStatus === "running" || previousStatus === "stopping") {
			return "stopping";
		}

		return "starting";
	}

	if (containerStatus === "running" && healthStatus === undefined) {
		// return previousStatus;
		return undefined;
	}

	if (containerStatus === "stopping") {
		return "stopping";
	}

	return "stopped";
}

type HealthStatus = "healthy" | "unhealthy";

interface HealthStatusTracker extends Disposable {
	status(): HealthStatus | undefined;
	start(): void;
	stop(): void;
	onChange(callback: (status: HealthStatus | undefined) => void): void;
}

function createHealthStatusTracker(
	timeTracker: TimeTracker,
): HealthStatusTracker {
	const status = createValueEmitter<HealthStatus | undefined>();

	let healthCheckTimeout: NodeJS.Timeout | undefined;

	const updateStatus = (newStatus: HealthStatus | undefined) => {
		status.setValue(newStatus);
	};

	const fetchAndUpdateStatus = async () => {
		await timeTracker.run("localstack-status.health", async () => {
			const newStatus = (await fetchHealth()) ? "healthy" : "unhealthy";
			updateStatus(newStatus);
		});
	};

	let enqueueAgain = false;

	const enqueueUpdateStatus = () => {
		if (healthCheckTimeout) {
			return;
		}

		healthCheckTimeout = setTimeout(() => {
			void fetchAndUpdateStatus().then(() => {
				if (!enqueueAgain) {
					return;
				}

				healthCheckTimeout = undefined;
				enqueueUpdateStatus();
			});
		}, 1_000);
	};

	return {
		status() {
			return status.value();
		},
		start() {
			enqueueAgain = true;
			enqueueUpdateStatus();
		},
		stop() {
			status.setValue(undefined);
			enqueueAgain = false;
			clearTimeout(healthCheckTimeout);
			healthCheckTimeout = undefined;
		},
		onChange(callback) {
			status.onChange(callback);
		},
		dispose() {
			clearTimeout(healthCheckTimeout);
		},
	};
}
