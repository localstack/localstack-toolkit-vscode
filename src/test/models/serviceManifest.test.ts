import assert from "node:assert";

import {
	getAllServiceIds,
	getEntry,
	getManifest,
	mapLabelToServiceId,
} from "../../platforms/aws/services/serviceManifest.ts";

/**
 * The service manifest is the static, generated source of truth for which AWS
 * services the resource browser knows about. These tests pin its shape, a few
 * representative entries (including the `stepfunctions → states` service-code
 * remap and the hyphenated `cognito-idp` id), and the label-mapping behavior
 * shared by the metamodel and CloudFormation paths.
 */
suite("serviceManifest", () => {
	test("manifest is a non-empty list of {id, name} entries", () => {
		const manifest = getManifest();
		assert.ok(manifest.length > 0, "expected a non-empty manifest");
		for (const entry of manifest) {
			assert.strictEqual(typeof entry.id, "string");
			assert.ok(entry.id.length > 0);
			assert.strictEqual(typeof entry.name, "string");
			assert.ok(entry.name.length > 0);
		}
	});

	test("service ids are unique", () => {
		const ids = getAllServiceIds();
		assert.strictEqual(new Set(ids).size, ids.length);
	});

	test("includes representative services under their AWS service codes", () => {
		const ids = new Set(getAllServiceIds());
		for (const id of ["s3", "states", "cognito-idp", "logs", "events"]) {
			assert.ok(ids.has(id), `expected manifest to contain ${id}`);
		}
	});

	test("Step Functions is keyed by its AWS service code, not its coverage slug", () => {
		assert.ok(getEntry("states"), "expected a `states` entry");
		assert.strictEqual(
			getEntry("stepfunctions"),
			undefined,
			"coverage slug `stepfunctions` must not be a manifest id",
		);
		assert.strictEqual(getEntry("states")?.name, "Step Functions");
	});

	test("getEntry returns the entry for a known id and undefined otherwise", () => {
		const s3 = getEntry("s3");
		assert.ok(s3);
		assert.strictEqual(s3.id, "s3");
		assert.strictEqual(getEntry("not-a-real-service"), undefined);
	});

	suite("mapLabelToServiceId", () => {
		test("lowercases simple PascalCase labels", () => {
			assert.strictEqual(
				mapLabelToServiceId("CloudFormation"),
				"cloudformation",
			);
			assert.strictEqual(mapLabelToServiceId("S3"), "s3");
			assert.strictEqual(mapLabelToServiceId("IAM"), "iam");
		});

		test("applies the Step Functions override", () => {
			assert.strictEqual(mapLabelToServiceId("StepFunctions"), "states");
			assert.strictEqual(mapLabelToServiceId("stepfunctions"), "states");
		});

		test("preserves hyphenated ids such as cognito-idp", () => {
			assert.strictEqual(mapLabelToServiceId("cognito-idp"), "cognito-idp");
		});
	});
});
