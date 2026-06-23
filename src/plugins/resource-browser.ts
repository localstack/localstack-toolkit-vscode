import { commands, window, workspace } from "vscode";
import type { Disposable, TreeView } from "vscode";

import { ProviderFactory } from "../platforms/aws/services/providerFactory.ts";
import { createPlugin } from "../plugins.ts";
import { registerLocalStackCommands } from "../views/localstack/commands.ts";
import { configTarget } from "../views/localstack/settings.ts";
import type { LocalStackTreeItem } from "../views/localstack/treeItems.ts";
import { LocalStackViewProvider } from "../views/localstack/viewProvider.ts";
import { ResourceDetailsViewProvider } from "../views/resource-details/viewProvider.ts";
import { ResourceArnTreeItem } from "../views/resources/treeItems.ts";
import { ResourceViewProvider } from "../views/resources/viewProvider.ts";

const MULTI_SELECT_SETTING = "focus.multiSelect";

export default createPlugin(
	"resource-browser",
	({ context, localStackStatusTracker, outputChannel }) => {
		/* Service providers give access to AWS resource information. */
		ProviderFactory.initialize();

		const localStackProvider = new LocalStackViewProvider(
			localStackStatusTracker,
			outputChannel,
		);
		const resourcesProvider = new ResourceViewProvider(context);
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

		/*
		 * The LocalStack view's canSelectMany is fixed at registration, so the
		 * multi-select toggle re-registers it in place.
		 */
		let localStackView: TreeView<LocalStackTreeItem> | undefined;
		let selectionListener: Disposable | undefined;

		const isMultiSelect = () =>
			workspace
				.getConfiguration("localstack")
				.get<boolean>(MULTI_SELECT_SETTING, false);

		const createLocalStackView = () => {
			const multi = isMultiSelect();
			void commands.executeCommand(
				"setContext",
				"localstack.multiSelect",
				multi,
			);

			const view = window.createTreeView("localstack.instances", {
				treeDataProvider: localStackProvider,
				canSelectMany: multi,
				showCollapseAll: true,
			});
			selectionListener = view.onDidChangeSelection((e) => {
				/* Retain a producer (not just the computed focus) so the Resources
				 * view's refresh button can recompute it — re-querying the metamodel
				 * for the current selection. */
				const selection = e.selection;
				void resourcesProvider.setFocusProducer(() =>
					localStackProvider.computeFocus(selection),
				);
			});
			localStackView = view;
		};

		const recreateLocalStackView = () => {
			selectionListener?.dispose();
			localStackView?.dispose();
			createLocalStackView();
		};

		createLocalStackView();

		const setMultiSelect = async (value: boolean) => {
			await workspace
				.getConfiguration("localstack")
				.update(MULTI_SELECT_SETTING, value, configTarget());
			recreateLocalStackView();
		};

		context.subscriptions.push(
			commands.registerCommand("localstack.enableMultiSelect", () =>
				setMultiSelect(true),
			),
			commands.registerCommand("localstack.disableMultiSelect", () =>
				setMultiSelect(false),
			),
			commands.registerCommand("localstack.refreshResources", () =>
				resourcesProvider.refresh(),
			),
			commands.registerCommand("localstack.refreshResourceDetails", () =>
				detailsProvider.refresh(),
			),
			...registerLocalStackCommands(localStackProvider),
		);

		/* Refresh the LocalStack view when its backing settings change. */
		context.subscriptions.push(
			workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration("localstack.cloudProfiles")) {
					localStackProvider.refresh();
				}
			}),
			{
				dispose: () => {
					selectionListener?.dispose();
					localStackView?.dispose();
				},
			},
		);
	},
);
