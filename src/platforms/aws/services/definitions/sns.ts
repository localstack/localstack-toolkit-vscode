import {
	GetTopicAttributesCommand,
	ListTopicsCommand,
	SNSClient,
} from "@aws-sdk/client-sns";
import type { Topic } from "@aws-sdk/client-sns";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * SNS. Topics only; the topic name is not a distinct ARN segment, so the detail
 * name is taken from the ARN's resource name and the rest from the topic's
 * attributes (`GetTopicAttributes`).
 */
export const snsDefinition = defineService<SNSClient>({
	id: "sns",
	name: "SNS",
	client: (config) => new SNSClient(config),
	resourceTypes: {
		topic: {
			singular: "Topic",
			plural: "Topics",
			list: async (client): Promise<Topic[]> => {
				const topics: Topic[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListTopicsCommand({ NextToken: nextToken }),
					);
					topics.push(...(out.Topics ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return topics;
			},
			id: (topic: Topic) => topic.TopicArn ?? "",
			describe: async (client, identifier) => {
				const out = await client.send(
					new GetTopicAttributesCommand({ TopicArn: identifier.arn }),
				);
				return { Name: identifier.resourceName, ...(out.Attributes ?? {}) };
			},
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "Display Name", path: "DisplayName", type: FieldType.NAME },
				{
					label: "Subscriptions Confirmed",
					path: "SubscriptionsConfirmed",
					type: FieldType.NUMBER,
				},
				{
					label: "Subscriptions Pending",
					path: "SubscriptionsPending",
					type: FieldType.NUMBER,
				},
				{
					label: "Subscriptions Deleted",
					path: "SubscriptionsDeleted",
					type: FieldType.NUMBER,
				},
				{ label: "Policy", path: "Policy", type: FieldType.JSON },
				{
					label: "Effective Delivery Policy",
					path: "EffectiveDeliveryPolicy",
					type: FieldType.JSON,
				},
			],
		},
	},
});
