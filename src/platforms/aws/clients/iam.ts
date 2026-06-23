import {
	GetRoleCommand,
	IAMClient,
	IAMClientConfig,
	ListAccountAliasesCommand,
	ListRolesCommand,
} from "@aws-sdk/client-iam";
import type { GetRoleCommandOutput } from "@aws-sdk/client-iam";

import { memoize } from "../../../utils/memoize.ts";
import type ARN from "../models/arnModel.ts";
import AWSConfig from "../models/awsConfig.ts";

const cachedGetIamClient = memoize(
	(profile: string) => new IAMClient(AWSConfig.getClientConfig(profile)),
);

const cachedGetAccountAlias = memoize(async (profile: string) => {
	const client = cachedGetIamClient(profile);
	const command = new ListAccountAliasesCommand();
	try {
		const response = await client.send(command);
		if (response.AccountAliases && response.AccountAliases.length > 0) {
			return response.AccountAliases[0];
		} else {
			return "";
		}
	} catch (ex) {
		console.error(`Failed to access account aliases for: ${profile}`);
		throw ex;
	}
});

/**
 * Accessor functions for the AWS "iam" service
 */
export const IAM = {
	/**
	 * Get the account alias of the specified profile. If the profile is not valid,
	 * return undefined and let the caller behave appropriately. Note that only
	 * the first account alias is returned.
	 */
	getAccountAlias(profile: string): Promise<string> {
		return cachedGetAccountAlias(profile);
	},

	/**
	 * List the IAM Roles in the specified profile. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	async listRoles(profile: string): Promise<string[]> {
		const client = cachedGetIamClient(profile);

		const roles: string[] = [];
		let marker: string | undefined;
		do {
			const command: ListRolesCommand = new ListRolesCommand({
				Marker: marker,
			});
			const response = await client.send(command);
			if (response.Roles) {
				roles.push(
					...response.Roles.flatMap((role) => (role.Arn ? [role.Arn] : [])),
				);
			}
			marker = response.Marker;
		} while (marker);
		return roles;
	},

	/**
	 * Get details about a specific IAM role.
	 */
	async getRole(profile: string, roleArn: ARN): Promise<GetRoleCommandOutput> {
		const client = cachedGetIamClient(profile);

		/* Role names can be path-qualified, so we need to extract just the name part */
		let roleName = roleArn.resourceName ?? "";
		const lastSlash = roleName.lastIndexOf("/");
		if (lastSlash !== -1) {
			roleName = roleName.substring(lastSlash + 1);
		}

		const command = new GetRoleCommand({ RoleName: roleName });
		return await client.send(command);
	},
};
