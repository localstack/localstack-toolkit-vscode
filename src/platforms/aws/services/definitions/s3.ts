import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import type { Bucket } from "@aws-sdk/client-s3";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/**
 * S3. Buckets are the only browsable resource type. S3 has no single-call
 * "describe bucket" that returns everything, so detail is drawn from the
 * ListBuckets item (name + creation date) as a first cut; richer per-bucket
 * detail (versioning, encryption, …) would need extra calls and can be added
 * later.
 */
export const s3Definition = defineService<S3Client>({
	id: "s3",
	name: "S3",
	client: (config) => new S3Client(config),
	resourceTypes: {
		bucket: {
			singular: "Bucket",
			plural: "Buckets",
			cfn: "AWS::S3::Bucket",
			list: async (client): Promise<Bucket[]> => {
				const out = await client.send(new ListBucketsCommand({}));
				return out.Buckets ?? [];
			},
			id: (bucket: Bucket) => `arn:aws:s3:::${bucket.Name}`,
			describe: async (client, identifier) => {
				const out = await client.send(new ListBucketsCommand({}));
				return (out.Buckets ?? []).find(
					(bucket) => bucket.Name === identifier.resourceName,
				);
			},
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "Creation Date", path: "CreationDate", type: FieldType.DATE },
			],
		},
	},
});
