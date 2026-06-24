import {
	DescribeTableCommand,
	DynamoDBClient,
	ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import type { TableDescription } from "@aws-sdk/client-dynamodb";

import { InternalError } from "../../../../utils/errors.ts";
import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/** A listed table paired with its derived ARN (the list API returns names only). */
type DynamoTable = { TableName: string; TableArn: string };

/**
 * DynamoDB. Tables only. `ListTables` returns names without ARNs, so `list`
 * derives the ARN prefix from the first table's description and applies it to
 * every name. The table's attribute definitions and key schema are
 * variable-length, rendered via `list` detail specs.
 */
export const dynamoDbDefinition = defineService<DynamoDBClient>({
	id: "dynamodb",
	name: "DynamoDB",
	client: (config) => new DynamoDBClient(config),
	resourceTypes: {
		table: {
			singular: "Table",
			plural: "Tables",
			list: async (client): Promise<DynamoTable[]> => {
				const names: string[] = [];
				let start: string | undefined;
				do {
					const out = await client.send(
						new ListTablesCommand({ ExclusiveStartTableName: start }),
					);
					names.push(...(out.TableNames ?? []));
					start = out.LastEvaluatedTableName;
				} while (start);
				if (names.length === 0) {
					return [];
				}
				/* Names only — derive the ARN prefix from the first table. */
				const first = await client.send(
					new DescribeTableCommand({ TableName: names[0] }),
				);
				const firstArn = first.Table?.TableArn;
				if (!firstArn) {
					throw new InternalError(
						`Failed to describe DynamoDB table: ${names[0]}`,
					);
				}
				const prefix = firstArn.slice(0, firstArn.lastIndexOf("/") + 1);
				return names.map((name) => ({
					TableName: name,
					TableArn: prefix + name,
				}));
			},
			id: (table: DynamoTable) => table.TableArn,
			describe: async (client, identifier): Promise<TableDescription> => {
				const out = await client.send(
					new DescribeTableCommand({ TableName: identifier.resourceName }),
				);
				if (!out.Table) {
					throw new InternalError(
						`Failed to describe DynamoDB table: ${identifier.resourceName}`,
					);
				}
				return out.Table;
			},
			detail: [
				{ label: "Name", path: "TableName", type: FieldType.NAME },
				{ label: "Table Status", path: "TableStatus", type: FieldType.NAME },
				{ label: "Item Count", path: "ItemCount", type: FieldType.NUMBER },
				{
					label: "Table Size (bytes)",
					path: "TableSizeBytes",
					type: FieldType.NUMBER,
				},
				{
					label: "Creation Date",
					path: "CreationDateTime",
					type: FieldType.DATE,
				},
				{
					label: "Billing Mode",
					path: "BillingModeSummary.BillingMode",
					type: FieldType.NAME,
				},
				{
					label: "Provisioned Read Capacity Units",
					path: "ProvisionedThroughput.ReadCapacityUnits",
					type: FieldType.NUMBER,
				},
				{
					label: "Provisioned Write Capacity Units",
					path: "ProvisionedThroughput.WriteCapacityUnits",
					type: FieldType.NUMBER,
				},
				{
					kind: "list",
					label: "Attributes",
					path: "AttributeDefinitions",
					itemLabel: "AttributeName",
					itemValue: "AttributeType",
				},
				{
					kind: "list",
					label: "Key Schema",
					path: "KeySchema",
					itemLabel: "AttributeName",
					itemValue: "KeyType",
				},
			],
		},
	},
});
