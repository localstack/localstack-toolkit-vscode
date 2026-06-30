import {
	GetRoleCommand,
	IAMClient,
	ListRolesCommand,
} from "@aws-sdk/client-iam";
import type { Role } from "@aws-sdk/client-iam";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * IAM. A global service (its ARNs carry no region), exposing roles. The role
 * name in a role ARN can be path-qualified (`role/path/.../name`), so `describe`
 * extracts the trailing name segment for `GetRole`, and the URL-encoded
 * `AssumeRolePolicyDocument` is decoded for display.
 */
export const iamDefinition = defineService<IAMClient>({
	id: "iam",
	name: "IAM",
	client: (config) => new IAMClient(config),
	resourceTypes: {
		role: {
			singular: "Role",
			plural: "Roles",
			cfn: "AWS::IAM::Role",
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId
					? `role/${summary.PhysicalResourceId}`
					: undefined,
			list: async (client): Promise<Role[]> => {
				const roles: Role[] = [];
				let marker: string | undefined;
				do {
					const out = await client.send(
						new ListRolesCommand({ Marker: marker }),
					);
					roles.push(...(out.Roles ?? []));
					marker = out.Marker;
				} while (marker);
				return roles;
			},
			id: (role: Role) => role.Arn ?? "",
			describe: async (client, identifier) => {
				/* Role names can be path-qualified; GetRole takes just the name. */
				const resourceName = identifier.resourceName ?? "";
				const roleName = resourceName.includes("/")
					? resourceName.slice(resourceName.lastIndexOf("/") + 1)
					: resourceName;
				const out = await client.send(
					new GetRoleCommand({ RoleName: roleName }),
				);
				const role = out.Role;
				return {
					...role,
					/* AssumeRolePolicyDocument is URL-encoded JSON; decode for display. */
					AssumeRolePolicyDocument: role?.AssumeRolePolicyDocument
						? decodeURIComponent(role.AssumeRolePolicyDocument)
						: undefined,
				};
			},
			detail: [
				{ label: "Role Name", path: "RoleName", type: FieldType.NAME },
				{ label: "Role ID", path: "RoleId", type: FieldType.NAME },
				{ label: "Path", path: "Path", type: FieldType.SHORT_TEXT },
				{
					label: "Description",
					path: "Description",
					type: FieldType.SHORT_TEXT,
				},
				{
					label: "Max Session Duration",
					path: "MaxSessionDuration",
					type: FieldType.NUMBER,
				},
				{ label: "Created", path: "CreateDate", type: FieldType.DATE },
				{
					label: "Last Used",
					path: "RoleLastUsed.LastUsedDate",
					type: FieldType.DATE,
				},
				{
					label: "Assume Role Policy",
					path: "AssumeRolePolicyDocument",
					type: FieldType.JSON,
				},
			],
		},
	},
});
