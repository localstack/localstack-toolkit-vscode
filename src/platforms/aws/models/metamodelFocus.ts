/*
 * Translates the running emulator's pods-state metamodel into a platform-neutral
 * Focus for the LocalStack Instances "View All Resources" selector.
 *
 * Metamodel shape (account -> Service label -> region -> apiOperation -> response):
 *   { "000000000000": { "S3": { "us-east-1": { "listBuckets": { ... } } } } }
 *
 * This is the transpose of the Focus shape (profile -> region -> service -> ...).
 * We name only the services/regions actually present (mapped to a registered
 * provider) and leave resource-type/ARN selectors as wildcards so the existing
 * SDK providers list the live resources on drill-down.
 */
import type { LogOutputChannel } from "vscode";

import { Focus } from "../../../models/focus.ts";
import { ProviderFactory } from "../services/providerFactory.ts";

const METAMODEL_PATH = "/_localstack/pods/state/metamodel";

/** v1 assumes a single account; other accounts are deliberately omitted. */
const DEFAULT_ACCOUNT = "000000000000";

/** The LocalStack profile that backs the instance section. */
const LOCALSTACK_PROFILE = "localstack";

/**
 * Map a metamodel service label to a provider id. Empirically `toLowerCase()`
 * is correct for every supported service except Step Functions; keep a small
 * override map for exceptions.
 */
const SERVICE_LABEL_OVERRIDES: Record<string, string> = {
	stepfunctions: "states",
};

function serviceLabelToProviderId(label: string): string {
	const lower = label.toLowerCase();
	return SERVICE_LABEL_OVERRIDES[lower] ?? lower;
}

type MetamodelPayload = Record<string, unknown>;

/**
 * Parse the metamodel payload leniently: the live endpoint can emit raw control
 * characters inside string values, which strict JSON.parse rejects. Exported for
 * testing.
 */
export function parseMetamodel(text: string): MetamodelPayload {
	const sanitized = text.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping invalid control chars that break strict JSON.parse
		/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
		"",
	);
	return JSON.parse(sanitized) as MetamodelPayload;
}

/**
 * Pure translation of a parsed metamodel payload into a Focus. `resourceTypes`
 * maps each supported provider id to its resource-type ids; services whose
 * mapped id is absent from this map are omitted (and logged). The global-service
 * mirror region ("") is skipped. Exported for testing.
 */
export function metamodelToFocus(
	payload: MetamodelPayload,
	resourceTypes: Map<string, string[]>,
	log?: LogOutputChannel,
): Focus {
	const account = payload[DEFAULT_ACCOUNT] as MetamodelPayload | undefined;
	if (!account) {
		/* No state for the default account: an empty (but valid) focus. */
		return Focus.parse({
			version: "1.0",
			profiles: [{ id: LOCALSTACK_PROFILE, regions: [] }],
		});
	}

	/* region id -> set of provider ids present in that region */
	const regionServices = new Map<string, Set<string>>();
	const dropped = new Set<string>();

	for (const [serviceLabel, regions] of Object.entries(account)) {
		const providerId = serviceLabelToProviderId(serviceLabel);
		if (!resourceTypes.has(providerId)) {
			dropped.add(serviceLabel);
			continue;
		}
		for (const region of Object.keys(regions as MetamodelPayload)) {
			/* Skip the global-service mirror ("") to avoid an empty region node. */
			if (region === "") {
				continue;
			}
			let set = regionServices.get(region);
			if (!set) {
				set = new Set<string>();
				regionServices.set(region, set);
			}
			set.add(providerId);
		}
	}

	if (dropped.size > 0) {
		log?.info(
			`[metamodel] Omitted services with no provider: ${[...dropped]
				.sort()
				.join(", ")}`,
		);
	}

	const focusRegions = [...regionServices.entries()].map(
		([regionId, serviceIds]) => ({
			id: regionId,
			services: [...serviceIds].map((serviceId) => ({
				id: serviceId,
				resourcetypes: (resourceTypes.get(serviceId) ?? []).map((rt) => ({
					id: rt,
					arns: ["*"],
				})),
			})),
		}),
	);

	return Focus.parse({
		version: "1.0",
		profiles: [{ id: LOCALSTACK_PROFILE, regions: focusRegions }],
	});
}

/**
 * Fetch and translate the emulator metamodel into a Focus. Throws if the
 * emulator is unreachable or the payload cannot be parsed; the caller surfaces
 * that as a non-fatal error state.
 */
export async function computeMetamodelFocus(
	endpointUrl: string,
	log?: LogOutputChannel,
): Promise<Focus> {
	const url = `${endpointUrl.replace(/\/$/, "")}${METAMODEL_PATH}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Metamodel request failed: HTTP ${response.status}`);
	}
	const payload = parseMetamodel(await response.text());

	const resourceTypes = new Map<string, string[]>(
		ProviderFactory.getSupportedServices().map((p) => [
			p.getId(),
			p.getResourceTypes(),
		]),
	);

	return metamodelToFocus(payload, resourceTypes, log);
}
