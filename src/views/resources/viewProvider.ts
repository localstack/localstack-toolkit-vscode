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
	ResourceServiceTreeItem,
	ResourceTypeTreeItem,
} from "./treeItems.ts";
import type { ResourceTreeItem } from "./treeItems.ts";

/**
 * Provider for a view that shows all the profile/region/service/resource information
 * that is in focus
 */
export class ResourceViewProvider
	implements vscode.TreeDataProvider<ResourceTreeItem>
{
	/** The focus that determines what is shown in this view */
	private focus?: Focus = undefined;

	/** EventEmitter we use to produce the event when the tree data changes. */
	private _onDidChangeTreeData = new vscode.EventEmitter<
		ResourceTreeItem | undefined | null | void
	>();

	/** The event that is fired when the tree data changes. For notifying listeners */
	public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		/* empty */
	}

	public setFocus(focus: Focus) {
		this.focus = focus;
		this._onDidChangeTreeData.fire(); // refresh the whole tree
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
			return this.makeResourceServices(element);
		} else if (element instanceof ResourceServiceTreeItem) {
			return this.makeResourceTypes(element);
		} else if (element instanceof ResourceTypeTreeItem) {
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
						return new ResourceProfileTreeItem(profile, account, alias);
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
		return Promise.all(
			regions.map(async (region) => {
				return new ResourceRegionTreeItem(
					parent,
					region,
					getRegionLongName(region.id),
				);
			}),
		);
	}

	/**
	 * Create ResourceServiceTreeItems from the services in the region. If the region name is a wildcard,
	 * then dynamically list all services available in the region. Any resourceTypes or ARNs below this
	 * level in the focus are assumed to always be wildcards as well.
	 */
	private makeResourceServices(
		parent: ResourceRegionTreeItem,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		/*
		 * If there's a single service listed, and the service name is "*", then dynamically list all of
		 * the actual services available in the current region.
		 */
		const services = parent.region.services;
		if (services.length === 1 && services[0].id === "*") {
			return ProviderFactory.getSupportedServices().map((provider) => {
				const serviceFocus = {
					id: provider.getId(),
					resourcetypes: provider
						.getResourceTypes()
						.map((name) => ({ id: name, arns: ["*"] })),
				};
				return new ResourceServiceTreeItem(
					parent,
					serviceFocus,
					provider,
					provider.getName(),
				);
			});
		}

		/* else, show only the specified services */
		return Promise.all(
			services.map(async (service) => {
				const provider = ProviderFactory.getProviderForService(service.id);
				return new ResourceServiceTreeItem(
					parent,
					service,
					provider,
					provider.getName(),
				);
			}),
		);
	}

	/**
	 * Create ResourceTypeTreeItems from the resource types in the service.
	 */
	private makeResourceTypes(
		parent: ResourceServiceTreeItem,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		const serviceProvider = parent.provider;
		return Promise.all(
			parent.service.resourcetypes.map(async (resourcetype) => {
				const [_, pluralName] = serviceProvider.getResourceTypeNames(
					resourcetype.id,
				);
				return new ResourceTypeTreeItem(parent, resourcetype, pluralName);
			}),
		);
	}

	/**
	 * Create ResourceArnTreeItems from the ARNs in the resource type.
	 */
	private makeResourceArns(
		parent: ResourceTypeTreeItem,
	): vscode.ProviderResult<ResourceTreeItem[]> {
		const profile = parent.parent.parent.parent.profile.id;
		const region = parent.parent.parent.region.id;
		const serviceProvider = parent.parent.provider;
		const serviceName = serviceProvider.getName();
		const serviceIconPath = serviceProvider.getIconPath(
			serviceProvider.getId(),
		);
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
					const name = new ARN(arn).resourceName || "Unknown Resource Name";

					/* Tooltip has form: <Service Name> <Resource Type Name> */
					const tooltip = `${serviceName} ${singularName}`;
					return new ResourceArnTreeItem(
						parent,
						arn,
						name,
						tooltip,
						serviceIconPath,
					);
				});
			}
		});
	}
}
