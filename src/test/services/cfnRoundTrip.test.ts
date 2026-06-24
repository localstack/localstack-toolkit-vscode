import assert from "node:assert";

import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import ARN from "../../platforms/aws/models/arnModel.ts";
import { DeclarativeServiceProvider } from "../../platforms/aws/services/declarative/engine.ts";
import type { ServiceDefinition } from "../../platforms/aws/services/declarative/types.ts";
import { apiGatewayDefinition } from "../../platforms/aws/services/definitions/apigateway.ts";
import { cognitoIdpDefinition } from "../../platforms/aws/services/definitions/cognito-idp.ts";

/**
 * Round-trip tests for CloudFormation-origin resources: synthesize the ARN
 * exactly as `CfnStackModel` does (`getArnResourceNameForCloudFormationResource`
 * → `arn:aws:<service>:<region>:<account>:<resourceName>`), then `describeResource`
 * that ARN and assert it resolves to the right type and fetches by the right id.
 *
 * This is the gap that let API Gateway and Cognito resources throw when opened
 * from a stack view: the live `id` and the CloudFormation ARN are built by two
 * different code paths, so a type whose `cfnResourceName` doesn't re-encode the
 * discriminating token is unresolvable. The dropped types assert the honest
 * fallback — they have no `cfn` mapping (CloudFormation can't supply the parent
 * id they need), so the stack model skips them rather than showing a broken row.
 */

type Handlers = Record<string, (input: Record<string, unknown>) => unknown>;
function fakeClient(handlers: Handlers): {
	send: (command: unknown) => unknown;
} {
	return {
		send: (command: unknown) => {
			const name = (command as { constructor: { name: string } }).constructor
				.name;
			const handler = handlers[name];
			if (!handler) {
				throw new Error(`Unexpected SDK command: ${name}`);
			}
			const input =
				(command as { input?: Record<string, unknown> }).input ?? {};
			return Promise.resolve(handler(input));
		},
	};
}

function providerWith<TClient>(
	definition: ServiceDefinition<TClient>,
	client: unknown,
) {
	return new DeclarativeServiceProvider({
		...definition,
		client: () => client as TClient,
	});
}

function summary(partial: Partial<StackResourceSummary>): StackResourceSummary {
	return partial as StackResourceSummary;
}

/** Build the ARN a stack resource would get, mirroring `CfnStackModel`. */
function cfnArn<TClient>(
	provider: DeclarativeServiceProvider<TClient>,
	stackResource: StackResourceSummary,
): { resourceType: string; arn: ARN } {
	const { resourceType, resourceName } =
		provider.getArnResourceNameForCloudFormationResource(stackResource);
	const arn = `arn:aws:${provider.getId()}:us-east-1:000000000000:${resourceName}`;
	return { resourceType, arn: new ARN(arn) };
}

suite("CloudFormation round-trip: API Gateway", () => {
	let seen: Record<string, string> = {};
	const client = fakeClient({
		GetRestApiCommand: (input) => {
			seen.restApiId = input.restApiId as string;
			return { id: input.restApiId, name: "My API" };
		},
		GetApiKeyCommand: (input) => {
			seen.apiKey = input.apiKey as string;
			return { id: input.apiKey, name: "My Key", enabled: true };
		},
		GetUsagePlanCommand: (input) => {
			seen.usagePlanId = input.usagePlanId as string;
			return { id: input.usagePlanId, name: "My Plan" };
		},
	});
	const provider = providerWith(apiGatewayDefinition, client);

	test("REST API resolves and describes by id", async () => {
		seen = {};
		const { resourceType, arn } = cfnArn(
			provider,
			summary({
				ResourceType: "AWS::ApiGateway::RestApi",
				PhysicalResourceId: "abc123",
			}),
		);
		assert.strictEqual(resourceType, "restapi");
		const fields = await provider.describeResource("default", arn);
		assert.strictEqual(seen.restApiId, "abc123");
		assert.ok(fields.some((f) => f.field === "Name" && f.value === "My API"));
	});

	test("API Key resolves and describes by id", async () => {
		seen = {};
		const { resourceType, arn } = cfnArn(
			provider,
			summary({
				ResourceType: "AWS::ApiGateway::ApiKey",
				PhysicalResourceId: "key123",
			}),
		);
		assert.strictEqual(resourceType, "apikey");
		await provider.describeResource("default", arn);
		assert.strictEqual(seen.apiKey, "key123");
	});

	test("Usage Plan resolves and describes by id", async () => {
		seen = {};
		const { resourceType, arn } = cfnArn(
			provider,
			summary({
				ResourceType: "AWS::ApiGateway::UsagePlan",
				PhysicalResourceId: "plan123",
			}),
		);
		assert.strictEqual(resourceType, "usageplan");
		await provider.describeResource("default", arn);
		assert.strictEqual(seen.usagePlanId, "plan123");
	});

	test("Stage and Authorizer have no CloudFormation mapping", () => {
		for (const ResourceType of [
			"AWS::ApiGateway::Stage",
			"AWS::ApiGateway::Authorizer",
		]) {
			assert.throws(
				() =>
					provider.getArnResourceNameForCloudFormationResource(
						summary({ ResourceType, PhysicalResourceId: "x" }),
					),
				/Unsupported resource type/,
				`expected ${ResourceType} to be unmapped`,
			);
		}
	});
});

suite("CloudFormation round-trip: Cognito", () => {
	let seenUserPoolId: string | undefined;
	const client = fakeClient({
		DescribeUserPoolCommand: (input) => {
			seenUserPoolId = input.UserPoolId as string;
			return { UserPool: { Name: "my-pool", Id: input.UserPoolId } };
		},
	});
	const provider = providerWith(cognitoIdpDefinition, client);

	test("User Pool resolves and describes by id", async () => {
		const { resourceType, arn } = cfnArn(
			provider,
			summary({
				ResourceType: "AWS::Cognito::UserPool",
				PhysicalResourceId: "us-east-1_AbC123",
			}),
		);
		assert.strictEqual(resourceType, "userpool");
		const fields = await provider.describeResource("default", arn);
		assert.strictEqual(seenUserPoolId, "us-east-1_AbC123");
		assert.ok(fields.some((f) => f.field === "Name" && f.value === "my-pool"));
	});

	test("User Pool Client and Group have no CloudFormation mapping", () => {
		for (const ResourceType of [
			"AWS::Cognito::UserPoolClient",
			"AWS::Cognito::UserPoolGroup",
		]) {
			assert.throws(
				() =>
					provider.getArnResourceNameForCloudFormationResource(
						summary({ ResourceType, PhysicalResourceId: "x" }),
					),
				/Unsupported resource type/,
				`expected ${ResourceType} to be unmapped`,
			);
		}
	});
});
