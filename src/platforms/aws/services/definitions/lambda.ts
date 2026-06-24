import {
	GetEventSourceMappingCommand,
	GetFunctionCommand,
	LambdaClient,
	ListEventSourceMappingsCommand,
	ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import type {
	EventSourceMappingConfiguration,
	FunctionConfiguration,
} from "@aws-sdk/client-lambda";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * Lambda. Functions and event source mappings. Both list operations paginate on
 * `Marker`/`NextMarker`. The CloudFormation resource name encodes the type
 * (`function:` / `event-source-mapping:`) so the synthesized ARN resolves back
 * to the right resource type. Array fields (architectures, response types) are
 * joined into a single display string by `describe`.
 */
export const lambdaDefinition = defineService<LambdaClient>({
	id: "lambda",
	name: "Lambda",
	client: (config) => new LambdaClient(config),
	resourceTypes: {
		function: {
			singular: "Function",
			plural: "Functions",
			metamodelOp: "listFunctions",
			cfn: "AWS::Lambda::Function",
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId
					? `function:${summary.PhysicalResourceId}`
					: undefined,
			list: async (client): Promise<FunctionConfiguration[]> => {
				const functions: FunctionConfiguration[] = [];
				let marker: string | undefined;
				do {
					const out = await client.send(
						new ListFunctionsCommand({ Marker: marker }),
					);
					functions.push(...(out.Functions ?? []));
					marker = out.NextMarker;
				} while (marker);
				return functions;
			},
			id: (fn: FunctionConfiguration) => fn.FunctionArn ?? "",
			describe: async (client, identifier) => {
				const out = await client.send(
					new GetFunctionCommand({ FunctionName: identifier.resourceName }),
				);
				const config = out.Configuration ?? {};
				return {
					...config,
					ArchitecturesText: (config.Architectures ?? []).join(", "),
				};
			},
			detail: [
				{ label: "Name", path: "FunctionName", type: FieldType.NAME },
				{ label: "State", path: "State", type: FieldType.NAME },
				{ label: "Description", path: "Description", type: FieldType.NAME },
				{ label: "Runtime", path: "Runtime", type: FieldType.NAME },
				{ label: "Handler", path: "Handler", type: FieldType.NAME },
				{ label: "Version", path: "Version", type: FieldType.NAME },
				{ label: "Role", path: "Role", type: FieldType.ARN },
				{
					label: "Code Size (bytes)",
					path: "CodeSize",
					type: FieldType.NUMBER,
				},
				{
					label: "Memory Size (MB)",
					path: "MemorySize",
					type: FieldType.NUMBER,
				},
				{ label: "Timeout (seconds)", path: "Timeout", type: FieldType.NUMBER },
				{ label: "Last Modified", path: "LastModified", type: FieldType.DATE },
				{
					label: "Last Update Status",
					path: "LastUpdateStatus",
					type: FieldType.NAME,
				},
				{ label: "Package Type", path: "PackageType", type: FieldType.NAME },
				{
					label: "Architectures",
					path: "ArchitecturesText",
					type: FieldType.NAME,
				},
				{
					label: "LogFormat",
					path: "LoggingConfig.LogFormat",
					type: FieldType.NAME,
				},
				{
					label: "LogGroup",
					path: "LoggingConfig.LogGroup",
					type: FieldType.LOG_GROUP,
				},
			],
		},
		"event-source-mapping": {
			singular: "Event Source Mapping",
			plural: "Event Source Mappings",
			metamodelOp: "listEventSourceMappings",
			cfn: "AWS::Lambda::EventSourceMapping",
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId
					? `event-source-mapping:${summary.PhysicalResourceId}`
					: undefined,
			list: async (client): Promise<EventSourceMappingConfiguration[]> => {
				const mappings: EventSourceMappingConfiguration[] = [];
				let marker: string | undefined;
				do {
					const out = await client.send(
						new ListEventSourceMappingsCommand({ Marker: marker }),
					);
					mappings.push(...(out.EventSourceMappings ?? []));
					marker = out.NextMarker;
				} while (marker);
				return mappings;
			},
			id: (mapping: EventSourceMappingConfiguration) =>
				mapping.EventSourceMappingArn ?? "",
			describe: async (client, identifier) => {
				const mapping = await client.send(
					new GetEventSourceMappingCommand({ UUID: identifier.resourceName }),
				);
				return {
					...mapping,
					FunctionResponseTypesText: (mapping.FunctionResponseTypes ?? []).join(
						", ",
					),
				};
			},
			detail: [
				{ label: "UUID", path: "UUID", type: FieldType.NAME },
				{ label: "Function ARN", path: "FunctionArn", type: FieldType.ARN },
				{
					label: "Event Source ARN",
					path: "EventSourceArn",
					type: FieldType.ARN,
				},
				{ label: "State", path: "State", type: FieldType.NAME },
				{
					label: "State Transition Reason",
					path: "StateTransitionReason",
					type: FieldType.NAME,
				},
				{ label: "Batch Size", path: "BatchSize", type: FieldType.NUMBER },
				{
					label: "Maximum Batching Window (seconds)",
					path: "MaximumBatchingWindowInSeconds",
					type: FieldType.NUMBER,
				},
				{ label: "Last Modified", path: "LastModified", type: FieldType.DATE },
				{
					label: "Last Processing Result",
					path: "LastProcessingResult",
					type: FieldType.NAME,
				},
				{
					label: "Function Response Types",
					path: "FunctionResponseTypesText",
					type: FieldType.NAME,
				},
			],
		},
	},
});
