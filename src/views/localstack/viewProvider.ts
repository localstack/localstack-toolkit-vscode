import { EventEmitter } from "vscode";
import type {
	Event,
	LogOutputChannel,
	ProviderResult,
	TreeDataProvider,
} from "vscode";

import { makeWildcardFocus } from "../../models/focus.ts";
import type { Focus } from "../../models/focus.ts";
import { CloudFormation } from "../../platforms/aws/clients/cloudformation.ts";
import ARN from "../../platforms/aws/models/arnModel.ts";
import AWSConfig from "../../platforms/aws/models/awsConfig.ts";
import CfnStackModel from "../../platforms/aws/models/cfnStackModel.ts";
import { computeMetamodelFocus } from "../../platforms/aws/models/metamodelFocus.ts";
import {
	endpointHostPort,
	getLocalStackEndpointUrl,
} from "../../utils/localstack-endpoint.ts";
import type { LocalStackStatusTracker } from "../../utils/localstack-status.ts";

import {
	getAddedRegions,
	getFiltersForRegion,
	getInstanceViews,
	resolveShownProfiles,
} from "./settings.ts";
import type { ResourcePair, SavedFilter } from "./settings.ts";
import {
	AppInspectorTreeItem,
	ErrorTreeItem,
	FilterTreeItem,
	FocusSelectorTreeItem,
	InstanceTreeItem,
	InstanceViewTreeItem,
	PlaceholderTreeItem,
	ProfileTreeItem,
	RegionTreeItem,
	SectionTreeItem,
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
				new SectionTreeItem("profiles", "Cloud Profiles"),
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

	/**
	 * Compute the focus for the current selection. The view is single-select, so
	 * at most one focus selector is active; return its focus (or undefined when
	 * the selection contains no focus selector).
	 */
	async computeFocus(
		selection: readonly LocalStackTreeItem[],
	): Promise<Focus | undefined> {
		const selector = selection.find(
			(item): item is FocusSelectorTreeItem =>
				item instanceof FocusSelectorTreeItem,
		);
		return selector ? selector.getFocus() : undefined;
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
		/* Children are only meaningful while the emulator is running. */
		if (this.statusTracker.status() !== "running") {
			return [];
		}

		const allResources = new FocusSelectorTreeItem(
			"View: All Resources",
			async () => {
				const endpoint = await getLocalStackEndpointUrl();
				return computeMetamodelFocus(endpoint, this.log);
			},
		);

		/* Saved instance views: the metamodel focus narrowed to the view's chosen
		 * pairs. Resolved live by name so edits/removes propagate on refresh. */
		const views = getInstanceViews().map(
			(view) =>
				new InstanceViewTreeItem(view, async () => {
					const endpoint = await getLocalStackEndpointUrl();
					const metamodel = await computeMetamodelFocus(endpoint, this.log);
					const live = getInstanceViews().find((v) => v.name === view.name);
					return live
						? intersectMetamodelWithPairs(metamodel, live.resources)
						: undefined;
				}),
		);

		return [new AppInspectorTreeItem(), allResources, ...views];
	}

	private makeProfiles(): LocalStackTreeItem[] {
		const all = AWSConfig.getProfileNames();
		const shown = new Set(resolveShownProfiles(all));
		const profiles = all.filter((profile) => shown.has(profile));
		if (profiles.length === 0) {
			return [new PlaceholderTreeItem("No profiles selected")];
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
			new FocusSelectorTreeItem("View: All Resources", () =>
				Promise.resolve(makeWildcardFocus(profile, region)),
			),
		);

		for (const filter of getFiltersForRegion(profile, region)) {
			children.push(
				new FilterTreeItem(profile, filter, () =>
					/* Resolve the filter live so an edit to the active view is
					 * reflected on refresh, and a removed view yields no focus
					 * (clearing the Resources view) rather than stale content. */
					Promise.resolve(
						resolveRegionFilterFocus(
							profile,
							region,
							filter.name,
							getFiltersForRegion(profile, region),
						),
					),
				),
			);
		}

		/* CloudFormation stacks for this profile/region. */
		try {
			const stacks = await CloudFormation.listStacks(profile, region);
			for (const stack of stacks) {
				children.push(
					new FocusSelectorTreeItem(`Stack: ${stack.StackName}`, () =>
						new CfnStackModel(
							profile,
							new ARN(stack.StackId!),
							this.log,
						).toFocusModel(),
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

/**
 * Resolve a region filter's focus live from the given filter list, by name.
 * Returns `undefined` when no filter with that name exists (e.g. it was removed
 * or renamed), so the Resources view clears rather than showing stale content.
 * Pure (the filter list is passed in) so the live-resolution behavior is
 * testable; the caller passes the current `getFiltersForRegion(...)` result.
 */
export function resolveRegionFilterFocus(
	profile: string,
	region: string,
	name: string,
	filters: SavedFilter[],
): Focus | undefined {
	const live = filters.find((f) => f.name === name);
	return live ? makeFilterFocus(profile, region, live) : undefined;
}

/**
 * Narrow a metamodel-derived focus to a set of chosen service/resource-type
 * pairs (an instance view). Keeps only the pairs that are actually present in
 * the metamodel, so a view never lists a type with nothing deployed; services
 * and regions left empty are dropped. Exported for testing.
 */
export function intersectMetamodelWithPairs(
	metamodel: Focus,
	pairs: ResourcePair[],
): Focus {
	const wantedServices = new Set(pairs.map((p) => p.service));
	const wantedPairs = new Set(
		pairs.map((p) => `${p.service} ${p.resourceType}`),
	);
	const profile = metamodel.profiles[0];
	const regions = (profile?.regions ?? [])
		.map((region) => ({
			id: region.id,
			services: region.services
				.filter((s) => wantedServices.has(s.id))
				.map((s) => ({
					id: s.id,
					resourcetypes: s.resourcetypes.filter((rt) =>
						wantedPairs.has(`${s.id} ${rt.id}`),
					),
				}))
				.filter((s) => s.resourcetypes.length > 0),
		}))
		.filter((region) => region.services.length > 0);

	return {
		version: "1.0",
		profiles: [{ id: profile?.id ?? "localstack", regions }],
	};
}

/** Build a focus for a region scoped to a filter's chosen service/type pairs. */
function makeFilterFocus(
	profile: string,
	region: string,
	filter: SavedFilter,
): Focus {
	/* Group the flat pair list by service into the focus shape. */
	const resourceTypesByService = new Map<string, string[]>();
	for (const { service, resourceType } of filter.resources) {
		const list = resourceTypesByService.get(service) ?? [];
		list.push(resourceType);
		resourceTypesByService.set(service, list);
	}
	const services = [...resourceTypesByService.entries()].map(
		([id, resourceTypes]) => ({
			id,
			resourcetypes: resourceTypes.map((rt) => ({ id: rt, arns: ["*"] })),
		}),
	);
	return {
		version: "1.0",
		profiles: [{ id: profile, regions: [{ id: region, services }] }],
	};
}
