/**
 * A memoized function, with a `clear()` to drop its cached results.
 */
export type Memoized<Args extends unknown[], Result> = ((
	...args: Args
) => Result) & { clear: () => void };

/*
 * Every memoized function's `clear` is registered here so all caches can be
 * dropped at once — e.g. when the user refreshes to re-query AWS, or when
 * credentials/endpoints may have changed and cached clients/results are stale.
 */
const registry = new Set<() => void>();

/** Drop every memoized cache (cached SDK clients and fetched data alike). */
export function clearMemoizedCaches(): void {
	for (const clear of registry) {
		clear();
	}
}

/**
 * Memoizes a function's results based on its arguments.
 *
 * For promise-returning functions the *promise* is cached (not just its
 * resolved value), so concurrent callers share a single in-flight request
 * instead of each firing their own. A rejected promise is evicted so the
 * failure is not served forever and the next call retries.
 *
 * Note: keys are derived via `JSON.stringify(args)`, so this is intended for
 * primitive arguments (strings/numbers). Object args with differing key order
 * — or non-serializable values — will not key reliably.
 *
 * @param func The function to memoize.
 * @returns A memoized version of `func`, with a `clear()` to drop its cache.
 */
export function memoize<Args extends unknown[], Result>(
	func: (...args: Args) => Result,
): Memoized<Args, Result> {
	const cache = new Map<string, Result>();

	const memoized = ((...args: Args): Result => {
		const key = JSON.stringify(args);
		if (cache.has(key)) {
			return cache.get(key) as Result;
		}

		const result = func(...args);
		cache.set(key, result);

		if (result instanceof Promise) {
			/* Don't let a rejection stick in the cache. Evict only if this exact
			 * promise is still the cached entry (a clear/refresh may have replaced
			 * it). The caller handles the rejection on its own copy of the promise;
			 * this handler exists solely to evict. */
			result.catch(() => {
				if (cache.get(key) === result) {
					cache.delete(key);
				}
			});
		}

		return result;
	}) as Memoized<Args, Result>;

	memoized.clear = () => cache.clear();
	registry.add(memoized.clear);
	return memoized;
}
