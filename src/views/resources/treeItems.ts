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
 * @param isLocalStack Whether this profile targets a LocalStack emulator (vs real AWS).
 *   Determines the target-aware icon shown on the service rows beneath it.
 */
export class ResourceProfileTreeItem extends ResourceTreeItem {
	constructor(
		public readonly profile: ProfileFocus,
		public readonly accountId: string,
		public readonly accountName: string,
		public readonly isLocalStack: boolean,
	) {
		super(`Profile: ${profile.id}`, vscode.TreeItemCollapsibleState.Expanded);
		/* Only render the alias (and its separator) when one is set, otherwise
		 * the description shows a dangling "(<id> - )". */
		this.description = accountName
			? `(${accountId} - ${accountName})`
			: `(${accountId})`;
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
 * Represents a single row combining a service and one of its resource types,
 * e.g. label `SQS` with the dimmed description `Queues`. A service with several
 * resource types yields several of these rows (sharing the service name/icon).
 */
export class ResourceServiceTypeTreeItem extends ResourceTreeItem {
	constructor(
		public readonly parent: ResourceRegionTreeItem,
		public readonly service: ServiceFocus,
		public readonly provider: ServiceProvider,
		public readonly resourceType: ResourceTypeFocus,
	) {
		super(provider.getName(), vscode.TreeItemCollapsibleState.Collapsed);
		const [, pluralName] = provider.getResourceTypeNames(resourceType.id);
		/* Resource type shown as dimmed description after the service name. */
		this.description = pluralName;
		/* The icon denotes the profile's target (LocalStack vs AWS), not the
		 * service. It lives on this combined row, not on the resource leaves. */
		this.iconPath = new vscode.ThemeIcon(
			parent.parent.isLocalStack ? "localstack-logo" : "cloud",
		);
	}
}

/**
 * Represents a TreeItem for a Resource
 */
export class ResourceArnTreeItem extends ResourceTreeItem {
	constructor(
		public readonly parent: ResourceServiceTypeTreeItem,
		public readonly arn: string,
		public readonly name: string,
		public readonly tooltip: string,
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
