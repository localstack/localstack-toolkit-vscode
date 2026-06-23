import * as vscode from "vscode";

import type { Focus } from "../../models/focus.ts";
import { Account } from "../../platforms/aws/clients/account.ts";
import { IAM } from "../../platforms/aws/clients/iam.ts";
import { STS } from "../../platforms/aws/clients/sts.ts";
import ARN from "../../platforms/aws/models/arnModel.ts";
import AWSConfig from "../../platforms/aws/models/awsConfig.ts";
import { getRegionLongName } from "../../platforms/aws/models/regionModel.ts";
import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";

import {
	ResourceArnTreeItem,
	ResourceErrorTreeItem,
	ResourcePlaceholderTreeItem,
	ResourceProfileTreeItem,
	ResourceRegionTreeItem,
	ResourceServiceTypeTreeItem,
} from "./treeItems.ts";
import type { ResourceTreeItem } from "./treeItems.ts";

/** The synthetic profile id used for the LocalStack emulator instance. */
const LOCALSTACK_PROFILE_ID = "localstack";

/**
 * Whether a profile targets a LocalStack emulator rather than real AWS. A
 * profile is treated as LocalStack when it resolves to a custom `endpoint_url`
 * (LocalStack profiles are configured with one) or when it is the synthetic
 * `localstack` instance profile. Profiles without a custom endpoint target AWS.
 */
function isLocalStackProfile(profileId: string): boolean {
	return (
		profileId === LOCALSTACK_PROFILE_ID ||
		AWSConfig.getEndpointForProfile(profileId) !== undefined
	);
}

/**
 * Provider for a view that shows all the profile/region/service/resource information
 * that is in focus
 */
export class ResourceViewProvider
	implements vscode.TreeDataProvider<ResourceTreeItem>
{
	/** The focus that determines what is shown in this view */
	private focus?: Focus = undefined;

	/**
	 * Produces the active focus. Stored (rather than just the resulting focus)
	 * so a manual refresh can recompute it from scratch — re-querying the
	 * LocalStack metamodel API to pick up resources created since the last view.
	 */
	private focusProducer?: () => Promise<Focus | undefined>;

	/** EventEmitter we use to produce the event when the tree data changes. */
	private _onDidChangeTreeData = new vscode.EventEmitter<
		ResourceTreeItem | undefined | null | void
	>();

	/** The event that is fired when the tree data changes. For notifying listeners */
	public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		/* empty */
	}

	/**
	 * Set the active focus from a producer. The producer is retained so a manual
	 * refresh can re-run it (e.g. re-fetching the metamodel for a LocalStack
	 * instance). A producer that resolves to `undefined` (e.g. a selection with
	 * no focus selectors) leaves the current focus untouched.
	 */
	public async setFocusProducer(
		producer: () => Promise<Focus | undefined>,
	): Promise<void> {
		this.focusProducer = producer;
		await this.applyFocus(false);
	}

	/** Set the active focus directly (no producer; refresh re-renders as-is). */
	public setFocus(focus: Focus) {
		this.focus = focus;
		this.focusProducer = undefined;
		this._onDidChangeTreeData.fire(); // refresh the whole tree
	}

	/**
	 * Manual refresh: recompute the focus from its producer (re-querying the
	 * LocalStack API so newly-created resources appear), then re-render. With no
	 * producer, re-render the current focus, which re-lists resources live.
	 */
	public async refresh(): Promise<void> {
		await this.applyFocus(true);
	}

	/**
	 * Recompute and apply the focus. `forceRender` re-fires the tree-change event
	 * even when the producer yields no new focus, so a manual refresh always
	 * re-lists resources.
	 */
	private async applyFocus(forceRender: boolean): Promise<void> {
		if (!this.focusProducer) {
			if (forceRender) {
				this._onDidChangeTreeData.fire();
			}
			return;
		}
		try {
			const focus = await this.focusProducer();
			if (focus) {
				this.focus = focus;
				this._onDidChangeTreeData.fire();
			} else if (forceRender) {
				this._onDidChangeTreeData.fire();
			}
		} catch (error) {
			void vscode.window.showWarningMessage(
				`Could not load resources: ${String(error)}`,
			);
		}
	}

	public getTreeItem(
		element: ResourceTreeItem,
	): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	public getChildren(element?: any): vscode.ProviderResult<ResourceTreeItem[]> {
		if (!element) {
			if (!this.focus) {
				return Promise.resolve([
					new ResourcePlaceholderTreeItem(
						"Please select a focus in the Focus view.",
					),
				]);
			} else {
				return this.makeResourceProfiles(this.focus);
			}
		} else if (element instanceof ResourceProfileTreeItem) {
			return this.makeResourceRegions(element);
		} else if (element instanceof ResourceRegionTreeItem) {
			return this.makeResourceServiceTypes(element);
		} else if (element instanceof ResourceServiceTypeTreeItem) {
			return this.makeResourceArns(element);
		}
		return Promise.resolve([]);
	}

	public getParent?(element: ResourceTreeItem) {
		return null;
	}

	public resolveTreeItem?(
		item: vscode.TreeItem,
		element: ResourceTreeItem,
		token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.TreeItem> {
		throw new Error("Method not implemented.");
	}

	/**
	 * Create ResourceProfileTreeItems from the profiles in the focus. The profiles must have
	 * valid names, and can not be a wildcard. We need to fetch the profile account's number and name.
	 */
	private makeResourceProfiles(
		focus: Focus,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		let profiles = focus.profiles;

		/* if there's a wildcard profile, then fetch all profiles from AWSConfig */
		if (profiles.length === 1 && profiles[0].id === "*") {
			const regions = profiles[0].regions;
			profiles = AWSConfig.getProfileNames().map((profileId) => {
				return { id: profileId, regions };
			});
		}

		/* else, show only the profiles specified in the focus */
		return Promise.all(
			profiles.map(async (profile) => {
				return Promise.all([
					STS.getCallerIdentity(profile.id),
					IAM.getAccountAlias(profile.id),
				])
					.then(([{ account }, alias]) => {
						return new ResourceProfileTreeItem(
							profile,
							account,
							alias,
							isLocalStackProfile(profile.id),
						);
					})
					.catch((error) => {
						/* error communicating with AWS, possibly bad credentials */
						return new ResourceErrorTreeItem(
							`Invalid Profile: ${profile.id}. ${error}`,
						);
					});
			}),
		);
	}

	/**
	 * Create ResourceRegionTreeItems from the regions in the profile.
	 */
	private makeResourceRegions(
		parent: ResourceProfileTreeItem,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		/*
		 * If there's a single region listed, and the region name is "*", then dynamically list all of
		 * the actual regions available in the current profile.
		 */
		const regions = parent.profile.regions;
		if (regions.length === 1 && regions[0].id === "*") {
			const services = regions[0].services;
			return Account.listRegions(parent.profile.id).then((regions) => {
				return regions.map((region) => {
					const longName = getRegionLongName(region);
					const regionFocus = { id: region, services };
					return new ResourceRegionTreeItem(parent, regionFocus, longName);
				});
			});
		}

		/* If the region name is 'default', then only show the user's currently selected default region */
		if (regions.length === 1 && regions[0].id === "default") {
			const region = AWSConfig.getRegionForProfile(parent.profile.id);
			if (!region) {
				return Promise.resolve([
					new ResourceErrorTreeItem(
						`Profile ${parent.profile.id} does not have a default region configured.`,
					),
				]);
			}
			const regionFocus = { id: region, services: regions[0].services };
			return Promise.resolve([
				new ResourceRegionTreeItem(
					parent,
					regionFocus,
					getRegionLongName(region),
				),
			]);
		}

		/* else, show only the specified regions */
		return regions.map(
			(region) =>
				new ResourceRegionTreeItem(
					parent,
					region,
					getRegionLongName(region.id),
				),
		);
	}

	/**
	 * Create the combined service/resource-type rows for a region — one row per
	 * (service, resource type) pair. If the region's service list is a wildcard,
	 * expand it to all supported providers (each with all of its resource types).
	 */
	private makeResourceServiceTypes(
		parent: ResourceRegionTreeItem,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		const services = parent.region.services;
		const expanded =
			services.length === 1 && services[0].id === "*"
				? ProviderFactory.getSupportedServices().map((provider) => ({
						provider,
						service: {
							id: provider.getId(),
							resourcetypes: provider
								.getResourceTypes()
								.map((name) => ({ id: name, arns: ["*"] })),
						},
					}))
				: services.map((service) => ({
						provider: ProviderFactory.getProviderForService(service.id),
						service,
					}));

		const rows: ResourceTreeItem[] = [];
		for (const { provider, service } of expanded) {
			for (const resourceType of service.resourcetypes) {
				rows.push(
					new ResourceServiceTypeTreeItem(
						parent,
						service,
						provider,
						resourceType,
					),
				);
			}
		}
		return rows;
	}

	/**
	 * Create ResourceArnTreeItems from the ARNs in the combined service/type row.
	 */
	private makeResourceArns(
		parent: ResourceServiceTypeTreeItem,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		const profile = parent.parent.parent.profile.id;
		const region = parent.parent.region.id;
		const serviceProvider = parent.provider;
		const serviceName = serviceProvider.getName();
		const [singularName, _] = serviceProvider.getResourceTypeNames(
			parent.resourceType.id,
		);

		/*
		 * Cases:
		 * 1) Wildcard ARN: ["*"] - fetch all ARNs of this resource type from AWS
		 * 2) Specific ARNs: ["arn:aws:..."] - use the specified ARNs directly
		 * 3) No ARNs: [] - display a placeholder tree item
		 */
		const arnSpecs = parent.resourceType.arns;
		const useWildCard = arnSpecs.length === 1 && arnSpecs[0] === "*";
		const arnPromise = useWildCard
			? serviceProvider.getResourceArns(profile, region, parent.resourceType.id)
			: Promise.resolve(arnSpecs);

		return arnPromise.then((arns) => {
			if (arns.length === 0) {
				return [new ResourcePlaceholderTreeItem()];
			} else {
				return arns.map((arn) => {
					/* Most providers return ARNs, but some return a primary identifier
					 * that isn't a parseable ARN. Fall back to showing the identifier
					 * verbatim rather than failing the whole row. */
					let name: string;
					try {
						name = new ARN(arn).resourceName || arn;
					} catch {
						name = arn;
					}

					/* Tooltip has form: <Service Name> <Resource Type Name> */
					const tooltip = `${serviceName} ${singularName}`;
					return new ResourceArnTreeItem(parent, arn, name, tooltip);
				});
			}
		});
	}
}
