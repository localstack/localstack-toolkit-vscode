import {
	DescribeDocumentCommand,
	DescribeMaintenanceWindowsCommand,
	DescribeParametersCommand,
	DescribePatchBaselinesCommand,
	ListAssociationsCommand,
	ListDocumentsCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import type {
	Association,
	DocumentIdentifier,
	ParameterMetadata,
	PatchBaselineIdentity,
	MaintenanceWindowIdentity,
} from "@aws-sdk/client-ssm";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * SSM (Systems Manager). Parameters, documents, maintenance windows,
 * associations, and patch baselines. Most of these list responses omit an ARN,
 * so an account-less ARN is synthesized from the region and the resource's
 * primary id; the resource segment distinguishes the five types.
 */
export const ssmDefinition = defineService<SSMClient>({
	id: "ssm",
	name: "SSM",
	client: (config) => new SSMClient(config),
	resourceTypes: {
		parameter: {
			singular: "Parameter",
			plural: "Parameters",
			cfn: "AWS::SSM::Parameter",
			matchArn: (identifier) => identifier.arn.includes(":parameter/"),
			list: async (client): Promise<ParameterMetadata[]> => {
				const parameters: ParameterMetadata[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribeParametersCommand({ NextToken: nextToken }),
					);
					parameters.push(...(out.Parameters ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return parameters;
			},
			id: (parameter: ParameterMetadata, ctx) =>
				`arn:aws:ssm:${ctx.region}::parameter/${parameter.Name}`,
			describe: async (client, identifier) => {
				const out = await client.send(
					new DescribeParametersCommand({
						ParameterFilters: [
							{ Key: "Name", Values: [identifier.resourceName ?? ""] },
						],
					}),
				);
				return out.Parameters?.[0];
			},
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "Type", path: "Type", type: FieldType.NAME },
				{ label: "Tier", path: "Tier", type: FieldType.NAME },
				{ label: "Version", path: "Version", type: FieldType.NUMBER },
				{
					label: "Description",
					path: "Description",
					type: FieldType.SHORT_TEXT,
				},
				{
					label: "Last Modified",
					path: "LastModifiedDate",
					type: FieldType.DATE,
				},
			],
		},
		document: {
			singular: "Document",
			plural: "Documents",
			cfn: "AWS::SSM::Document",
			matchArn: (identifier) => identifier.arn.includes(":document/"),
			list: async (client): Promise<DocumentIdentifier[]> => {
				const documents: DocumentIdentifier[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListDocumentsCommand({ NextToken: nextToken }),
					);
					documents.push(...(out.DocumentIdentifiers ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return documents;
			},
			id: (document: DocumentIdentifier, ctx) =>
				`arn:aws:ssm:${ctx.region}::document/${document.Name}`,
			describe: (client, identifier) =>
				client.send(
					new DescribeDocumentCommand({ Name: identifier.resourceName }),
				),
			detail: [
				{ label: "Name", path: "Document.Name", type: FieldType.NAME },
				{ label: "Type", path: "Document.DocumentType", type: FieldType.NAME },
				{
					label: "Format",
					path: "Document.DocumentFormat",
					type: FieldType.NAME,
				},
				{ label: "Status", path: "Document.Status", type: FieldType.NAME },
				{ label: "Owner", path: "Document.Owner", type: FieldType.NAME },
				{
					label: "Created Date",
					path: "Document.CreatedDate",
					type: FieldType.DATE,
				},
			],
		},
		maintenancewindow: {
			singular: "Maintenance Window",
			plural: "Maintenance Windows",
			cfn: "AWS::SSM::MaintenanceWindow",
			matchArn: (identifier) => identifier.arn.includes(":maintenancewindow/"),
			list: async (client): Promise<MaintenanceWindowIdentity[]> => {
				const windows: MaintenanceWindowIdentity[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribeMaintenanceWindowsCommand({ NextToken: nextToken }),
					);
					windows.push(...(out.WindowIdentities ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return windows;
			},
			id: (window: MaintenanceWindowIdentity, ctx) =>
				`arn:aws:ssm:${ctx.region}::maintenancewindow/${window.WindowId}`,
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "Window ID", path: "WindowId", type: FieldType.NAME },
				{ label: "Enabled", path: "Enabled", type: FieldType.NAME },
				{ label: "Duration", path: "Duration", type: FieldType.NUMBER },
				{ label: "Cutoff", path: "Cutoff", type: FieldType.NUMBER },
				{
					label: "Schedule",
					path: "ScheduleExpression",
					type: FieldType.SHORT_TEXT,
				},
			],
		},
		association: {
			singular: "Association",
			plural: "Associations",
			cfn: "AWS::SSM::Association",
			matchArn: (identifier) => identifier.arn.includes(":association/"),
			list: async (client): Promise<Association[]> => {
				const associations: Association[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListAssociationsCommand({ NextToken: nextToken }),
					);
					associations.push(...(out.Associations ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return associations;
			},
			id: (association: Association, ctx) =>
				`arn:aws:ssm:${ctx.region}::association/${association.AssociationId}`,
			detail: [
				{
					label: "Association ID",
					path: "AssociationId",
					type: FieldType.NAME,
				},
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{
					label: "Association Name",
					path: "AssociationName",
					type: FieldType.NAME,
				},
				{
					label: "Schedule",
					path: "ScheduleExpression",
					type: FieldType.SHORT_TEXT,
				},
				{
					label: "Last Execution",
					path: "LastExecutionDate",
					type: FieldType.DATE,
				},
			],
		},
		patchbaseline: {
			singular: "Patch Baseline",
			plural: "Patch Baselines",
			cfn: "AWS::SSM::PatchBaseline",
			matchArn: (identifier) => identifier.arn.includes(":patchbaseline/"),
			list: async (client): Promise<PatchBaselineIdentity[]> => {
				const baselines: PatchBaselineIdentity[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribePatchBaselinesCommand({ NextToken: nextToken }),
					);
					baselines.push(...(out.BaselineIdentities ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return baselines;
			},
			id: (baseline: PatchBaselineIdentity, ctx) =>
				`arn:aws:ssm:${ctx.region}::patchbaseline/${baseline.BaselineId}`,
			detail: [
				{ label: "Name", path: "BaselineName", type: FieldType.NAME },
				{ label: "Baseline ID", path: "BaselineId", type: FieldType.NAME },
				{
					label: "Operating System",
					path: "OperatingSystem",
					type: FieldType.NAME,
				},
				{
					label: "Description",
					path: "BaselineDescription",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Default", path: "DefaultBaseline", type: FieldType.NAME },
			],
		},
	},
});
