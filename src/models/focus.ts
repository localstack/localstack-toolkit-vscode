/*
 * This file contains the models for a "focus" object, which describes a
 * specific configuration of which profiles, regions, services, resource types,
 * and resources should be shown in the UI. The model is platform-neutral: AWS
 * (and future emulators) populate it via their own code under src/platforms/.
 */
import * as fs from "node:fs";
import path from "node:path";

import * as z from "zod";

import { InternalError } from "../utils/errors.ts";
import { memoize } from "../utils/memoize.ts";

const ResourceTypeFocus = z.object({
	id: z.string(),
	get arns() {
		return z.array(z.string());
	},
});

const ServiceFocus = z.object({
	id: z.string(),
	get resourcetypes() {
		return z.array(ResourceTypeFocus);
	},
});

const RegionFocus = z.object({
	id: z.string(),
	get services() {
		return z.array(ServiceFocus);
	},
});

const ProfileFocus = z.object({
	id: z.string(),
	get regions() {
		return z.array(RegionFocus);
	},
});

export const Focus = z.object({
	version: z.string(),
	get profiles() {
		return z.array(ProfileFocus);
	},
});

export type Focus = z.infer<typeof Focus>;
export type ProfileFocus = z.infer<typeof ProfileFocus>;
export type RegionFocus = z.infer<typeof RegionFocus>;
export type ServiceFocus = z.infer<typeof ServiceFocus>;
export type ResourceTypeFocus = z.infer<typeof ResourceTypeFocus>;

/**
 * Standard focuses that are always available by default,
 * and can never be modified.
 */
type StandardModelType = {
	key: string;
	name: string;
};
export const StandardModel = {
	EVERYTHING_IN_DEFAULT_REGION: {
		key: "everything-in-default-region",
		name: "All Services in Default Region",
	} satisfies StandardModelType,
	EVERYTHING_IN_DEFAULT_PROFILE: {
		key: "everything-in-default-profile",
		name: "All Regions in Default Profile",
	} satisfies StandardModelType,
	EVERYTHING_IN_ALL_PROFILES: {
		key: "everything-in-all-profiles",
		name: "Everything in all Profiles",
	} satisfies StandardModelType,

	get all(): StandardModelType[] {
		return [
			StandardModel.EVERYTHING_IN_DEFAULT_REGION,
			StandardModel.EVERYTHING_IN_DEFAULT_PROFILE,
			StandardModel.EVERYTHING_IN_ALL_PROFILES,
		];
	},
};

/**
 * Load one of the standard (pre-defined, unmodifiable) focuses. The
 * result is memoized since the data will not change.
 */
export const loadStandardModel = memoize(
	(model: StandardModelType, extensionPath: string = "./") => {
		const jsonString: string = fs.readFileSync(
			path.resolve(
				extensionPath,
				"resources",
				"focuses",
				`${model.key}.focus.json`,
			),
			"utf-8",
		);

		let json: unknown;
		try {
			json = JSON.parse(jsonString);
		} catch (error) {
			throw new InternalError(
				`Loading standard Focus '${model.key}': ${String(error)}`,
			);
		}

		const result = Focus.safeParse(json);
		if (!result.success) {
			throw new InternalError(
				`Loading standard Focus '${model.key}': ${z.prettifyError(result.error)}`,
			);
		}
		return result.data;
	},
);

/**
 * Build a wildcard focus that shows everything in a single profile/region.
 * The service wildcard (`*`) is expanded dynamically by the Resources view.
 */
export function makeWildcardFocus(profileId: string, regionId: string): Focus {
	return Focus.parse({
		version: "1.0",
		profiles: [
			{
				id: profileId,
				regions: [
					{
						id: regionId,
						services: [{ id: "*", resourcetypes: [{ id: "*", arns: ["*"] }] }],
					},
				],
			},
		],
	});
}

/* Multi-focus merging was removed with the multi-select feature; the LocalStack
 * view is single-select, so the Resources view always shows exactly one focus. */
