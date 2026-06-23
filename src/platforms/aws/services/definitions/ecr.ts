import { DescribeRepositoriesCommand, ECRClient } from "@aws-sdk/client-ecr";
import type { Repository } from "@aws-sdk/client-ecr";

import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/** ECR (Elastic Container Registry). Repositories are the browsable type. */
export const ecrDefinition = defineService<ECRClient>({
	id: "ecr",
	name: "ECR",
	client: (config) => new ECRClient(config),
	resourceTypes: {
		repository: {
			singular: "Repository",
			plural: "Repositories",
			cfn: "AWS::ECR::Repository",
			list: async (client): Promise<Repository[]> => {
				const repositories: Repository[] = [];
				let nextToken: string | undefined;
				do {
					const out = await client.send(
						new DescribeRepositoriesCommand({ nextToken }),
					);
					repositories.push(...(out.repositories ?? []));
					nextToken = out.nextToken;
				} while (nextToken);
				return repositories;
			},
			id: (repo: Repository) => repo.repositoryArn ?? repo.repositoryName ?? "",
			describe: async (client, identifier) => {
				const out = await client.send(
					new DescribeRepositoriesCommand({
						repositoryNames: [identifier.resourceName ?? ""],
					}),
				);
				return out.repositories?.[0];
			},
			detail: [
				{
					label: "Repository Name",
					path: "repositoryName",
					type: FieldType.NAME,
				},
				{ label: "ARN", path: "repositoryArn", type: FieldType.ARN },
				{ label: "URI", path: "repositoryUri", type: FieldType.SHORT_TEXT },
				{
					label: "Tag Mutability",
					path: "imageTagMutability",
					type: FieldType.NAME,
				},
				{ label: "Created At", path: "createdAt", type: FieldType.DATE },
			],
		},
	},
});
