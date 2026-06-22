/*
 * Command handlers for the Cloud Profiles affordances: add/remove regions and
 * add/edit/remove filters. Registered by the resource-browser plugin.
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
	getFilters,
	removeFilter,
	removeRegion,
	resolveShownProfiles,
	saveFilter,
	setAddedRegions,
	setShownProfiles,
} from "./settings.ts";
import type { FilterScope, SavedFilter } from "./settings.ts";
import type { FilterTreeItem, RegionTreeItem } from "./treeItems.ts";
import type { LocalStackViewProvider } from "./viewProvider.ts";

/** Register the region/filter CRUD commands; returns their disposables. */
export function registerLocalStackCommands(
	provider: LocalStackViewProvider,
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
		commands.registerCommand("localstack.addFilter", (item: RegionTreeItem) =>
			onAddFilter(provider, item.profileName, item.regionId),
		),
		commands.registerCommand("localstack.editFilter", (item: FilterTreeItem) =>
			onEditFilter(provider, item),
		),
		commands.registerCommand(
			"localstack.removeFilter",
			(item: FilterTreeItem) =>
				onRemoveFilter(provider, item.profileName, item.filter.name),
		),
	];
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
		window.showInformationMessage("No additional regions are available.");
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
		window.showInformationMessage("No AWS profiles were found.");
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

async function onAddFilter(
	provider: LocalStackViewProvider,
	profile: string,
	region: string,
): Promise<void> {
	const result = await runFilterWizard(profile, region);
	if (!result) {
		return;
	}
	await saveFilter(profile, result);
	provider.refresh();
}

async function onEditFilter(
	provider: LocalStackViewProvider,
	item: FilterTreeItem,
): Promise<void> {
	const region =
		"region" in item.filter.scope ? item.filter.scope.region : undefined;
	const result = await runFilterWizard(item.profileName, region, item.filter);
	if (!result) {
		return;
	}
	await saveFilter(item.profileName, result, item.filter.name);
	provider.refresh();
}

async function onRemoveFilter(
	provider: LocalStackViewProvider,
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
	await removeFilter(profile, name);
	provider.refresh();
}

/**
 * The 3-step filter wizard: name -> services -> scope. Returns the new filter,
 * or undefined if the user cancelled at any step. `existing` pre-populates the
 * fields for an edit.
 */
async function runFilterWizard(
	profile: string,
	region: string | undefined,
	existing?: SavedFilter,
): Promise<SavedFilter | undefined> {
	/* Step 1: name (unique within the profile). */
	const takenNames = new Set(
		getFilters(profile)
			.map((f) => f.name)
			.filter((n) => n !== existing?.name),
	);
	const name = await window.showInputBox({
		title: "View name",
		value: existing?.name,
		prompt: "A name for this view (must be unique within the profile)",
		validateInput: (value) => {
			const trimmed = value.trim();
			if (!trimmed) {
				return "Name cannot be empty";
			}
			if (trimmed.toLowerCase() === "all resources") {
				return `"All Resources" is a reserved view name`;
			}
			if (takenNames.has(trimmed)) {
				return `A view named "${trimmed}" already exists in this profile`;
			}
			return undefined;
		},
	});
	if (name === undefined) {
		return undefined;
	}

	/* Step 2: services (at least one). */
	const serviceItems: (QuickPickItem & { id: string })[] =
		ProviderFactory.getSupportedServices().map((p) => ({
			label: p.getName(),
			description: p.getId(),
			id: p.getId(),
			picked: existing?.services.includes(p.getId()) ?? false,
		}));
	const pickedServices = await window.showQuickPick(serviceItems, {
		title: "Select services for this view",
		placeHolder: "Pick one or more services",
		canPickMany: true,
	});
	if (!pickedServices || pickedServices.length === 0) {
		return undefined;
	}

	/* Step 3: scope. */
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

	let scope: FilterScope;
	if (scopeChoice === allRegionsLabel) {
		scope = { allRegions: true };
	} else if (region) {
		scope = { region };
	} else {
		scope = { allRegions: true };
	}

	return {
		name: name.trim(),
		services: pickedServices.map((s) => s.id),
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
