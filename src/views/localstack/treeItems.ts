import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";

import type { Focus } from "../../models/focus.ts";

import type { SavedFilter } from "./settings.ts";

/** Root class for every node in the LocalStack view. */
export class LocalStackTreeItem extends TreeItem {
	constructor(label: string, state?: TreeItemCollapsibleState) {
		super(label, state);
	}
}

/** The three top-level sections. */
export type SectionKind = "instances" | "profiles" | "workspace";

export class SectionTreeItem extends LocalStackTreeItem {
	constructor(
		public readonly kind: SectionKind,
		label: string,
	) {
		super(label, TreeItemCollapsibleState.Expanded);
		this.contextValue = `localstackSection:${kind}`;
	}
}

/** A running LocalStack emulator instance (LocalStack Instances section). */
export class InstanceTreeItem extends LocalStackTreeItem {
	constructor(hostPort: string) {
		super(`AWS: ${hostPort}`, TreeItemCollapsibleState.Expanded);
		this.contextValue = "localstackInstance";
		this.iconPath = new ThemeIcon("server-environment");
	}
}

/** The live status node under an instance. */
export class StatusTreeItem extends LocalStackTreeItem {
	constructor() {
		super("Status", TreeItemCollapsibleState.None);
		this.contextValue = "localstackStatus";
	}
}

/** Opens the App Inspector webview when clicked. */
export class AppInspectorTreeItem extends LocalStackTreeItem {
	constructor() {
		super("App Inspector", TreeItemCollapsibleState.None);
		this.description = "Click to open";
		this.contextValue = "localstackAppInspector";
		this.command = {
			title: "Open App Inspector",
			command: "localstack.openAppInspector",
		};
	}
}

/** An AWS profile from ~/.aws/config (Cloud Profiles section). */
export class ProfileTreeItem extends LocalStackTreeItem {
	constructor(public readonly profileName: string) {
		super(`AWS: ${profileName}`, TreeItemCollapsibleState.Collapsed);
		this.contextValue = "localstackProfile";
		this.iconPath = new ThemeIcon("account");
	}
}

/** A region under a profile. */
export class RegionTreeItem extends LocalStackTreeItem {
	constructor(
		public readonly profileName: string,
		public readonly regionId: string,
		public readonly isDefault: boolean,
	) {
		super(regionId, TreeItemCollapsibleState.Collapsed);
		this.description = isDefault ? "(default)" : undefined;
		/* Only user-added regions offer a Remove action. */
		this.contextValue = isDefault
			? "localstackDefaultRegion"
			: "localstackUserRegion";
	}
}

/**
 * A focus selector: clicking it sets the active focus for the Resources view.
 * `getFocus` is invoked lazily when the node is selected.
 */
export class FocusSelectorTreeItem extends LocalStackTreeItem {
	constructor(
		label: string,
		public readonly getFocus: () => Promise<Focus>,
	) {
		super(label, TreeItemCollapsibleState.None);
		this.contextValue = "localstackFocusSelector";
		this.iconPath = new ThemeIcon("filter");
		this.tooltip = `Select to focus on: ${label}`;
	}
}

/** A user-defined filter focus selector (supports Edit/Remove). */
export class FilterTreeItem extends FocusSelectorTreeItem {
	constructor(
		public readonly profileName: string,
		public readonly filter: SavedFilter,
		getFocus: () => Promise<Focus>,
	) {
		super(filter.name, getFocus);
		this.contextValue = "localstackFilter";
	}
}

/** The "Add new filter" affordance under a region. */
export class AddFilterTreeItem extends LocalStackTreeItem {
	constructor(
		public readonly profileName: string,
		public readonly regionId: string,
	) {
		super("Add new filter", TreeItemCollapsibleState.None);
		this.iconPath = new ThemeIcon("add");
		this.contextValue = "localstackAddFilter";
		this.command = {
			title: "Add new filter",
			command: "localstack.addFilter",
			arguments: [{ profileName, regionId }],
		};
	}
}

/** The "Add new region" affordance under a profile. */
export class AddRegionTreeItem extends LocalStackTreeItem {
	constructor(public readonly profileName: string) {
		super("Add new region", TreeItemCollapsibleState.None);
		this.iconPath = new ThemeIcon("add");
		this.contextValue = "localstackAddRegion";
		this.command = {
			title: "Add new region",
			command: "localstack.addRegion",
			arguments: [{ profileName }],
		};
	}
}

/** A non-interactive placeholder (e.g. "Coming soon", "[ No stacks ]"). */
export class PlaceholderTreeItem extends LocalStackTreeItem {
	constructor(message: string) {
		super(message, TreeItemCollapsibleState.None);
		this.tooltip = message;
	}
}

/** An error node shown in place of content we could not load. */
export class ErrorTreeItem extends LocalStackTreeItem {
	constructor(message: string) {
		super(`Error: ${message}`, TreeItemCollapsibleState.None);
		this.tooltip = message;
		this.iconPath = new ThemeIcon("error");
	}
}
