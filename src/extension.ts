import ms from "ms";
import {
	EventEmitter,
	StatusBarAlignment,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	window,
} from "vscode";
import type {
	ExtensionContext,
	ProviderResult,
	TreeDataProvider,
	Event,
} from "vscode";

import configureAws from "./plugins/configure-aws.ts";
import logs from "./plugins/logs.ts";
import manage from "./plugins/manage.ts";
import setup from "./plugins/setup.ts";
import statusBar from "./plugins/status-bar.ts";
import { PluginManager } from "./plugins.ts";
import { createContainerStatusTracker } from "./utils/container-status.ts";
import { createLocalStackStatusTracker } from "./utils/localstack-status.ts";
import { getOrCreateExtensionSessionId } from "./utils/manage.ts";
import { createSetupStatusTracker } from "./utils/setup-status.ts";
import { createTelemetry } from "./utils/telemetry.ts";
import { createTimeTracker } from "./utils/time-tracker.ts";

const plugins = new PluginManager([
	setup,
	configureAws,
	manage,
	statusBar,
	logs,
]);

export async function activate(context: ExtensionContext) {
	const outputChannel = window.createOutputChannel("LocalStack", {
		log: true,
	});
	context.subscriptions.push(outputChannel);

	const timeTracker = createTimeTracker({ outputChannel });

	const {
		containerStatusTracker,
		localStackStatusTracker,
		setupStatusTracker,
		statusBarItem,
		telemetry,
	} = await timeTracker.run("extension.dependencies", async () => {
		const statusBarItem = window.createStatusBarItem(
			StatusBarAlignment.Left,
			-1,
		);
		context.subscriptions.push(statusBarItem);
		statusBarItem.text = "$(loading~spin) LocalStack";
		statusBarItem.show();

		const containerStatusTracker = await createContainerStatusTracker(
			"localstack-main",
			outputChannel,
			timeTracker,
		);
		context.subscriptions.push(containerStatusTracker);

		const localStackStatusTracker = createLocalStackStatusTracker(
			containerStatusTracker,
			outputChannel,
			timeTracker,
		);
		context.subscriptions.push(localStackStatusTracker);

		outputChannel.trace(`[setup-status]: Starting...`);
		const startStatusTracker = Date.now();
		const setupStatusTracker = await createSetupStatusTracker(
			outputChannel,
			timeTracker,
		);
		context.subscriptions.push(setupStatusTracker);
		const endStatusTracker = Date.now();
		outputChannel.trace(
			`[setup-status]: Completed in ${ms(
				endStatusTracker - startStatusTracker,
				{ long: true },
			)}`,
		);

		const startTelemetry = Date.now();
		outputChannel.trace(`[telemetry]: Starting...`);
		const sessionId = await getOrCreateExtensionSessionId(context);
		const telemetry = createTelemetry(outputChannel, sessionId);
		const endTelemetry = Date.now();
		outputChannel.trace(
			`[telemetry]: Completed in ${ms(endTelemetry - startTelemetry, {
				long: true,
			})}`,
		);

		return {
			statusBarItem,
			containerStatusTracker,
			localStackStatusTracker,
			setupStatusTracker,
			telemetry,
		};
	});

	await timeTracker.run("extension.activatePlugins", async () => {
		await plugins.activate({
			context,
			outputChannel,
			statusBarItem,
			containerStatusTracker,
			localStackStatusTracker,
			setupStatusTracker,
			telemetry,
			timeTracker,
		});
	});

	const provider = new ExampleTreeDataProvider();

	// Register the provider under the view ID defined in package.json
	const treeView = window.createTreeView("localstackTreeView", {
		treeDataProvider: provider,
		showCollapseAll: false,
	});
}

export async function deactivate() {
	await plugins.deactivate();
}

class ExampleTreeDataProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData = new EventEmitter<
		ExampleTreeItem | undefined | void
	>();

	readonly onDidChangeTreeData: Event<ExampleTreeItem | undefined | void> =
		this._onDidChangeTreeData.event;

	// Toggle to show one or two items for demonstration
	private showTwoItems = true;

	/**
	 * Triggers a refresh of the tree view.
	 */
	refresh(): void {
		this.showTwoItems = !this.showTwoItems;
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Returns children of a given element or root.
	 * Root returns 1–2 items; no nested children in this minimal example.
	 */
	getChildren(element?: ExampleTreeItem): ProviderResult<TreeItem[]> {
		if (element) {
			// No nested children in this example
			return [];
		}

		const items: TreeItem[] = [];
		const one = new ExampleTreeItem("Item One", "one");
		items.push(one);

		if (this.showTwoItems) {
			const two = new ExampleTreeItem("Item Two", "two");
			items.push(two);
		}

		const instanceEndpoint = new TreeItem(
			"Instance endpoint",
			TreeItemCollapsibleState.None,
		);
		instanceEndpoint.tooltip = "tooltip";
		instanceEndpoint.description = "https://localhost.localstack.cloud:4566";
		instanceEndpoint.iconPath = new ThemeIcon("globe");
		items.push(instanceEndpoint);

		return items;
	}

	/**
	 * Returns a TreeItem to render in the view.
	 */
	getTreeItem(element: ExampleTreeItem): TreeItem {
		return element;
	}
}

/**
 * A clickable TreeItem that runs the example.openItem command when selected.
 */
class ExampleTreeItem extends TreeItem {
	constructor(
		label: string,
		readonly id: string,
	) {
		super(label);
		this.id = id;
		this.tooltip = `Click to open "${label}"`;
		this.description = id;
		this.iconPath = new ThemeIcon("localstack-logo");
		this.command = {
			command: "example.openItem",
			title: "Open Item",
			arguments: [this],
		};
		// No collapsible state, these are leaf nodes
		this.collapsibleState = TreeItemCollapsibleState.None;
		// Optional: contextValue enables context-menu targeting in contributes.menus
		this.contextValue = "exampleItem";
	}
}
