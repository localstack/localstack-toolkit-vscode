import assert from "node:assert";

import type { SavedView } from "../../views/explore/settings.ts";
import { resolveRegionViewFocus } from "../../views/explore/viewProvider.ts";

/**
 * The region (saved) view focus selector resolves its definition live
 * from the current view list, so editing the active view is reflected on
 * refresh and removing it yields no focus (clearing the Resources view).
 */
suite("resolveRegionViewFocus", () => {
	const profile = "default";
	const region = "us-east-1";

	function view(resources: SavedView["resources"]): SavedView {
		return { name: "My View", resources, scope: { region } };
	}

	test("resolves the focus from the matching view's pairs", () => {
		const focus = resolveRegionViewFocus(profile, region, "My View", [
			view([{ service: "sqs", resourceType: "queue" }]),
		]);
		assert.ok(focus);
		const services = focus.profiles[0].regions[0].services;
		assert.deepStrictEqual(
			services.map((s) => s.id),
			["sqs"],
		);
	});

	test("reflects an edit to the view's pairs (live resolution)", () => {
		/* Same name, different pairs — simulating an edit; the resolved focus
		 * must reflect the new pairs, not a stale snapshot. */
		const focus = resolveRegionViewFocus(profile, region, "My View", [
			view([
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

	test("yields undefined when the named view is absent (removed/renamed)", () => {
		const focus = resolveRegionViewFocus(
			profile,
			region,
			"My View",
			[view([{ service: "sqs", resourceType: "queue" }])].filter(
				(v) => v.name !== "My View",
			),
		);
		assert.strictEqual(focus, undefined);
	});
});
