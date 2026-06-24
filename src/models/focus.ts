/*
 * This file contains the models for a "focus" object, which describes a
 * specific configuration of which profiles, regions, services, resource types,
 * and resources should be shown in the UI. The model is platform-neutral: AWS
 * (and future emulators) populate it via their own code under src/platforms/.
 */
import * as z from "zod";

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
