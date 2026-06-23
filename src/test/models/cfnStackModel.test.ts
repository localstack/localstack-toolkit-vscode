import assert from "node:assert";

import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";
import type { ExtensionContext, LogOutputChannel } from "vscode";

import { CloudFormation } from "../../platforms/aws/clients/cloudformation.ts";
import ARN from "../../platforms/aws/models/arnModel.ts";
import CfnStackModel from "../../platforms/aws/models/cfnStackModel.ts";
import { ProviderFactory } from "../../platforms/aws/services/providerFactory.ts";

/**
 * CfnStackModel converts a CloudFormation stack's resources into a Focus model.
 * It depends on two collaborators we stub here:
 *  - `ProviderFactory`, initialized with a bare context (the service providers
 *    only touch the context for icon paths, which this conversion never needs);
 *  - `CloudFormation.listStackResources`, whose static method is swapped for a
 *    stub returning a fixed resource list so no AWS calls are made.
 */
const cfnHandle = CloudFormation as unknown as {
	listStackResources: (
		profile: string,
		arn: ARN,
	) => Promise<StackResourceSummary[]>;
};

const STACK_ARN =
	"arn:aws:cloudformation:us-east-1:000000000000:stack/my-stack/abc-123";

/**
 * Build a StackResourceSummary, filling the fields the SDK type requires but
 * the conversion ignores (status/timestamp) so tests only specify what matters.
 */
function res(partial: Partial<StackResourceSummary>): StackResourceSummary {
	return {
		ResourceStatus: "CREATE_COMPLETE",
		LastUpdatedTimestamp: new Date(0),
		...partial,
	} as StackResourceSummary;
}

/** Build a LogOutputChannel stub that records the messages passed to `warn`. */
function makeLogStub(): { log: LogOutputChannel; warnings: string[] } {
	const warnings: string[] = [];
	const log = {
		warn: (message: string) => {
			warnings.push(message);
		},
	} as unknown as LogOutputChannel;
	return { log, warnings };
}

suite("CfnStackModel", () => {
	let originalListStackResources: typeof cfnHandle.listStackResources;

	suiteSetup(() => {
		ProviderFactory.initialize({} as unknown as ExtensionContext);
		originalListStackResources = cfnHandle.listStackResources;
	});

	suiteTeardown(() => {
		cfnHandle.listStackResources = originalListStackResources;
	});

	function stubResources(resources: Partial<StackResourceSummary>[]) {
		const full = resources.map(res);
		cfnHandle.listStackResources = async () => full;
	}

	test("maps supported resources into a grouped Focus", async () => {
		stubResources([
			{
				LogicalResourceId: "MyQueue",
				ResourceType: "AWS::SQS::Queue",
				PhysicalResourceId:
					"https://sqs.us-east-1.amazonaws.com/000000000000/my-queue",
			},
			{
				LogicalResourceId: "MyFunction",
				ResourceType: "AWS::Lambda::Function",
				PhysicalResourceId: "my-function",
			},
		]);

		const { log, warnings } = makeLogStub();
		const focus = await new CfnStackModel(
			"default",
			new ARN(STACK_ARN),
			log,
		).toFocusModel();

		assert.strictEqual(warnings.length, 0);
		assert.strictEqual(focus.profiles.length, 1);
		assert.strictEqual(focus.profiles[0].id, "default");

		const region = focus.profiles[0].regions[0];
		assert.strictEqual(region.id, "us-east-1");

		const sqs = region.services.find((s) => s.id === "sqs");
		assert.ok(sqs, "expected an sqs service entry");
		assert.deepStrictEqual(sqs.resourcetypes, [
			{ id: "queue", arns: ["arn:aws:sqs:us-east-1:000000000000:my-queue"] },
		]);

		const lambda = region.services.find((s) => s.id === "lambda");
		assert.ok(lambda, "expected a lambda service entry");
		assert.deepStrictEqual(lambda.resourcetypes, [
			{
				id: "function",
				arns: ["arn:aws:lambda:us-east-1:000000000000:function:my-function"],
			},
		]);
	});

	test("groups multiple resources of the same type under one service", async () => {
		stubResources([
			{
				LogicalResourceId: "QueueA",
				ResourceType: "AWS::SQS::Queue",
				PhysicalResourceId:
					"https://sqs.us-east-1.amazonaws.com/000000000000/queue-a",
			},
			{
				LogicalResourceId: "QueueB",
				ResourceType: "AWS::SQS::Queue",
				PhysicalResourceId:
					"https://sqs.us-east-1.amazonaws.com/000000000000/queue-b",
			},
		]);

		const { log } = makeLogStub();
		const focus = await new CfnStackModel(
			"default",
			new ARN(STACK_ARN),
			log,
		).toFocusModel();

		const sqs = focus.profiles[0].regions[0].services.find(
			(s) => s.id === "sqs",
		);
		assert.ok(sqs);
		assert.deepStrictEqual(sqs.resourcetypes[0].arns, [
			"arn:aws:sqs:us-east-1:000000000000:queue-a",
			"arn:aws:sqs:us-east-1:000000000000:queue-b",
		]);
	});

	test("skips and warns about resources it cannot map, keeping the rest", async () => {
		stubResources([
			{
				LogicalResourceId: "MyQueue",
				ResourceType: "AWS::SQS::Queue",
				PhysicalResourceId:
					"https://sqs.us-east-1.amazonaws.com/000000000000/my-queue",
			},
			/* Unsupported service: no provider is registered for "ec2". */
			{
				LogicalResourceId: "MyInstance",
				ResourceType: "AWS::EC2::Instance",
				PhysicalResourceId: "i-1234567890abcdef0",
			},
			/* Malformed summary: a missing ResourceType used to throw a
			 * TypeError ("Cannot read properties of undefined (reading 'split')")
			 * that aborted the whole stack. It must now be skipped instead. */
			{ LogicalResourceId: "Mystery", PhysicalResourceId: "whatever" },
		]);

		const { log, warnings } = makeLogStub();
		const focus = await new CfnStackModel(
			"default",
			new ARN(STACK_ARN),
			log,
		).toFocusModel();

		/* The recognized SQS queue still made it through. */
		const services = focus.profiles[0].regions[0].services;
		assert.deepStrictEqual(
			services.map((s) => s.id),
			["sqs"],
		);

		/* Both unmappable resources were reported, identified by logical id. */
		assert.strictEqual(warnings.length, 2);
		assert.ok(warnings.some((w) => w.includes("MyInstance")));
		assert.ok(warnings.some((w) => w.includes("Mystery")));
	});

	test("routes a StepFunctions CFN namespace to the states provider via label mapping", async () => {
		stubResources([
			{
				LogicalResourceId: "MyStateMachine",
				ResourceType: "AWS::StepFunctions::StateMachine",
				PhysicalResourceId: "my-state-machine",
			},
		]);

		const { log, warnings } = makeLogStub();
		const focus = await new CfnStackModel(
			"default",
			new ARN(STACK_ARN),
			log,
		).toFocusModel();

		/* The `states` provider does not yet implement CloudFormation mapping, so
		 * the resource is skipped — but the warning originates from the states
		 * provider, proving the label mapping routed `StepFunctions` to `states`
		 * rather than failing earlier at provider lookup. */
		assert.deepStrictEqual(focus.profiles[0].regions[0].services, []);
		assert.strictEqual(warnings.length, 1);
		assert.ok(warnings[0].includes("Step Functions"));
	});

	test("does not require a log channel", async () => {
		stubResources([
			{
				LogicalResourceId: "MyInstance",
				ResourceType: "AWS::EC2::Instance",
				PhysicalResourceId: "i-1234567890abcdef0",
			},
		]);

		/* No log passed: the skip path must not throw on the optional channel. */
		const focus = await new CfnStackModel(
			"default",
			new ARN(STACK_ARN),
		).toFocusModel();

		assert.deepStrictEqual(focus.profiles[0].regions[0].services, []);
	});

	test("rejects ARNs that are not CloudFormation stacks", () => {
		assert.throws(
			() =>
				new CfnStackModel(
					"default",
					new ARN("arn:aws:sqs:us-east-1:000000000000:my-queue"),
				),
		);
	});
});
