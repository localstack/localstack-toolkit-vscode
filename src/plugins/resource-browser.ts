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
		ProviderFactory.initialize(context);

		const localStackProvider = new LocalStackViewProvider(
			localStackStatusTracker,
			outputChannel,
		);
		const resourcesProvider = new ResourceViewProvider(context);
		const detailsProvider = new ResourceDetailsViewProvider();

		/* Resources + Resource Details views are stable (no canSelectMany toggle). */
		const resourcesView = window.createTreeView("localstack.resources", {
			treeDataProvider: resourcesProvider,
		});
		const detailsView = window.createTreeView("localstack.resourceDetails", {
			treeDataProvider: detailsProvider,
		});
		context.subscriptions.push(resourcesView, detailsView);

		/* Selecting a resource updates the Resource Details view. */
		context.subscriptions.push(
			resourcesView.onDidChangeSelection((e) => {
				if (
					e.selection.length === 1 &&
					e.selection[0] instanceof ResourceArnTreeItem
				) {
					const item = e.selection[0];
					const profile = item.parent.parent.parent.parent.profile.id;
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
			selectionListener = view.onDidChangeSelection(async (e) => {
				try {
					const focus = await localStackProvider.computeFocus(e.selection);
					if (focus) {
						resourcesProvider.setFocus(focus);
					}
				} catch (error) {
					window.showWarningMessage(
						`Could not load resources: ${String(error)}`,
					);
				}
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
