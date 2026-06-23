import assert from "node:assert";

import type { Focus } from "../../models/focus.ts";
import { intersectMetamodelWithPairs } from "../../views/localstack/viewProvider.ts";

/**
 * An instance view's focus is the live metamodel focus narrowed to the view's
 * chosen service/resource-type pairs: pairs not present in the metamodel are
 * dropped, and empty services/regions are pruned.
 */
suite("intersectMetamodelWithPairs", () => {
	const metamodel: Focus = {
		version: "1.0",
		profiles: [
			{
				id: "localstack",
				regions: [
					{
						id: "us-east-1",
						services: [
							{ id: "ssm", resourcetypes: [{ id: "parameter", arns: ["*"] }] },
							{ id: "sqs", resourcetypes: [{ id: "queue", arns: ["*"] }] },
						],
					},
				],
			},
		],
	};

	test("keeps only the chosen pairs present in the metamodel", () => {
		const focus = intersectMetamodelWithPairs(metamodel, [
			{ service: "ssm", resourceType: "parameter" },
		]);
		const services = focus.profiles[0].regions[0].services;
		assert.deepStrictEqual(
			services.map((s) => s.id),
			["ssm"],
		);
		assert.deepStrictEqual(services[0].resourcetypes, [
			{ id: "parameter", arns: ["*"] },
		]);
	});

	test("drops chosen pairs that are not deployed in the metamodel", () => {
		/* SSM document is chosen but only a parameter is deployed. */
		const focus = intersectMetamodelWithPairs(metamodel, [
			{ service: "ssm", resourceType: "document" },
		]);
		assert.deepStrictEqual(focus.profiles[0].regions, []);
	});

	test("prunes services and regions left empty", () => {
		const focus = intersectMetamodelWithPairs(metamodel, [
			{ service: "sqs", resourceType: "queue" },
		]);
		const services = focus.profiles[0].regions[0].services;
		assert.deepStrictEqual(
			services.map((s) => s.id),
			["sqs"],
		);
		assert.strictEqual(focus.profiles[0].id, "localstack");
	});
});
