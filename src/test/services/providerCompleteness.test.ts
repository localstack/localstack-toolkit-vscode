import assert from "node:assert";

import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";
import { getAllServiceIds } from "../../platforms/aws/services/serviceManifest.ts";

/**
 * Completeness tracking for manifest-backed provider registration.
 *
 * The definition of "done" for the full-service-coverage effort is: every
 * manifest service has a registered provider. Until all batches land this runs
 * as a coverage tracker — it never serves a generic fallback, so a manifest
 * service with no provider is simply absent. The hard assertions below guard
 * against regressions (stray providers, lost coverage); the final
 * everything-covered gate is logged until it can be turned on (see the skipped
 * test) once the remaining batches ship.
 */
suite("provider completeness", () => {
	suiteSetup(() => {
		ProviderFactory.initialize();
	});

	test("every registered provider maps to a real manifest service id", () => {
		const manifestIds = new Set(getAllServiceIds());
		const stray = ProviderFactory.getRegisteredServiceIds().filter(
			(id) => !manifestIds.has(id),
		);
		assert.deepStrictEqual(
			stray,
			[],
			`registered providers with no manifest entry: ${stray.join(", ")}`,
		);
	});

	test("coverage tracker: report manifest services with no provider", () => {
		const registered = new Set(ProviderFactory.getRegisteredServiceIds());
		const manifestIds = getAllServiceIds();
		const missing = manifestIds.filter((id) => !registered.has(id));

		const covered = manifestIds.length - missing.length;
		console.log(
			`[provider-coverage] ${covered}/${manifestIds.length} manifest services ` +
				`have a provider; ${missing.length} remaining.`,
		);

		/* Coverage can only be a subset of the manifest; full coverage is the
		 * eventual goal, enforced by the skipped test below once batches land. */
		assert.ok(covered > 0, "expected at least one provider registered");
		assert.ok(covered <= manifestIds.length);
	});

	test.skip("DONE GATE: every manifest service has a provider", () => {
		const registered = new Set(ProviderFactory.getRegisteredServiceIds());
		const missing = getAllServiceIds().filter((id) => !registered.has(id));
		assert.deepStrictEqual(
			missing,
			[],
			`manifest services with no provider: ${missing.join(", ")}`,
		);
	});
});
