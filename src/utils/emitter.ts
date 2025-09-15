import { createOnceImmediate } from "./once-immediate.ts";

export type Callback<T> = (value: T | undefined) => Promise<void> | void;

export interface ValueEmitter<T> {
	value(): T | undefined;
	setValue(value: T | undefined): void;
	onChange(callback: Callback<T>): void;
}

export function createValueEmitter<T>(): ValueEmitter<T> {
	let currentValue: T | undefined;
	const callbacks: Callback<T>[] = [];

	const emit = createOnceImmediate(async () => {
		for (const callback of callbacks) {
			try {
				await callback(currentValue);
			} catch {}
		}
	});

	return {
		value() {
			return currentValue;
		},
		setValue(value) {
			if (currentValue !== value) {
				currentValue = value;
				emit();
			}
		},
		onChange(callback) {
			callbacks.push(callback);
			void Promise.resolve(callback(currentValue)).catch(() => {});
		},
	};
}
