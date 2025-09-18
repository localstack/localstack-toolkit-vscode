/**
 * Creates a function that calls the given callback on the next tick, once per tick.
 *
 * Multiple calls during the same tick are ignored.
 *
 * @param callback - The callback to call.
 * @returns A function that calls the callback on the next tick, once per tick.
 */
export function createOnceImmediate<T>(callback: () => T): () => void {
	let timeout: NodeJS.Immediate | undefined;

	return () => {
		if (timeout) {
			return;
		}

		timeout = setImmediate(() => {
			void Promise.resolve(callback()).finally(() => {
				timeout = undefined;
			});
		});
	};
}
