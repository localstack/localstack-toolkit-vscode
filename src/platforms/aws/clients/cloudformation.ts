import {
	CloudFormationClient,
	DescribeStacksCommand,
	ListStackResourcesCommand,
	ListStacksCommand,
} from "@aws-sdk/client-cloudformation";
import type {
	ListStacksCommandOutput,
	StackResourceSummary,
	StackStatus,
	StackSummary,
} from "@aws-sdk/client-cloudformation";

import { InternalError } from "../../../utils/errors.ts";
import { memoize } from "../../../utils/memoize.ts";
import type ARN from "../models/arnModel.ts";
import AWSConfig from "../models/awsConfig.ts";

/**
 * Accessor functions for the AWS "cloudformation" service
 */
export class CloudFormation {
	private static cachedGetCloudFormationClient = memoize(
		(profile: string, region: string) =>
			new CloudFormationClient(AWSConfig.getClientConfig(profile, region)),
	);

	/**
	 * List the successfully-created stacks of the specified profile — i.e. those
	 * in a stable, resource-bearing state. Stacks that failed, rolled back from a
	 * failed create, or are being deleted are omitted (see the status allowlist
	 * below). If the profile is not valid, reject the promise and let the caller
	 * behave appropriately.
	 */
	public static async listStacks(
		profile: string,
		region: string,
	): Promise<StackSummary[]> {
		const client = CloudFormation.cachedGetCloudFormationClient(
			profile,
			region,
		);

		const stacks: StackSummary[] = [];
		let nextToken: string | undefined;

		/*
		 * Only list stacks that have been successfully provisioned and therefore
		 * have live, inspectable resources. Stacks that never finished creating,
		 * failed, rolled back from a failed create, or are being deleted are
		 * excluded: their resources either don't exist or lack the identifiers
		 * (e.g. PhysicalResourceId) the Resources view relies on, so surfacing
		 * them only yields empty or broken stack views. The retained states are
		 * the stable, resource-bearing terminal states (and their transient
		 * cleanup tails). This will need to be updated if AWS adds new statuses.
		 */
		const createdStatuses: StackStatus[] = [
			"CREATE_COMPLETE",
			"UPDATE_COMPLETE",
			"UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
			"UPDATE_ROLLBACK_COMPLETE",
			"UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
			"IMPORT_COMPLETE",
			"IMPORT_ROLLBACK_COMPLETE",
		];
		do {
			const command = new ListStacksCommand({
				NextToken: nextToken,
				StackStatusFilter: createdStatuses,
			});
			const response: ListStacksCommandOutput = await client.send(command);
			if (response.StackSummaries) {
				stacks.push(...response.StackSummaries);
			}
			nextToken = response.NextToken;
		} while (nextToken);

		return stacks;
	}

	/**
	 * Describe a specific CloudFormation stack.
	 */
	public static async describeStacks(
		profile: string,
		region: string,
		arn: ARN,
	) {
		const client = CloudFormation.cachedGetCloudFormationClient(
			profile,
			region,
		);

		/*
		 * Note: although there might be many 'deleted' stacks with the same name
		 * (with a UUID appended to the ARN), there can only be a single active stack
		 * with a given name.
		 */
		const command = new DescribeStacksCommand({ StackName: arn.resourceName });
		const response = await client.send(command);
		if (response.NextToken) {
			throw new InternalError("NextToken not handled for DescribeStacks call");
		}
		if (response.Stacks && response.Stacks.length > 0) {
			return response.Stacks[0];
		} else {
			throw new InternalError(`No stack found with name: ${arn.resourceName}`);
		}
	}

	/**
	 * Invoke the listStackResources API call.
	 */
	public static async listStackResources(profile: string, arn: ARN) {
		const client = CloudFormation.cachedGetCloudFormationClient(
			profile,
			arn.region,
		);

		const resources: StackResourceSummary[] = [];
		let nextToken: string | undefined;

		do {
			const command: ListStackResourcesCommand = new ListStackResourcesCommand({
				StackName: arn.resourceName,
				NextToken: nextToken,
			});
			const response = await client.send(command);
			if (response.StackResourceSummaries) {
				resources.push(...response.StackResourceSummaries);
			}
			nextToken = response.NextToken;
		} while (nextToken);

		return resources;
	}
}
