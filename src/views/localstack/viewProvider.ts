import { EventEmitter } from "vscode";
import type {
	Event,
	LogOutputChannel,
	ProviderResult,
	TreeDataProvider,
} from "vscode";

import { makeWildcardFocus, mergeFocuses } from "../../models/focus.ts";
import type { Focus } from "../../models/focus.ts";
import { CloudFormation } from "../../platforms/aws/clients/cloudformation.ts";
import ARN from "../../platforms/aws/models/arnModel.ts";
import AWSConfig from "../../platforms/aws/models/awsConfig.ts";
import CfnStackModel from "../../platforms/aws/models/cfnStackModel.ts";
import { computeMetamodelFocus } from "../../platforms/aws/models/metamodelFocus.ts";
import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";
import {
	endpointHostPort,
	getLocalStackEndpointUrl,
} from "../../utils/localstack-endpoint.ts";
import type { LocalStackStatusTracker } from "../../utils/localstack-status.ts";

import {
	getAddedRegions,
	getFiltersForRegion,
	getHiddenProfiles,
} from "./settings.ts";
import type { SavedFilter } from "./settings.ts";
import {
	AppInspectorTreeItem,
	ErrorTreeItem,
	FilterTreeItem,
	FocusSelectorTreeItem,
	InstanceTreeItem,
	PlaceholderTreeItem,
	ProfileTreeItem,
	RegionTreeItem,
	SectionTreeItem,
	SeparatorTreeItem,
} from "./treeItems.ts";
import type { LocalStackTreeItem } from "./treeItems.ts";

/**
 * Tree data provider for the combined "LocalStack" view, with three sections:
 * LocalStack Instances, Cloud Profiles, and Workspace IaC. Leaf focus selectors
 * drive the Resources view.
 */
export class LocalStackViewProvider
	implements TreeDataProvider<LocalStackTreeItem>
{
	readonly #onDidChangeTreeData = new EventEmitter<
		// biome-ignore lint/suspicious/noConfusingVoidType: required by the Event signature
		LocalStackTreeItem | undefined | void
	>();
	readonly onDidChangeTreeData: Event<
		// biome-ignore lint/suspicious/noConfusingVoidType: required by the Event signature
		LocalStackTreeItem | undefined | void
	> = this.#onDidChangeTreeData.event;

	#instanceItem: InstanceTreeItem | undefined;

	constructor(
		private readonly statusTracker: LocalStackStatusTracker,
		private readonly log?: LogOutputChannel,
	) {
		this.statusTracker.onChange((status) => {
			if (this.#instanceItem) {
				/* Update the inline status label and refresh the instance node;
				 * firing it also rebuilds its children so the App Inspector
				 * description reflects the new running state. */
				this.#instanceItem.setStatus(status);
				this.#onDidChangeTreeData.fire(this.#instanceItem);
			}
		});
	}

	/** Refresh the whole tree (e.g. after a settings change). */
	refresh(): void {
		this.#onDidChangeTreeData.fire();
	}

	getTreeItem(element: LocalStackTreeItem): LocalStackTreeItem {
		return element;
	}

	getChildren(
		element?: LocalStackTreeItem,
	): ProviderResult<LocalStackTreeItem[]> {
		if (!element) {
			return [
				new SectionTreeItem("instances", "LocalStack Instances"),
				new SeparatorTreeItem(),
				new SectionTreeItem("profiles", "Cloud Profiles"),
				new SeparatorTreeItem(),
				new SectionTreeItem("workspace", "Workspace IaC"),
			];
		}
		if (element instanceof SectionTreeItem) {
			switch (element.kind) {
				case "instances":
					return this.makeInstances();
				case "profiles":
					return this.makeProfiles();
				case "workspace":
					return [new PlaceholderTreeItem("Coming soon")];
			}
		}
		if (element instanceof InstanceTreeItem) {
			return this.makeInstanceChildren();
		}
		if (element instanceof ProfileTreeItem) {
			return this.makeProfileChildren(element.profileName);
		}
		if (element instanceof RegionTreeItem) {
			return this.makeRegionChildren(element.profileName, element.regionId);
		}
		return [];
	}

	/** Compute the focus for the current selection, merging when multiple. */
	async computeFocus(
		selection: readonly LocalStackTreeItem[],
	): Promise<Focus | undefined> {
		const selectors = selection.filter(
			(item): item is FocusSelectorTreeItem =>
				item instanceof FocusSelectorTreeItem,
		);
		if (selectors.length === 0) {
			return undefined;
		}
		const focuses = await Promise.all(selectors.map((s) => s.getFocus()));
		return mergeFocuses(focuses);
	}

	private async makeInstances(): Promise<LocalStackTreeItem[]> {
		const endpoint = await getLocalStackEndpointUrl();
		const item = new InstanceTreeItem(
			endpointHostPort(endpoint),
			this.statusTracker.status(),
		);
		this.#instanceItem = item;
		return [item];
	}

	private makeInstanceChildren(): LocalStackTreeItem[] {
		const isRunning = this.statusTracker.status() === "running";

		const allResources = new FocusSelectorTreeItem(
			"View All Resources",
			async () => {
				const endpoint = await getLocalStackEndpointUrl();
				return computeMetamodelFocus(endpoint, this.log);
			},
		);

		return [new AppInspectorTreeItem(isRunning), allResources];
	}

	private makeProfiles(): LocalStackTreeItem[] {
		const hidden = new Set(getHiddenProfiles());
		const profiles = AWSConfig.getProfileNames().filter(
			(profile) => !hidden.has(profile),
		);
		if (profiles.length === 0) {
			return [new PlaceholderTreeItem("All profiles hidden")];
		}
		return profiles.map((profile) => new ProfileTreeItem(profile));
	}

	private makeProfileChildren(profile: string): LocalStackTreeItem[] {
		const regions: LocalStackTreeItem[] = [];
		const defaultRegion = AWSConfig.getRegionForProfile(profile);
		const seen = new Set<string>();
		if (defaultRegion) {
			regions.push(new RegionTreeItem(profile, defaultRegion, true));
			seen.add(defaultRegion);
		}
		for (const region of getAddedRegions(profile)) {
			if (!seen.has(region)) {
				regions.push(new RegionTreeItem(profile, region, false));
				seen.add(region);
			}
		}
		return regions;
	}

	private async makeRegionChildren(
		profile: string,
		region: string,
	): Promise<LocalStackTreeItem[]> {
		const children: LocalStackTreeItem[] = [];

		children.push(
			new FocusSelectorTreeItem("View All Resources", () =>
				Promise.resolve(makeWildcardFocus(profile, region)),
			),
		);

		for (const filter of getFiltersForRegion(profile, region)) {
			children.push(
				new FilterTreeItem(profile, filter, () =>
					Promise.resolve(makeFilterFocus(profile, region, filter)),
				),
			);
		}

		/* CloudFormation stacks for this profile/region. */
		try {
			const stacks = await CloudFormation.listStacks(profile, region);
			for (const stack of stacks) {
				children.push(
					new FocusSelectorTreeItem(`CFN: ${stack.StackName}`, () =>
						new CfnStackModel(profile, new ARN(stack.StackId!)).toFocusModel(),
					),
				);
			}
		} catch (error) {
			children.push(
				new ErrorTreeItem(
					`Could not list CloudFormation stacks: ${String(error)}`,
				),
			);
		}

		return children;
	}
}

/** Build a focus for a region scoped to a filter's chosen services. */
function makeFilterFocus(
	profile: string,
	region: string,
	filter: SavedFilter,
): Focus {
	const services = filter.services.map((serviceId) => {
		const provider = ProviderFactory.getProviderForService(serviceId);
		return {
			id: serviceId,
			resourcetypes: provider
				.getResourceTypes()
				.map((rt) => ({ id: rt, arns: ["*"] })),
		};
	});
	return {
		version: "1.0",
		profiles: [{ id: profile, regions: [{ id: region, services }] }],
	};
}
