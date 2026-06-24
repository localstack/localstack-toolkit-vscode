import assert from "node:assert";

import ARN from "../../platforms/aws/models/arnModel.ts";
import { InternalError } from "../../utils/errors.ts";

suite("ARN", () => {
	test("parses a valid Step Functions ARN", () => {
		const arn = new ARN(
			"arn:aws:states:us-east-1:123456789012:stateMachine:my-state-machine",
		);

		assert.strictEqual(arn.partition, "aws");
		assert.strictEqual(arn.service, "states");
		assert.strictEqual(arn.region, "us-east-1");
		assert.strictEqual(arn.accountId, "123456789012");
		assert.strictEqual(arn.resourceId, "stateMachine:my-state-machine");
		assert.strictEqual(arn.resourceType, "stateMachine");
		assert.strictEqual(arn.resourceName, "my-state-machine");
	});

	test("parses a valid DynamoDB ARN", () => {
		const arn = new ARN(
			"arn:aws:dynamodb:ap-southeast-2:123456789012:table/my-table",
		);

		assert.strictEqual(arn.service, "dynamodb");
		assert.strictEqual(arn.resourceType, "table");
		assert.strictEqual(arn.resourceName, "my-table");
	});

	test("parses a valid Lambda ARN", () => {
		const arn = new ARN(
			"arn:aws:lambda:eu-central-1:123456789012:function:my-function",
		);

		assert.strictEqual(arn.service, "lambda");
		assert.strictEqual(arn.resourceType, "function");
		assert.strictEqual(arn.resourceName, "my-function");
	});

	test("parses a valid SNS ARN without a resource type", () => {
		const arn = new ARN("arn:aws:sns:us-east-1:123456789012:my-topic");

		assert.strictEqual(arn.service, "sns");
		assert.strictEqual(arn.resourceId, "my-topic");
		assert.strictEqual(arn.resourceType, undefined);
		assert.strictEqual(arn.resourceName, "my-topic");
	});

	test("accepts valid non-standard partition names", () => {
		const arn = new ARN(
			"arn:aws-us-gov:lambda:us-east-1:123456789012:function:my-function",
		);

		assert.strictEqual(arn.partition, "aws-us-gov");
	});

	test("rejects invalid ARNs", () => {
		assert.throws(
			() =>
				new ARN("aws:lambda:eu-central-1:123456789012:function:my-function"),
			InternalError,
		);
		assert.throws(
			() => new ARN("arn:aws:lambda:eu-central-1:12347:function:my-function"),
			InternalError,
		);
		assert.throws(() => new ARN("completely-invalid-arn"), InternalError);
	});
});
