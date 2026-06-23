import {
	GetQueueAttributesCommand,
	GetQueueUrlCommand,
	ListQueuesCommand,
	SQSClient,
} from "@aws-sdk/client-sqs";
import type {
	GetQueueAttributesCommandOutput,
	ListQueuesCommandOutput,
} from "@aws-sdk/client-sqs";

import { memoize } from "../../../utils/memoize.ts";
import type ARN from "../models/arnModel.ts";
import AWSConfig from "../models/awsConfig.ts";

const cachedGetSqsClient = memoize((profile: string, region: string) => {
	return new SQSClient(AWSConfig.getClientConfig(profile, region));
});

/**
 * Accessor functions for the AWS "SQS" (Simple Queue Service) service
 */
export const Sqs = {
	/**
	 * List the SQS queues in the specified profile/region. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async listQueues(profile: string, region: string): Promise<string[]> {
		const client = cachedGetSqsClient(profile, region);

		const queueUrls: string[] = [];
		let nextToken: string | undefined;
		do {
			const command = new ListQueuesCommand({ NextToken: nextToken });
			const response: ListQueuesCommandOutput = await client.send(command);
			if (response.QueueUrls) {
				queueUrls.push(...response.QueueUrls);
			}
			nextToken = response.NextToken;
		} while (nextToken);

		/*
		 * Iterate through the queueURLs and call getQueueAttributes to fetch the corresponding ARN.
		 * This is not a very scalable solution, but it does ensure we get the ARN correct (including
		 * for non-standard AWS partitions)
		 */
		const queueArns = await Promise.all(
			queueUrls.map(async (url) => {
				const command = new GetQueueAttributesCommand({
					QueueUrl: url,
					AttributeNames: ["QueueArn"],
				});
				const attributes = await client.send(command);
				const queueArn = attributes.Attributes?.QueueArn;
				if (!queueArn) {
					throw new Error(`Failed to resolve ARN for SQS queue: ${url}`);
				}
				return queueArn;
			}),
		);

		return queueArns;
	},

	/**
	 * Get the all attributes of an SQS queue.
	 */
	async getQueueAttributes(
		profile: string,
		region: string,
		queueArn: ARN,
	): Promise<GetQueueAttributesCommandOutput["Attributes"]> {
		const client = cachedGetSqsClient(profile, region);

		/*
		 * Convert the ARN to a queue URL by calling getQueueUrl. This is necessary because SQS doesn't use
		 * standard ARN formats for querying resources.
		 */
		const getUrlCommand = new GetQueueUrlCommand({
			QueueName: queueArn.resourceName,
		});
		const { QueueUrl: queueUrl } = await client.send(getUrlCommand);
		if (!queueUrl) {
			throw new Error(
				`Failed to resolve URL for SQS queue: ${queueArn.resourceName}`,
			);
		}

		const command = new GetQueueAttributesCommand({
			QueueUrl: queueUrl,
			AttributeNames: ["All"],
		});
		return (await client.send(command)).Attributes;
	},
};
