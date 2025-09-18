import ms from "ms";
import type { CancellationToken, Disposable, LogOutputChannel } from "vscode";
import * as z from "zod/v4-mini";

import { LOCALSTACK_DOCKER_IMAGE_NAME } from "../constants.ts";

import { createLocalStackAuthenticationStatusTracker } from "./authenticate.ts";
import type { CliStatusTracker } from "./cli.ts";
import { createAwsProfileStatusTracker } from "./configure-aws.ts";
import { createValueEmitter } from "./emitter.ts";
import { exec } from "./exec.ts";
import { createLicenseStatusTracker } from "./license.ts";
import { createOnceImmediate } from "./once-immediate.ts";
import { spawn } from "./spawn.ts";
import type { TimeTracker } from "./time-tracker.ts";

export async function updateDockerImage(
	outputChannel: LogOutputChannel,
	cancellationToken: CancellationToken,
): Promise<void> {
	const imageVersion = await getDockerImageSemverVersion(outputChannel);
	if (!imageVersion) {
		await pullDockerImage(outputChannel, cancellationToken);
	}
}

const InspectSchema = z.array(
	z.object({
		Config: z.object({
			Env: z.array(z.string()),
		}),
	}),
);

async function getDockerImageSemverVersion(
	outputChannel: LogOutputChannel,
): Promise<string | undefined> {
	try {
		const { stdout } = await exec(
			`docker inspect ${LOCALSTACK_DOCKER_IMAGE_NAME}`,
		);
		const data: unknown = JSON.parse(stdout);
		const parsed = InspectSchema.safeParse(data);
		if (!parsed.success) {
			throw new Error(
				`Could not parse "docker inspect" output: ${JSON.stringify(z.treeifyError(parsed.error))}`,
			);
		}
		const env = parsed.data[0]?.Config.Env ?? [];
		const imageVersion = env
			.find((line) => line.startsWith("LOCALSTACK_BUILD_VERSION="))
			?.slice("LOCALSTACK_BUILD_VERSION=".length);
		if (!imageVersion) {
			return;
		}
		return imageVersion;
	} catch (error) {
		outputChannel.error("Could not inspect LocalStack docker image");
		outputChannel.error(error instanceof Error ? error : String(error));
		return undefined;
	}
}

async function pullDockerImage(
	outputChannel: LogOutputChannel,
	cancellationToken: CancellationToken,
): Promise<void> {
	try {
		await spawn("docker", ["pull", LOCALSTACK_DOCKER_IMAGE_NAME], {
			outputChannel,
			outputLabel: "docker.pull",
			cancellationToken,
		});
	} catch (error) {
		outputChannel.error("Could not pull LocalStack docker image");
		outputChannel.error(error instanceof Error ? error : String(error));
	}
}

export type SetupStatus = "ok" | "setup_required" | "waiting_for_dependencies";

export interface SetupStatusTracker extends Disposable {
	status(): SetupStatus | undefined;
	onChange(callback: (status: SetupStatus | undefined) => void): void;
}
/**
 * Checks the status of the LocalStack installation.
 */

export async function createSetupStatusTracker(
	outputChannel: LogOutputChannel,
	timeTracker: TimeTracker,
	cliTracker: CliStatusTracker,
): Promise<SetupStatusTracker> {
	const start = Date.now();
	const status = createValueEmitter<SetupStatus>();
	const awsProfileTracker = createAwsProfileStatusTracker(outputChannel);
	const localStackAuthenticationTracker =
		createLocalStackAuthenticationStatusTracker(outputChannel);
	const licenseTracker = createLicenseStatusTracker(
		cliTracker,
		localStackAuthenticationTracker,
		outputChannel,
	);
	const end = Date.now();
	outputChannel.trace(
		`[setup-status]: Initialized dependencies in ${ms(end - start, { long: true })}`,
	);

	const checkStatusNow = async () => {
		const statuses = {
			cliTracker: cliTracker.status(),
			awsProfileTracker: awsProfileTracker.status(),
			authTracker: localStackAuthenticationTracker.status(),
			licenseTracker: licenseTracker.status(),
		};

		const notInitialized = Object.values(statuses).some(
			(check) => check === undefined,
		);
		if (notInitialized) {
			outputChannel.trace(
				`[setup-status] File watchers not initialized yet, skipping status check : ${JSON.stringify(
					{
						cliTracker: cliTracker.status() ?? "undefined",
						awsProfileTracker: awsProfileTracker.status() ?? "undefined",
						authTracker:
							localStackAuthenticationTracker.status() ?? "undefined",
						licenseTracker: licenseTracker.status() ?? "undefined",
					},
				)}`,
			);
			return;
		}

		const setupRequired = Object.values(statuses).some(
			(status) => status === "setup_required",
		);
		const newStatus = setupRequired ? "setup_required" : "ok";
		if (status.value() !== newStatus) {
			outputChannel.trace(
				`[setup-status] Status changed to ${JSON.stringify({
					cliTracker: cliTracker.status() ?? "undefined",
					awsProfileTracker: awsProfileTracker.status() ?? "undefined",
					authTracker: localStackAuthenticationTracker.status() ?? "undefined",
					licenseTracker: licenseTracker.status() ?? "undefined",
				})}`,
			);
		}
		status.setValue(newStatus);
	};

	const checkStatus = createOnceImmediate(async () => {
		await checkStatusNow();
	});

	awsProfileTracker.onChange(() => {
		checkStatus();
	});

	localStackAuthenticationTracker.onChange(() => {
		checkStatus();
	});

	licenseTracker.onChange(() => {
		checkStatus();
	});

	let timeout: NodeJS.Timeout | undefined;
	const startChecking = () => {
		checkStatus();

		// TODO: Find a smarter way to check the status (e.g. watch for changes in AWS credentials or LocalStack installation)
		timeout = setTimeout(() => void startChecking(), 1000);
	};

	await timeTracker.run("setup-status.checkIsSetupRequired", () => {
		startChecking();
		return Promise.resolve();
	});

	await checkStatusNow();

	return {
		status() {
			return status.value();
		},
		onChange(callback) {
			status.onChange(callback);
		},
		async dispose() {
			clearTimeout(timeout);
			await Promise.all([
				awsProfileTracker.dispose(),
				localStackAuthenticationTracker.dispose(),
			]);
		},
	};
}
