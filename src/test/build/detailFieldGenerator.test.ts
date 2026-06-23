/* The generator under test is an untyped .mjs (its exports type as `any`), so
 * the type-aware "unsafe" rules fire on every call/result here only as noise. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import assert from "node:assert";

import {
	importanceRank,
	mapFieldType,
	rankAndSelect,
	resolveOutputMembers,
	toLabel,
} from "../../../build/generate-detail-fields.mjs";

/**
 * The detail-field generator is a dev-time authoring aid: it turns an offline
 * AWS API output shape into a ranked, capped, typed first-cut `detail` spec.
 * These tests pin its pure logic — type mapping, the importance heuristic,
 * label formatting, and model resolution — which is what determines the quality
 * of the generated specs.
 */
type SelectedField = { label: string; path: string; typeName: string };
suite("detail-field generator: mapFieldType", () => {
	test("timestamps -> DATE, numerics -> NUMBER", () => {
		assert.strictEqual(mapFieldType("CreatedAt", "timestamp"), "DATE");
		assert.strictEqual(mapFieldType("MemorySize", "integer"), "NUMBER");
		assert.strictEqual(mapFieldType("Weight", "double"), "NUMBER");
	});
	test("nested shapes -> JSON", () => {
		assert.strictEqual(mapFieldType("Tags", "map"), "JSON");
		assert.strictEqual(mapFieldType("Subnets", "list"), "JSON");
	});
	test("string refinements: Arn -> ARN, LogGroup -> LOG_GROUP, else NAME", () => {
		assert.strictEqual(mapFieldType("RoleArn", "string"), "ARN");
		assert.strictEqual(mapFieldType("LogGroupName", "string"), "LOG_GROUP");
		assert.strictEqual(mapFieldType("Description", "string"), "NAME");
	});
});

suite("detail-field generator: importanceRank", () => {
	test("orders identifiers above status above timestamps above scalars", () => {
		assert.ok(
			importanceRank("FunctionName", "string") <
				importanceRank("State", "string"),
		);
		assert.ok(
			importanceRank("State", "string") <
				importanceRank("LastModified", "timestamp"),
		);
		assert.ok(
			importanceRank("LastModified", "timestamp") <
				importanceRank("MemorySize", "integer"),
		);
		assert.ok(
			importanceRank("MemorySize", "integer") < importanceRank("Tags", "map"),
		);
	});
});

suite("detail-field generator: toLabel", () => {
	test("spaces camel/Pascal case", () => {
		assert.strictEqual(toLabel("FunctionName"), "Function Name");
		assert.strictEqual(toLabel("creationDate"), "Creation Date");
		assert.strictEqual(toLabel("KMSKeyArn"), "KMS Key Arn");
	});
});

suite("detail-field generator: rankAndSelect", () => {
	test("excludes metadata/pagination/blobs, ranks, and caps", () => {
		const members = [
			{ name: "ResponseMetadata", shapeType: "structure" },
			{ name: "NextToken", shapeType: "string" },
			{ name: "Code", shapeType: "blob" },
			{ name: "FunctionArn", shapeType: "string" },
			{ name: "FunctionName", shapeType: "string" },
			{ name: "State", shapeType: "string" },
			{ name: "LastModified", shapeType: "timestamp" },
			{ name: "MemorySize", shapeType: "integer" },
			{ name: "Runtime", shapeType: "string" },
			{ name: "Tags", shapeType: "map" },
		];
		const selected = rankAndSelect(members);

		/* metadata, pagination token, and blob are dropped */
		assert.ok(
			!selected.some((f: SelectedField) => f.path === "ResponseMetadata"),
		);
		assert.ok(!selected.some((f: SelectedField) => f.path === "NextToken"));
		assert.ok(!selected.some((f: SelectedField) => f.path === "Code"));

		assert.deepStrictEqual(
			selected.map((f: SelectedField) => f.path),
			[
				"FunctionArn",
				"FunctionName",
				"State",
				"LastModified",
				"MemorySize",
				"Runtime",
				"Tags",
			],
		);
		assert.deepStrictEqual(
			selected.map((f: SelectedField) => f.typeName),
			["ARN", "NAME", "NAME", "DATE", "NUMBER", "NAME", "JSON"],
		);
	});

	test("respects the field cap", () => {
		const members = Array.from({ length: 30 }, (_, i) => ({
			name: `Field${i}`,
			shapeType: "string",
		}));
		assert.strictEqual(rankAndSelect(members, 12).length, 12);
	});
});

suite("detail-field generator: resolveOutputMembers", () => {
	test("resolves an operation output shape to member name + type", () => {
		const model = {
			operations: { GetThing: { output: { shape: "GetThingOutput" } } },
			shapes: {
				GetThingOutput: {
					type: "structure",
					members: { Name: { shape: "S" }, Count: { shape: "I" } },
				},
				S: { type: "string" },
				I: { type: "integer" },
			},
		};
		assert.deepStrictEqual(resolveOutputMembers(model, "GetThing"), [
			{ name: "Name", shapeType: "string" },
			{ name: "Count", shapeType: "integer" },
		]);
	});
});
