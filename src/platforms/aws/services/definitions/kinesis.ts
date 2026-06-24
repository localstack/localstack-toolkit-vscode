import {
	DescribeStreamConsumerCommand,
	DescribeStreamSummaryCommand,
	KinesisClient,
	ListStreamConsumersCommand,
	ListStreamsCommand,
} from "@aws-sdk/client-kinesis";
import type { Consumer, StreamSummary } from "@aws-sdk/client-kinesis";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * Kinesis Data Streams. Streams plus their registered (enhanced fan-out)
 * consumers. Consumers are listed region-wide by iterating every stream; their
 * ARNs are nested under the stream ARN, so a predicate distinguishes the two
 * types (both share the `stream/` resource token).
 */
export const kinesisDefinition = defineService<KinesisClient>({
	id: "kinesis",
	name: "Kinesis",
	client: (config) => new KinesisClient(config),
	resourceTypes: {
		stream: {
			singular: "Stream",
			plural: "Streams",
			metamodelOp: "listStreams",
			cfn: "AWS::Kinesis::Stream",
			matchArn: (identifier) => !identifier.arn.includes("/consumer/"),
			list: async (client): Promise<StreamSummary[]> => {
				const summaries: StreamSummary[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListStreamsCommand({ NextToken: nextToken }),
					);
					summaries.push(...(out.StreamSummaries ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return summaries;
			},
			id: (stream: StreamSummary) => stream.StreamARN ?? "",
			describe: (client, identifier) =>
				client.send(
					new DescribeStreamSummaryCommand({
						StreamName: identifier.resourceName,
					}),
				),
			detail: [
				{
					label: "Name",
					path: "StreamDescriptionSummary.StreamName",
					type: FieldType.NAME,
				},
				{
					label: "ARN",
					path: "StreamDescriptionSummary.StreamARN",
					type: FieldType.ARN,
				},
				{
					label: "Status",
					path: "StreamDescriptionSummary.StreamStatus",
					type: FieldType.NAME,
				},
				{
					label: "Retention (hours)",
					path: "StreamDescriptionSummary.RetentionPeriodHours",
					type: FieldType.NUMBER,
				},
				{
					label: "Open Shards",
					path: "StreamDescriptionSummary.OpenShardCount",
					type: FieldType.NUMBER,
				},
				{
					label: "Creation Time",
					path: "StreamDescriptionSummary.StreamCreationTimestamp",
					type: FieldType.DATE,
				},
			],
		},
		streamconsumer: {
			singular: "Stream Consumer",
			plural: "Stream Consumers",
			metamodelOp: "listStreamConsumers",
			cfn: "AWS::Kinesis::StreamConsumer",
			matchArn: (identifier) => identifier.arn.includes("/consumer/"),
			list: async (client): Promise<Consumer[]> => {
				/* Consumers are scoped to a stream; enumerate streams, then their
				 * consumers, and present the result as a flat, region-wide list. */
				const streamArns: string[] = [];
				let streamToken: string | undefined;
				do {
					const out = await client.send(
						new ListStreamsCommand({ NextToken: streamToken }),
					);
					streamArns.push(
						...(out.StreamSummaries ?? [])
							.map((summary) => summary.StreamARN)
							.filter((arn): arn is string => Boolean(arn)),
					);
					streamToken = out.NextToken;
				} while (streamToken);

				const consumers: Consumer[] = [];
				for (const streamArn of streamArns) {
					let nextToken: string | undefined;
					do {
						const out = await client.send(
							new ListStreamConsumersCommand({
								StreamARN: streamArn,
								NextToken: nextToken,
							}),
						);
						consumers.push(...(out.Consumers ?? []));
						nextToken = out.NextToken;
					} while (nextToken);
				}
				return consumers;
			},
			id: (consumer: Consumer) => consumer.ConsumerARN ?? "",
			describe: (client, identifier) =>
				client.send(
					new DescribeStreamConsumerCommand({ ConsumerARN: identifier.arn }),
				),
			detail: [
				{
					label: "Name",
					path: "ConsumerDescription.ConsumerName",
					type: FieldType.NAME,
				},
				{
					label: "ARN",
					path: "ConsumerDescription.ConsumerARN",
					type: FieldType.ARN,
				},
				{
					label: "Status",
					path: "ConsumerDescription.ConsumerStatus",
					type: FieldType.NAME,
				},
				{
					label: "Stream ARN",
					path: "ConsumerDescription.StreamARN",
					type: FieldType.ARN,
				},
				{
					label: "Creation Time",
					path: "ConsumerDescription.ConsumerCreationTimestamp",
					type: FieldType.DATE,
				},
			],
		},
	},
});
