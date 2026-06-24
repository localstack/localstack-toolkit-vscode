import assert from "node:assert";

import {
	getAllRegionCodes,
	getRegionLongName,
} from "../../platforms/aws/models/regionModel.ts";

/**
 * Region lookups back both the cloud-profile add-region picker and the region
 * labels shown in the Resources view. The latter renders whatever region the
 * running emulator reports in its metamodel, so an unknown region must degrade
 * to its code rather than throw and break the whole "All Resources" view.
 */
suite("regionModel", () => {
	test("returns the long name for a known region", () => {
		assert.strictEqual(getRegionLongName("us-east-1"), "US East (N. Virginia)");
		assert.strictEqual(getRegionLongName("cn-north-1"), "China (Beijing)");
	});

	test("falls back to the region code for an unknown region", () => {
		assert.strictEqual(getRegionLongName("xx-unknown-9"), "xx-unknown-9");
	});

	test("exposes the China partition regions in the region list", () => {
		const codes = getAllRegionCodes();
		assert.ok(codes.includes("cn-north-1"));
		assert.ok(codes.includes("cn-northwest-1"));
	});
});
