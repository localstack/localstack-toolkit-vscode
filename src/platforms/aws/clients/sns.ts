import {
	GetTopicAttributesCommand,
	ListTopicsCommand,
	SNSClient,
} from "@aws-sdk/client-sns";
import type {
	GetTopicAttributesCommandOutput,
	ListTopicsCommandOutput,
	Topic,
} from "@aws-sdk/client-sns";

import { memoize } from "../../../utils/memoize.ts";
import AWSConfig from "../models/awsConfig.ts";

const cachedGetSnsClient = memoize((profile: string, region: string) => {
	return new SNSClient(AWSConfig.getClientConfig(profile, region));
});

/**
 * Accessor functions for the AWS "SNS" (Simple Notification Service) service
 */
export const Sns = {
	/**
	 * List the SNS topics in the specified profile/region. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async listTopics(profile: string, region: string): Promise<Topic[]> {
		const client = cachedGetSnsClient(profile, region);

		const topics: Topic[] = [];
		let nextToken: string | undefined;
		do {
			const command = new ListTopicsCommand({ NextToken: nextToken });
			const response: ListTopicsCommandOutput = await client.send(command);
			if (response.Topics) {
				topics.push(...response.Topics);
			}
			nextToken = response.NextToken;
		} while (nextToken);

		return topics;
	},

	/**
	 * Get the attributes of an SNS topic.
	 */
	getTopicAttributes(
		profile: string,
		region: string,
		topicArn: string,
	): Promise<GetTopicAttributesCommandOutput> {
		const client = cachedGetSnsClient(profile, region);
		const command = new GetTopicAttributesCommand({ TopicArn: topicArn });
		return client.send(command);
	},
};
