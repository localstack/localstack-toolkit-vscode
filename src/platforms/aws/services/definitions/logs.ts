import {
	CloudWatchLogsClient,
	DescribeDestinationsCommand,
	DescribeLogGroupsCommand,
	DescribeLogStreamsCommand,
	DescribeMetricFiltersCommand,
	DescribeSubscriptionFiltersCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type {
	Destination,
	LogGroup,
	LogStream,
	MetricFilter,
	SubscriptionFilter,
} from "@aws-sdk/client-cloudwatch-logs";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * CloudWatch Logs. Log groups, log streams (enumerated across groups), metric
 * filters, subscription filters (enumerated across groups), and destinations.
 * Log groups/streams/destinations carry ARNs; the two filter types do not, so
 * an account-less ARN is synthesized and detail is read from the list item
 * (matched back by identifier — the synthesized ARN is never re-parsed).
 */
export const logsDefinition = defineService<CloudWatchLogsClient>({
	id: "logs",
	name: "CloudWatch Logs",
	client: (config) => new CloudWatchLogsClient(config),
	resourceTypes: {
		loggroup: {
			singular: "Log Group",
			plural: "Log Groups",
			metamodelOp: "describeLogGroups",
			cfn: "AWS::Logs::LogGroup",
			matchArn: (identifier) =>
				identifier.arn.includes(":log-group:") &&
				!identifier.arn.includes(":log-stream:"),
			list: async (client): Promise<LogGroup[]> => {
				const groups: LogGroup[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribeLogGroupsCommand({ nextToken }),
					);
					groups.push(...(out.logGroups ?? []));
					nextToken = out.nextToken;
				} while (nextToken);
				return groups;
			},
			id: (group: LogGroup) => group.arn ?? group.logGroupName ?? "",
			detail: [
				{ label: "Name", path: "logGroupName", type: FieldType.LOG_GROUP },
				{ label: "ARN", path: "arn", type: FieldType.ARN },
				{
					label: "Retention (days)",
					path: "retentionInDays",
					type: FieldType.NUMBER,
				},
				{ label: "Stored Bytes", path: "storedBytes", type: FieldType.NUMBER },
				{
					label: "Metric Filters",
					path: "metricFilterCount",
					type: FieldType.NUMBER,
				},
				{ label: "Creation Time", path: "creationTime", type: FieldType.DATE },
			],
		},
		logstream: {
			singular: "Log Stream",
			plural: "Log Streams",
			metamodelOp: "describeLogStreams",
			matchArn: (identifier) => identifier.arn.includes(":log-stream:"),
			list: async (client): Promise<LogStream[]> => {
				const groupNames = await listLogGroupNames(client);
				const streams: LogStream[] = [];
				for (const logGroupName of groupNames) {
					let nextToken: string | undefined;
					do {
						const out = await client.send(
							new DescribeLogStreamsCommand({ logGroupName, nextToken }),
						);
						streams.push(...(out.logStreams ?? []));
						nextToken = out.nextToken;
					} while (nextToken);
				}
				return streams;
			},
			id: (stream: LogStream) => stream.arn ?? stream.logStreamName ?? "",
			detail: [
				{ label: "Name", path: "logStreamName", type: FieldType.NAME },
				{ label: "ARN", path: "arn", type: FieldType.ARN },
				{ label: "Creation Time", path: "creationTime", type: FieldType.DATE },
				{
					label: "Last Event",
					path: "lastEventTimestamp",
					type: FieldType.DATE,
				},
			],
		},
		metricfilter: {
			singular: "Metric Filter",
			plural: "Metric Filters",
			metamodelOp: "describeMetricFilters",
			cfn: "AWS::Logs::MetricFilter",
			matchArn: (identifier) => identifier.arn.includes(":metric-filter:"),
			list: async (client): Promise<MetricFilter[]> => {
				const filters: MetricFilter[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribeMetricFiltersCommand({ nextToken }),
					);
					filters.push(...(out.metricFilters ?? []));
					nextToken = out.nextToken;
				} while (nextToken);
				return filters;
			},
			id: (filter: MetricFilter, ctx) =>
				`arn:aws:logs:${ctx.region}::metric-filter:${filter.logGroupName}:${filter.filterName}`,
			detail: [
				{ label: "Name", path: "filterName", type: FieldType.NAME },
				{ label: "Log Group", path: "logGroupName", type: FieldType.LOG_GROUP },
				{ label: "Pattern", path: "filterPattern", type: FieldType.SHORT_TEXT },
				{ label: "Creation Time", path: "creationTime", type: FieldType.DATE },
			],
		},
		subscriptionfilter: {
			singular: "Subscription Filter",
			plural: "Subscription Filters",
			metamodelOp: "describeSubscriptionFilters",
			cfn: "AWS::Logs::SubscriptionFilter",
			matchArn: (identifier) =>
				identifier.arn.includes(":subscription-filter:"),
			list: async (client): Promise<SubscriptionFilter[]> => {
				const groupNames = await listLogGroupNames(client);
				const filters: SubscriptionFilter[] = [];
				for (const logGroupName of groupNames) {
					let nextToken: string | undefined;
					do {
						const out = await client.send(
							new DescribeSubscriptionFiltersCommand({
								logGroupName,
								nextToken,
							}),
						);
						filters.push(...(out.subscriptionFilters ?? []));
						nextToken = out.nextToken;
					} while (nextToken);
				}
				return filters;
			},
			id: (filter: SubscriptionFilter, ctx) =>
				`arn:aws:logs:${ctx.region}::subscription-filter:${filter.logGroupName}:${filter.filterName}`,
			detail: [
				{ label: "Name", path: "filterName", type: FieldType.NAME },
				{ label: "Log Group", path: "logGroupName", type: FieldType.LOG_GROUP },
				{ label: "Pattern", path: "filterPattern", type: FieldType.SHORT_TEXT },
				{
					label: "Destination ARN",
					path: "destinationArn",
					type: FieldType.ARN,
				},
				{ label: "Creation Time", path: "creationTime", type: FieldType.DATE },
			],
		},
		destination: {
			singular: "Destination",
			plural: "Destinations",
			metamodelOp: "describeDestinations",
			cfn: "AWS::Logs::Destination",
			matchArn: (identifier) => identifier.arn.includes(":destination:"),
			list: async (client): Promise<Destination[]> => {
				const destinations: Destination[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribeDestinationsCommand({ nextToken }),
					);
					destinations.push(...(out.destinations ?? []));
					nextToken = out.nextToken;
				} while (nextToken);
				return destinations;
			},
			id: (destination: Destination) =>
				destination.arn ?? destination.destinationName ?? "",
			detail: [
				{ label: "Name", path: "destinationName", type: FieldType.NAME },
				{ label: "ARN", path: "arn", type: FieldType.ARN },
				{ label: "Target ARN", path: "targetArn", type: FieldType.ARN },
				{ label: "Role ARN", path: "roleArn", type: FieldType.ARN },
				{ label: "Creation Time", path: "creationTime", type: FieldType.DATE },
			],
		},
	},
});

/** Enumerate every log group name (for resource types scoped to a group). */
async function listLogGroupNames(
	client: CloudWatchLogsClient,
): Promise<string[]> {
	const names: string[] = [];
	let nextToken: string | undefined;
	do {
		const out = await client.send(new DescribeLogGroupsCommand({ nextToken }));
		names.push(
			...(out.logGroups ?? [])
				.map((group) => group.logGroupName)
				.filter((name): name is string => Boolean(name)),
		);
		nextToken = out.nextToken;
	} while (nextToken);
	return names;
}
