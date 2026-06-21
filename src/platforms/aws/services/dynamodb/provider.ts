import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";
import { ta } from "zod/v4/locales/index.cjs";

import { DynamoDB } from "../../clients/dynamodb.ts";
import type ARN from "../../models/arnModel.ts";
import {
	FieldType,
	ServiceProvider,
	ServiceResourceArnTuple,
} from "../serviceProvider.ts";

export class DynamoDBServiceProvider extends ServiceProvider {
	async getResourceArns(
		profile: string,
		region: string,
		resourceType: string,
	): Promise<string[]> {
		if (resourceType === "table") {
			return await DynamoDB.listTables(profile, region);
		} else {
			throw new Error(`Unknown resource type: ${resourceType}`);
		}
	}

	public async describeResource(
		profile: string,
		arn: ARN,
	): Promise<{ field: string; value: string; type: FieldType }[]> {
		const resourceType = arn.resourceType?.toLowerCase();
		if (resourceType === "table") {
			const tableInfo = await DynamoDB.describeTable(profile, arn.region, arn);

			const attributeFields = (tableInfo.AttributeDefinitions || []).map(
				(attr) => ({
					field: ` - ${attr.AttributeName!}`,
					value: attr.AttributeType!,
					type: FieldType.NAME,
				}),
			);
			const keySchemaFields = (tableInfo.KeySchema || []).map((key) => ({
				field: ` - ${key.AttributeName!}`,
				value: key.KeyType!,
				type: FieldType.NAME,
			}));

			return [
				{ field: "Resource Type", value: "Table", type: FieldType.NAME },
				{ field: "Name", value: tableInfo.TableName!, type: FieldType.NAME },
				{
					field: "Table Status",
					value: tableInfo.TableStatus!,
					type: FieldType.NAME,
				},
				{
					field: "Item Count",
					value: tableInfo.ItemCount!.toString(),
					type: FieldType.NUMBER,
				},
				{
					field: "Table Size (bytes)",
					value: tableInfo.TableSizeBytes?.toString() || "0",
					type: FieldType.NUMBER,
				},
				{
					field: "Creation Date",
					value: tableInfo.CreationDateTime!.toISOString(),
					type: FieldType.DATE,
				},
				{
					field: "Billing Mode",
					value: tableInfo.BillingModeSummary?.BillingMode || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Provisioned Read Capacity Units",
					value:
						tableInfo.ProvisionedThroughput?.ReadCapacityUnits?.toString() ||
						"N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Provisioned Write Capacity Units",
					value:
						tableInfo.ProvisionedThroughput?.WriteCapacityUnits?.toString() ||
						"N/A",
					type: FieldType.NUMBER,
				},
				{ field: "Attributes", value: "", type: FieldType.NAME },
				...attributeFields,
				{ field: "Key Schema", value: "", type: FieldType.NAME },
				...keySchemaFields,
			];
		} else {
			throw new Error(
				`Unsupported resource type for DynamoDB: ${arn.resourceType}`,
			);
		}
	}

	public getArnResourceNameForCloudFormationResource(
		stackResourceSummary: StackResourceSummary,
	): { resourceType: string; resourceName: string } {
		throw new Error(
			`Unsupported DynamoDB resource type: ${stackResourceSummary.ResourceType}`,
		);
	}

	protected resourceTypes: Record<string, [string, string]> = {
		table: ["Table", "Tables"],
	};

	getId(): string {
		return "dynamodb";
	}

	getName(): string {
		return "DynamoDB";
	}
}
