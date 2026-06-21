import {
	GetTopicAttributesCommand,
	ListTopicsCommand,
	SNSClient,
} from "@aws-sdk/client-sns";
import type { ListTopicsCommandOutput, Topic } from "@aws-sdk/client-sns";

import { memoize } from "../../../utils/memoize.ts";

/**
 * Accessor functions for the AWS "SNS" (Simple Notification Service) service
 */
export class Sns {
	private static cachedGetSnsClient = memoize(
		(profile: string, region: string) => {
			return new SNSClient({ profile, region });
		},
	);

	/**
	 * List the SNS topics in the specified profile/region. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	public static async listTopics(
		profile: string,
		region: string,
	): Promise<Topic[]> {
		const client = Sns.cachedGetSnsClient(profile, region);

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
	}

	/**
	 * Get the attributes of an SNS topic.
	 */
	public static getTopicAttributes(
		profile: string,
		region: string,
		topicArn: string,
	): Promise<any> {
		const client = Sns.cachedGetSnsClient(profile, region);
		const command = new GetTopicAttributesCommand({ TopicArn: topicArn });
		return client.send(command);
	}
}
