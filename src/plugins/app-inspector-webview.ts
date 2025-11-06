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
} from "vscode";
import type { ProviderResult, TreeDataProvider, Event } from "vscode";

import { createPlugin } from "../plugins.ts";
import type {
	LocalStackStatus,
	LocalStackStatusTracker,
} from "../utils/localstack-status.ts";

export default createPlugin(
	"app-inspector-webview",
	({ context, outputChannel, localStackStatusTracker }) => {
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

				panel.iconPath = Uri.joinPath(
					context.extensionUri,
					// "resources/icons/codicon-plug.svg",
					"resources/icons/codicon-combine.svg",
				);

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
			}),
		);

		const provider = new ExampleTreeDataProvider({
			localStackStatusTracker,
		});

		const instancesTreeView = window.createTreeView("localstack.instances", {
			treeDataProvider: provider,
			showCollapseAll: false,
		});
	},
);

class ExampleTreeItem extends TreeItem {
	children?: ExampleTreeItem[];
}

interface ExampleTreeDataProviderOptions {
	localStackStatusTracker: LocalStackStatusTracker;
}

class ExampleTreeDataProvider implements TreeDataProvider<ExampleTreeItem> {
	readonly #onDidChangeTreeData = new EventEmitter<
		// biome-ignore lint/suspicious/noConfusingVoidType: void is required by Event
		ExampleTreeItem | undefined | void
	>();

	// biome-ignore lint/suspicious/noConfusingVoidType: void is required by Event
	readonly onDidChangeTreeData: Event<ExampleTreeItem | undefined | void> =
		this.#onDidChangeTreeData.event;

	#rootItems: ExampleTreeItem[] = [];

	constructor(options: ExampleTreeDataProviderOptions) {
		const appInspectorItem = new ExampleTreeItem(
			"App Inspector",
			TreeItemCollapsibleState.None,
		);
		appInspectorItem.description = "Click to open ↗";
		appInspectorItem.iconPath = new ThemeIcon("combine");
		appInspectorItem.command = {
			title: "Open App Inspector",
			command: "localstack.openAppInspector",
		};

		const instanceItem = new ExampleTreeItem(
			"localhost.localstack.cloud",
			TreeItemCollapsibleState.Expanded,
		);
		instanceItem.children = [
			(() => {
				const item = new ExampleTreeItem(
					"Status",
					TreeItemCollapsibleState.None,
				);
				options.localStackStatusTracker.onChange((status) => {
					item.description = status;
					item.iconPath = getLocalStackStatusThemeIcon(status);
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

	getChildren(element?: ExampleTreeItem): ProviderResult<ExampleTreeItem[]> {
		if (element) {
			return element.children;
		}

		return this.#rootItems;
	}

	getTreeItem(element: ExampleTreeItem): TreeItem {
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
