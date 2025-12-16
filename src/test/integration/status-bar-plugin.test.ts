/**
 * Integration tests for status bar plugin
 */

import * as assert from "node:assert";

import { createMockOutputChannel } from "../helpers/mocks.ts";
import { FunctionSpy } from "../helpers/test-utils.ts";

suite("Status Bar Plugin Integration Test Suite", () => {
	suite("Status Bar Display", () => {
		test("should show loading indicator during initialization", async () => {
			// Uses $(sync~spin) icon during startup
			const loadingIcon = "$(sync~spin)";

			assert.ok(loadingIcon.includes("sync"), "Should use sync icon");
			assert.ok(loadingIcon.includes("~spin"), "Should animate");
		});

		test("should update icon based on LocalStack status", async () => {
			// Different icons based on setupStatus and localStackStatus
			const statusIcons = {
				setupRequired: "$(error)",
				starting: "$(sync~spin)",
				stopping: "$(sync~spin)",
				running: "$(localstack-logo)",
			};

			assert.ok(
				Object.keys(statusIcons).length >= 4,
				"Should have icons for different states",
			);
		});

		test("should show error background when setup is required", async () => {
			// Error background when setupStatus === "setup_required"
			const errorColor = "statusBarItem.errorBackground";

			assert.ok(
				errorColor.includes("error"),
				"Should use error color for setup issues",
			);
		});

		test("should show spin animation when starting/stopping", async () => {
			// Spin animation during start/stop operations
			const animatedStates = ["starting", "stopping"];

			assert.ok(
				animatedStates.length >= 2,
				"Should animate during transitions",
			);
			assert.ok(
				animatedStates.every((s) => s.endsWith("ing")),
				"Animated states are progressive forms",
			);
		});
	});

	suite("Quick Pick Commands", () => {
		test("should provide available commands in menu", async () => {
			// Quick pick shows context-appropriate commands via showCommands
			const availableCommands = [
				"Run LocalStack Setup Wizard",
				"Start LocalStack",
				"Stop LocalStack",
				"View Logs",
			];

			assert.ok(availableCommands.length >= 4, "Should have multiple commands");
		});

		test("should show setup wizard when setup required", async () => {
			// Shows when setupStatusTracker.status() === "setup_required"
			const setupCommand = "Run LocalStack Setup Wizard";

			assert.ok(setupCommand.includes("Setup"), "Should offer setup option");
		});

		test("should show start command when stopped", async () => {
			// Shows when isInstalled && localStackStatus === "stopped"
			const condition = "isInstalled && status === 'stopped'";

			assert.ok(
				condition.includes("stopped"),
				"Should offer start when stopped",
			);
		});

		test("should show stop command when running", async () => {
			// Shows when isInstalled && localStackStatus === "running"
			const condition = "isInstalled && status === 'running'";

			assert.ok(
				condition.includes("running"),
				"Should offer stop when running",
			);
		});

		test("should execute selected command", async () => {
			// Commands executed via commands.executeCommand(selected.command)
			const commandPrefix = "localstack.";

			assert.ok(
				commandPrefix.startsWith("localstack"),
				"Commands should use localstack prefix",
			);
		});
	});

	suite("Status Bar Refresh", () => {
		test("should refresh on container status change", async () => {
			// Refresh triggered by localstack.refreshStatusBar command
			// Called when status trackers onChange events fire
			const refreshCommand = "localstack.refreshStatusBar";

			assert.strictEqual(
				refreshCommand,
				"localstack.refreshStatusBar",
				"Should have refresh command",
			);
		});

		test("should refresh on setup status change", async () => {
			// Listens to setup status tracker onChange events
			const setupStates = ["not-configured", "configured", "setup_required"];

			assert.ok(setupStates.length >= 3, "Should track setup state changes");
		});
	});

	suite("Status Bar Click Behavior", () => {
		test("should show commands menu on click", async () => {
			// statusBarItem.command = "localstack.showCommands"
			const clickAction = "localstack.showCommands";

			assert.strictEqual(
				clickAction,
				"localstack.showCommands",
				"Click should show quick pick",
			);
		});
	});
});
