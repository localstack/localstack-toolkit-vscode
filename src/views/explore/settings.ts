/*
 * Read/write helpers for the per-workspace configuration backing the
 * Cloud Profiles section of the Explore view: user-added regions and
 * user-defined views. All state lives in VS Code workspace settings so it is
 * visible/editable in settings.json and survives reloads.
 */
import { ConfigurationTarget, workspace } from "vscode";

const CONFIG_SECTION = "localstack";
const REGIONS_KEY = "cloudProfiles.regions";
const PROFILE_VIEWS_KEY = "cloudProfiles.views";
const SHOWN_PROFILES_KEY = "cloudProfiles.shown";
/* Instance views are stored separately from cloud-profile views so they never
 * collide with the bundled `localstack` cloud profile's region views. */
const INSTANCE_VIEWS_KEY = "instanceViews";

/**
 * Deep-clone plain JSON config data. We cannot use `structuredClone` on the
 * objects returned by `workspace.getConfiguration().get()` — they are not
 * structured-cloneable and throw `#<Object> could not be cloned`.
 */
function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Choose where to persist settings: per-workspace when a folder is open,
 * global otherwise. Writing to `Workspace` with no folder open throws
 * "Unable to write to Workspace Settings because no workspace is opened".
 */
export function configTarget(): ConfigurationTarget {
	return workspace.workspaceFolders?.length
		? ConfigurationTarget.Workspace
		: ConfigurationTarget.Global;
}

/** Scope of a saved view: a single region, or every region of the profile. */
export type ViewScope = { region: string } | { allRegions: true };

/** A service and one of its resource types, the granularity a view filters at. */
export interface ResourcePair {
	service: string;
	resourceType: string;
}

export interface SavedView {
	name: string;
	resources: ResourcePair[];
	scope: ViewScope;
}

type RegionsMap = Record<string, string[]>;
type ProfileViewsMap = Record<string, SavedView[]>;

function regionsMap(): RegionsMap {
	return (
		workspace.getConfiguration(CONFIG_SECTION).get<RegionsMap>(REGIONS_KEY) ??
		{}
	);
}

function profileViewsMap(): ProfileViewsMap {
	return (
		workspace
			.getConfiguration(CONFIG_SECTION)
			.get<ProfileViewsMap>(PROFILE_VIEWS_KEY) ?? {}
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
	const map = cloneJson(regionsMap());
	const list = map[profile] ?? [];
	if (!list.includes(region)) {
		list.push(region);
	}
	map[profile] = list;
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(REGIONS_KEY, map, configTarget());
}

export async function removeRegion(
	profile: string,
	region: string,
): Promise<void> {
	const map = cloneJson(regionsMap());
	map[profile] = (map[profile] ?? []).filter((r) => r !== region);
	if (map[profile].length === 0) {
		delete map[profile];
	}
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(REGIONS_KEY, map, configTarget());
}

/** Replace the full set of user-added regions for a profile. */
export async function setAddedRegions(
	profile: string,
	regions: string[],
): Promise<void> {
	const map = cloneJson(regionsMap());
	if (regions.length === 0) {
		delete map[profile];
	} else {
		map[profile] = regions;
	}
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(REGIONS_KEY, map, configTarget());
}

/**
 * Profile names the user has chosen to show under Cloud Profiles. Returns
 * `undefined` when unset (never configured), which is distinct from an empty
 * list (the user explicitly chose to show nothing).
 */
export function getShownProfiles(): string[] | undefined {
	/* Use inspect() rather than get(): a contributed array setting always
	 * resolves to its default ([]) via get(), which would erase the
	 * unset-vs-empty distinction. Only an explicit user value at any scope
	 * counts as "set". */
	const inspected = workspace
		.getConfiguration(CONFIG_SECTION)
		.inspect<string[]>(SHOWN_PROFILES_KEY);
	return (
		inspected?.workspaceFolderValue ??
		inspected?.workspaceValue ??
		inspected?.globalValue
	);
}

/** Replace the set of shown profile names. */
export async function setShownProfiles(profiles: string[]): Promise<void> {
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(SHOWN_PROFILES_KEY, profiles, configTarget());
}

/** The default shown set when unset: `default` if present, else the first. */
export function defaultShownProfiles(allProfiles: string[]): string[] {
	if (allProfiles.includes("default")) {
		return ["default"];
	}
	return allProfiles.length > 0 ? [allProfiles[0]] : [];
}

/**
 * The effective set of shown profile names: the configured set when set
 * (including an explicit empty list), otherwise the default-only fallback.
 */
export function resolveShownProfiles(allProfiles: string[]): string[] {
	return getShownProfiles() ?? defaultShownProfiles(allProfiles);
}

/** All views defined for a profile. */
export function getProfileViews(profile: string): SavedView[] {
	return profileViewsMap()[profile] ?? [];
}

/** Views that apply to a given region: its own plus the profile's all-region views. */
export function getProfileViewsForRegion(
	profile: string,
	region: string,
): SavedView[] {
	return getProfileViews(profile).filter((v) =>
		"allRegions" in v.scope ? v.scope.allRegions : v.scope.region === region,
	);
}

/**
 * Add a new view or overwrite an existing one. When `originalName` is given
 * (an edit), the view with that name is replaced; otherwise the view is
 * appended (or replaces one with the same name).
 */
export async function saveProfileView(
	profile: string,
	view: SavedView,
	originalName?: string,
): Promise<void> {
	const map = cloneJson(profileViewsMap());
	const list = map[profile] ?? [];
	const key = originalName ?? view.name;
	const index = list.findIndex((v) => v.name === key);
	if (index >= 0) {
		list[index] = view;
	} else {
		list.push(view);
	}
	map[profile] = list;
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(PROFILE_VIEWS_KEY, map, configTarget());
}

export async function removeProfileView(
	profile: string,
	name: string,
): Promise<void> {
	const map = cloneJson(profileViewsMap());
	map[profile] = (map[profile] ?? []).filter((v) => v.name !== name);
	if (map[profile].length === 0) {
		delete map[profile];
	}
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(PROFILE_VIEWS_KEY, map, configTarget());
}

/* ── Instance views ───────────────────────────────────────────────────────
 * Saved views for the running LocalStack instance. They reuse the SavedView
 * shape (with a placeholder scope that instance rendering ignores) but live
 * under their own key, separate from cloud-profile views. */

function instanceViews(): SavedView[] {
	return (
		workspace
			.getConfiguration(CONFIG_SECTION)
			.get<SavedView[]>(INSTANCE_VIEWS_KEY) ?? []
	);
}

/** All saved views for the LocalStack instance. */
export function getInstanceViews(): SavedView[] {
	return instanceViews();
}

/** Add a new instance view, or overwrite one by name (`originalName` on edit). */
export async function saveInstanceView(
	view: SavedView,
	originalName?: string,
): Promise<void> {
	const list = cloneJson(instanceViews());
	const key = originalName ?? view.name;
	const index = list.findIndex((v) => v.name === key);
	if (index >= 0) {
		list[index] = view;
	} else {
		list.push(view);
	}
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(INSTANCE_VIEWS_KEY, list, configTarget());
}

export async function removeInstanceView(name: string): Promise<void> {
	const list = instanceViews().filter((v) => v.name !== name);
	await workspace
		.getConfiguration(CONFIG_SECTION)
		.update(INSTANCE_VIEWS_KEY, list, configTarget());
}
