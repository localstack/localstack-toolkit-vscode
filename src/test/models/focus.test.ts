import assert from "node:assert";

import { makeWildcardFocus } from "../../models/focus.ts";

suite("Focus model", () => {
	test("makeWildcardFocus builds a single profile/region wildcard focus", () => {
		const focus = makeWildcardFocus("default", "us-east-1");
		assert.strictEqual(focus.profiles.length, 1);
		assert.strictEqual(focus.profiles[0].id, "default");
		assert.strictEqual(focus.profiles[0].regions[0].id, "us-east-1");
		assert.strictEqual(focus.profiles[0].regions[0].services[0].id, "*");
	});
});
