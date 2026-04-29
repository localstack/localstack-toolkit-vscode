import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	commands,
	window,
	ViewColumn,
	EventEmitter,
	ThemeColor,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	extensions,
	version as vscodeVersion,
} from "vscode";
import type {
	ProviderResult,
	TreeDataProvider,
	Event,
	WebviewPanel,
} from "vscode";

import { createPlugin } from "../plugins.ts";
import type {
	LocalStackStatus,
	LocalStackStatusTracker,
} from "../utils/localstack-status.ts";

export default createPlugin(
	"app-inspector-webview",
	({ context, localStackStatusTracker }) => {
		let appInspectorPanel: WebviewPanel | undefined;
		context.subscriptions.push(
			commands.registerCommand("localstack.openAppInspector", async () => {
				if (appInspectorPanel) {
					appInspectorPanel.reveal();
					return;
				}

				const panel = window.createWebviewPanel(
					"localStackAppInspector",
					`App Inspector`,
					ViewColumn.Active,
					{
						enableScripts: true,
						retainContextWhenHidden: true,
					},
				);
				appInspectorPanel = panel;

				panel.onDidDispose(() => {
					appInspectorPanel = undefined;
				});

				const appInspectorDist = path.resolve(
					import.meta.dirname,
					"../resources/app-inspector/dist",
				);
				const html = await readFile(
					path.join(appInspectorDist, "index.html"),
					"utf-8",
				);
				const extensionVersion =
					(
						extensions.getExtension("localstack.localstack")?.packageJSON as {
							version?: string;
						}
					)?.version ?? "unknown";

				panel.webview.html = html
					.replaceAll(/"(\/.*?\.(?:js|css))"/g, (_, asset: string) => {
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
					})
					.replace(
						"window.__APP_INSPECTOR_CONTEXT__ = null;",
						`window.__APP_INSPECTOR_CONTEXT__ = ${JSON.stringify({
							source: "vscode",
							ideVersion: vscodeVersion,
							extensionVersion,
						})};`,
					);
			}),
		);

		const provider = new InstancesTreeDataProvider({
			localStackStatusTracker,
		});

		const instancesTreeView = window.createTreeView("localstack.instances", {
			treeDataProvider: provider,
			showCollapseAll: false,
		});
	},
);

class InstancesTreeItem extends TreeItem {
	children?: InstancesTreeItem[];
}

interface InstancesTreeDataProviderOptions {
	localStackStatusTracker: LocalStackStatusTracker;
}

class InstancesTreeDataProvider implements TreeDataProvider<InstancesTreeItem> {
	readonly #onDidChangeTreeData = new EventEmitter<
		// biome-ignore lint/suspicious/noConfusingVoidType: void is required by Event
		InstancesTreeItem | undefined | void
	>();

	// biome-ignore lint/suspicious/noConfusingVoidType: void is required by Event
	readonly onDidChangeTreeData: Event<InstancesTreeItem | undefined | void> =
		this.#onDidChangeTreeData.event;

	#rootItems: InstancesTreeItem[] = [];

	constructor(options: InstancesTreeDataProviderOptions) {
		const appInspectorItem = new InstancesTreeItem(
			"App Inspector",
			TreeItemCollapsibleState.None,
		);
		appInspectorItem.description = "Click to open";
		appInspectorItem.command = {
			title: "Open App Inspector",
			command: "localstack.openAppInspector",
		};

		const instanceItem = new InstancesTreeItem(
			"localhost.localstack.cloud:4566",
			TreeItemCollapsibleState.Expanded,
		);
		instanceItem.children = [
			(() => {
				const item = new InstancesTreeItem(
					"Status",
					TreeItemCollapsibleState.None,
				);
				options.localStackStatusTracker.onChange((status) => {
					item.description = status;
					this.#onDidChangeTreeData.fire(item);
				});

				return item;
			})(),
			appInspectorItem,
		];

		this.#rootItems.push(instanceItem);

		options.localStackStatusTracker.onChange((status) => {
			instanceItem.iconPath = getLocalStackStatusThemeIcon(status);
			this.#onDidChangeTreeData.fire(instanceItem);
		});
	}

	getChildren(
		element?: InstancesTreeItem,
	): ProviderResult<InstancesTreeItem[]> {
		if (element) {
			return element.children;
		}

		return this.#rootItems;
	}

	getTreeItem(element: InstancesTreeItem): TreeItem {
		return element;
	}
}

function getLocalStackStatusThemeIcon(status: LocalStackStatus): ThemeIcon {
	switch (status) {
		case "starting":
			return new ThemeIcon("circle-outline");
		case "running":
			return new ThemeIcon("circle-filled");
		case "stopping":
			return new ThemeIcon(
				"circle-filled",
				new ThemeColor("disabledForeground"),
			);
		case "stopped":
			return new ThemeIcon(
				"circle-outline",
				new ThemeColor("disabledForeground"),
			);
	}
}
