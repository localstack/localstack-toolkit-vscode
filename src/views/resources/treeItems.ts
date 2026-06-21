import * as vscode from "vscode";

import type {
	ProfileFocus,
	RegionFocus,
	ResourceTypeFocus,
	ServiceFocus,
} from "../../models/focus.ts";
import type { ServiceProvider } from "../../platforms/aws/services/serviceProvider.ts";

/**
 * The top-level class for any TreeItem in the Resources View
 */
export class ResourceTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		state?: vscode.TreeItemCollapsibleState,
	) {
		super(label, state);
	}
}

/**
 * Represents a TreeItem for a Profile
 * @param profile The ProfileFocus object providing Profile details.
 * @param accountId The AWS account ID associated with the profile.
 * @param accountName The name of the AWS account associated with the profile.
 */
export class ResourceProfileTreeItem extends ResourceTreeItem {
	constructor(
		public readonly profile: ProfileFocus,
		public readonly accountId: string,
		public readonly accountName: string,
	) {
		super(`Profile: ${profile.id}`, vscode.TreeItemCollapsibleState.Expanded);
		this.description = `(${accountId} - ${accountName})`;
	}
}

/**
 * Represents a TreeItem for a Region
 */
export class ResourceRegionTreeItem extends ResourceTreeItem {
	constructor(
		public readonly parent: ResourceProfileTreeItem,
		public readonly region: RegionFocus,
		public readonly locationName: string,
	) {
		super(region.id, vscode.TreeItemCollapsibleState.Collapsed);
		this.description = locationName;
	}
}

/**
 * Represents a TreeItem for a Service
 */
export class ResourceServiceTreeItem extends ResourceTreeItem {
	constructor(
		public readonly parent: ResourceRegionTreeItem,
		public readonly service: ServiceFocus,
		public readonly provider: ServiceProvider,
		public readonly name: string,
	) {
		super(name, vscode.TreeItemCollapsibleState.Collapsed);
	}
}

/**
 * Represents a TreeItem for a Resource Type
 */
export class ResourceTypeTreeItem extends ResourceTreeItem {
	constructor(
		public readonly parent: ResourceServiceTreeItem,
		public readonly resourceType: ResourceTypeFocus,
		public readonly name: string,
	) {
		super(name, vscode.TreeItemCollapsibleState.Expanded);
	}
}

/**
 * Represents a TreeItem for a Resource
 */
export class ResourceArnTreeItem extends ResourceTreeItem {
	constructor(
		public readonly parent: ResourceTypeTreeItem,
		public readonly arn: string,
		public readonly name: string,
		public readonly tooltip: string,
		public readonly iconPath: string,
	) {
		super(name);
	}
}

/**
 * Represents a TreeItem that we weren't able to show because
 * of some error.
 */
export class ResourceErrorTreeItem extends ResourceTreeItem {
	constructor(public readonly errorMessage: string) {
		super(`Error: ${errorMessage}`, vscode.TreeItemCollapsibleState.None);
		this.tooltip = errorMessage;
		this.iconPath = new vscode.ThemeIcon("error");
	}
}

/**
 * Represents a TreeItem that is essentially a placeholder. This is not an
 * error, but more for indicating that there are no resources to display.
 */
export class ResourcePlaceholderTreeItem extends ResourceTreeItem {
	constructor(message: string = "[ No Resources ]") {
		super(message, vscode.TreeItemCollapsibleState.None);
		this.tooltip = "No Resources to Display";
	}
}
