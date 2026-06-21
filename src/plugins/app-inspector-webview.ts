import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	commands,
	extensions,
	Uri,
	ViewColumn,
	version as vscodeVersion,
	window,
} from "vscode";
import type { WebviewPanel } from "vscode";

import { createPlugin } from "../plugins.ts";

export default createPlugin("app-inspector-webview", ({ context }) => {
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
});
