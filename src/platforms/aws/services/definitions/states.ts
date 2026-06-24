import {
	DescribeStateMachineCommand,
	ListActivitiesCommand,
	ListStateMachinesCommand,
	SFNClient,
} from "@aws-sdk/client-sfn";
import type {
	ActivityListItem,
	StateMachineListItem,
} from "@aws-sdk/client-sfn";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * Step Functions (service code `states`). Activities self-describe from their
 * list item; state machines are described via `DescribeStateMachine`, whose
 * optional logging/tracing config is flattened into display strings. The state
 * machine ARN's resource token is `stateMachine`, matched case-insensitively to
 * the `statemachine` resource-type id. No CloudFormation mapping (parity with
 * the previous provider, which did not support it).
 */
export const statesDefinition = defineService<SFNClient>({
	id: "states",
	name: "Step Functions",
	client: (config) => new SFNClient(config),
	resourceTypes: {
		activity: {
			singular: "Activity",
			plural: "Activities",
			metamodelOp: "listActivities",
			list: async (client): Promise<ActivityListItem[]> => {
				const activities: ActivityListItem[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListActivitiesCommand({ nextToken }),
					);
					activities.push(...(out.activities ?? []));
					nextToken = out.nextToken;
				} while (nextToken);
				return activities;
			},
			id: (activity: ActivityListItem) => activity.activityArn ?? "",
			/* Self-describe: the list item carries name + creationDate. */
			detail: [
				{ label: "Name", path: "name", type: FieldType.NAME },
				{ label: "Creation Date", path: "creationDate", type: FieldType.DATE },
			],
		},
		statemachine: {
			singular: "State Machine",
			plural: "State Machines",
			metamodelOp: "listStateMachines",
			list: async (client): Promise<StateMachineListItem[]> => {
				const machines: StateMachineListItem[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListStateMachinesCommand({ nextToken }),
					);
					machines.push(...(out.stateMachines ?? []));
					nextToken = out.nextToken;
				} while (nextToken);
				return machines;
			},
			id: (machine: StateMachineListItem) => machine.stateMachineArn ?? "",
			describe: async (client, identifier) => {
				const details = await client.send(
					new DescribeStateMachineCommand({ stateMachineArn: identifier.arn }),
				);
				const destination = details.loggingConfiguration?.destinations?.[0];
				return {
					...details,
					LogGroupArn:
						destination?.cloudWatchLogsLogGroup?.logGroupArn ?? "None",
					LogExecutionDataText: details.loggingConfiguration
						?.includeExecutionData
						? "Yes"
						: "No",
					TracingText: details.tracingConfiguration?.enabled
						? "Enabled"
						: "Disabled",
				};
			},
			detail: [
				{ label: "Name", path: "name", type: FieldType.NAME },
				{
					label: "Description",
					path: "description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "State Machine Type", path: "type", type: FieldType.NAME },
				{ label: "Status", path: "status", type: FieldType.NAME },
				{ label: "Creation Date", path: "creationDate", type: FieldType.DATE },
				{ label: "Role ARN", path: "roleArn", type: FieldType.ARN },
				{ label: "Definition", path: "definition", type: FieldType.JSON },
				{ label: "Log Group", path: "LogGroupArn", type: FieldType.ARN },
				{
					label: "Log Execution Data",
					path: "LogExecutionDataText",
					type: FieldType.NAME,
				},
				{
					label: "Log Level",
					path: "loggingConfiguration.level",
					type: FieldType.NAME,
				},
				{ label: "Tracing", path: "TracingText", type: FieldType.NAME },
			],
		},
	},
});
