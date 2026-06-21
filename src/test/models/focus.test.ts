import assert from "node:assert";

import { makeWildcardFocus, mergeFocuses } from "../../models/focus.ts";
import type { Focus } from "../../models/focus.ts";

suite("Focus model", () => {
	test("makeWildcardFocus builds a single profile/region wildcard focus", () => {
		const focus = makeWildcardFocus("default", "us-east-1");
		assert.strictEqual(focus.profiles.length, 1);
		assert.strictEqual(focus.profiles[0].id, "default");
		assert.strictEqual(focus.profiles[0].regions[0].id, "us-east-1");
		assert.strictEqual(focus.profiles[0].regions[0].services[0].id, "*");
	});

	test("mergeFocuses returns undefined for an empty selection", () => {
		assert.strictEqual(mergeFocuses([]), undefined);
	});

	test("mergeFocuses unions services on the same profile/region", () => {
		const a: Focus = {
			version: "1.0",
			profiles: [
				{
					id: "default",
					regions: [
						{
							id: "us-east-1",
							services: [
								{ id: "sqs", resourcetypes: [{ id: "queue", arns: ["*"] }] },
							],
						},
					],
				},
			],
		};
		const b: Focus = {
			version: "1.0",
			profiles: [
				{
					id: "default",
					regions: [
						{
							id: "us-east-1",
							services: [
								{ id: "sns", resourcetypes: [{ id: "topic", arns: ["*"] }] },
							],
						},
					],
				},
			],
		};

		const merged = mergeFocuses([a, b]);
		assert.ok(merged);
		assert.strictEqual(merged.profiles.length, 1);
		assert.strictEqual(merged.profiles[0].regions.length, 1);
		const serviceIds = merged.profiles[0].regions[0].services
			.map((s) => s.id)
			.sort();
		assert.deepStrictEqual(serviceIds, ["sns", "sqs"]);
	});

	test("mergeFocuses dedups identical ARNs within a resource type", () => {
		const one: Focus = {
			version: "1.0",
			profiles: [
				{
					id: "p",
					regions: [
						{
							id: "r",
							services: [
								{ id: "s", resourcetypes: [{ id: "t", arns: ["arn:1"] }] },
							],
						},
					],
				},
			],
		};
		const two: Focus = {
			version: "1.0",
			profiles: [
				{
					id: "p",
					regions: [
						{
							id: "r",
							services: [
								{
									id: "s",
									resourcetypes: [{ id: "t", arns: ["arn:1", "arn:2"] }],
								},
							],
						},
					],
				},
			],
		};

		const merged = mergeFocuses([one, two]);
		assert.ok(merged);
		const arns = merged.profiles[0].regions[0].services[0].resourcetypes[0].arns
			.slice()
			.sort();
		assert.deepStrictEqual(arns, ["arn:1", "arn:2"]);
	});
});
