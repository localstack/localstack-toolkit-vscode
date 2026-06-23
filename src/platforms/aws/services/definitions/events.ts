import {
	DescribeArchiveCommand,
	EventBridgeClient,
	ListApiDestinationsCommand,
	ListArchivesCommand,
	ListConnectionsCommand,
	ListEventBusesCommand,
	ListRulesCommand,
} from "@aws-sdk/client-eventbridge";
import type {
	ApiDestination,
	Archive,
	Connection,
	EventBus,
	Rule,
} from "@aws-sdk/client-eventbridge";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * EventBridge. Event buses, rules (enumerated across every bus), API
 * destinations, connections, and archives. Most detail is read from the list
 * item; archives have no ARN in their list response, so an account-less ARN is
 * synthesized from the region to keep them addressable.
 */
export const eventsDefinition = defineService<EventBridgeClient>({
	id: "events",
	name: "EventBridge",
	client: (config) => new EventBridgeClient(config),
	resourceTypes: {
		eventbus: {
			singular: "Event Bus",
			plural: "Event Buses",
			cfn: "AWS::Events::EventBus",
			matchArn: (identifier) => identifier.arn.includes(":event-bus/"),
			list: async (client): Promise<EventBus[]> => {
				const buses: EventBus[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListEventBusesCommand({ NextToken: nextToken }),
					);
					buses.push(...(out.EventBuses ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return buses;
			},
			id: (bus: EventBus) => bus.Arn ?? bus.Name ?? "",
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "ARN", path: "Arn", type: FieldType.ARN },
				{ label: "Policy", path: "Policy", type: FieldType.JSON },
			],
		},
		rule: {
			singular: "Rule",
			plural: "Rules",
			cfn: "AWS::Events::Rule",
			matchArn: (identifier) => identifier.arn.includes(":rule/"),
			list: async (client): Promise<Rule[]> => {
				/* Rules belong to an event bus; enumerate buses, then their rules. */
				const busNames: string[] = [];
				let busToken: string | undefined;
				do {
					const out = await client.send(
						new ListEventBusesCommand({ NextToken: busToken }),
					);
					busNames.push(
						...(out.EventBuses ?? [])
							.map((bus) => bus.Name)
							.filter((name): name is string => Boolean(name)),
					);
					busToken = out.NextToken;
				} while (busToken);

				const rules: Rule[] = [];
				for (const busName of busNames) {
					let nextToken: string | undefined;
					do {
						const out = await client.send(
							new ListRulesCommand({
								EventBusName: busName,
								NextToken: nextToken,
							}),
						);
						rules.push(...(out.Rules ?? []));
						nextToken = out.NextToken;
					} while (nextToken);
				}
				return rules;
			},
			id: (rule: Rule) => rule.Arn ?? rule.Name ?? "",
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "ARN", path: "Arn", type: FieldType.ARN },
				{ label: "State", path: "State", type: FieldType.NAME },
				{
					label: "Description",
					path: "Description",
					type: FieldType.SHORT_TEXT,
				},
				{
					label: "Schedule",
					path: "ScheduleExpression",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Event Bus", path: "EventBusName", type: FieldType.NAME },
			],
		},
		apidestination: {
			singular: "API Destination",
			plural: "API Destinations",
			cfn: "AWS::Events::ApiDestination",
			matchArn: (identifier) => identifier.arn.includes(":api-destination/"),
			list: async (client): Promise<ApiDestination[]> => {
				const destinations: ApiDestination[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListApiDestinationsCommand({ NextToken: nextToken }),
					);
					destinations.push(...(out.ApiDestinations ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return destinations;
			},
			id: (destination: ApiDestination) =>
				destination.ApiDestinationArn ?? destination.Name ?? "",
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "ARN", path: "ApiDestinationArn", type: FieldType.ARN },
				{ label: "State", path: "ApiDestinationState", type: FieldType.NAME },
				{
					label: "Endpoint",
					path: "InvocationEndpoint",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "HTTP Method", path: "HttpMethod", type: FieldType.NAME },
				{ label: "Creation Time", path: "CreationTime", type: FieldType.DATE },
			],
		},
		connection: {
			singular: "Connection",
			plural: "Connections",
			cfn: "AWS::Events::Connection",
			matchArn: (identifier) => identifier.arn.includes(":connection/"),
			list: async (client): Promise<Connection[]> => {
				const connections: Connection[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListConnectionsCommand({ NextToken: nextToken }),
					);
					connections.push(...(out.Connections ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return connections;
			},
			id: (connection: Connection) =>
				connection.ConnectionArn ?? connection.Name ?? "",
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "ARN", path: "ConnectionArn", type: FieldType.ARN },
				{ label: "State", path: "ConnectionState", type: FieldType.NAME },
				{
					label: "Authorization",
					path: "AuthorizationType",
					type: FieldType.NAME,
				},
				{ label: "Creation Time", path: "CreationTime", type: FieldType.DATE },
			],
		},
		archive: {
			singular: "Archive",
			plural: "Archives",
			cfn: "AWS::Events::Archive",
			matchArn: (identifier) => identifier.arn.includes(":archive/"),
			list: async (client): Promise<Archive[]> => {
				const archives: Archive[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListArchivesCommand({ NextToken: nextToken }),
					);
					archives.push(...(out.Archives ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return archives;
			},
			/* ListArchives omits an ARN; synthesize an account-less one from region. */
			id: (archive: Archive, ctx) =>
				`arn:aws:events:${ctx.region}::archive/${archive.ArchiveName}`,
			describe: (client, identifier) =>
				client.send(
					new DescribeArchiveCommand({ ArchiveName: identifier.resourceName }),
				),
			detail: [
				{ label: "Name", path: "ArchiveName", type: FieldType.NAME },
				{ label: "State", path: "State", type: FieldType.NAME },
				{
					label: "Event Source ARN",
					path: "EventSourceArn",
					type: FieldType.ARN,
				},
				{
					label: "Retention (days)",
					path: "RetentionDays",
					type: FieldType.NUMBER,
				},
				{ label: "Event Count", path: "EventCount", type: FieldType.NUMBER },
				{ label: "Creation Time", path: "CreationTime", type: FieldType.DATE },
			],
		},
	},
});
