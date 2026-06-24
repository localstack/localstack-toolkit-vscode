import {
	DescribeSecretCommand,
	ListSecretsCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { SecretListEntry } from "@aws-sdk/client-secrets-manager";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/** Secrets Manager. Secrets are identified by their full ARN. */
export const secretsManagerDefinition = defineService<SecretsManagerClient>({
	id: "secretsmanager",
	name: "Secrets Manager",
	client: (config) => new SecretsManagerClient(config),
	resourceTypes: {
		secret: {
			singular: "Secret",
			plural: "Secrets",
			cfn: "AWS::SecretsManager::Secret",
			list: async (client): Promise<SecretListEntry[]> => {
				const secrets: SecretListEntry[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new ListSecretsCommand({ NextToken: nextToken }),
					);
					secrets.push(...(out.SecretList ?? []));
					nextToken = out.NextToken;
				} while (nextToken);
				return secrets;
			},
			id: (secret: SecretListEntry) => secret.ARN ?? secret.Name ?? "",
			describe: (client, identifier) =>
				client.send(new DescribeSecretCommand({ SecretId: identifier.arn })),
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "ARN", path: "ARN", type: FieldType.ARN },
				{
					label: "Description",
					path: "Description",
					type: FieldType.SHORT_TEXT,
				},
				{
					label: "Rotation Enabled",
					path: "RotationEnabled",
					type: FieldType.NAME,
				},
				{
					label: "Last Changed Date",
					path: "LastChangedDate",
					type: FieldType.DATE,
				},
				{ label: "Created Date", path: "CreatedDate", type: FieldType.DATE },
			],
		},
	},
});
