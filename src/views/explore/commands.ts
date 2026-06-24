/*
 * Command handlers for the Cloud Profiles affordances: add/remove regions and
 * add/edit/remove views. Registered by the resource-browser plugin.
 */
import { commands, window } from "vscode";
import type { Disposable, QuickPickItem } from "vscode";

import AWSConfig from "../../platforms/aws/models/awsConfig.ts";
import {
	getAllRegionCodes,
	getRegionLongName,
} from "../../platforms/aws/models/regionModel.ts";
import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";

import {
	getAddedRegions,
	getInstanceViews,
	getProfileViews,
	removeInstanceView,
	removeProfileView,
	removeRegion,
	resolveShownProfiles,
	saveInstanceView,
	saveProfileView,
	setAddedRegions,
	setShownProfiles,
} from "./settings.ts";
import type { SavedView, ViewScope } from "./settings.ts";
import type {
	InstanceViewTreeItem,
	ProfileViewTreeItem,
	RegionTreeItem,
} from "./treeItems.ts";
import type { LocalStackViewProvider } from "./viewProvider.ts";

/**
 * Register the region/view CRUD commands; returns their disposables.
 * `refreshResources` re-renders the Resources view after a view is
 * added/edited/removed, so an active view reflects the change (or clears when
 * removed) without the user reselecting it.
 */
export function registerLocalStackCommands(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
): Disposable[] {
	return [
		commands.registerCommand(
			"localstack.addRegion",
			(arg: { profileName: string }) => onAddRegion(provider, arg.profileName),
		),
		commands.registerCommand("localstack.manageProfiles", () =>
			onManageProfiles(provider),
		),
		commands.registerCommand(
			"localstack.removeRegion",
			(item: RegionTreeItem) =>
				onRemoveRegion(provider, item.profileName, item.regionId),
		),
		commands.registerCommand(
			"localstack.addProfileView",
			(item: RegionTreeItem) =>
				onAddProfileView(
					provider,
					refreshResources,
					item.profileName,
					item.regionId,
				),
		),
		commands.registerCommand(
			"localstack.editProfileView",
			(item: ProfileViewTreeItem) =>
				onEditProfileView(provider, refreshResources, item),
		),
		commands.registerCommand(
			"localstack.removeProfileView",
			(item: ProfileViewTreeItem) =>
				onRemoveProfileView(
					provider,
					refreshResources,
					item.profileName,
					item.view.name,
				),
		),
		commands.registerCommand("localstack.addInstanceView", () =>
			onAddInstanceView(provider, refreshResources),
		),
		commands.registerCommand(
			"localstack.editInstanceView",
			(item: InstanceViewTreeItem) =>
				onEditInstanceView(provider, refreshResources, item),
		),
		commands.registerCommand(
			"localstack.removeInstanceView",
			(item: InstanceViewTreeItem) =>
				onRemoveInstanceView(provider, refreshResources, item.view.name),
		),
	];
}

async function onAddInstanceView(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
): Promise<void> {
	const result = await runViewWizard(undefined, undefined, undefined, true);
	if (!result) {
		return;
	}
	await saveInstanceView(result);
	provider.refresh();
	refreshResources();
}

async function onEditInstanceView(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
	item: InstanceViewTreeItem,
): Promise<void> {
	const result = await runViewWizard(undefined, undefined, item.view, true);
	if (!result) {
		return;
	}
	await saveInstanceView(result, item.view.name);
	provider.refresh();
	refreshResources();
}

async function onRemoveInstanceView(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
	name: string,
): Promise<void> {
	const confirmed = await window.showWarningMessage(
		`Remove view "${name}" from the LocalStack instance?`,
		{ modal: true },
		"Remove",
	);
	if (confirmed !== "Remove") {
		return;
	}
	await removeInstanceView(name);
	provider.refresh();
	refreshResources();
}

async function onAddRegion(
	provider: LocalStackViewProvider,
	profile: string,
): Promise<void> {
	const added = new Set(getAddedRegions(profile));
	/* The profile's default region is always shown and is not user-selectable. */
	const defaultRegion = AWSConfig.getRegionForProfile(profile);

	const items: QuickPickItem[] = getAllRegionCodes()
		.filter((code) => code !== defaultRegion)
		.map((code) => ({
			label: code,
			description: safeLongName(code),
			picked: added.has(code),
		}));

	if (items.length === 0) {
		void window.showInformationMessage("No additional regions are available.");
		return;
	}

	const picked = await window.showQuickPick(items, {
		title: `Select Regions for "${profile}"`,
		placeHolder: "Select the regions to show (deselect to hide)",
		canPickMany: true,
	});
	/* Undefined means cancelled; an empty array is a valid "hide all". */
	if (picked === undefined) {
		return;
	}
	await setAddedRegions(
		profile,
		picked.map((p) => p.label),
	);
	provider.refresh();
}

/** Toggle which Cloud Profiles are shown (does not touch ~/.aws/config). */
async function onManageProfiles(
	provider: LocalStackViewProvider,
): Promise<void> {
	const all = AWSConfig.getProfileNames();
	const shown = new Set(resolveShownProfiles(all));
	const items: QuickPickItem[] = all.map((profile) => ({
		label: profile,
		picked: shown.has(profile),
	}));

	if (items.length === 0) {
		void window.showInformationMessage("No AWS profiles were found.");
		return;
	}

	const picked = await window.showQuickPick(items, {
		title: "Select Profiles",
		placeHolder: "Select the profiles to show (deselect to hide)",
		canPickMany: true,
	});
	if (picked === undefined) {
		return;
	}
	await setShownProfiles(picked.map((p) => p.label));
	provider.refresh();
}

async function onRemoveRegion(
	provider: LocalStackViewProvider,
	profile: string,
	region: string,
): Promise<void> {
	const confirmed = await window.showWarningMessage(
		`Remove region "${region}" from profile "${profile}"?`,
		{ modal: true },
		"Remove",
	);
	if (confirmed !== "Remove") {
		return;
	}
	await removeRegion(profile, region);
	provider.refresh();
}

async function onAddProfileView(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
	profile: string,
	region: string,
): Promise<void> {
	const result = await runViewWizard(profile, region);
	if (!result) {
		return;
	}
	await saveProfileView(profile, result);
	provider.refresh();
	refreshResources();
}

async function onEditProfileView(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
	item: ProfileViewTreeItem,
): Promise<void> {
	const region =
		"region" in item.view.scope ? item.view.scope.region : undefined;
	const result = await runViewWizard(item.profileName, region, item.view);
	if (!result) {
		return;
	}
	await saveProfileView(item.profileName, result, item.view.name);
	provider.refresh();
	refreshResources();
}

async function onRemoveProfileView(
	provider: LocalStackViewProvider,
	refreshResources: () => void,
	profile: string,
	name: string,
): Promise<void> {
	const confirmed = await window.showWarningMessage(
		`Remove view "${name}" from profile "${profile}"?`,
		{ modal: true },
		"Remove",
	);
	if (confirmed !== "Remove") {
		return;
	}
	await removeProfileView(profile, name);
	provider.refresh();
	refreshResources();
}

/**
 * The view wizard: name -> services -> scope. Returns the new view, or
 * undefined if the user cancelled at any step. `existing` pre-populates the
 * fields for an edit. For an instance view (`isInstance`), the scope step is
 * skipped (instance views always apply to the running instance) and the name
 * must be unique among instance views rather than a profile's views.
 */
async function runViewWizard(
	profile: string | undefined,
	region: string | undefined,
	existing?: SavedView,
	isInstance = false,
): Promise<SavedView | undefined> {
	/* Step 1: name (unique within the profile, or among instance views). */
	const siblings = isInstance
		? getInstanceViews()
		: getProfileViews(profile ?? "");
	const takenNames = new Set(
		siblings.map((v) => v.name).filter((n) => n !== existing?.name),
	);
	const scopeLabel = isInstance ? "the instance" : "the profile";
	const name = await window.showInputBox({
		title: "View name",
		value: existing?.name,
		prompt: `A name for this view (must be unique within ${scopeLabel})`,
		validateInput: (value) => {
			const trimmed = value.trim();
			if (!trimmed) {
				return "Name cannot be empty";
			}
			if (trimmed.toLowerCase() === "all resources") {
				return `"All Resources" is a reserved view name`;
			}
			if (takenNames.has(trimmed)) {
				return `A view named "${trimmed}" already exists in ${scopeLabel}`;
			}
			return undefined;
		},
	});
	if (name === undefined) {
		return undefined;
	}

	/* Step 2: service/resource-type pairs (at least one). */
	const resourceItems: (QuickPickItem & {
		service: string;
		resourceType: string;
	})[] = ProviderFactory.getSupportedServices().flatMap((p) =>
		p.getResourceTypes().map((resourceType) => {
			const [, pluralName] = p.getResourceTypeNames(resourceType);
			return {
				label: `${p.getName()} — ${pluralName}`,
				service: p.getId(),
				resourceType,
				picked:
					existing?.resources.some(
						(r) => r.service === p.getId() && r.resourceType === resourceType,
					) ?? false,
			};
		}),
	);
	const pickedResources = await window.showQuickPick(resourceItems, {
		title: "Select resource types for this view",
		placeHolder: "Pick one or more service resource types",
		canPickMany: true,
	});
	if (!pickedResources || pickedResources.length === 0) {
		return undefined;
	}

	/* Step 3: scope. Instance views always apply to the running instance, so the
	 * scope step is skipped and a placeholder scope is stored (unused there). */
	let scope: ViewScope = { allRegions: true };
	if (!isInstance) {
		const thisRegionLabel = region
			? `This region only (${region})`
			: "This region only";
		const allRegionsLabel = "All regions in this profile";
		const scopeChoice = await window.showQuickPick(
			[thisRegionLabel, allRegionsLabel],
			{ title: "Where should this view appear?" },
		);
		if (!scopeChoice) {
			return undefined;
		}
		if (scopeChoice === allRegionsLabel) {
			scope = { allRegions: true };
		} else if (region) {
			scope = { region };
		} else {
			scope = { allRegions: true };
		}
	}

	return {
		name: name.trim(),
		resources: pickedResources.map((r) => ({
			service: r.service,
			resourceType: r.resourceType,
		})),
		scope,
	};
}

function safeLongName(code: string): string {
	try {
		return getRegionLongName(code);
	} catch {
		return "";
	}
}
