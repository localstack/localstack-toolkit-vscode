/**
 * Memoizes a function's results based on its arguments.
 *
 * @param func The function to memoize.
 * @returns A memoized version of the function.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic memoize wrapper
export function memoize<T extends (...args: any[]) => any>(func: T): T {
	const cache = new Map<string, ReturnType<T>>();

	return ((...args: Parameters<T>): ReturnType<T> => {
		const key = JSON.stringify(args); // Create a unique key from arguments

		if (cache.has(key)) {
			return cache.get(key)!;
		}

		const result = func(...args);

		/* for Promises, only cache them if they're successful */
		if (result instanceof Promise) {
			return result.then((res) => {
				cache.set(key, res);
				return res;
			}) as ReturnType<T>;

			/* For non-Promises, always cache the result */
		}
		cache.set(key, result);
		return result;
	}) as T;
}
