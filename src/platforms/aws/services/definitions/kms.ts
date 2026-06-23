import {
	DescribeKeyCommand,
	KMSClient,
	ListAliasesCommand,
	ListKeysCommand,
} from "@aws-sdk/client-kms";
import type { AliasListEntry, KeyListEntry } from "@aws-sdk/client-kms";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * KMS (Key Management Service). Customer keys and aliases. Key detail comes
 * from DescribeKey (nested under `KeyMetadata`); alias detail is taken from the
 * ListAliases item.
 */
export const kmsDefinition = defineService<KMSClient>({
	id: "kms",
	name: "KMS",
	client: (config) => new KMSClient(config),
	resourceTypes: {
		key: {
			singular: "Key",
			plural: "Keys",
			cfn: "AWS::KMS::Key",
			list: async (client): Promise<KeyListEntry[]> => {
				const keys: KeyListEntry[] = [];
				let marker: string | undefined;
				do {
					const out = await client.send(
						new ListKeysCommand({ Marker: marker }),
					);
					keys.push(...(out.Keys ?? []));
					marker = out.Truncated ? out.NextMarker : undefined;
				} while (marker);
				return keys;
			},
			id: (key: KeyListEntry) => key.KeyArn ?? key.KeyId ?? "",
			describe: (client, identifier) =>
				client.send(new DescribeKeyCommand({ KeyId: identifier.arn })),
			detail: [
				{ label: "Key ID", path: "KeyMetadata.KeyId", type: FieldType.NAME },
				{ label: "ARN", path: "KeyMetadata.Arn", type: FieldType.ARN },
				{
					label: "Description",
					path: "KeyMetadata.Description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "State", path: "KeyMetadata.KeyState", type: FieldType.NAME },
				{ label: "Usage", path: "KeyMetadata.KeyUsage", type: FieldType.NAME },
				{ label: "Enabled", path: "KeyMetadata.Enabled", type: FieldType.NAME },
				{
					label: "Creation Date",
					path: "KeyMetadata.CreationDate",
					type: FieldType.DATE,
				},
			],
		},
		alias: {
			singular: "Alias",
			plural: "Aliases",
			cfn: "AWS::KMS::Alias",
			list: async (client): Promise<AliasListEntry[]> => {
				const aliases: AliasListEntry[] = [];
				let marker: string | undefined;
				do {
					const out = await client.send(
						new ListAliasesCommand({ Marker: marker }),
					);
					aliases.push(...(out.Aliases ?? []));
					marker = out.Truncated ? out.NextMarker : undefined;
				} while (marker);
				return aliases;
			},
			id: (alias: AliasListEntry) => alias.AliasArn ?? alias.AliasName ?? "",
			/* No GetAlias API; detail comes from the matching ListAliases item. */
			detail: [
				{ label: "Alias Name", path: "AliasName", type: FieldType.NAME },
				{ label: "ARN", path: "AliasArn", type: FieldType.ARN },
				{ label: "Target Key ID", path: "TargetKeyId", type: FieldType.NAME },
				{
					label: "Creation Date",
					path: "CreationDate",
					type: FieldType.DATE,
				},
				{
					label: "Last Updated Date",
					path: "LastUpdatedDate",
					type: FieldType.DATE,
				},
			],
		},
	},
});
