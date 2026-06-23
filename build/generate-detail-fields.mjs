/**
 * Detail-field generator (dev-time authoring aid, on-demand only).
 *
 * Produces a first-cut `detail: [{ label, path, type }]` spec for a resource
 * type by reading that resource's Describe/Get (or list-item) output shape from
 * an OFFLINE AWS API model — the `aws-sdk` v2 `apis/<service>-*.normal.json`
 * models, or an equivalent botocore `service-2.json`. The model source is used
 * only by this generator and is never bundled into the extension.
 *
 * The emitted spec is a STARTING POINT: it is committed into the service
 * definition and hand-refined. Runtime renders the committed, fixed subset (not
 * a raw response dump). Services whose detail spans multiple calls, or whose
 * only data is the list item, get a partial first cut and are finished by hand.
 *
 *   node build/generate-detail-fields.mjs <model.normal.json> <OperationName>
 *
 * Prints a TypeScript `detail` array to stdout for pasting into a definition.
 */
/* This dev-time generator walks untyped AWS API model JSON (JSON.parse → any),
 * so the type-aware "unsafe" rules add only noise here. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import fs from "node:fs";

/* FieldType enum values, mirrored from src/.../serviceProvider.ts (the runtime
 * enum can't be imported into a plain .mjs). Keyed by enum member name so we
 * can emit `FieldType.NAME` identifiers. */
export const FIELD_TYPE = {
	NAME: "name",
	ARN: "arn",
	DATE: "date",
	SHORT_TEXT: "shortText",
	LONG_TEXT: "longText",
	JSON: "json",
	NUMBER: "number",
	LOG_GROUP: "logGroup",
};

/** Members never worth showing. */
const EXCLUDED_NAMES = new Set([
	"ResponseMetadata",
	"NextToken",
	"NextMarker",
	"Marker",
	"nextToken",
	"MaxResults",
	"MaxItems",
]);

const PAGINATION_SUFFIXES = ["Token", "Marker"];

/**
 * Map an API member (its name + resolved shape type) to a FieldType enum member
 * name. `shapeType` is the botocore/aws-sdk shape `type`
 * (string|integer|long|float|double|boolean|timestamp|structure|list|map|blob).
 */
export function mapFieldType(name, shapeType) {
	if (shapeType === "timestamp") return "DATE";
	if (["integer", "long", "float", "double"].includes(shapeType)) {
		return "NUMBER";
	}
	if (["structure", "list", "map"].includes(shapeType)) return "JSON";
	/* strings (and anything else) default to NAME, with a couple of refinements */
	if (/Arn$/.test(name)) return "ARN";
	if (/LogGroup/i.test(name)) return "LOG_GROUP";
	return "NAME";
}

/** Importance bucket (lower = more important) for a member name + shape type. */
export function importanceRank(name, shapeType) {
	if (/Name$/.test(name) || /Id$/.test(name) || /Arn$/.test(name)) {
		return 0; /* identifiers / names */
	}
	if (/(Status|State)$/.test(name)) return 1;
	if (/(Type|Mode)$/.test(name)) return 2;
	if (shapeType === "timestamp" || /(Time|Date|Timestamp)$/.test(name)) {
		return 3; /* timestamps */
	}
	if (["structure", "list", "map", "blob"].includes(shapeType)) {
		return 5; /* nested / blobs sink to the bottom */
	}
	return 4; /* other top-level scalars */
}

/** Convert a PascalCase/camelCase member name into a spaced display label. */
export function toLabel(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/^./, (c) => c.toUpperCase());
}

/**
 * Rank, filter, and cap a list of `{ name, shapeType }` members into ordered
 * FieldSpec-like entries `{ label, path, typeName }` (typeName is a FIELD_TYPE
 * member name). Excludes metadata/pagination/blobs; collapses nested shapes to
 * JSON; caps at `cap` (default 12).
 */
export function rankAndSelect(members, cap = 12) {
	const kept = members.filter(({ name, shapeType }) => {
		if (EXCLUDED_NAMES.has(name)) return false;
		if (PAGINATION_SUFFIXES.some((s) => name.endsWith(s))) return false;
		if (shapeType === "blob") return false;
		return true;
	});

	kept.sort((a, b) => {
		const ra = importanceRank(a.name, a.shapeType);
		const rb = importanceRank(b.name, b.shapeType);
		if (ra !== rb) return ra - rb;
		return a.name.localeCompare(b.name); /* stable, deterministic */
	});

	return kept.slice(0, cap).map(({ name, shapeType }) => ({
		label: toLabel(name),
		path: name,
		typeName: mapFieldType(name, shapeType),
	}));
}

/**
 * Resolve the top-level output members of an operation from an aws-sdk v2
 * `.normal.json` model, as `{ name, shapeType }[]`.
 */
export function resolveOutputMembers(model, operationName) {
	const op = model.operations?.[operationName];
	if (!op) {
		throw new Error(`Operation not found in model: ${operationName}`);
	}
	const outputShapeName = op.output?.shape;
	if (!outputShapeName) return [];
	const outputShape = model.shapes?.[outputShapeName];
	const members = outputShape?.members ?? {};
	return Object.entries(members).map(([name, ref]) => {
		const memberShape = model.shapes?.[ref.shape];
		return { name, shapeType: memberShape?.type ?? "string" };
	});
}

/** Render the selected entries as a pasteable TypeScript `detail` array. */
export function renderDetailArray(entries) {
	const lines = entries.map(
		({ label, path, typeName }) =>
			`\t\t\t\t{ label: ${JSON.stringify(label)}, path: ${JSON.stringify(
				path,
			)}, type: FieldType.${typeName} },`,
	);
	return `detail: [\n${lines.join("\n")}\n\t\t\t],`;
}

function main() {
	const [modelPath, operationName] = process.argv.slice(2);
	if (!modelPath || !operationName) {
		console.error(
			"Usage: node build/generate-detail-fields.mjs <model.normal.json> <OperationName>",
		);
		process.exit(1);
	}
	const model = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
	const members = resolveOutputMembers(model, operationName);
	const entries = rankAndSelect(members);
	console.log(renderDetailArray(entries));
}

/* Run only when invoked directly, so the pure functions stay importable. */
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
