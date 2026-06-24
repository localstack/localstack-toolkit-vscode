import * as assert from "node:assert";

import { clearMemoizedCaches, memoize } from "../utils/memoize.ts";

suite("memoize", () => {
	test("caches by argument key", () => {
		let calls = 0;
		const m = memoize((x: number) => {
			calls++;
			return x * 2;
		});
		assert.strictEqual(m(2), 4);
		assert.strictEqual(m(2), 4);
		assert.strictEqual(calls, 1);
		assert.strictEqual(m(3), 6);
		assert.strictEqual(calls, 2);
	});

	test("dedupes concurrent in-flight async callers into one invocation", async () => {
		let calls = 0;
		const m = memoize((key: string) => {
			calls++;
			return Promise.resolve(`${key}!`);
		});

		/* Both calls happen before the first resolves; with promise caching they
		 * share the single in-flight request rather than each invoking `func`. */
		const [a, b] = await Promise.all([m("x"), m("x")]);
		assert.strictEqual(a, "x!");
		assert.strictEqual(b, "x!");
		assert.strictEqual(calls, 1);
	});

	test("does not cache a rejected promise; the next call retries", async () => {
		let attempts = 0;
		const m = memoize((key: string) => {
			attempts++;
			return attempts === 1
				? Promise.reject(new Error("transient"))
				: Promise.resolve(`${key}-ok`);
		});

		await assert.rejects(m("x"), /transient/);
		/* The failure was evicted, so the retry re-invokes and succeeds. */
		assert.strictEqual(await m("x"), "x-ok");
		assert.strictEqual(attempts, 2);
	});

	test("clear() drops a single function's cache", () => {
		let calls = 0;
		const m = memoize((x: number) => {
			calls++;
			return x;
		});
		m(1);
		m(1);
		assert.strictEqual(calls, 1);
		m.clear();
		m(1);
		assert.strictEqual(calls, 2);
	});

	test("clearMemoizedCaches() drops registered caches", () => {
		let calls = 0;
		const m = memoize((x: number) => {
			calls++;
			return x;
		});
		m(1);
		assert.strictEqual(calls, 1);
		clearMemoizedCaches();
		m(1);
		assert.strictEqual(calls, 2);
	});
});
