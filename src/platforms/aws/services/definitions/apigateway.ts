import {
	APIGatewayClient,
	GetApiKeyCommand,
	GetApiKeysCommand,
	GetAuthorizersCommand,
	GetRestApiCommand,
	GetRestApisCommand,
	GetStagesCommand,
	GetUsagePlanCommand,
	GetUsagePlansCommand,
} from "@aws-sdk/client-api-gateway";
import type {
	ApiKey,
	Authorizer,
	RestApi,
	Stage,
	UsagePlan,
} from "@aws-sdk/client-api-gateway";

import type ARN from "../../models/arnModel.ts";
import { defineService } from "../declarative/types.ts";
import { FieldType } from "../serviceProvider.ts";

/* Stages and authorizers are scoped to a REST API but their list items omit the
 * api id; augment them so a path-style ARN can be synthesized. */
type StageWithApi = Stage & { restApiId: string };
type AuthorizerWithApi = Authorizer & { restApiId: string };

/**
 * API Gateway (v1 / REST). REST APIs, stages, API keys, usage plans, and
 * authorizers. API Gateway uses path-style ARNs
 * (`arn:aws:apigateway:<region>::/restapis/<id>`) with no account, synthesized
 * here from the region; the path segment distinguishes the types and detail is
 * read from the list item.
 */
export const apiGatewayDefinition = defineService<APIGatewayClient>({
	id: "apigateway",
	name: "API Gateway",
	client: (config) => new APIGatewayClient(config),
	resourceTypes: {
		restapi: {
			singular: "REST API",
			plural: "REST APIs",
			metamodelOp: "getRestApis",
			cfn: "AWS::ApiGateway::RestApi",
			/* CloudFormation's PhysicalResourceId is the REST API id; re-encode it as
			 * the `/restapis/<id>` path the live `id` uses so a stack resource
			 * resolves to this type and `describe` can read it back. */
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId
					? `/restapis/${summary.PhysicalResourceId}`
					: undefined,
			matchArn: (identifier) =>
				identifier.arn.includes("/restapis/") &&
				!identifier.arn.includes("/stages/") &&
				!identifier.arn.includes("/authorizers/"),
			list: async (client): Promise<RestApi[]> => {
				const apis: RestApi[] = [];
				let position: string | undefined;
				do {
					const out = await client.send(new GetRestApisCommand({ position }));
					apis.push(...(out.items ?? []));
					position = out.position;
				} while (position);
				return apis;
			},
			id: (api: RestApi, ctx) =>
				`arn:aws:apigateway:${ctx.region}::/restapis/${api.id}`,
			/* Fetch directly by id (works for both live and CloudFormation ARNs)
			 * rather than re-listing every API. */
			describe: (client, identifier) =>
				client.send(
					new GetRestApiCommand({ restApiId: pathId(identifier, "restapis") }),
				),
			detail: [
				{ label: "Name", path: "name", type: FieldType.NAME },
				{ label: "ID", path: "id", type: FieldType.NAME },
				{
					label: "Description",
					path: "description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Version", path: "version", type: FieldType.NAME },
				{ label: "API Key Source", path: "apiKeySource", type: FieldType.NAME },
				{ label: "Created Date", path: "createdDate", type: FieldType.DATE },
			],
		},
		stage: {
			singular: "Stage",
			plural: "Stages",
			metamodelOp: "getStages",
			/* No `cfn` mapping: CloudFormation's PhysicalResourceId for a stage is the
			 * stage name alone, without the REST API id needed to fetch it. Live
			 * stages (whose ARN carries the api id) still resolve; CloudFormation
			 * stages are skipped in stack views. */
			matchArn: (identifier) => identifier.arn.includes("/stages/"),
			list: async (client): Promise<StageWithApi[]> => {
				const apiIds = await listRestApiIds(client);
				const stages: StageWithApi[] = [];
				for (const restApiId of apiIds) {
					const out = await client.send(new GetStagesCommand({ restApiId }));
					stages.push(
						...(out.item ?? []).map((stage) => ({ ...stage, restApiId })),
					);
				}
				return stages;
			},
			id: (stage: StageWithApi, ctx) =>
				`arn:aws:apigateway:${ctx.region}::/restapis/${stage.restApiId}/stages/${stage.stageName}`,
			detail: [
				{ label: "Stage Name", path: "stageName", type: FieldType.NAME },
				{ label: "REST API ID", path: "restApiId", type: FieldType.NAME },
				{ label: "Deployment ID", path: "deploymentId", type: FieldType.NAME },
				{
					label: "Description",
					path: "description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Created Date", path: "createdDate", type: FieldType.DATE },
			],
		},
		apikey: {
			singular: "API Key",
			plural: "API Keys",
			metamodelOp: "getApiKeys",
			cfn: "AWS::ApiGateway::ApiKey",
			/* CloudFormation's PhysicalResourceId is the API key id; re-encode it as
			 * the `/apikeys/<id>` path the live `id` uses. */
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId
					? `/apikeys/${summary.PhysicalResourceId}`
					: undefined,
			matchArn: (identifier) => identifier.arn.includes("/apikeys/"),
			list: async (client): Promise<ApiKey[]> => {
				const keys: ApiKey[] = [];
				let position: string | undefined;
				do {
					const out = await client.send(new GetApiKeysCommand({ position }));
					keys.push(...(out.items ?? []));
					position = out.position;
				} while (position);
				return keys;
			},
			id: (key: ApiKey, ctx) =>
				`arn:aws:apigateway:${ctx.region}::/apikeys/${key.id}`,
			/* Fetch by id (no `includeValue`, so the key secret is never read). */
			describe: (client, identifier) =>
				client.send(
					new GetApiKeyCommand({ apiKey: pathId(identifier, "apikeys") }),
				),
			detail: [
				{ label: "Name", path: "name", type: FieldType.NAME },
				{ label: "ID", path: "id", type: FieldType.NAME },
				{ label: "Enabled", path: "enabled", type: FieldType.NAME },
				{
					label: "Description",
					path: "description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Created Date", path: "createdDate", type: FieldType.DATE },
			],
		},
		usageplan: {
			singular: "Usage Plan",
			plural: "Usage Plans",
			metamodelOp: "getUsagePlans",
			cfn: "AWS::ApiGateway::UsagePlan",
			/* CloudFormation's PhysicalResourceId is the usage plan id; re-encode it
			 * as the `/usageplans/<id>` path the live `id` uses. */
			cfnResourceName: (summary) =>
				summary.PhysicalResourceId
					? `/usageplans/${summary.PhysicalResourceId}`
					: undefined,
			matchArn: (identifier) => identifier.arn.includes("/usageplans/"),
			list: async (client): Promise<UsagePlan[]> => {
				const plans: UsagePlan[] = [];
				let position: string | undefined;
				do {
					const out = await client.send(new GetUsagePlansCommand({ position }));
					plans.push(...(out.items ?? []));
					position = out.position;
				} while (position);
				return plans;
			},
			id: (plan: UsagePlan, ctx) =>
				`arn:aws:apigateway:${ctx.region}::/usageplans/${plan.id}`,
			/* Fetch directly by id rather than re-listing every usage plan. */
			describe: (client, identifier) =>
				client.send(
					new GetUsagePlanCommand({
						usagePlanId: pathId(identifier, "usageplans"),
					}),
				),
			detail: [
				{ label: "Name", path: "name", type: FieldType.NAME },
				{ label: "ID", path: "id", type: FieldType.NAME },
				{
					label: "Description",
					path: "description",
					type: FieldType.SHORT_TEXT,
				},
				{ label: "Product Code", path: "productCode", type: FieldType.NAME },
			],
		},
		authorizer: {
			singular: "Authorizer",
			plural: "Authorizers",
			metamodelOp: "getAuthorizers",
			/* No `cfn` mapping: CloudFormation's PhysicalResourceId for an authorizer
			 * is the authorizer id alone, without the REST API id needed to fetch it.
			 * Live authorizers still resolve; CloudFormation authorizers are skipped. */
			matchArn: (identifier) => identifier.arn.includes("/authorizers/"),
			list: async (client): Promise<AuthorizerWithApi[]> => {
				const apiIds = await listRestApiIds(client);
				const authorizers: AuthorizerWithApi[] = [];
				for (const restApiId of apiIds) {
					const out = await client.send(
						new GetAuthorizersCommand({ restApiId }),
					);
					authorizers.push(
						...(out.items ?? []).map((authorizer) => ({
							...authorizer,
							restApiId,
						})),
					);
				}
				return authorizers;
			},
			id: (authorizer: AuthorizerWithApi, ctx) =>
				`arn:aws:apigateway:${ctx.region}::/restapis/${authorizer.restApiId}/authorizers/${authorizer.id}`,
			detail: [
				{ label: "Name", path: "name", type: FieldType.NAME },
				{ label: "ID", path: "id", type: FieldType.NAME },
				{ label: "Type", path: "type", type: FieldType.NAME },
				{ label: "REST API ID", path: "restApiId", type: FieldType.NAME },
				{
					label: "Auth Type",
					path: "authType",
					type: FieldType.NAME,
				},
			],
		},
	},
});

/**
 * Extract the id following a path collection in an API Gateway ARN, e.g. the
 * `<id>` in `/restapis/<id>` or `/apikeys/<id>`. Works for both the live
 * (account-less) ARN and the CloudFormation-synthesized one, since both encode
 * the same `/collection/<id>` path in the resource portion. Returns `""` when
 * the collection segment is absent.
 */
function pathId(identifier: ARN, collection: string): string {
	const parts = identifier.resourceId.split("/").filter(Boolean);
	const index = parts.indexOf(collection);
	return index >= 0 ? (parts[index + 1] ?? "") : "";
}

/** Enumerate every REST API id (for resource types scoped to an API). */
async function listRestApiIds(client: APIGatewayClient): Promise<string[]> {
	const ids: string[] = [];
	let position: string | undefined;
	do {
		const out = await client.send(new GetRestApisCommand({ position }));
		ids.push(
			...(out.items ?? [])
				.map((api) => api.id)
				.filter((id): id is string => Boolean(id)),
		);
		position = out.position;
	} while (position);
	return ids;
}
