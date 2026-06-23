import assert from "node:assert";

import type { SavedFilter } from "../../views/localstack/settings.ts";
import { resolveRegionFilterFocus } from "../../views/localstack/viewProvider.ts";

/**
 * The region view (saved filter) focus selector resolves its definition live
 * from the current filter list, so editing the active view is reflected on
 * refresh and removing it yields no focus (clearing the Resources view).
 */
suite("resolveRegionFilterFocus", () => {
	const profile = "default";
	const region = "us-east-1";

	function filter(resources: SavedFilter["resources"]): SavedFilter {
		return { name: "My View", resources, scope: { region } };
	}

	test("resolves the focus from the matching filter's pairs", () => {
		const focus = resolveRegionFilterFocus(profile, region, "My View", [
			filter([{ service: "sqs", resourceType: "queue" }]),
		]);
		assert.ok(focus);
		const services = focus.profiles[0].regions[0].services;
		assert.deepStrictEqual(
			services.map((s) => s.id),
			["sqs"],
		);
	});

	test("reflects an edit to the filter's pairs (live resolution)", () => {
		/* Same name, different pairs — simulating an edit; the resolved focus
		 * must reflect the new pairs, not a stale snapshot. */
		const focus = resolveRegionFilterFocus(profile, region, "My View", [
			filter([
				{ service: "sqs", resourceType: "queue" },
				{ service: "sns", resourceType: "topic" },
			]),
		]);
		assert.ok(focus);
		const serviceIds = focus.profiles[0].regions[0].services
			.map((s) => s.id)
			.sort();
		assert.deepStrictEqual(serviceIds, ["sns", "sqs"]);
	});

	test("yields undefined when the named filter is absent (removed/renamed)", () => {
		const focus = resolveRegionFilterFocus(profile, region, "My View", [
			filter([{ service: "sqs", resourceType: "queue" }]),
		].filter((f) => f.name !== "My View"));
		assert.strictEqual(focus, undefined);
	});
});
