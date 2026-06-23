import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";
import {
	SFNClient,
	ListActivitiesCommand,
	ListStateMachinesCommand,
} from "@aws-sdk/client-sfn";

import { States } from "../../clients/states.ts";
import type ARN from "../../models/arnModel.ts";
import {
	FieldType,
	ServiceProvider,
	ServiceResourceArnTuple,
} from "../serviceProvider.ts";

export class StatesServiceProvider extends ServiceProvider {
	public async getResourceArns(
		profile: string,
		region: string,
		resourceType: string,
	): Promise<string[]> {
		if (resourceType === "activity") {
			return (await States.listActivities(profile, region)).map(
				(activity) => activity.activityArn!,
			);
		} else if (resourceType === "statemachine") {
			return (await States.listStateMachines(profile, region)).map(
				(stateMachine) => stateMachine.stateMachineArn!,
			);
		} else {
			throw new Error(`Unknown resource type: ${resourceType}`);
		}
	}

	public async describeResource(
		profile: string,
		arn: ARN,
	): Promise<{ field: string; value: string; type: FieldType }[]> {
		/* determine if this is an activity or a state machine */
		const resourceType = arn.resourceType?.toLowerCase();
		if (resourceType === "activity") {
			const details = await States.describeActivity(
				profile,
				arn.region,
				arn.arn,
			);
			return [
				{ field: "Resource Type", value: "Activity", type: FieldType.NAME },
				{ field: "Name", value: details.name!, type: FieldType.NAME },
				{
					field: "Creation Date",
					value: details.creationDate?.toISOString() || "",
					type: FieldType.DATE,
				},
			];
		} else if (resourceType === "statemachine") {
			const details = await States.describeStateMachine(
				profile,
				arn.region,
				arn.arn,
			);
			const loggingDestination = details.loggingConfiguration?.destinations
				? details.loggingConfiguration.destinations[0]
				: undefined;
			return [
				{
					field: "Resource Type",
					value: "State Machine",
					type: FieldType.NAME,
				},
				{ field: "Name", value: details.name!, type: FieldType.NAME },
				{
					field: "Description",
					value: details.description || "",
					type: FieldType.SHORT_TEXT,
				},
				{
					field: "State Machine Type",
					value: details.type!,
					type: FieldType.NAME,
				},
				{ field: "Status", value: details.status!, type: FieldType.NAME },
				{
					field: "Creation Date",
					value: details.creationDate?.toISOString() || "",
					type: FieldType.DATE,
				},
				{
					field: "Role ARN",
					value: details.roleArn || "",
					type: FieldType.ARN,
				},
				{
					field: "Definition",
					value: details.definition || "",
					type: FieldType.JSON,
				},
				{
					field: "Log Group",
					value: loggingDestination?.cloudWatchLogsLogGroup?.logGroupArn
						? loggingDestination.cloudWatchLogsLogGroup.logGroupArn
						: "None",
					type: FieldType.ARN,
				},
				{
					field: "Log Execution Data",
					value: details.loggingConfiguration?.includeExecutionData
						? "Yes"
						: "No",
					type: FieldType.NAME,
				},
				{
					field: "Log Level",
					value: details.loggingConfiguration?.level || "N/A",
					type: FieldType.NAME,
				},
				{
					field: "Tracing",
					value: details.tracingConfiguration?.enabled ? "Enabled" : "Disabled",
					type: FieldType.NAME,
				},
			];
		} else {
			throw new Error(`Unknown resource type for ARN: ${arn.toString()}`);
		}
	}

	public getArnResourceNameForCloudFormationResource(
		stackResourceSummary: StackResourceSummary,
	): { resourceType: string; resourceName: string } {
		throw new Error(
			`Unsupported Step Functions resource type: ${stackResourceSummary.ResourceType}`,
		);
	}

	protected resourceTypes: Record<string, [string, string]> = {
		activity: ["Activity", "Activities"],
		statemachine: ["State Machine", "State Machines"],
	};

	public override getMetamodelOperationMap(): Map<string, string> {
		return new Map([
			["listActivities", "activity"],
			["listStateMachines", "statemachine"],
		]);
	}

	public getId(): string {
		return "states";
	}

	public getName(): string {
		return "Step Functions";
	}
}
