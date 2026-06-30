import assert from "node:assert";

import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import ARN from "../../platforms/aws/models/arnModel.ts";
import { DeclarativeServiceProvider } from "../../platforms/aws/services/declarative/engine.ts";
import type { ServiceDefinition } from "../../platforms/aws/services/declarative/types.ts";
import { cloudFormationDefinition } from "../../platforms/aws/services/definitions/cloudformation.ts";
import { dynamoDbDefinition } from "../../platforms/aws/services/definitions/dynamodb.ts";
import { iamDefinition } from "../../platforms/aws/services/definitions/iam.ts";
import { lambdaDefinition } from "../../platforms/aws/services/definitions/lambda.ts";
import { snsDefinition } from "../../platforms/aws/services/definitions/sns.ts";
import { sqsDefinition } from "../../platforms/aws/services/definitions/sqs.ts";
import { statesDefinition } from "../../platforms/aws/services/definitions/states.ts";
import { FieldType } from "../../platforms/aws/services/serviceProvider.ts";

/**
 * End-to-end tests for the Batch 2 declarative providers — the services
 * migrated from hand-written `ServiceProvider` subclasses. They are driven
 * through the real engine with a stubbed SDK client (dispatching on command
 * class name), covering the patterns unique to this batch: describe-time value
 * flattening (joins, boolean→string, URL-decode, epoch coercion), URL↔ARN
 * round-trips, ARN-prefix derivation, status filtering, and the variable-length
 * `list` detail spec. CloudFormation mapping is asserted directly on the
 * provider. No real AWS calls.
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

suite("Batch 2: IAM (path-stripped GetRole, decoded policy)", () => {
	const roleArn = "arn:aws:iam::000000000000:role/my-team/my-role";
	let seenRoleName: string | undefined;
	const client = fakeClient({
		ListRolesCommand: () => ({
			Roles: [{ Arn: roleArn, RoleName: "my-role" }],
		}),
		GetRoleCommand: (input) => {
			seenRoleName = input.RoleName as string;
			return {
				Role: {
					RoleName: "my-role",
					RoleId: "AROA123",
					AssumeRolePolicyDocument: encodeURIComponent('{"Version":"2012"}'),
				},
			};
		},
	});

	test("lists role ARNs", async () => {
		const arns = await providerWith(iamDefinition, client).getResourceArns(
			"default",
			"us-east-1",
			"role",
		);
		assert.deepStrictEqual(arns, [roleArn]);
	});

	test("strips the path before GetRole and decodes the policy document", async () => {
		const fields = await providerWith(iamDefinition, client).describeResource(
			"default",
			new ARN(roleArn),
		);
		assert.strictEqual(seenRoleName, "my-role");
		const policy = fields.find((f) => f.field === "Assume Role Policy");
		assert.deepStrictEqual(policy, {
			field: "Assume Role Policy",
			value: '{"Version":"2012"}',
			type: FieldType.JSON,
		});
	});

	test("maps a CloudFormation role to role/<id>", () => {
		assert.deepStrictEqual(
			providerWith(
				iamDefinition,
				client,
			).getArnResourceNameForCloudFormationResource(
				summary({ ResourceType: "AWS::IAM::Role", PhysicalResourceId: "r1" }),
			),
			{ resourceType: "role", resourceName: "role/r1" },
		);
	});
});

suite("Batch 2: Lambda (multi-type, joined arrays, typed CFN names)", () => {
	const fnArn = "arn:aws:lambda:us-east-1:000000000000:function:my-fn";
	const esmArn =
		"arn:aws:lambda:us-east-1:000000000000:event-source-mapping:uuid-1";
	const client = fakeClient({
		ListFunctionsCommand: () => ({ Functions: [{ FunctionArn: fnArn }] }),
		GetFunctionCommand: () => ({
			Configuration: {
				FunctionName: "my-fn",
				Architectures: ["arm64", "x86_64"],
			},
		}),
		ListEventSourceMappingsCommand: () => ({
			EventSourceMappings: [{ EventSourceMappingArn: esmArn }],
		}),
		GetEventSourceMappingCommand: () => ({ UUID: "uuid-1", State: "Enabled" }),
	});

	test("lists function ARNs", async () => {
		const arns = await providerWith(lambdaDefinition, client).getResourceArns(
			"default",
			"us-east-1",
			"function",
		);
		assert.deepStrictEqual(arns, [fnArn]);
	});

	test("joins the architectures array for display", async () => {
		const fields = await providerWith(
			lambdaDefinition,
			client,
		).describeResource("default", new ARN(fnArn));
		assert.ok(
			fields.some(
				(f) => f.field === "Architectures" && f.value === "arm64, x86_64",
			),
		);
	});

	test("resolves an event-source-mapping ARN to its own type", async () => {
		const fields = await providerWith(
			lambdaDefinition,
			client,
		).describeResource("default", new ARN(esmArn));
		assert.deepStrictEqual(fields[0], {
			field: "UUID",
			value: "uuid-1",
			type: FieldType.NAME,
		});
	});

	test("encodes the type in the CloudFormation resource name", () => {
		const provider = providerWith(lambdaDefinition, client);
		assert.deepStrictEqual(
			provider.getArnResourceNameForCloudFormationResource(
				summary({
					ResourceType: "AWS::Lambda::Function",
					PhysicalResourceId: "my-fn",
				}),
			),
			{ resourceType: "function", resourceName: "function:my-fn" },
		);
		assert.deepStrictEqual(
			provider.getArnResourceNameForCloudFormationResource(
				summary({
					ResourceType: "AWS::Lambda::EventSourceMapping",
					PhysicalResourceId: "uuid-1",
				}),
			),
			{
				resourceType: "event-source-mapping",
				resourceName: "event-source-mapping:uuid-1",
			},
		);
	});
});

suite("Batch 2: SNS (name from ARN + attributes)", () => {
	const topicArn = "arn:aws:sns:us-east-1:000000000000:my-topic";
	const client = fakeClient({
		ListTopicsCommand: () => ({ Topics: [{ TopicArn: topicArn }] }),
		GetTopicAttributesCommand: () => ({
			Attributes: { DisplayName: "My Topic", SubscriptionsConfirmed: "3" },
		}),
	});

	test("takes the name from the ARN and the rest from attributes", async () => {
		const fields = await providerWith(snsDefinition, client).describeResource(
			"default",
			new ARN(topicArn),
		);
		assert.deepStrictEqual(fields[0], {
			field: "Name",
			value: "my-topic",
			type: FieldType.NAME,
		});
		assert.ok(
			fields.some((f) => f.field === "Display Name" && f.value === "My Topic"),
		);
	});
});

suite("Batch 2: SQS (URL↔ARN round-trip, epoch coercion)", () => {
	const queueUrl = "https://sqs.us-east-1.amazonaws.com/000000000000/my-queue";
	const queueArn = "arn:aws:sqs:us-east-1:000000000000:my-queue";
	const client = fakeClient({
		ListQueuesCommand: () => ({ QueueUrls: [queueUrl] }),
		GetQueueUrlCommand: () => ({ QueueUrl: queueUrl }),
		GetQueueAttributesCommand: (input) => {
			const names = input.AttributeNames as string[];
			if (names.includes("QueueArn")) {
				return { Attributes: { QueueArn: queueArn } };
			}
			return {
				Attributes: { VisibilityTimeout: "30", CreatedTimestamp: "0" },
			};
		},
	});

	test("resolves listed queue URLs to ARNs", async () => {
		const arns = await providerWith(sqsDefinition, client).getResourceArns(
			"default",
			"us-east-1",
			"queue",
		);
		assert.deepStrictEqual(arns, [queueArn]);
	});

	test("renders the epoch-second timestamp as an ISO date", async () => {
		const fields = await providerWith(sqsDefinition, client).describeResource(
			"default",
			new ARN(queueArn),
		);
		assert.ok(
			fields.some(
				(f) =>
					f.field === "Created Timestamp" &&
					f.value === "1970-01-01T00:00:00.000Z",
			),
		);
	});

	test("maps a CloudFormation queue URL to its name", () => {
		assert.deepStrictEqual(
			providerWith(
				sqsDefinition,
				client,
			).getArnResourceNameForCloudFormationResource(
				summary({
					ResourceType: "AWS::SQS::Queue",
					PhysicalResourceId: queueUrl,
				}),
			),
			{ resourceType: "queue", resourceName: "my-queue" },
		);
	});
});

suite(
	"Batch 2: Step Functions (self activity, flattened state machine)",
	() => {
		const activityArn = "arn:aws:states:us-east-1:000000000000:activity:act";
		const machineArn = "arn:aws:states:us-east-1:000000000000:stateMachine:sm";
		const logGroupArn = "arn:aws:logs:us-east-1:000000000000:log-group:/sm";
		const client = fakeClient({
			ListActivitiesCommand: () => ({
				activities: [{ activityArn, name: "act", creationDate: new Date(0) }],
			}),
			ListStateMachinesCommand: () => ({
				stateMachines: [{ stateMachineArn: machineArn, name: "sm" }],
			}),
			DescribeStateMachineCommand: () => ({
				name: "sm",
				loggingConfiguration: {
					includeExecutionData: true,
					level: "ALL",
					destinations: [{ cloudWatchLogsLogGroup: { logGroupArn } }],
				},
				tracingConfiguration: { enabled: true },
			}),
		});

		test("describes an activity from its list item (self)", async () => {
			const fields = await providerWith(
				statesDefinition,
				client,
			).describeResource("default", new ARN(activityArn));
			assert.deepStrictEqual(fields, [
				{ field: "Name", value: "act", type: FieldType.NAME },
				{
					field: "Creation Date",
					value: "1970-01-01T00:00:00.000Z",
					type: FieldType.DATE,
				},
			]);
		});

		test("flattens logging/tracing config into display strings", async () => {
			const fields = await providerWith(
				statesDefinition,
				client,
			).describeResource("default", new ARN(machineArn));
			assert.ok(
				fields.some((f) => f.field === "Log Group" && f.value === logGroupArn),
			);
			assert.ok(
				fields.some(
					(f) => f.field === "Log Execution Data" && f.value === "Yes",
				),
			);
			assert.ok(
				fields.some((f) => f.field === "Tracing" && f.value === "Enabled"),
			);
		});

		test("does not support CloudFormation mapping", () => {
			assert.throws(() =>
				providerWith(
					statesDefinition,
					client,
				).getArnResourceNameForCloudFormationResource(
					summary({
						ResourceType: "AWS::StepFunctions::StateMachine",
						PhysicalResourceId: "sm",
					}),
				),
			);
		});
	},
);

suite("Batch 2: DynamoDB (ARN-prefix derivation, list detail spec)", () => {
	const tableArn = "arn:aws:dynamodb:us-east-1:000000000000:table/t1";
	const client = fakeClient({
		ListTablesCommand: () => ({ TableNames: ["t1", "t2"] }),
		DescribeTableCommand: (input) => ({
			Table: {
				TableName: input.TableName,
				TableArn: `arn:aws:dynamodb:us-east-1:000000000000:table/${input.TableName as string}`,
				AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
				KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
			},
		}),
	});

	test("derives every table ARN from the first table's prefix", async () => {
		const arns = await providerWith(dynamoDbDefinition, client).getResourceArns(
			"default",
			"us-east-1",
			"table",
		);
		assert.deepStrictEqual(arns, [
			"arn:aws:dynamodb:us-east-1:000000000000:table/t1",
			"arn:aws:dynamodb:us-east-1:000000000000:table/t2",
		]);
	});

	test("expands attribute definitions and key schema via the list spec", async () => {
		const fields = await providerWith(
			dynamoDbDefinition,
			client,
		).describeResource("default", new ARN(tableArn));
		assert.deepStrictEqual(
			fields.filter((f) =>
				["Attributes", "Key Schema", "    id"].includes(f.field),
			),
			[
				{ field: "Attributes", value: "", type: FieldType.NAME },
				{ field: "    id", value: "S", type: FieldType.NAME },
				{ field: "Key Schema", value: "", type: FieldType.NAME },
				{ field: "    id", value: "HASH", type: FieldType.NAME },
			],
		);
	});
});

suite("Batch 2: CloudFormation (status filter, sort, list detail spec)", () => {
	const stackArn =
		"arn:aws:cloudformation:us-east-1:000000000000:stack/my-stack/abc";
	let seenStatusFilter: unknown;
	const client = fakeClient({
		ListStacksCommand: (input) => {
			seenStatusFilter = input.StackStatusFilter;
			return {
				StackSummaries: [
					{ StackId: "arn:...:stack/b" },
					{ StackId: "arn:...:stack/a" },
				],
			};
		},
		DescribeStacksCommand: () => ({
			Stacks: [
				{
					StackName: "my-stack",
					EnableTerminationProtection: true,
					DisableRollback: false,
					Capabilities: ["CAPABILITY_IAM"],
					Parameters: [{ ParameterKey: "Env", ParameterValue: "prod" }],
					Outputs: [{ OutputKey: "Url", OutputValue: "https://x" }],
				},
			],
		}),
	});

	test("filters to created statuses and returns ARNs sorted by id", async () => {
		const arns = await providerWith(
			cloudFormationDefinition,
			client,
		).getResourceArns("default", "us-east-1", "stack");
		assert.deepStrictEqual(arns, ["arn:...:stack/a", "arn:...:stack/b"]);
		assert.ok(Array.isArray(seenStatusFilter));
		assert.ok((seenStatusFilter as string[]).includes("CREATE_COMPLETE"));
	});

	test("flattens flags and expands parameters/outputs", async () => {
		const fields = await providerWith(
			cloudFormationDefinition,
			client,
		).describeResource("default", new ARN(stackArn));
		assert.ok(
			fields.some(
				(f) => f.field === "Termination Protection" && f.value === "Enabled",
			),
		);
		assert.ok(
			fields.some((f) => f.field === "Rollback" && f.value === "Enabled"),
		);
		assert.ok(
			fields.some(
				(f) => f.field === "Capabilities" && f.value === "CAPABILITY_IAM",
			),
		);
		assert.deepStrictEqual(
			fields.filter((f) =>
				["Parameters", "    Env", "Outputs", "    Url"].includes(f.field),
			),
			[
				{ field: "Parameters", value: "", type: FieldType.NAME },
				{ field: "    Env", value: "prod", type: FieldType.NAME },
				{ field: "Outputs", value: "", type: FieldType.NAME },
				{ field: "    Url", value: "https://x", type: FieldType.NAME },
			],
		);
	});
});
