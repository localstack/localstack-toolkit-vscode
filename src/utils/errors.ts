/**
 * Indicates that something happened inside the software that is not
 * the user's fault. It requires a software fix.
 */
export class InternalError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InternalError";
	}
}

/**
 * Indicates there was a configuration problem that the user needs to fix.
 */
export class UserConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UserConfigurationError";
	}
}
