/**
 * Common test utilities and helpers
 */

import * as assert from "node:assert";

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
	value: T | null | undefined,
	message?: string,
): asserts value is T {
	assert.ok(
		value !== null && value !== undefined,
		message || "Value should be defined",
	);
}

/**
 * Assert that an error is thrown with a specific message
 */
export async function assertThrowsAsync(
	fn: () => Promise<any>,
	errorMessage?: string | RegExp,
): Promise<void> {
	let threw = false;
	try {
		await fn();
	} catch (error) {
		threw = true;
		if (errorMessage) {
			const message = error instanceof Error ? error.message : String(error);
			if (typeof errorMessage === "string") {
				assert.ok(
					message.includes(errorMessage),
					`Expected error message to include "${errorMessage}", got: ${message}`,
				);
			} else {
				assert.ok(
					errorMessage.test(message),
					`Expected error message to match ${errorMessage}, got: ${message}`,
				);
			}
		}
	}
	assert.ok(threw, "Expected function to throw an error");
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	options: { timeout?: number; interval?: number } = {},
): Promise<void> {
	const timeout = options.timeout || 5000;
	const interval = options.interval || 100;
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		if (await condition()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, interval));
	}

	throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a deferred promise that can be resolved/rejected externally
 */
export function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
} {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

/**
 * Spy on function calls
 */
export class FunctionSpy<TArgs extends any[], TReturn> {
	private calls: TArgs[] = [];
	private impl?: (...args: TArgs) => TReturn;

	constructor(impl?: (...args: TArgs) => TReturn) {
		this.impl = impl;
	}

	call(...args: TArgs): TReturn {
		this.calls.push(args);
		if (this.impl) {
			return this.impl(...args);
		}
		return undefined as TReturn;
	}

	getCalls(): TArgs[] {
		return this.calls;
	}

	getCallCount(): number {
		return this.calls.length;
	}

	wasCalled(): boolean {
		return this.calls.length > 0;
	}

	wasCalledWith(...args: TArgs): boolean {
		return this.calls.some(
			(call) => JSON.stringify(call) === JSON.stringify(args),
		);
	}

	reset(): void {
		this.calls = [];
	}
}
