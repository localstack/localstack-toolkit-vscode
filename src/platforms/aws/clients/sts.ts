import {
	GetCallerIdentityCommand,
	GetCallerIdentityCommandOutput,
	STSClient,
	STSClientConfig,
} from "@aws-sdk/client-sts";

import { memoize } from "../../../utils/memoize.ts";
import AWSConfig from "../models/awsConfig.ts";

const cachedGetStsClient = memoize((profile: string) => {
	return new STSClient(AWSConfig.getClientConfig(profile));
});

const cachedGetCallerIdentity = memoize(async (profile: string) => {
	const client = cachedGetStsClient(profile);
	const command = new GetCallerIdentityCommand();
	try {
		const response = await client.send(command);
		if (!response.Account) {
			throw new Error("Failed to fetch account ID from profile");
		}
		return { account: response.Account };
	} catch (ex) {
		console.error(`Failed to access profile: ${profile}`);
		throw ex;
	}
});

/**
 * Accessor functions for the AWS "sts" service
 */
export const STS = {
	/**
	 * Get the caller identity of the specified profile. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	getCallerIdentity(profile: string): Promise<{ account: string }> {
		return cachedGetCallerIdentity(profile);
	},
};
