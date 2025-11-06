import { readFile } from "node:fs/promises";
import path from "node:path";

import ms from "ms";
import {
	commands,
	EventEmitter,
	StatusBarAlignment,
	ThemeColor,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	ViewColumn,
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
import type { LocalStackStatusTracker } from "./utils/localstack-status.ts";
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

	context.subscriptions.push(
		commands.registerCommand("localstack.openAppInspector", async () => {
			const panel = window.createWebviewPanel(
				"webviewOpener",
				`App Inspector`,
				ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
				},
			);

			// panel.webview.asWebviewUri

			const appInspectorDist = path.resolve(
				import.meta.dirname,
				"../resources/app-inspector/dist",
			);
			outputChannel.debug(`appInspectorDist=${appInspectorDist}`);
			const html = await readFile(
				path.join(appInspectorDist, "index.html"),
				"utf-8",
			);
			outputChannel.debug(`html=${html}`);
			// webview.asWebviewUri(vscode.Uri.joinPath(dist, entry.file))
			panel.webview.html = html.replaceAll(
				/"(\/.*?\.(?:js|css))"/g,
				(_, asset: string) => {
					return JSON.stringify(
						panel.webview
							.asWebviewUri(
								Uri.joinPath(
									context.extensionUri,
									"resources/app-inspector/dist",
									asset,
								),
							)
							.toString(),
					);
				},
			);
			outputChannel.debug(`html=${panel.webview.html}`);

			panel.onDidDispose(() => {
				// Clean up resources if needed
			});
		}),
	);

	const provider = new ExampleTreeDataProvider({
		localStackStatusTracker,
	});

	// const interval = setInterval(() => {
	// 	provider.refresh();
	// }, 1000);
	// context.subscriptions.push({
	// 	dispose() {
	// 		clearInterval(interval);
	// 	},
	// });

	// Register the provider under the view ID defined in package.json
	const instancesTreeView = window.createTreeView("localstack.instances", {
		treeDataProvider: provider,
		showCollapseAll: false,
	});
}

export async function deactivate() {
	await plugins.deactivate();
}

class ExampleTreeItem extends TreeItem {
	children?: ExampleTreeItem[];
}

interface ExampleTreeDataProviderOptions {
	localStackStatusTracker: LocalStackStatusTracker;
}

class ExampleTreeDataProvider implements TreeDataProvider<ExampleTreeItem> {
	readonly #onDidChangeTreeData = new EventEmitter<
		ExampleTreeItem | undefined | void
	>();

	readonly onDidChangeTreeData: Event<ExampleTreeItem | undefined | void> =
		this.#onDidChangeTreeData.event;

	#rootItems: ExampleTreeItem[] = [];

	constructor(options: ExampleTreeDataProviderOptions) {
		// const one = new ExampleTreeItem("Item One", "one");
		// items.push(one);

		// if (this.showTwoItems) {
		// 	const two = new ExampleTreeItem("Item Two", "two");
		// 	items.push(two);
		// }

		const appInspectorItem = new ExampleTreeItem(
			"App Inspector",
			TreeItemCollapsibleState.None,
		);
		// appInspectorItem.tooltip = "App Inspector →";
		appInspectorItem.description = "Click to open ↗";
		// appInspectorItem.iconPath = new ThemeIcon("search");
		// appInspectorItem.iconPath = new ThemeIcon("book");
		// appInspectorItem.iconPath = new ThemeIcon("plug");
		appInspectorItem.command = {
			title: "Open App Inspector",
			command: "localstack.openAppInspector",
		};

		// const endpointItem = new ExampleTreeItem(
		// 	"Endpoint",
		// 	TreeItemCollapsibleState.None,
		// );
		// endpointItem.description = "https://localhost.localstack.cloud:4566";
		// endpointItem.tooltip = "Click to copy";
		// // endpointItem.iconPath = new ThemeIcon("globe");

		const instanceItem = new ExampleTreeItem(
			"localhost.localstack.cloud",
			TreeItemCollapsibleState.Expanded,
		);
		// instanceEndpointItem.description = "stopped";
		instanceItem.iconPath =
			options.localStackStatusTracker.status() === "running"
				? new ThemeIcon("circle-filled")
				: new ThemeIcon("circle-outline", new ThemeColor("disabledForeground"));
		instanceItem.children = [
			// (() => {
			// 	const item = new ExampleTreeItem(
			// 		"LocalStack is not running",
			// 		TreeItemCollapsibleState.None,
			// 	);
			// 	// item.description = "Running";
			// 	// item.tooltip = "Click to copy";
			// 	// item.iconPath = new ThemeIcon(
			// 	// 	"error",
			// 	// 	new ThemeColor("errorForeground"),
			// 	// );

			// 	return item;
			// })(),
			(() => {
				const item = new ExampleTreeItem(
					"Status",
					TreeItemCollapsibleState.None,
				);
				// item.description = options.localStackStatusTracker.status();
				// item.tooltip = "Click to copy";
				// item.iconPath = new ThemeIcon("globe");
				options.localStackStatusTracker.onChange((status) => {
					item.description = status;
					// 	item.iconPath =
					// 		status === "running"
					// 			? new ThemeIcon("circle-filled")
					// 			: new ThemeIcon(
					// 					"circle-outline",
					// 					new ThemeColor("disabledForeground"),
					// 				);
					this.#onDidChangeTreeData.fire(item);
				});

				return item;
			})(),
			// endpointItem,
			appInspectorItem,
		];

		// instanceEndpointItem.tooltip = "tooltip";
		// instanceEndpointItem.description =
		// 	"localhost.localstack.cloud";
		// instanceEndpointItem.iconPath = new ThemeIcon("globe");

		this.#rootItems.push(instanceItem);

		options.localStackStatusTracker.onChange((status) => {
			instanceItem.iconPath =
				status === "running"
					? new ThemeIcon("circle-filled")
					: new ThemeIcon(
							"circle-outline",
							new ThemeColor("disabledForeground"),
						);
			this.#onDidChangeTreeData.fire(instanceItem);
		});

		// this.#interval = setInterval(() => {
		// 	const status: "running" | "stopped" =
		// 		Math.random() * 100 > 50 ? "running" : "stopped";
		// 	instanceEndpointItem.iconPath =
		// 		status === "running"
		// 			? new ThemeIcon("circle-filled")
		// 			: new ThemeIcon(
		// 					"circle-outline",
		// 					new ThemeColor("disabledForeground"),
		// 				);
		// 	this.#_onDidChangeTreeData.fire(instanceEndpointItem);
		// }, 1000);
	}

	// /**
	//  * Triggers a refresh of the tree view.
	//  */
	// refresh(): void {
	// 	this.#_onDidChangeTreeData.fire();
	// }

	/**
	 * Returns children of a given element or root.
	 * Root returns 1–2 items; no nested children in this minimal example.
	 */
	getChildren(element?: ExampleTreeItem): ProviderResult<ExampleTreeItem[]> {
		if (element) {
			return element.children;
		}

		return this.#rootItems;
		// const appInspectorItem = new ExampleTreeItem(
		// 	"App Inspector ↗",
		// 	TreeItemCollapsibleState.None,
		// );
		// // appInspectorItem.tooltip = "App Inspector →";
		// // appInspectorItem.description = "Click to open";
		// // appInspectorItem.iconPath = new ThemeIcon("search");
		// // appInspectorItem.iconPath = new ThemeIcon("book");
		// // appInspectorItem.iconPath = new ThemeIcon("plug");
		// appInspectorItem.command = {
		// 	title: "Open App Inspector",
		// 	command: "localstack.openAppInspector",
		// };

		// // const endpointItem = new ExampleTreeItem(
		// // 	"Endpoint",
		// // 	TreeItemCollapsibleState.None,
		// // );
		// // endpointItem.description = "https://localhost.localstack.cloud:4566";
		// // endpointItem.tooltip = "Click to copy";
		// // // endpointItem.iconPath = new ThemeIcon("globe");

		// const status: "running" | "stopped" =
		// 	Math.random() * 100 > 50 ? "running" : "stopped";

		// const instanceEndpointItem = new ExampleTreeItem(
		// 	"localhost.localstack.cloud",
		// 	TreeItemCollapsibleState.Expanded,
		// );
		// // instanceEndpointItem.description = "stopped";
		// instanceEndpointItem.iconPath =
		// 	status === "running"
		// 		? new ThemeIcon("circle-filled")
		// 		: new ThemeIcon("circle-outline", new ThemeColor("disabledForeground"));
		// instanceEndpointItem.children = [
		// 	(() => {
		// 		const item = new ExampleTreeItem(
		// 			"LocalStack is not running",
		// 			TreeItemCollapsibleState.None,
		// 		);
		// 		// item.description = "Running";
		// 		// item.tooltip = "Click to copy";
		// 		// item.iconPath = new ThemeIcon(
		// 		// 	"error",
		// 		// 	new ThemeColor("errorForeground"),
		// 		// );

		// 		return item;
		// 	})(),
		// 	// (() => {
		// 	// 	const item = new ExampleTreeItem(
		// 	// 		"Status",
		// 	// 		TreeItemCollapsibleState.None,
		// 	// 	);
		// 	// 	item.description = "Running";
		// 	// 	// item.tooltip = "Click to copy";
		// 	// 	item.iconPath = new ThemeIcon("globe");
		// 	// 	return item;
		// 	// })(),
		// 	// endpointItem,
		// 	// appInspectorItem,
		// ];
		// // instanceEndpointItem.tooltip = "tooltip";
		// // instanceEndpointItem.description =
		// // 	"localhost.localstack.cloud";
		// // instanceEndpointItem.iconPath = new ThemeIcon("globe");

		// return [instanceEndpointItem];
	}

	/**
	 * Returns a TreeItem to render in the view.
	 */
	getTreeItem(element: ExampleTreeItem): TreeItem {
		return element;
	}
}
