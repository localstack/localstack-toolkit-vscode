import type { DeploymentContainer } from "@localstack/appinspector-ui";
import {
	AppInspectorContextProvider,
	pages,
} from "@localstack/appinspector-ui";
import {
	eventSystem,
	LocalStackEventType,
	LocalStackThemeProvider,
	ThemeType,
} from "@localstack/integrations";
import { StrictMode, useEffect } from "react";
import { render } from "react-dom";
import {
	HashRouter,
	Link,
	Navigate,
	Outlet,
	Route,
	Routes,
} from "react-router-dom";

/**
 * Reads VS Code's current theme from the webview's body element. VS Code
 * tags the body with `data-vscode-theme-kind` (and matching `vscode-*`
 * classes) and updates them when the user changes their color theme.
 * Returns undefined outside a VS Code webview, so the theme provider can
 * fall back to the OS `prefers-color-scheme` default.
 */
function detectVSCodeTheme(): ThemeType | undefined {
	const kind =
		document.body.dataset.vscodeThemeKind ??
		(document.body.classList.contains("vscode-dark")
			? "vscode-dark"
			: document.body.classList.contains("vscode-high-contrast")
				? "vscode-high-contrast"
				: document.body.classList.contains("vscode-high-contrast-light")
					? "vscode-high-contrast-light"
					: document.body.classList.contains("vscode-light")
						? "vscode-light"
						: undefined);
	if (kind === "vscode-dark" || kind === "vscode-high-contrast") {
		return ThemeType.DARK;
	}
	if (kind === "vscode-light" || kind === "vscode-high-contrast-light") {
		return ThemeType.LIGHT;
	}
	return undefined;
}

const VSCodeThemeSync = () => {
	useEffect(() => {
		let lastTheme = detectVSCodeTheme();
		const observer = new MutationObserver(() => {
			const next = detectVSCodeTheme();
			if (next && next !== lastTheme) {
				lastTheme = next;
				eventSystem.notify({
					eventType: LocalStackEventType.THEME_UPDATE,
					data: { theme: next },
				});
			}
		});
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["class", "data-vscode-theme-kind"],
		});
		return () => observer.disconnect();
	}, []);
	return null;
};

/* Passed by the VS Code extension when App Inspector is launched. */
declare global {
	interface Window {
		__APP_INSPECTOR_CONTEXT__: {
			source: "vscode";
			ideVersion: string;
			extensionVersion: string;
		} | null;
	}
}

const APPINSPECTOR_ROUTE_PREFIX = "/appinspector";

const deploymentContainer: DeploymentContainer =
	window.__APP_INSPECTOR_CONTEXT__ ?? {
		source: "vscode",
		ideVersion: "unknown",
		extensionVersion: "unknown",
	};

render(
	<StrictMode>
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					flexGrow: 1,
					display: "flex",
					flexDirection: "column",
					padding: "24px",
				}}
			>
				<VSCodeThemeSync />
				<LocalStackThemeProvider
					themeType={detectVSCodeTheme()}
					useExtensionLayout={false}
				>
					<AppInspectorContextProvider
						deploymentContainer={deploymentContainer}
						linkComponent={(props) => (
							<Link to={props.to}>{props.children}</Link>
						)}
						localstackEndpoint="http://localhost:4566"
						routePrefix={APPINSPECTOR_ROUTE_PREFIX}
					>
						<HashRouter basename="/">
							<Routes>
								<Route
									element={<Navigate replace to={APPINSPECTOR_ROUTE_PREFIX} />}
									path="/"
								/>

								<Route element={<Outlet />} path={APPINSPECTOR_ROUTE_PREFIX}>
									<Route
										element={<Navigate replace to="./spans" />}
										path={APPINSPECTOR_ROUTE_PREFIX}
									/>

									{Object.entries(pages).map(([key, [path, Page]]) => (
										<Route
											element={<Page />}
											key={key}
											path={`${APPINSPECTOR_ROUTE_PREFIX}/${path}`}
										/>
									))}
								</Route>
							</Routes>
						</HashRouter>
					</AppInspectorContextProvider>
				</LocalStackThemeProvider>
			</div>
		</div>
	</StrictMode>,
	document.querySelector("#root"),
);
