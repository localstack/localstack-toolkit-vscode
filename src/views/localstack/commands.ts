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
	addRegion,
	getAddedRegions,
	getFilters,
	removeFilter,
	removeRegion,
	saveFilter,
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
		commands.registerCommand(
			"localstack.removeRegion",
			(item: RegionTreeItem) =>
				onRemoveRegion(provider, item.profileName, item.regionId),
		),
		commands.registerCommand(
			"localstack.addFilter",
			(arg: { profileName: string; regionId: string }) =>
				onAddFilter(provider, arg.profileName, arg.regionId),
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
	const shown = new Set<string>(getAddedRegions(profile));
	const defaultRegion = AWSConfig.getRegionForProfile(profile);
	if (defaultRegion) {
		shown.add(defaultRegion);
	}
	const items: QuickPickItem[] = getAllRegionCodes()
		.filter((code) => !shown.has(code))
		.map((code) => ({ label: code, description: safeLongName(code) }));

	if (items.length === 0) {
		window.showInformationMessage("All known regions are already shown.");
		return;
	}

	const picked = await window.showQuickPick(items, {
		title: `Add a region to profile "${profile}"`,
		placeHolder: "Select a region to add",
	});
	if (!picked) {
		return;
	}
	await addRegion(profile, picked.label);
	provider.refresh();
}

async function onRemoveRegion(
	provider: LocalStackViewProvider,
	profile: string,
	region: string,
): Promise<void> {
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
		title: "Filter name",
		value: existing?.name,
		prompt: "A name for this filter (must be unique within the profile)",
		validateInput: (value) => {
			const trimmed = value.trim();
			if (!trimmed) {
				return "Name cannot be empty";
			}
			if (takenNames.has(trimmed)) {
				return `A filter named "${trimmed}" already exists in this profile`;
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
		title: "Select services for this filter",
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
		{ title: "Where should this filter appear?" },
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
