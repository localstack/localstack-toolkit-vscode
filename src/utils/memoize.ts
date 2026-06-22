/**
 * Memoizes a function's results based on its arguments.
 *
 * @param func The function to memoize.
 * @returns A memoized version of the function.
 */
export function memoize<Args extends unknown[], Result>(
	func: (...args: Args) => Result,
): (...args: Args) => Result {
	/* For promise-returning functions we cache the resolved value (not the
	 * promise), so the cache holds `Awaited<Result>`. */
	const cache = new Map<string, Awaited<Result>>();

	return (...args: Args): Result => {
		const key = JSON.stringify(args); // Create a unique key from arguments

		if (cache.has(key)) {
			return cache.get(key) as Result;
		}

		const result = func(...args);

		/* for Promises, only cache them if they're successful */
		if (result instanceof Promise) {
			return (result as Promise<Awaited<Result>>).then((res) => {
				cache.set(key, res);
				return res;
			}) as Result;

			/* For non-Promises, always cache the result */
		}
		cache.set(key, result as Awaited<Result>);
		return result;
	};
}
