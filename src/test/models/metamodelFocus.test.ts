import assert from "node:assert";

import {
	metamodelToFocus,
	parseMetamodel,
} from "../../platforms/aws/models/metamodelFocus.ts";

suite("metamodel -> Focus", () => {
	test("parseMetamodel tolerates raw control characters", () => {
		const withControlChar = `{"a": "x${String.fromCharCode(1)}y"}`;
		assert.throws(() => JSON.parse(withControlChar));
		const parsed = parseMetamodel(withControlChar);
		assert.strictEqual(parsed.a, "xy");
	});

	test("maps supported services, drops unsupported, dedups global region", () => {
		const payload = {
			"000000000000": {
				EventBridge: { "us-east-1": { listEventBuses: {} } },
				S3: { "us-east-1": { listBuckets: {} } },
				IAM: { "us-east-1": { listRoles: {} }, "": { listRoles: {} } },
				SSM: { "us-east-1": { describeParameters: {} } },
				CloudFormation: { "us-east-1": { listStacks: {} } },
			},
		};
		const resourceTypes = new Map<string, string[]>([
			["cloudformation", ["stack"]],
			["iam", ["role"]],
		]);

		const focus = metamodelToFocus(payload, resourceTypes);

		assert.strictEqual(focus.profiles.length, 1);
		assert.strictEqual(focus.profiles[0].id, "localstack");

		/* The empty-string global mirror must not produce a region node. */
		const regions = focus.profiles[0].regions;
		assert.strictEqual(regions.length, 1);
		assert.strictEqual(regions[0].id, "us-east-1");

		const serviceIds = regions[0].services.map((s) => s.id).sort();
		assert.deepStrictEqual(serviceIds, ["cloudformation", "iam"]);

		/* Resource types are expanded with wildcard ARNs. */
		const iam = regions[0].services.find((s) => s.id === "iam");
		assert.ok(iam);
		assert.deepStrictEqual(iam.resourcetypes, [{ id: "role", arns: ["*"] }]);
	});

	test("applies the StepFunctions -> states label override", () => {
		const payload = {
			"000000000000": {
				StepFunctions: { "us-east-1": { listStateMachines: {} } },
			},
		};
		/* The provider registers under the AWS service code `states`, not the
		 * metamodel label `StepFunctions`; the shared label mapping must bridge them. */
		const resourceTypes = new Map<string, string[]>([
			["states", ["statemachine"]],
		]);

		const focus = metamodelToFocus(payload, resourceTypes);

		const serviceIds = focus.profiles[0].regions[0].services.map((s) => s.id);
		assert.deepStrictEqual(serviceIds, ["states"]);
	});

	test("returns an empty focus when the default account is absent", () => {
		const focus = metamodelToFocus({ "999999999999": {} }, new Map());
		assert.strictEqual(focus.profiles[0].id, "localstack");
		assert.strictEqual(focus.profiles[0].regions.length, 0);
	});
});
