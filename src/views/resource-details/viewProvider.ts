import { commands } from "vscode";
import type * as vscode from "vscode";

import ARN from "../../platforms/aws/models/arnModel.ts";
import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";
import { FieldType } from "../../platforms/aws/services/serviceProvider.ts";

/** A single described field, as returned by a provider's `describeResource`. */
interface DetailField {
	field: string;
	value: string;
	type: FieldType;
}

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Pretty-print a JSON string; fall back to the raw text if it does not parse. */
function prettyJson(value: string): string {
	try {
		return JSON.stringify(JSON.parse(value) as unknown, null, 2);
	} catch {
		return value;
	}
}

/* Inline stylesheet — themed via VS Code CSS variables so it tracks the theme. */
const STYLES = `
	body {
		color: var(--vscode-foreground);
		font-family: var(--vscode-font-family);
		font-size: var(--vscode-font-size);
		padding: 0 8px 8px;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		/* Fixed layout makes the column widths below hard caps, so a long field
		 * label wraps within its 20% column instead of stretching it. */
		table-layout: fixed;
	}
	td {
		padding: 3px 8px;
		vertical-align: top;
		border-bottom: 1px solid var(--vscode-widget-border, transparent);
	}
	td.field {
		color: var(--vscode-descriptionForeground);
		width: 20%;
		white-space: normal;
		overflow-wrap: break-word;
	}
	td.value {
		width: 80%;
		word-break: break-word;
	}
	.mono {
		font-family: var(--vscode-editor-font-family);
		font-size: var(--vscode-editor-font-size);
	}
	pre.block {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: var(--vscode-editor-font-family);
		font-size: var(--vscode-editor-font-size);
	}
	.placeholder {
		color: var(--vscode-descriptionForeground);
	}
	.error {
		color: var(--vscode-errorForeground);
	}
`;

/**
 * Provider for the "Resource Details" webview, showing a themed key/value table
 * for the AWS resource currently selected in the "Resources" view. Rendered as a
 * webview (rather than a tree) so values can be laid out as a real table and
 * formatted per field type. The content changes whenever a new resource is
 * selected, and can be refreshed manually.
 */
export class ResourceDetailsViewProvider implements vscode.WebviewViewProvider {
	/** The resolved webview view, once VS Code has created it. */
	private view: vscode.WebviewView | undefined;

	/** The ARN of the currently selected resource. */
	private arn: string | undefined = undefined;

	/** The profile of the currently selected resource. */
	private profile: string | undefined = undefined;

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		/* No scripts are needed: the table is static HTML. */
		webviewView.webview.options = { enableScripts: false };
		this.render();
	}

	/** Update the view to show details of the selected resource. */
	public setArn(profile: string, arn: string): void {
		if (arn !== this.arn || profile !== this.profile) {
			this.arn = arn;
			this.profile = profile;
			this.render();
		}
	}

	/** Re-fetch and re-render the currently selected resource (manual refresh). */
	public refresh(): void {
		this.render();
	}

	/**
	 * Bring the Resource Details panel forward without stealing keyboard focus,
	 * so the user can keep arrow-key browsing the Resources tree while details
	 * follow live. Before the panel has ever been opened the view isn't resolved
	 * yet, so fall back to the auto-generated focus command to open it the first
	 * time (that one reveal does take focus).
	 */
	public reveal(): void {
		if (this.view) {
			this.view.show(true); // preserveFocus: keep focus in the Resources tree
		} else {
			void commands.executeCommand("localstack.resourceDetails.focus");
		}
	}

	/** Render the current state into the webview (no-op until it is resolved). */
	private render(): void {
		if (!this.view) {
			return;
		}
		if (!this.arn || !this.profile) {
			this.view.webview.html = this.htmlDocument(
				`<p class="placeholder">Please select a resource in the Resources view.</p>`,
			);
			return;
		}
		this.view.webview.html = this.htmlDocument(
			`<p class="placeholder">Loading…</p>`,
		);
		void this.renderResource(this.profile, this.arn);
	}

	/** Fetch the resource's fields and render them, guarding against stale fetches. */
	private async renderResource(profile: string, arn: string): Promise<void> {
		let body: string;
		try {
			const resourceArn = new ARN(arn);
			const service = ProviderFactory.getProviderForService(
				resourceArn.service,
			);
			const fields = await service.describeResource(profile, resourceArn);
			const rows: DetailField[] = [
				{ field: "ARN", value: arn, type: FieldType.ARN },
				{ field: "Service", value: service.getName(), type: FieldType.NAME },
				...fields,
			];
			body = this.tableBody(rows);
		} catch (error) {
			body = `<p class="error">Could not load resource details: ${escapeHtml(
				String(error),
			)}</p>`;
		}
		/* A newer selection (or refresh) may have superseded this fetch. */
		if (!this.view || this.arn !== arn || this.profile !== profile) {
			return;
		}
		this.view.webview.html = this.htmlDocument(body);
	}

	private tableBody(rows: DetailField[]): string {
		const trs = rows
			.map(
				(row) =>
					`<tr><td class="field">${escapeHtml(
						row.field,
					)}</td><td class="value">${this.valueCell(
						row.value,
						row.type,
					)}</td></tr>`,
			)
			.join("");
		return `<table>${trs}</table>`;
	}

	/** Render a value cell, formatted according to its field type. */
	private valueCell(value: string, type: FieldType): string {
		switch (type) {
			case FieldType.JSON:
				return `<pre class="block">${escapeHtml(prettyJson(value))}</pre>`;
			case FieldType.LONG_TEXT:
				return `<pre class="block">${escapeHtml(value)}</pre>`;
			case FieldType.ARN:
			case FieldType.LOG_GROUP:
			case FieldType.NUMBER:
			case FieldType.DATE:
				return `<span class="mono">${escapeHtml(value)}</span>`;
			default:
				return escapeHtml(value);
		}
	}

	private htmlDocument(body: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>${STYLES}</style>
</head>
<body>${body}</body>
</html>`;
	}
}
