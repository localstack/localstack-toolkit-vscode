import {
	CloudFormationClient,
	DescribeStacksCommand,
	ListStacksCommand,
} from "@aws-sdk/client-cloudformation";
import type { StackStatus, StackSummary } from "@aws-sdk/client-cloudformation";

import { InternalError } from "../../../../utils/errors.ts";
import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/*
 * Only list stacks in a stable, resource-bearing state. Stacks that never
 * finished creating, failed, rolled back from a failed create, or are being
 * deleted are excluded: their resources either don't exist or lack the
 * identifiers the Resources view relies on. Update this if AWS adds statuses.
 */
const CREATED_STATUSES: StackStatus[] = [
	"CREATE_COMPLETE",
	"UPDATE_COMPLETE",
	"UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
	"UPDATE_ROLLBACK_COMPLETE",
	"UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
	"IMPORT_COMPLETE",
	"IMPORT_ROLLBACK_COMPLETE",
];

/**
 * CloudFormation. Stacks only, filtered to the stable created/updated states
 * and sorted by stack id for a consistent display order. Parameters and outputs
 * are variable-length, rendered via `list` detail specs; the boolean
 * protection/rollback flags and the capabilities array are flattened into
 * display strings by `describe`. No CloudFormation self-mapping (a stack is not
 * itself a stack resource).
 */
export const cloudFormationDefinition = defineService<CloudFormationClient>({
	id: "cloudformation",
	name: "CloudFormation",
	client: (config) => new CloudFormationClient(config),
	resourceTypes: {
		stack: {
			singular: "Stack",
			plural: "Stacks",
			list: async (client): Promise<StackSummary[]> => {
				const stacks: StackSummary[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListStacksCommand({
							NextToken: nextToken,
							StackStatusFilter: CREATED_STATUSES,
						}),
					);
					stacks.push(...(out.StackSummaries ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return stacks
					.filter((stack) => stack.StackId)
					.sort((a, b) => (a.StackId ?? "").localeCompare(b.StackId ?? ""));
			},
			id: (stack: StackSummary) => stack.StackId ?? "",
			describe: async (client, identifier) => {
				const out = await client.send(
					new DescribeStacksCommand({ StackName: identifier.resourceName }),
				);
				const stack = out.Stacks?.[0];
				if (!stack) {
					throw new InternalError(
						`No stack found with name: ${identifier.resourceName}`,
					);
				}
				return {
					...stack,
					TerminationProtectionText: stack.EnableTerminationProtection
						? "Enabled"
						: "Disabled",
					RollbackText: stack.DisableRollback ? "Disabled" : "Enabled",
					CapabilitiesText: stack.Capabilities?.length
						? stack.Capabilities.join(", ")
						: "None",
				};
			},
			detail: [
				{ label: "Stack Name", path: "StackName", type: FieldType.NAME },
				{ label: "Stack Status", path: "StackStatus", type: FieldType.NAME },
				{
					label: "Description",
					path: "Description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Change Set ARN", path: "ChangeSetId", type: FieldType.ARN },
				{ label: "Creation Time", path: "CreationTime", type: FieldType.DATE },
				{
					label: "Last Updated Time",
					path: "LastUpdatedTime",
					type: FieldType.DATE,
				},
				{
					label: "Termination Protection",
					path: "TerminationProtectionText",
					type: FieldType.NAME,
				},
				{ label: "Rollback", path: "RollbackText", type: FieldType.NAME },
				{
					label: "Capabilities",
					path: "CapabilitiesText",
					type: FieldType.SHORT_TEXT,
				},
				{
					label: "Drift Status",
					path: "DriftInformation.StackDriftStatus",
					type: FieldType.NAME,
				},
				{
					kind: "list",
					label: "Parameters",
					path: "Parameters",
					itemLabel: "ParameterKey",
					itemValue: "ParameterValue",
				},
				{
					kind: "list",
					label: "Outputs",
					path: "Outputs",
					itemLabel: "OutputKey",
					itemValue: "OutputValue",
				},
			],
		},
	},
});
