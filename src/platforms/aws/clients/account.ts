import {
	AccountClient,
	AccountClientConfig,
	ListRegionsCommand,
	RegionOptStatus,
} from "@aws-sdk/client-account";
import type { ListRegionsCommandInput } from "@aws-sdk/client-account";

import { memoize } from "../../../utils/memoize.ts";
import AWSConfig from "../models/awsConfig.ts";

const cachedGetAccountClient = memoize(
	(profile: string) => new AccountClient(AWSConfig.getClientConfig(profile)),
);

const cachedListRegions = memoize(async (profile: string) => {
	const client = cachedGetAccountClient(profile);

	const request: ListRegionsCommandInput = {
		RegionOptStatusContains: [
			RegionOptStatus.ENABLED_BY_DEFAULT,
			RegionOptStatus.ENABLED,
		],
	};
	const RegionNames: string[] = [];

	while (true) {
		const response = await client.send(new ListRegionsCommand(request));
		if (response.Regions) {
			RegionNames.push(
				...response.Regions.flatMap((region) =>
					region.RegionName ? [region.RegionName] : [],
				),
			);
		}
		if (!response.NextToken) {
			break;
		}
		request.NextToken = response.NextToken;
	}
	return RegionNames;
});

/**
 * Accessor functions for the AWS "account" service
 */
export const Account = {
	/**
	 * Return the list of AWS regions available for this profile. For example:
	 *    ['ap-southeast-2', 'us-east-1', 'us-west-2']
	 */
	listRegions(profile: string): Promise<string[]> {
		return cachedListRegions(profile);
	},
};
