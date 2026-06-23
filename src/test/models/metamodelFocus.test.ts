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

		/* Single-type services with no operation map fall back to their sole type. */
		const focus = metamodelToFocus(payload, resourceTypes, new Map());

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

		const focus = metamodelToFocus(payload, resourceTypes, new Map());

		const serviceIds = focus.profiles[0].regions[0].services.map((s) => s.id);
		assert.deepStrictEqual(serviceIds, ["states"]);
	});

	test("returns an empty focus when the default account is absent", () => {
		const focus = metamodelToFocus(
			{ "999999999999": {} },
			new Map(),
			new Map(),
		);
		assert.strictEqual(focus.profiles[0].id, "localstack");
		assert.strictEqual(focus.profiles[0].regions.length, 0);
	});

	test("names only the resource types whose metamodel operation is present", () => {
		/* SSM has five types but only a Parameter is deployed: the focus must list
		 * Parameters alone, not the other four types. */
		const payload = {
			"000000000000": {
				SSM: { "us-east-1": { describeParameters: {} } },
			},
		};
		const resourceTypes = new Map<string, string[]>([
			[
				"ssm",
				[
					"parameter",
					"document",
					"maintenancewindow",
					"association",
					"patchbaseline",
				],
			],
		]);
		const operationMaps = new Map<string, Map<string, string>>([
			[
				"ssm",
				new Map([
					["describeParameters", "parameter"],
					["listDocuments", "document"],
					["describeMaintenanceWindows", "maintenancewindow"],
					["listAssociations", "association"],
					["describePatchBaselines", "patchbaseline"],
				]),
			],
		]);

		const focus = metamodelToFocus(payload, resourceTypes, operationMaps);

		const ssm = focus.profiles[0].regions[0].services.find(
			(s) => s.id === "ssm",
		);
		assert.ok(ssm);
		assert.deepStrictEqual(ssm.resourcetypes, [
			{ id: "parameter", arns: ["*"] },
		]);
	});

	test("falls back to the full type set when an operation is unmapped", () => {
		/* A present operation that maps to no known type must not hide resources:
		 * the service falls back to listing all its types. */
		const payload = {
			"000000000000": {
				SSM: { "us-east-1": { someUnknownOperation: {} } },
			},
		};
		const resourceTypes = new Map<string, string[]>([
			["ssm", ["parameter", "document"]],
		]);
		const operationMaps = new Map<string, Map<string, string>>([
			["ssm", new Map([["describeParameters", "parameter"]])],
		]);

		const focus = metamodelToFocus(payload, resourceTypes, operationMaps);

		const ssm = focus.profiles[0].regions[0].services.find(
			(s) => s.id === "ssm",
		);
		assert.ok(ssm);
		assert.deepStrictEqual(ssm.resourcetypes.map((rt) => rt.id).sort(), [
			"document",
			"parameter",
		]);
	});
});
