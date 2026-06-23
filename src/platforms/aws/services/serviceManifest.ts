/*
 * The static service manifest: the single source of truth for which AWS
 * services the resource browser knows about. It is generated on demand from
 * LocalStack's published coverage data by `build/generate-service-manifest.mjs`
 * and committed to `resources/service-manifest.json`; nothing here queries a
 * running emulator or any discovery API. Availability (community/pro) is
 * deliberately neither stored nor exposed — because the browser also targets
 * real AWS, every service is treated as fully available.
 */
import manifestData from "../../../../resources/service-manifest.json";
import { InternalError } from "../../../utils/errors.ts";

/** A single manifest entry: AWS service-code id + display name. */
export type ServiceManifestEntry = {
	/** AWS service code (SDK/endpoint id), e.g. `s3`, `logs`, `states`. */
	id: string;
	/** Human-readable display name, e.g. `S3`, `CloudWatch Logs`. */
	name: string;
};

/**
 * Service labels as they appear in emulator data (metamodel PascalCase labels,
 * CloudFormation resource-type namespaces) do not always equal the manifest id
 * under a simple lowercase transform. This documented override table maps the
 * exceptions. Keyed by the lowercased label.
 */
const LABEL_OVERRIDES: Record<string, string> = {
	/* Coverage/CFN/metamodel call it "StepFunctions"; the AWS service code is `states`. */
	stepfunctions: "states",
};

let memoizedEntries: ServiceManifestEntry[] | undefined;
let memoizedById: Map<string, ServiceManifestEntry> | undefined;

function load(): {
	entries: ServiceManifestEntry[];
	byId: Map<string, ServiceManifestEntry>;
} {
	if (memoizedEntries && memoizedById) {
		return { entries: memoizedEntries, byId: memoizedById };
	}

	const services = (manifestData as { services?: unknown }).services;
	if (!Array.isArray(services)) {
		throw new InternalError(
			"service-manifest.json is malformed: missing `services` array",
		);
	}

	const byId = new Map<string, ServiceManifestEntry>();
	for (const entry of services) {
		if (
			typeof entry !== "object" ||
			entry === null ||
			typeof (entry as ServiceManifestEntry).id !== "string" ||
			typeof (entry as ServiceManifestEntry).name !== "string"
		) {
			throw new InternalError(
				`service-manifest.json has a malformed entry: ${JSON.stringify(entry)}`,
			);
		}
		const valid = entry as ServiceManifestEntry;
		byId.set(valid.id, valid);
	}

	memoizedEntries = [...byId.values()];
	memoizedById = byId;
	return { entries: memoizedEntries, byId: memoizedById };
}

/** Return every manifest entry. */
export function getManifest(): ServiceManifestEntry[] {
	return load().entries;
}

/** Look up a single manifest entry by service id, or `undefined` if absent. */
export function getEntry(id: string): ServiceManifestEntry | undefined {
	return load().byId.get(id);
}

/** Return every manifest service id. */
export function getAllServiceIds(): string[] {
	return load().entries.map((entry) => entry.id);
}

/**
 * Map a service label found in emulator data (metamodel label, CloudFormation
 * namespace) to its manifest service-code id. Case-insensitive, with a
 * documented override table for exceptions (e.g. `StepFunctions → states`).
 */
export function mapLabelToServiceId(label: string): string {
	const lower = label.toLowerCase();
	return LABEL_OVERRIDES[lower] ?? lower;
}
