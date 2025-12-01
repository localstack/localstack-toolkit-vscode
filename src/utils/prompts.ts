import * as childProcess from "node:child_process";
import { appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import * as vscode from "vscode";
import type { CancellationToken, LogOutputChannel } from "vscode";

import { pipeToLogOutputChannel, spawn, SpawnError } from "./spawn.ts";

export interface SpawnElevatedDarwinOptions {
	script: string;
	outputChannel: LogOutputChannel;
	outputLabel?: string;
	cancellationToken?: CancellationToken;
}

export async function spawnElevatedDarwin(
	options: SpawnElevatedDarwinOptions,
): Promise<{ cancelled: boolean }> {
	try {
		await spawn(
			"osascript",
			[
				"-e",
				`'do shell script ${JSON.stringify(options.script)} with administrator privileges'`,
			],
			{
				outputChannel: options.outputChannel,
				outputLabel: options.outputLabel,
				cancellationToken: options.cancellationToken,
			},
		);
		return {
			cancelled: false,
		};
	} catch (error) {
		// osascript will terminate with code 1 if the user cancels the dialog.
		if (error instanceof SpawnError && error.code === 1) {
			return { cancelled: true };
		}

		options.outputChannel.error(error instanceof Error ? error : String(error));
		throw error;
	}
}

export interface SpawnElevatedLinuxOptions {
	script: string;
	outputChannel: LogOutputChannel;
	outputLabel?: string;
	cancellationToken?: CancellationToken;
}

async function tryPkexec(
	options: SpawnElevatedLinuxOptions,
): Promise<{ success: boolean; cancelled: boolean }> {
	const scriptArg = JSON.stringify(options.script);
	try {
		await spawn("pkexec", ["sh", "-c", scriptArg], {
			outputChannel: options.outputChannel,
			outputLabel: options.outputLabel,
			cancellationToken: options.cancellationToken,
		});
		return { success: true, cancelled: false };
	} catch (error) {
		if (error instanceof SpawnError) {
			// User cancelled (pkexec returns 126)
			if (error.code === 126) {
				return { success: true, cancelled: true };
			}
			// Other failures (no polkit agent, TTY error, etc.) - signal to try fallback
			return { success: false, cancelled: false };
		}
		throw error;
	}
}

async function spawnWithSudoPassword(
	options: SpawnElevatedLinuxOptions,
): Promise<{ cancelled: boolean }> {
	// Security note: This approach is less secure than pkexec because:
	// - Password flows through VS Code → Node.js → child process stdin (more attack surface)
	// - Password briefly exists in application memory (vulnerable to memory dumps)
	// - Potential attack vector: A malicious VS Code extension could theoretically intercept
	//   the password by hooking into Node.js I/O streams or reading process memory
	//   (though VS Code's extension sandbox provides some isolation)
	//
	// However, this is acceptable because:
	// - We only use this when pkexec is unavailable (systems without desktop environment)
	// - Password is masked in input, never logged, and passed via stdin only
	// - Password is not stored/cached and is disposed immediately
	// - This is a one-time installation operation, not continuous privileged access
	//
	// Alternative: complete installation failure on systems without polkit agents
	const password = await vscode.window.showInputBox({
		prompt: "Enter your sudo password",
		password: true,
		ignoreFocusOut: true,
	});

	if (password === undefined) {
		return { cancelled: true };
	}

	const outputLabel = options.outputLabel ? `[${options.outputLabel}]: ` : "";

	return new Promise((resolve, reject) => {
		let stderrOutput = "";

		const child = childProcess.spawn(
			"sudo",
			["-S", "sh", "-c", options.script],
			{
				stdio: ["pipe", "pipe", "pipe"],
			},
		);

		// Capture stderr to detect wrong password
		child.stderr?.on("data", (data: Buffer) => {
			stderrOutput += data.toString();
		});

		// Write password to stdin and close it
		// Note: We use stdin rather than command-line arguments because:
		// - Command-line args are visible in process listings (eg ps aux)
		// - stdin prevents the password from appearing in logs or shell history
		// - stdin data is not visible to other users on the system
		// However, the password still exists briefly in our process memory and the pipe buffer
		child.stdin.write(`${password}\n`);
		child.stdin.end();

		// Redirect the child process stdout/stderr to VSCode's output channel for visibility
		pipeToLogOutputChannel(child, options.outputChannel, outputLabel);

		const disposeCancel = options.cancellationToken?.onCancellationRequested(
			() => {
				child.kill("SIGINT");
				reject(new Error("Command cancelled"));
			},
		);

		child.on("close", (code) => {
			disposeCancel?.dispose();
			if (code === 0) {
				resolve({ cancelled: false });
			} else {
				// Detect wrong password from stderr
				const isWrongPassword =
					stderrOutput.includes("Sorry, try again") ||
					stderrOutput.includes("incorrect password") ||
					stderrOutput.includes("Authentication failure");

				const errorMessage = isWrongPassword
					? "Incorrect sudo password"
					: `sudo command failed with exit code ${code}`;

				reject(new Error(errorMessage));
			}
		});

		child.on("error", (error) => {
			disposeCancel?.dispose();
			reject(error);
		});
	});
}

export async function spawnElevatedLinux(
	options: SpawnElevatedLinuxOptions,
): Promise<{ cancelled: boolean }> {
	// Try pkexec first (works with graphical polkit agents)
	const pkexecResult = await tryPkexec(options);
	if (pkexecResult.success) {
		return { cancelled: pkexecResult.cancelled };
	}

	// Fallback: prompt for sudo password via VS Code input
	options.outputChannel.info(
		"pkexec not available, falling back to sudo password prompt",
	);
	return spawnWithSudoPassword(options);
}

export async function spawnElevatedWindows({
	script,
	outputChannel,
	outputLabel,
	cancellationToken,
}: {
	script: string;
	outputChannel: LogOutputChannel;
	outputLabel: string;
	cancellationToken: CancellationToken;
}) {
	const tempScriptPath = path.join(
		tmpdir(),
		`localstack-elevate-${Date.now()}.ps1`,
	);
	await appendFile(tempScriptPath, script);

	const powershellArgs = [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-Command",
		`$process = Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"' -PassThru; $process.WaitForExit();`,
	];

	await spawn("powershell", powershellArgs, {
		outputLabel,
		outputChannel,
		cancellationToken,
	});

	await rm(tempScriptPath, { force: true });
	return { cancelled: false };
}
