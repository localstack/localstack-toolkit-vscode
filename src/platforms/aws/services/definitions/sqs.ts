import {
	GetQueueAttributesCommand,
	GetQueueUrlCommand,
	ListQueuesCommand,
	SQSClient,
} from "@aws-sdk/client-sqs";

import { InternalError } from "../../../../utils/errors.ts";
import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * SQS. Queues only. SQS does not use standard ARNs for querying, so `list`
 * resolves each queue URL to its ARN via `GetQueueAttributes`, and `describe`
 * converts the ARN back to a URL via `GetQueueUrl` before reading attributes.
 * The two timestamps come back as epoch-second strings; they are coerced to
 * numbers so the `DATE` formatter renders them as ISO dates.
 */
export const sqsDefinition = defineService<SQSClient>({
	id: "sqs",
	name: "SQS",
	client: (config) => new SQSClient(config),
	resourceTypes: {
		queue: {
			singular: "Queue",
			plural: "Queues",
			cfn: "AWS::SQS::Queue",
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId?.split("/").pop(),
			list: async (client): Promise<string[]> => {
				const urls: string[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListQueuesCommand({ NextToken: nextToken }),
					);
					urls.push(...(out.QueueUrls ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				/* The list API returns URLs; resolve each to its ARN (correct across
				 * non-standard partitions). */
				return Promise.all(
					urls.map(async (url) => {
						const attrs = await client.send(
							new GetQueueAttributesCommand({
								QueueUrl: url,
								AttributeNames: ["QueueArn"],
							}),
						);
						const queueArn = attrs.Attributes?.QueueArn;
						if (!queueArn) {
							throw new InternalError(
								`Failed to resolve ARN for SQS queue: ${url}`,
							);
						}
						return queueArn;
					}),
				);
			},
			id: (arn: string) => arn,
			describe: async (client, identifier) => {
				const urlOut = await client.send(
					new GetQueueUrlCommand({ QueueName: identifier.resourceName }),
				);
				const queueUrl = urlOut.QueueUrl;
				if (!queueUrl) {
					throw new InternalError(
						`Failed to resolve URL for SQS queue: ${identifier.resourceName}`,
					);
				}
				const out = await client.send(
					new GetQueueAttributesCommand({
						QueueUrl: queueUrl,
						AttributeNames: ["All"],
					}),
				);
				const attrs = out.Attributes ?? {};
				return {
					Name: identifier.resourceName,
					...attrs,
					CreatedTimestamp: attrs.CreatedTimestamp
						? Number(attrs.CreatedTimestamp)
						: undefined,
					LastModifiedTimestamp: attrs.LastModifiedTimestamp
						? Number(attrs.LastModifiedTimestamp)
						: undefined,
				};
			},
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{
					label: "Visibility Timeout",
					path: "VisibilityTimeout",
					type: FieldType.NUMBER,
				},
				{
					label: "Maximum Message Size",
					path: "MaximumMessageSize",
					type: FieldType.NUMBER,
				},
				{
					label: "Message Retention Period",
					path: "MessageRetentionPeriod",
					type: FieldType.NUMBER,
				},
				{
					label: "Delay Seconds",
					path: "DelaySeconds",
					type: FieldType.NUMBER,
				},
				{
					label: "Receive Message Wait Time Seconds",
					path: "ReceiveMessageWaitTimeSeconds",
					type: FieldType.NUMBER,
				},
				{
					label: "SQS Managed SSE Enabled",
					path: "SqsManagedSseEnabled",
					type: FieldType.NAME,
				},
				{
					label: "Approximate Number of Messages",
					path: "ApproximateNumberOfMessages",
					type: FieldType.NUMBER,
				},
				{
					label: "Approximate Number of Messages Delayed",
					path: "ApproximateNumberOfMessagesDelayed",
					type: FieldType.NUMBER,
				},
				{
					label: "Approximate Number of Messages Not Visible",
					path: "ApproximateNumberOfMessagesNotVisible",
					type: FieldType.NUMBER,
				},
				{
					label: "Created Timestamp",
					path: "CreatedTimestamp",
					type: FieldType.DATE,
				},
				{
					label: "Last Modified Timestamp",
					path: "LastModifiedTimestamp",
					type: FieldType.DATE,
				},
			],
		},
	},
});
