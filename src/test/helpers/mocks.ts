/**
 * Test mocking utilities for LocalStack Toolkit tests
 */

import type { LogOutputChannel } from "vscode";

/**
 * Create a mock LogOutputChannel for testing
 */
export function createMockOutputChannel(): LogOutputChannel {
	const messages: Array<{ level: string; message: string }> = [];

	return {
		trace: (message: string) => messages.push({ level: "trace", message }),
		debug: (message: string) => messages.push({ level: "debug", message }),
		info: (message: string) => messages.push({ level: "info", message }),
		warn: (message: string) => messages.push({ level: "warn", message }),
		error: (message: string | Error) =>
			messages.push({
				level: "error",
				message: message instanceof Error ? message.message : message,
			}),
		append: () => {},
		appendLine: () => {},
		replace: () => {},
		clear: () => {},
		show: () => {},
		hide: () => {},
		dispose: () => {},
		name: "MockOutputChannel",
		logLevel: 1,
		onDidChangeLogLevel: (() => ({ dispose: () => {} })) as any,
		getMessages: () => messages,
	} as LogOutputChannel & { getMessages: () => typeof messages };
}

/**
 * Mock exec function for testing CLI commands
 */
export function createMockExec(
	mockResponses: Map<
		string,
		{ stdout: string; stderr: string; exitCode?: number }
	>,
) {
	return async (
		command: string,
	): Promise<{ stdout: string; stderr: string }> => {
		for (const [pattern, response] of mockResponses.entries()) {
			if (command.includes(pattern)) {
				if (response.exitCode !== undefined && response.exitCode !== 0) {
					throw new Error(
						`Command failed: ${command}\n${response.stderr || ""}`,
					);
				}
				return { stdout: response.stdout, stderr: response.stderr };
			}
		}
		throw new Error(`No mock response defined for command: ${command}`);
	};
}

/**
 * Mock spawn function for testing
 */
export interface MockSpawnProcess {
	stdout: NodeJS.ReadableStream;
	stderr: NodeJS.ReadableStream;
	on: (event: string, callback: (code: number) => void) => void;
	kill: () => void;
}

export function createMockSpawn(
	outputs: Map<string, { stdout?: string; stderr?: string; exitCode?: number }>,
) {
	return (command: string, args: string[]): MockSpawnProcess => {
		const fullCommand = `${command} ${args.join(" ")}`;
		const { Readable } = require("node:stream");

		for (const [pattern, output] of outputs.entries()) {
			if (fullCommand.includes(pattern)) {
				const stdout = new Readable();
				const stderr = new Readable();

				// Push data and end stream
				if (output.stdout) {
					stdout.push(output.stdout);
				}
				stdout.push(null);

				if (output.stderr) {
					stderr.push(output.stderr);
				}
				stderr.push(null);

				return {
					stdout,
					stderr,
					on: (event: string, callback: (code: number) => void) => {
						if (event === "close" || event === "exit") {
							setTimeout(() => callback(output.exitCode || 0), 10);
						}
					},
					kill: () => {},
				};
			}
		}

		throw new Error(`No mock spawn defined for: ${fullCommand}`);
	};
}

/**
 * Mock fetch for HTTP requests
 */
export function createMockFetch(
	responses: Map<
		string,
		{ ok: boolean; status: number; json?: any; text?: string }
	>,
) {
	return async (url: string | URL): Promise<Response> => {
		const urlString = url.toString();

		for (const [pattern, response] of responses.entries()) {
			if (urlString.includes(pattern)) {
				return {
					ok: response.ok,
					status: response.status,
					json: async () => response.json || {},
					text: async () => response.text || "",
				} as Response;
			}
		}

		return {
			ok: false,
			status: 404,
			json: async () => ({}),
			text: async () => "",
		} as Response;
	};
}

/**
 * Create a temporary directory for testing
 */
export async function createTempTestDir(
	prefix = "localstack-test-",
): Promise<string> {
	const { mkdtemp } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");

	return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Clean up temporary test directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
	const { rm } = await import("node:fs/promises");
	await rm(dirPath, { recursive: true, force: true });
}
