/*
 * Translates the running emulator's pods-state metamodel into a platform-neutral
 * Focus for the LocalStack Instances "View: All Resources" selector.
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
import { mapLabelToServiceId } from "../services/serviceManifest.ts";

const METAMODEL_PATH = "/_localstack/pods/state/metamodel";

/** v1 assumes a single account; other accounts are deliberately omitted. */
const DEFAULT_ACCOUNT = "000000000000";

/** The LocalStack profile that backs the instance section. */
const LOCALSTACK_PROFILE = "localstack";

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
 * maps each supported provider id to its resource-type ids; `operationMaps` maps
 * each provider id to its metamodel-operation → resource-type map. Services whose
 * mapped id is absent from `resourceTypes` are omitted (and logged). The
 * global-service mirror region ("") is skipped. Exported for testing.
 *
 * For each present service/region the focus names only the resource types whose
 * metamodel list-operation key is present (so a service with one deployed type
 * does not render its other types). When a present operation maps to no known
 * resource type — or the provider declares no operation map — the service falls
 * back to its full resource-type set (and the gap is logged), so a missing
 * mapping never hides resources that exist.
 */
export function metamodelToFocus(
	payload: MetamodelPayload,
	resourceTypes: Map<string, string[]>,
	operationMaps: Map<string, Map<string, string>>,
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

	/* region id -> provider id -> set of present resource-type ids */
	const regionServices = new Map<string, Map<string, Set<string>>>();
	const dropped = new Set<string>();
	const fellBack = new Set<string>();

	for (const [serviceLabel, regions] of Object.entries(account)) {
		const providerId = mapLabelToServiceId(serviceLabel);
		const allTypes = resourceTypes.get(providerId);
		if (!allTypes) {
			dropped.add(serviceLabel);
			continue;
		}
		const opMap = operationMaps.get(providerId) ?? new Map<string, string>();

		for (const [region, opsByName] of Object.entries(
			regions as MetamodelPayload,
		)) {
			/* Skip the global-service mirror ("") to avoid an empty region node. */
			if (region === "") {
				continue;
			}

			/* The metamodel records one list-operation key per present resource
			 * type. Map those to resource types; fall back to the full set when an
			 * operation is unmapped (or none map), so resources are never hidden. */
			const present = new Set<string>();
			let unmappedOp = false;
			for (const op of Object.keys((opsByName as MetamodelPayload) ?? {})) {
				const resourceType = opMap.get(op);
				if (resourceType) {
					present.add(resourceType);
				} else {
					unmappedOp = true;
				}
			}
			const types =
				unmappedOp || present.size === 0 ? allTypes : [...present];
			if (unmappedOp) {
				fellBack.add(serviceLabel);
			}

			let svcMap = regionServices.get(region);
			if (!svcMap) {
				svcMap = new Map<string, Set<string>>();
				regionServices.set(region, svcMap);
			}
			const existing = svcMap.get(providerId);
			if (existing) {
				for (const t of types) {
					existing.add(t);
				}
			} else {
				svcMap.set(providerId, new Set(types));
			}
		}
	}

	if (dropped.size > 0) {
		log?.info(
			`[metamodel] Omitted services with no provider: ${[...dropped]
				.sort()
				.join(", ")}`,
		);
	}
	if (fellBack.size > 0) {
		log?.info(
			`[metamodel] Listed all resource types (unmapped operation) for: ${[
				...fellBack,
			]
				.sort()
				.join(", ")}`,
		);
	}

	const focusRegions = [...regionServices.entries()].map(
		([regionId, svcMap]) => ({
			id: regionId,
			services: [...svcMap.entries()].map(([serviceId, typeIds]) => ({
				id: serviceId,
				resourcetypes: [...typeIds].map((rt) => ({
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

	const services = ProviderFactory.getSupportedServices();
	const resourceTypes = new Map<string, string[]>(
		services.map((p) => [p.getId(), p.getResourceTypes()]),
	);
	const operationMaps = new Map<string, Map<string, string>>(
		services.map((p) => [p.getId(), p.getMetamodelOperationMap()]),
	);

	return metamodelToFocus(payload, resourceTypes, operationMaps, log);
}
