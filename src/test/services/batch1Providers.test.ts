import assert from "node:assert";

import type { ExtensionContext } from "vscode";

import ARN from "../../platforms/aws/models/arnModel.ts";
import { DeclarativeServiceProvider } from "../../platforms/aws/services/declarative/engine.ts";
import type { ServiceDefinition } from "../../platforms/aws/services/declarative/types.ts";
import { apiGatewayDefinition } from "../../platforms/aws/services/definitions/apigateway.ts";
import { eventsDefinition } from "../../platforms/aws/services/definitions/events.ts";
import { kinesisDefinition } from "../../platforms/aws/services/definitions/kinesis.ts";
import { kmsDefinition } from "../../platforms/aws/services/definitions/kms.ts";
import { logsDefinition } from "../../platforms/aws/services/definitions/logs.ts";
import { s3Definition } from "../../platforms/aws/services/definitions/s3.ts";
import { ssmDefinition } from "../../platforms/aws/services/definitions/ssm.ts";
import { FieldType } from "../../platforms/aws/services/serviceProvider.ts";

/**
 * End-to-end tests for representative Batch 1 declarative providers, driven
 * through the real engine with a stubbed SDK client. They cover each distinct
 * pattern: self-detail vs. explicit describe, nested response paths, multi-type
 * ARN resolution (by token and by `matchArn` predicate), parent iteration, and
 * region-synthesized ARNs for ARN-less list responses. No real AWS calls.
 */

/* A fake SDK client whose `send` dispatches on the command class name. */
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

/** Build a provider from a real definition but with a stubbed client. */
function providerWith<TClient>(
	definition: ServiceDefinition<TClient>,
	client: unknown,
) {
	return new DeclarativeServiceProvider({} as unknown as ExtensionContext, {
		...definition,
		client: () => client as TClient,
	});
}

suite("Batch 1: S3 (self-detail, single type)", () => {
	const client = fakeClient({
		ListBucketsCommand: () => ({
			Buckets: [{ Name: "my-bucket", CreationDate: new Date(0) }],
		}),
	});

	test("lists buckets as region-less ARNs", async () => {
		const arns = await providerWith(s3Definition, client).getResourceArns(
			"default",
			"us-east-1",
			"bucket",
		);
		assert.deepStrictEqual(arns, ["arn:aws:s3:::my-bucket"]);
	});

	test("describes a bucket from the list item", async () => {
		const fields = await providerWith(s3Definition, client).describeResource(
			"default",
			new ARN("arn:aws:s3:::my-bucket"),
		);
		assert.deepStrictEqual(fields, [
			{ field: "Name", value: "my-bucket", type: FieldType.NAME },
			{
				field: "Creation Date",
				value: "1970-01-01T00:00:00.000Z",
				type: FieldType.DATE,
			},
		]);
	});
});

suite("Batch 1: KMS (multi-type, nested describe + self)", () => {
	const keyArn = "arn:aws:kms:us-east-1:000000000000:key/abc-123";
	const aliasArn = "arn:aws:kms:us-east-1:000000000000:alias/my-alias";
	const client = fakeClient({
		ListKeysCommand: () => ({ Keys: [{ KeyId: "abc-123", KeyArn: keyArn }] }),
		DescribeKeyCommand: (input) => ({
			KeyMetadata: {
				KeyId: "abc-123",
				Arn: input.KeyId,
				KeyState: "Enabled",
				KeyUsage: "ENCRYPT_DECRYPT",
				Enabled: true,
			},
		}),
		ListAliasesCommand: () => ({
			Aliases: [
				{
					AliasName: "alias/my-alias",
					AliasArn: aliasArn,
					TargetKeyId: "abc-123",
				},
			],
		}),
	});

	test("describes a key via DescribeKey (nested KeyMetadata path)", async () => {
		const fields = await providerWith(kmsDefinition, client).describeResource(
			"default",
			new ARN(keyArn),
		);
		assert.deepStrictEqual(fields[0], {
			field: "Key ID",
			value: "abc-123",
			type: FieldType.NAME,
		});
		assert.ok(fields.some((f) => f.field === "State" && f.value === "Enabled"));
	});

	test("resolves an alias ARN to the alias type and describes it via self", async () => {
		const fields = await providerWith(kmsDefinition, client).describeResource(
			"default",
			new ARN(aliasArn),
		);
		assert.deepStrictEqual(fields[0], {
			field: "Alias Name",
			value: "alias/my-alias",
			type: FieldType.NAME,
		});
	});
});

suite("Batch 1: Kinesis (matchArn predicate, parent iteration)", () => {
	const streamArn = "arn:aws:kinesis:us-east-1:000000000000:stream/orders";
	const consumerArn = `${streamArn}/consumer/reader:1700000000`;
	const client = fakeClient({
		ListStreamsCommand: () => ({
			StreamSummaries: [{ StreamName: "orders", StreamARN: streamArn }],
		}),
		ListStreamConsumersCommand: () => ({
			Consumers: [{ ConsumerName: "reader", ConsumerARN: consumerArn }],
		}),
		DescribeStreamConsumerCommand: () => ({
			ConsumerDescription: {
				ConsumerName: "reader",
				ConsumerARN: consumerArn,
				ConsumerStatus: "ACTIVE",
			},
		}),
	});

	test("lists consumers across streams", async () => {
		const arns = await providerWith(kinesisDefinition, client).getResourceArns(
			"default",
			"us-east-1",
			"streamconsumer",
		);
		assert.deepStrictEqual(arns, [consumerArn]);
	});

	test("a consumer ARN resolves to the consumer type via matchArn", async () => {
		const fields = await providerWith(
			kinesisDefinition,
			client,
		).describeResource("default", new ARN(consumerArn));
		assert.ok(fields.some((f) => f.field === "Status" && f.value === "ACTIVE"));
	});
});

suite("Batch 1: SSM document (synthesized ARN + nested describe)", () => {
	const client = fakeClient({
		ListDocumentsCommand: () => ({
			DocumentIdentifiers: [{ Name: "My-Doc", DocumentType: "Command" }],
		}),
		DescribeDocumentCommand: (input) => ({
			Document: {
				Name: input.Name,
				DocumentType: "Command",
				Status: "Active",
				Owner: "self",
			},
		}),
	});

	test("synthesizes a document ARN from the region", async () => {
		const arns = await providerWith(ssmDefinition, client).getResourceArns(
			"default",
			"eu-west-1",
			"document",
		);
		assert.deepStrictEqual(arns, ["arn:aws:ssm:eu-west-1::document/My-Doc"]);
	});

	test("resolves the document type and describes it", async () => {
		const fields = await providerWith(ssmDefinition, client).describeResource(
			"default",
			new ARN("arn:aws:ssm:eu-west-1::document/My-Doc"),
		);
		assert.deepStrictEqual(fields[0], {
			field: "Name",
			value: "My-Doc",
			type: FieldType.NAME,
		});
		assert.ok(fields.some((f) => f.field === "Status" && f.value === "Active"));
	});
});

suite("Batch 1: EventBridge archive (region-synthesized ARN)", () => {
	const client = fakeClient({
		ListArchivesCommand: () => ({
			Archives: [{ ArchiveName: "audit", State: "ENABLED", EventCount: 5 }],
		}),
		DescribeArchiveCommand: (input) => ({
			ArchiveName: input.ArchiveName,
			State: "ENABLED",
			EventCount: 5,
		}),
	});

	test("synthesizes an account-less archive ARN", async () => {
		const arns = await providerWith(eventsDefinition, client).getResourceArns(
			"default",
			"us-east-1",
			"archive",
		);
		assert.deepStrictEqual(arns, ["arn:aws:events:us-east-1::archive/audit"]);
	});

	test("resolves and describes the archive", async () => {
		const fields = await providerWith(
			eventsDefinition,
			client,
		).describeResource(
			"default",
			new ARN("arn:aws:events:us-east-1::archive/audit"),
		);
		assert.deepStrictEqual(fields[0], {
			field: "Name",
			value: "audit",
			type: FieldType.NAME,
		});
	});
});

suite("Batch 1: API Gateway stage (augmented item, path-style ARN)", () => {
	const client = fakeClient({
		GetRestApisCommand: () => ({ items: [{ id: "api1", name: "My API" }] }),
		GetStagesCommand: () => ({
			item: [{ stageName: "prod", deploymentId: "dep1" }],
		}),
	});

	test("synthesizes a path-style stage ARN including the api id", async () => {
		const arns = await providerWith(
			apiGatewayDefinition,
			client,
		).getResourceArns("default", "us-east-1", "stage");
		assert.deepStrictEqual(arns, [
			"arn:aws:apigateway:us-east-1::/restapis/api1/stages/prod",
		]);
	});

	test("resolves the stage type via the /stages/ predicate and self-describes", async () => {
		const fields = await providerWith(
			apiGatewayDefinition,
			client,
		).describeResource(
			"default",
			new ARN("arn:aws:apigateway:us-east-1::/restapis/api1/stages/prod"),
		);
		assert.deepStrictEqual(fields[0], {
			field: "Stage Name",
			value: "prod",
			type: FieldType.NAME,
		});
		assert.ok(
			fields.some((f) => f.field === "REST API ID" && f.value === "api1"),
		);
	});
});

suite(
	"Batch 1: CloudWatch Logs metric filter (synth ARN with slashes, self)",
	() => {
		const client = fakeClient({
			DescribeMetricFiltersCommand: () => ({
				metricFilters: [
					{
						filterName: "Errors",
						logGroupName: "/aws/lambda/fn",
						filterPattern: "ERROR",
						creationTime: 0,
					},
				],
			}),
		});

		test("synthesizes a metric-filter ARN embedding the log group path", async () => {
			const arns = await providerWith(logsDefinition, client).getResourceArns(
				"default",
				"us-east-1",
				"metricfilter",
			);
			assert.deepStrictEqual(arns, [
				"arn:aws:logs:us-east-1::metric-filter:/aws/lambda/fn:Errors",
			]);
		});

		test("resolves the metric-filter type and renders detail from the list item", async () => {
			const fields = await providerWith(
				logsDefinition,
				client,
			).describeResource(
				"default",
				new ARN("arn:aws:logs:us-east-1::metric-filter:/aws/lambda/fn:Errors"),
			);
			assert.deepStrictEqual(fields, [
				{ field: "Name", value: "Errors", type: FieldType.NAME },
				{
					field: "Log Group",
					value: "/aws/lambda/fn",
					type: FieldType.LOG_GROUP,
				},
				{ field: "Pattern", value: "ERROR", type: FieldType.SHORT_TEXT },
				{
					field: "Creation Time",
					value: "1970-01-01T00:00:00.000Z",
					type: FieldType.DATE,
				},
			]);
		});
	},
);
