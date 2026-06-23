import { commands, window, workspace } from "vscode";

import { ProviderFactory } from "../platforms/aws/services/providerFactory.ts";
import { createPlugin } from "../plugins.ts";
import { registerLocalStackCommands } from "../views/localstack/commands.ts";
import { LocalStackViewProvider } from "../views/localstack/viewProvider.ts";
import { ResourceDetailsViewProvider } from "../views/resource-details/viewProvider.ts";
import { ResourceArnTreeItem } from "../views/resources/treeItems.ts";
import { ResourceViewProvider } from "../views/resources/viewProvider.ts";

export default createPlugin(
	"resource-browser",
	({ context, localStackStatusTracker, outputChannel }) => {
		/* Service providers give access to AWS resource information. */
		ProviderFactory.initialize();

		const localStackProvider = new LocalStackViewProvider(
			localStackStatusTracker,
			outputChannel,
		);
		const resourcesProvider = new ResourceViewProvider();
		const detailsProvider = new ResourceDetailsViewProvider();

		/* Resources is a tree view; Resource Details is a webview (table layout). */
		const resourcesView = window.createTreeView("localstack.resources", {
			treeDataProvider: resourcesProvider,
		});
		const detailsView = window.registerWebviewViewProvider(
			"localstack.resourceDetails",
			detailsProvider,
		);
		context.subscriptions.push(resourcesView, detailsView);

		/* Selecting a resource updates the Resource Details view. */
		context.subscriptions.push(
			resourcesView.onDidChangeSelection((e) => {
				if (
					e.selection.length === 1 &&
					e.selection[0] instanceof ResourceArnTreeItem
				) {
					const item = e.selection[0];
					const profile = item.parent.parent.parent.profile.id;
					detailsProvider.setArn(profile, item.arn);
				}
			}),
		);

		/* The LocalStack view is single-select: activating one focus selector
		 * deactivates any other. */
		const localStackView = window.createTreeView("localstack.instances", {
			treeDataProvider: localStackProvider,
			canSelectMany: false,
			showCollapseAll: true,
		});
		context.subscriptions.push(
			localStackView,
			localStackView.onDidChangeSelection((e) => {
				/* Retain a producer (not just the computed focus) so the Resources
				 * view's refresh button can recompute it — re-querying the metamodel
				 * for the current selection. */
				const selection = e.selection;
				void resourcesProvider.setFocusProducer(() =>
					localStackProvider.computeFocus(selection),
				);
			}),
		);

		context.subscriptions.push(
			commands.registerCommand("localstack.refreshResources", () =>
				resourcesProvider.refresh(),
			),
			commands.registerCommand("localstack.refreshResourceDetails", () =>
				detailsProvider.refresh(),
			),
			...registerLocalStackCommands(localStackProvider, () => {
				void resourcesProvider.refresh();
			}),
		);

		/* Refresh the LocalStack view when its backing settings change. */
		context.subscriptions.push(
			workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration("localstack.cloudProfiles")) {
					localStackProvider.refresh();
				}
			}),
		);
	},
);
