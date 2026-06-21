import * as vscode from "vscode";

import ARN from "../../platforms/aws/models/arnModel.ts";
import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";

export class ResourceDetailsTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly value: string,
	) {
		super(label);
		this.description = value;
		this.tooltip = value;
		this.iconPath = new vscode.ThemeIcon("circle-small");
	}
}

/**
 * Provider for a view showing the details of the AWS resource that is currently selected
 * in the "Resources" view. The content of this view will change whenever a new AWS resource
 * is selected.
 */
export class ResourceDetailsViewProvider
	implements vscode.TreeDataProvider<ResourceDetailsTreeItem>
{
	/** EventEmitter we use to produce the event when the tree data changes. */
	private _onDidChangeTreeData = new vscode.EventEmitter<
		ResourceDetailsTreeItem | undefined | null | void
	>();

	/** The event that is fired when the tree data changes. For notifying listeners */
	public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	/** The ARN of the currently selected resource */
	private arn: string | undefined = undefined;

	/** The profile of the currently selected resource */
	private profile: string | undefined = undefined;

	/** Update the view to show details of the selected resource */
	public setArn(profile: string, arn: string) {
		if (arn !== this.arn || profile !== this.profile) {
			this.arn = arn;
			this.profile = profile;
			this._onDidChangeTreeData.fire();
		}
	}

	getTreeItem(
		element: ResourceDetailsTreeItem,
	): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: any): vscode.ProviderResult<ResourceDetailsTreeItem[]> {
		if (this.arn && this.profile) {
			const resourceArn = new ARN(this.arn);
			const service = ProviderFactory.getProviderForService(
				resourceArn.service,
			);

			const headerField = Promise.resolve([
				new ResourceDetailsTreeItem("ARN: ", this.arn),
				new ResourceDetailsTreeItem("Service: ", service.getName()),
			]);

			const resourceFields = service
				.describeResource(this.profile, resourceArn)
				.then((fields) => {
					return fields.map(
						(field) =>
							new ResourceDetailsTreeItem(field.field + ": ", field.value),
					);
				});

			return Promise.all([headerField, resourceFields]).then(
				([header, resource]) => {
					return header.concat(resource);
				},
			);
		} else {
			return Promise.resolve([
				new ResourceDetailsTreeItem(
					"Please select a resource in the Resources view.",
					"",
				),
			]);
		}
	}

	getParent?(element: ResourceDetailsTreeItem) {
		return null;
	}

	resolveTreeItem?(
		item: vscode.TreeItem,
		element: ResourceDetailsTreeItem,
		token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.TreeItem> {
		throw new Error("Method not implemented.");
	}
}
