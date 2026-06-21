/*
 * Read/write helpers for the per-workspace configuration backing the
 * Cloud Profiles section of the LocalStack view: user-added regions and
 * user-defined filters. All state lives in VS Code workspace settings so it is
 * visible/editable in settings.json and survives reloads.
 */
import { ConfigurationTarget, workspace } from "vscode";

const CONFIG_SECTION = "localstack";
const REGIONS_KEY = "cloudProfiles.regions";
const FILTERS_KEY = "cloudProfiles.filters";

/** Scope of a saved filter: a single region, or every region of the profile. */
export type FilterScope = { region: string } | { allRegions: true };

export interface SavedFilter {
	name: string;
	services: string[];
	scope: FilterScope;
}

type RegionsMap = Record<string, string[]>;
type FiltersMap = Record<string, SavedFilter[]>;

function regionsMap(): RegionsMap {
	return (
		workspace.getConfiguration(CONFIG_SECTION).get<RegionsMap>(REGIONS_KEY) ??
		{}
	);
}

function filtersMap(): FiltersMap {
	return (
		workspace.getConfiguration(CONFIG_SECTION).get<FiltersMap>(FILTERS_KEY) ??
		{}
	);
}

/** User-added regions for a profile (excludes the profile's default region). */
export function getAddedRegions(profile: string): string[] {
	return regionsMap()[profile] ?? [];
}

export async function addRegion(
	profile: string,
	region: string,
): Promise<void> {
	const map = structuredClone(regionsMap());
	const list = map[profile] ?? [];
	if (!list.includes(region)) {
		list.push(region);
	}
	map[profile] = list;
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(REGIONS_KEY, map, ConfigurationTarget.Workspace);
}

export async function removeRegion(
	profile: string,
	region: string,
): Promise<void> {
	const map = structuredClone(regionsMap());
	map[profile] = (map[profile] ?? []).filter((r) => r !== region);
	if (map[profile].length === 0) {
		delete map[profile];
	}
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(REGIONS_KEY, map, ConfigurationTarget.Workspace);
}

/** All filters defined for a profile. */
export function getFilters(profile: string): SavedFilter[] {
	return filtersMap()[profile] ?? [];
}

/** Filters that apply to a given region: its own plus the profile's all-region filters. */
export function getFiltersForRegion(
	profile: string,
	region: string,
): SavedFilter[] {
	return getFilters(profile).filter((f) =>
		"allRegions" in f.scope ? f.scope.allRegions : f.scope.region === region,
	);
}

/**
 * Add a new filter or overwrite an existing one. When `originalName` is given
 * (an edit), the filter with that name is replaced; otherwise the filter is
 * appended (or replaces one with the same name).
 */
export async function saveFilter(
	profile: string,
	filter: SavedFilter,
	originalName?: string,
): Promise<void> {
	const map = structuredClone(filtersMap());
	const list = map[profile] ?? [];
	const key = originalName ?? filter.name;
	const index = list.findIndex((f) => f.name === key);
	if (index >= 0) {
		list[index] = filter;
	} else {
		list.push(filter);
	}
	map[profile] = list;
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(FILTERS_KEY, map, ConfigurationTarget.Workspace);
}

export async function removeFilter(
	profile: string,
	name: string,
): Promise<void> {
	const map = structuredClone(filtersMap());
	map[profile] = (map[profile] ?? []).filter((f) => f.name !== name);
	if (map[profile].length === 0) {
		delete map[profile];
	}
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(FILTERS_KEY, map, ConfigurationTarget.Workspace);
}
