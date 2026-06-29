import { commands } from "vscode";
import type { ExtensionContext } from "vscode";

/**
 * Global-state key (and matching VS Code context key) for the resource-browser
 * opt-in. The same string is referenced by the `when` clauses on the Resources
 * and Resource Details view contributions in package.json.
 */
export const RESOURCE_BROWSER_ENABLED_KEY = "localstack.resourceBrowserEnabled";

/** Whether the user has opted in to the resource browser. Defaults to off. */
export function isResourceBrowserEnabled(context: ExtensionContext): boolean {
	return context.globalState.get<boolean>(RESOURCE_BROWSER_ENABLED_KEY, false);
}

/**
 * Persist the opt-in choice and mirror it onto the context key so the gated
 * views show/hide immediately. `globalState` is the source of truth; the
 * context key is always derived from it.
 */
export async function setResourceBrowserEnabled(
	context: ExtensionContext,
	enabled: boolean,
): Promise<void> {
	await context.globalState.update(RESOURCE_BROWSER_ENABLED_KEY, enabled);
	await commands.executeCommand(
		"setContext",
		RESOURCE_BROWSER_ENABLED_KEY,
		enabled,
	);
}

/**
 * Re-assert the context key from persisted state. Context keys do not survive a
 * window reload, so this must run on every activation to restore view
 * visibility.
 */
export async function syncResourceBrowserContext(
	context: ExtensionContext,
): Promise<void> {
	await commands.executeCommand(
		"setContext",
		RESOURCE_BROWSER_ENABLED_KEY,
		isResourceBrowserEnabled(context),
	);
}
