import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";

import type { Focus } from "../../models/focus.ts";
import type { LocalStackStatus } from "../../utils/localstack-status.ts";

import type { SavedView } from "./settings.ts";

/** Capitalize a status word for display, e.g. "stopped" → "Stopped". */
function capitalizeStatus(status: LocalStackStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Root class for every node in the LocalStack view. */
export class LocalStackTreeItem extends TreeItem {}

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

/**
 * A LocalStack emulator instance (LocalStack Instances section). The live
 * status is shown inline on the label, e.g. `AWS (Stopped): localhost:4566`.
 */
export class InstanceTreeItem extends LocalStackTreeItem {
	constructor(
		public readonly hostPort: string,
		status: LocalStackStatus,
	) {
		super("", TreeItemCollapsibleState.Expanded);
		this.contextValue = "localstackInstance";
		this.iconPath = new ThemeIcon("server-environment");
		this.setStatus(status);
	}

	/** Update the inline status portion of the label and expandability. */
	setStatus(status: LocalStackStatus): void {
		this.label = `AWS (${capitalizeStatus(status)}): ${this.hostPort}`;
		/* Only a running instance has children (App Inspector, View selectors),
		 * so a stopped instance renders as a plain, non-expandable line. */
		this.collapsibleState =
			status === "running"
				? TreeItemCollapsibleState.Expanded
				: TreeItemCollapsibleState.None;
	}
}

/** Opens the App Inspector webview when clicked. Only shown while running. */
export class AppInspectorTreeItem extends LocalStackTreeItem {
	constructor() {
		super("App Inspector", TreeItemCollapsibleState.None);
		this.description = "Click to open";
		this.contextValue = "localstackAppInspector";
		this.iconPath = new ThemeIcon("search");
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
		public readonly getFocus: () => Promise<Focus | undefined>,
	) {
		super(label, TreeItemCollapsibleState.None);
		this.contextValue = "localstackFocusSelector";
		this.tooltip = `Select to focus on: ${label}`;
		/* Transparent icon so the label aligns with icon-bearing siblings —
		 * specifically the `App Inspector` node alongside the instance's
		 * `View: All Resources` selector. */
		this.iconPath = new ThemeIcon("blank");
	}
}

/** A user-defined cloud-profile view focus selector (supports Edit/Remove). */
export class ProfileViewTreeItem extends FocusSelectorTreeItem {
	constructor(
		public readonly profileName: string,
		public readonly view: SavedView,
		getFocus: () => Promise<Focus | undefined>,
	) {
		super(`View: ${view.name}`, getFocus);
		this.contextValue = "localstackProfileView";
	}
}

/**
 * A user-defined view for the LocalStack instance (supports Edit/Remove).
 * Distinct from `ProfileViewTreeItem` (cloud-profile views) so its menus and
 * storage stay separate; its focus intersects the live metamodel with the
 * chosen pairs.
 */
export class InstanceViewTreeItem extends FocusSelectorTreeItem {
	constructor(
		public readonly view: SavedView,
		getFocus: () => Promise<Focus | undefined>,
	) {
		super(`View: ${view.name}`, getFocus);
		this.contextValue = "localstackInstanceView";
	}
}

/**
 * Opt-in affordance shown at the root while the resource browser is disabled.
 * Clicking it enables the full experience. Not a focus selector — it never
 * drives the Resources view.
 */
export class OptInTreeItem extends LocalStackTreeItem {
	constructor() {
		super("Enable resource browser (preview)", TreeItemCollapsibleState.None);
		this.contextValue = "localstackOptIn";
		this.iconPath = new ThemeIcon("sparkle");
		this.tooltip =
			"Show the Resources and Resource Details views and the full Explore tree";
		this.command = {
			title: "Enable Resource Browser",
			command: "localstack.enableResourceBrowser",
		};
	}
}

/**
 * Opt-out affordance shown at the root while the resource browser is enabled.
 * Clicking it returns to the minimal experience.
 */
export class OptOutTreeItem extends LocalStackTreeItem {
	constructor() {
		super("Disable resource browser (preview)", TreeItemCollapsibleState.None);
		this.contextValue = "localstackOptOut";
		this.iconPath = new ThemeIcon("circle-slash");
		this.tooltip =
			"Hide the Resources and Resource Details views and return to the minimal Explore tree";
		this.command = {
			title: "Disable Resource Browser",
			command: "localstack.disableResourceBrowser",
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
