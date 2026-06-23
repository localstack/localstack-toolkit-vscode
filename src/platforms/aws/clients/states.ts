import {
	DescribeActivityCommand,
	DescribeStateMachineCommand,
	ListActivitiesCommand,
	ListStateMachinesCommand,
	SFNClient,
} from "@aws-sdk/client-sfn";
import type {
	ActivityListItem,
	DescribeActivityCommandOutput,
	DescribeStateMachineCommandOutput,
	ListActivitiesCommandOutput,
	ListStateMachinesCommandOutput,
	StateMachineListItem,
} from "@aws-sdk/client-sfn";

import { memoize } from "../../../utils/memoize.ts";
import AWSConfig from "../models/awsConfig.ts";

const cachedGetStatesClient = memoize((profile: string, region: string) => {
	return new SFNClient(AWSConfig.getClientConfig(profile, region));
});

/**
 * Accessor functions for the AWS "states" (Step Functions) service
 */
export const States = {
	/**
	 * List the state machines in the specified profile/region. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async listStateMachines(
		profile: string,
		region: string,
	): Promise<StateMachineListItem[]> {
		const client = cachedGetStatesClient(profile, region);

		const stateMachines: StateMachineListItem[] = [];
		let nextToken: string | undefined;
		do {
			const command = new ListStateMachinesCommand({ nextToken });
			const response: ListStateMachinesCommandOutput =
				await client.send(command);
			if (response.stateMachines) {
				stateMachines.push(...response.stateMachines);
			}
			nextToken = response.nextToken;
		} while (nextToken);

		return stateMachines;
	},

	/**
	 * Describe the state machine with the specified ARN. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async describeStateMachine(
		profile: string,
		region: string,
		arn: string,
	): Promise<DescribeStateMachineCommandOutput> {
		const client = cachedGetStatesClient(profile, region);
		const command = new DescribeStateMachineCommand({ stateMachineArn: arn });
		return await client.send(command);
	},

	/**
	 * List the activities of the specified profile. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async listActivities(
		profile: string,
		region: string,
	): Promise<ActivityListItem[]> {
		const client = cachedGetStatesClient(profile, region);

		const activities: ActivityListItem[] = [];
		let nextToken: string | undefined;

		do {
			const command = new ListActivitiesCommand({ nextToken });
			const response: ListActivitiesCommandOutput = await client.send(command);
			if (response.activities) {
				activities.push(...response.activities);
			}
			nextToken = response.nextToken;
		} while (nextToken);

		return activities;
	},

	/**
	 * Describe an activity in the specified profile/region. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async describeActivity(
		profile: string,
		region: string,
		arn: string,
	): Promise<DescribeActivityCommandOutput> {
		const client = cachedGetStatesClient(profile, region);

		const command = new DescribeActivityCommand({ activityArn: arn });
		return await client.send(command);
	},
};
