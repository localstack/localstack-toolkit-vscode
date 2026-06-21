import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import { IAM } from "../../clients/iam.ts";
import type ARN from "../../models/arnModel.ts";
import {
	FieldType,
	ServiceProvider,
	ServiceResourceArnTuple,
} from "../serviceProvider.ts";

export class IAMServiceProvider extends ServiceProvider {
	async getResourceArns(
		profile: string,
		region: string,
		resourceType: string,
	): Promise<string[]> {
		if (resourceType === "role") {
			return await IAM.listRoles(profile);
		} else {
			throw new Error(`Unknown resource type: ${resourceType}`);
		}
	}

	public async describeResource(
		profile: string,
		arn: ARN,
	): Promise<{ field: string; value: string; type: FieldType }[]> {
		const resourceType = arn.resourceType?.toLowerCase();
		if (resourceType === "role") {
			const details = await IAM.getRole(profile, arn);
			if (!details.Role) {
				throw new Error(`Failed to get details for role: ${arn.toString()}`);
			}
			const role = details.Role;

			return [
				{ field: "Resource Type", value: "Role", type: FieldType.NAME },
				{ field: "Role Name", value: role.RoleName!, type: FieldType.NAME },
				{ field: "Role ID", value: role.RoleId!, type: FieldType.NAME },
				{ field: "Path", value: role.Path!, type: FieldType.SHORT_TEXT },
				{
					field: "Description",
					value: role.Description || "",
					type: FieldType.SHORT_TEXT,
				},
				{
					field: "Max Session Duration",
					value: role.MaxSessionDuration
						? role.MaxSessionDuration.toString()
						: "N/A",
					type: FieldType.NUMBER,
				},
				{
					field: "Created",
					value: role.CreateDate!.toISOString(),
					type: FieldType.DATE,
				},
				{
					field: "Last Used",
					value: role.RoleLastUsed?.LastUsedDate
						? role.RoleLastUsed.LastUsedDate.toISOString()
						: "N/A",
					type: FieldType.DATE,
				},
				{
					field: "Assume Role Policy",
					value: role.AssumeRolePolicyDocument
						? decodeURIComponent(role.AssumeRolePolicyDocument)
						: "N/A",
					type: FieldType.JSON,
				},
			];
		} else {
			throw new Error(`Unknown resource type for ARN: ${arn.toString()}`);
		}
	}

	public getArnResourceNameForCloudFormationResource(
		stackResourceSummary: StackResourceSummary,
	): { resourceType: string; resourceName: string } {
		const resourceType = stackResourceSummary.ResourceType;
		if (resourceType === "AWS::IAM::Role") {
			return {
				resourceType: "role",
				resourceName: `role/${stackResourceSummary.PhysicalResourceId!}`,
			};
		} else {
			throw new Error(`Unsupported IAM resource type: ${resourceType}`);
		}
	}

	protected resourceTypes: Record<string, [string, string]> = {
		role: ["Role", "Roles"],
	};

	getId(): string {
		return "iam";
	}

	getName(): string {
		return "IAM";
	}
}
