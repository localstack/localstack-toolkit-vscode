import { watch } from "chokidar";
import type { LogOutputChannel } from "vscode";

import { createValueEmitter } from "./emitter.ts";
import { createOnceImmediate } from "./once-immediate.ts";
import type { SetupStatus } from "./setup.ts";

export interface StatusTracker {
	status(): SetupStatus | undefined;
	onChange(callback: (status: SetupStatus | undefined) => void): void;
	dispose(): Promise<void>;
	check(): void;
}
/**
 * Creates a status tracker that monitors the given files for changes.
 * When a file is added, changed, or deleted, the provided check function is called
 * to determine the current setup status. Emits status changes to registered listeners.
 *
 * @param outputChannel - Channel for logging output and trace messages.
 * @param outputChannelPrefix - Prefix for log messages.
 * @param files - Array of file paths to watch.
 * @param check - Function that returns the current SetupStatus (sync or async).
 * @returns A {@link StatusTracker} instance for querying status, subscribing to changes, and disposing resources.
 */
export function createFileStatusTracker(
	outputChannel: LogOutputChannel,
	outputChannelPrefix: string,
	files: string[],
	check: () => Promise<SetupStatus | undefined> | SetupStatus | undefined,
): StatusTracker {
	const status = createValueEmitter<SetupStatus | undefined>();

	const updateStatus = createOnceImmediate(async () => {
		const newStatus = await Promise.resolve(check());
		status.setValue(newStatus);
	});

	const watcher = watch(files)
		.on("change", (path) => {
			outputChannel.trace(`${outputChannelPrefix} ${path} changed`);
			updateStatus();
		})
		.on("unlink", (path) => {
			outputChannel.trace(`${outputChannelPrefix} ${path} deleted`);
			updateStatus();
		})
		.on("add", (path) => {
			outputChannel.trace(`${outputChannelPrefix} ${path} added`);
			updateStatus();
		})
		.on("error", (error) => {
			outputChannel.error(`${outputChannelPrefix} Error watching file`);
			outputChannel.error(error instanceof Error ? error : String(error));
		});

	// Update the status immediately on file tracker initialization
	void updateStatus();

	return {
		status() {
			return status.value();
		},
		onChange(callback) {
			status.onChange(callback);
		},
		async dispose() {
			await watcher.close();
		},
		check() {
			return updateStatus();
		},
	};
}
