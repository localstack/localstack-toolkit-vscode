import {
	CognitoIdentityProviderClient,
	DescribeUserPoolCommand,
	ListGroupsCommand,
	ListUserPoolClientsCommand,
	ListUserPoolsCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
	GroupType,
	UserPoolClientDescription,
	UserPoolDescriptionType,
} from "@aws-sdk/client-cognito-identity-provider";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * Cognito User Pools (the `cognito-idp` service code). User pools plus their
 * app clients and groups, enumerated across pools and presented flat. None of
 * these list responses carry ARNs, so account-less ARNs are synthesized from
 * the region; client/group detail is read from the list item.
 *
 * Note: identity pools belong to the separate `cognito-identity` service (a
 * different SDK client) and are intentionally not included here.
 */
export const cognitoIdpDefinition =
	defineService<CognitoIdentityProviderClient>({
		id: "cognito-idp",
		name: "Cognito IDP",
		client: (config) => new CognitoIdentityProviderClient(config),
		resourceTypes: {
			userpool: {
				singular: "User Pool",
				plural: "User Pools",
				cfn: "AWS::Cognito::UserPool",
				matchArn: (identifier) => identifier.arn.includes(":userpool/"),
				list: async (client): Promise<UserPoolDescriptionType[]> => {
					const pools: UserPoolDescriptionType[] = [];
					let nextToken: string | undefined;
					do {
						const out = await client.send(
							new ListUserPoolsCommand({
								MaxResults: 60,
								NextToken: nextToken,
							}),
						);
						pools.push(...(out.UserPools ?? []));
						nextToken = out.NextToken;
					} while (nextToken);
					return pools;
				},
				id: (pool: UserPoolDescriptionType, ctx) =>
					`arn:aws:cognito-idp:${ctx.region}::userpool/${pool.Id}`,
				describe: (client, identifier) =>
					client.send(
						new DescribeUserPoolCommand({
							UserPoolId: identifier.resourceName,
						}),
					),
				detail: [
					{ label: "Name", path: "UserPool.Name", type: FieldType.NAME },
					{ label: "ID", path: "UserPool.Id", type: FieldType.NAME },
					{ label: "Status", path: "UserPool.Status", type: FieldType.NAME },
					{
						label: "MFA Configuration",
						path: "UserPool.MfaConfiguration",
						type: FieldType.NAME,
					},
					{
						label: "Estimated Users",
						path: "UserPool.EstimatedNumberOfUsers",
						type: FieldType.NUMBER,
					},
					{
						label: "Creation Date",
						path: "UserPool.CreationDate",
						type: FieldType.DATE,
					},
				],
			},
			userpoolclient: {
				singular: "User Pool Client",
				plural: "User Pool Clients",
				cfn: "AWS::Cognito::UserPoolClient",
				matchArn: (identifier) => identifier.arn.includes(":userpoolclient/"),
				list: async (client): Promise<UserPoolClientDescription[]> => {
					const poolIds = await listUserPoolIds(client);
					const clients: UserPoolClientDescription[] = [];
					for (const userPoolId of poolIds) {
						let nextToken: string | undefined;
						do {
							const out = await client.send(
								new ListUserPoolClientsCommand({
									UserPoolId: userPoolId,
									MaxResults: 60,
									NextToken: nextToken,
								}),
							);
							clients.push(...(out.UserPoolClients ?? []));
							nextToken = out.NextToken;
						} while (nextToken);
					}
					return clients;
				},
				id: (appClient: UserPoolClientDescription, ctx) =>
					`arn:aws:cognito-idp:${ctx.region}::userpoolclient/${appClient.UserPoolId}/${appClient.ClientId}`,
				detail: [
					{ label: "Client Name", path: "ClientName", type: FieldType.NAME },
					{ label: "Client ID", path: "ClientId", type: FieldType.NAME },
					{ label: "User Pool ID", path: "UserPoolId", type: FieldType.NAME },
				],
			},
			userpoolgroup: {
				singular: "User Pool Group",
				plural: "User Pool Groups",
				cfn: "AWS::Cognito::UserPoolGroup",
				matchArn: (identifier) => identifier.arn.includes(":userpoolgroup/"),
				list: async (client): Promise<GroupType[]> => {
					const poolIds = await listUserPoolIds(client);
					const groups: GroupType[] = [];
					for (const userPoolId of poolIds) {
						let nextToken: string | undefined;
						do {
							const out = await client.send(
								new ListGroupsCommand({
									UserPoolId: userPoolId,
									NextToken: nextToken,
								}),
							);
							groups.push(...(out.Groups ?? []));
							nextToken = out.NextToken;
						} while (nextToken);
					}
					return groups;
				},
				id: (group: GroupType, ctx) =>
					`arn:aws:cognito-idp:${ctx.region}::userpoolgroup/${group.UserPoolId}/${group.GroupName}`,
				detail: [
					{ label: "Group Name", path: "GroupName", type: FieldType.NAME },
					{ label: "User Pool ID", path: "UserPoolId", type: FieldType.NAME },
					{
						label: "Description",
						path: "Description",
						type: FieldType.SHORT_TEXT,
					},
					{ label: "Precedence", path: "Precedence", type: FieldType.NUMBER },
					{ label: "Role ARN", path: "RoleArn", type: FieldType.ARN },
					{
						label: "Creation Date",
						path: "CreationDate",
						type: FieldType.DATE,
					},
				],
			},
		},
	});

/** Enumerate every user pool id (for resource types scoped to a pool). */
async function listUserPoolIds(
	client: CognitoIdentityProviderClient,
): Promise<string[]> {
	const ids: string[] = [];
	let nextToken: string | undefined;
	do {
		const out = await client.send(
			new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken }),
		);
		ids.push(
			...(out.UserPools ?? [])
				.map((pool) => pool.Id)
				.filter((id): id is string => Boolean(id)),
		);
		nextToken = out.NextToken;
	} while (nextToken);
	return ids;
}
