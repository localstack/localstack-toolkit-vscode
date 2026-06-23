import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import { Lambda } from "../../clients/lambda.ts";
import type ARN from "../../models/arnModel.ts";
import {
	FieldType,
	ServiceProvider,
	ServiceResourceArnTuple,
} from "../serviceProvider.ts";

export class LambdaServiceProvider extends ServiceProvider {
	async getResourceArns(
		profile: string,
		region: string,
		resourceType: string,
	): Promise<string[]> {
		if (resourceType === "function") {
			return (await Lambda.listFunctions(profile, region)).flatMap((func) =>
				func.FunctionArn ? [func.FunctionArn] : [],
			);
		} else if (resourceType === "event-source-mapping") {
			return (await Lambda.listEventSourceMappings(profile, region)).flatMap(
				(mapping) =>
					mapping.EventSourceMappingArn ? [mapping.EventSourceMappingArn] : [],
			);
		} else {
			throw new Error(`Unknown resource type: ${resourceType}`);
		}
	}

	public async describeResource(
		profile: string,
		arn: ARN,
	): Promise<{ field: string; value: string; type: FieldType }[]> {
		const resourceType = arn.resourceType?.toLowerCase();
		if (resourceType === "function") {
			const functionInfo = await Lambda.getFunction(profile, arn.region, arn);
			return [
				{ field: "Resource Type", value: "Function", type: FieldType.NAME },
				{
					field: "Name",
					value: functionInfo.FunctionName ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "State",
					value: functionInfo.State ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Description",
					value: functionInfo.Description || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Runtime",
					value: functionInfo.Runtime ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Handler",
					value: functionInfo.Handler ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Version",
					value: functionInfo.Version ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Role",
					value: functionInfo.Role ?? "N/A",
					type: FieldType.ARN,
				},
				{
					field: "Code Size (bytes)",
					value: functionInfo.CodeSize?.toString() ?? "N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Memory Size (MB)",
					value: functionInfo.MemorySize?.toString() ?? "N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Timeout (seconds)",
					value: functionInfo.Timeout?.toString() ?? "N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Last Modified",
					value: functionInfo.LastModified ?? "N/A",
					type: FieldType.DATE,
				},
				{
					field: "Last Update Status",
					value: functionInfo.LastUpdateStatus ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Package Type",
					value: functionInfo.PackageType ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Architectures",
					value: (functionInfo.Architectures || []).join(", ") || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "LogFormat",
					value: functionInfo.LoggingConfig?.LogFormat || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "LogGroup",
					value: functionInfo.LoggingConfig?.LogGroup || "N/A",
					type: FieldType.LOG_GROUP,
				},
			];
		} else if (resourceType === "event-source-mapping") {
			const mappingInfo = await Lambda.getEventSourceMapping(
				profile,
				arn.region,
				arn,
			);
			return [
				{
					field: "Resource Type",
					value: "Event Source Mapping",
					type: FieldType.NAME,
				},
				{
					field: "UUID",
					value: mappingInfo.UUID ?? "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Function ARN",
					value: mappingInfo.FunctionArn ?? "N/A",
					type: FieldType.ARN,
				},
				{
					field: "Event Source ARN",
					value: mappingInfo.EventSourceArn || "N/A",
					type: FieldType.ARN,
				},
				{
					field: "State",
					value: mappingInfo.State || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "State Transition Reason",
					value: mappingInfo.StateTransitionReason || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Batch Size",
					value: mappingInfo.BatchSize?.toString() ?? "N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Maximum Batching Window (seconds)",
					value:
						mappingInfo.MaximumBatchingWindowInSeconds?.toString() ?? "N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Last Modified",
					value: mappingInfo.LastModified?.toISOString() ?? "N/A",
					type: FieldType.DATE,
				},
				{
					field: "Last Processing Result",
					value: mappingInfo.LastProcessingResult || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Function Response Types",
					value: (mappingInfo.FunctionResponseTypes || []).join(", ") || "N/A",
					type: FieldType.NAME,
				},
			];
		} else {
			throw new Error(
				`Unsupported resource type for Lambda: ${arn.resourceType}`,
			);
		}
	}

	public getArnResourceNameForCloudFormationResource(
		stackResourceSummary: StackResourceSummary,
	): { resourceType: string; resourceName: string } {
		const resourceType = stackResourceSummary.ResourceType;
		const physicalResourceId = stackResourceSummary.PhysicalResourceId;
		if (!physicalResourceId) {
			throw new Error(
				`Missing PhysicalResourceId for Lambda resource type: ${resourceType}`,
			);
		}
		if (resourceType === "AWS::Lambda::Function") {
			return {
				resourceType: "function",
				resourceName: `function:${physicalResourceId}`,
			};
		} else if (resourceType === "AWS::Lambda::EventSourceMapping") {
			return {
				resourceType: "event-source-mapping",
				resourceName: `event-source-mapping:${physicalResourceId}`,
			};
		} else {
			throw new Error(`Unsupported Lambda resource type: ${resourceType}`);
		}
	}

	protected resourceTypes: Record<string, [string, string]> = {
		function: ["Function", "Functions"],
		"event-source-mapping": ["Event Source Mapping", "Event Source Mappings"],
	};

	override getMetamodelOperationMap(): Map<string, string> {
		return new Map([
			["listFunctions", "function"],
			["listEventSourceMappings", "event-source-mapping"],
		]);
	}

	getId(): string {
		return "lambda";
	}

	getName(): string {
		return "Lambda";
	}
}
