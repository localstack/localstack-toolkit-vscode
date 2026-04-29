import type { DeploymentContainer } from "@localstack/appinspector-ui";
import {
	AppInspectorContextProvider,
	pages,
} from "@localstack/appinspector-ui";
import { LocalStackThemeProvider } from "@localstack/integrations";
import { StrictMode } from "react";
import { render } from "react-dom";
import {
	HashRouter,
	Link,
	Navigate,
	Outlet,
	Route,
	Routes,
} from "react-router-dom";

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
				<LocalStackThemeProvider useExtensionLayout={false}>
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
