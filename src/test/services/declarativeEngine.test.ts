import assert from "node:assert";

import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import ARN from "../../platforms/aws/models/arnModel.ts";
import {
	DeclarativeServiceProvider,
	formatValue,
	getByPath,
} from "../../platforms/aws/services/declarative/engine.ts";
import { defineService } from "../../platforms/aws/services/declarative/types.ts";
import { FieldType } from "../../platforms/aws/services/serviceProvider.ts";

/**
 * The declarative engine adapts a `ServiceDefinition` (data + per-type closures)
 * to the `ServiceProvider` interface. These tests drive it with a fake service
 * whose "SDK client" returns fixed data, exercising resource-type listing,
 * identifier mapping, path-based detail rendering (both via an explicit
 * `describe` call and via the "self" list-item fallback), multi-type ARN
 * resolution, and CloudFormation mapping — without any real AWS calls.
 */

type Widget = { Arn: string; Name: string; State: string; Created: Date };
type Gadget = { Arn: string };

/* A stand-in SDK client; the definition's closures read from fixed data. */
type FakeClient = { tag: "fake" };

const WIDGET_ARN = "arn:aws:fake:us-east-1:000000000000:widget/w1";
const GADGET_ARN = "arn:aws:fake:us-east-1:000000000000:gadget/g1";

const fakeDefinition = defineService<FakeClient>({
	id: "fake",
	name: "Fake Service",
	client: () => ({ tag: "fake" }),
	resourceTypes: {
		widget: {
			singular: "Widget",
			plural: "Widgets",
			cfn: "AWS::Fake::Widget",
			list: async (): Promise<Widget[]> => [
				{
					Arn: WIDGET_ARN,
					Name: "w1",
					State: "ACTIVE",
					Created: new Date(0),
				},
			],
			id: (item: Widget) => item.Arn,
			/* no `describe`: detail is read from the matching list item ("self") */
			detail: [
				{ label: "Name", path: "Name", type: FieldType.NAME },
				{ label: "State", path: "State", type: FieldType.NAME },
				{ label: "Created", path: "Created", type: FieldType.DATE },
			],
		},
		gadget: {
			singular: "Gadget",
			plural: "Gadgets",
			cfn: "AWS::Fake::Gadget",
			list: async (): Promise<Gadget[]> => [{ Arn: GADGET_ARN }],
			id: (item: Gadget) => item.Arn,
			describe: async () => ({
				Config: { Size: 5 },
				Nested: { Deep: "value" },
			}),
			detail: [
				{ label: "Size", path: "Config.Size", type: FieldType.NUMBER },
				{ label: "Deep", path: "Nested.Deep", type: FieldType.SHORT_TEXT },
			],
		},
	},
});

function makeProvider() {
	return new DeclarativeServiceProvider(fakeDefinition);
}

suite("declarative engine: getByPath", () => {
	test("walks dotted paths", () => {
		assert.strictEqual(getByPath({ a: { b: { c: 7 } } }, "a.b.c"), 7);
	});
	test("walks bracketed array indices", () => {
		assert.strictEqual(
			getByPath({ Tags: [{ Value: "x" }, { Value: "y" }] }, "Tags[1].Value"),
			"y",
		);
	});
	test("returns undefined for a missing segment", () => {
		assert.strictEqual(getByPath({ a: {} }, "a.b.c"), undefined);
	});
});

suite("declarative engine: formatValue", () => {
	test("renders epoch-millis numbers as ISO dates", () => {
		assert.strictEqual(
			formatValue(0, FieldType.DATE),
			"1970-01-01T00:00:00.000Z",
		);
	});
	test("stringifies objects for JSON fields", () => {
		assert.strictEqual(
			formatValue({ a: 1 }, FieldType.JSON),
			JSON.stringify({ a: 1 }, null, 2),
		);
	});
	test("renders null/undefined as empty string", () => {
		assert.strictEqual(formatValue(undefined, FieldType.NAME), "");
		assert.strictEqual(formatValue(null, FieldType.NAME), "");
	});
});

suite("declarative engine: provider", () => {
	test("exposes resource types and their display names", () => {
		const provider = makeProvider();
		assert.deepStrictEqual(provider.getResourceTypes().sort(), [
			"gadget",
			"widget",
		]);
		assert.deepStrictEqual(provider.getResourceTypeNames("widget"), [
			"Widget",
			"Widgets",
		]);
	});

	test("getResourceArns maps list items to identifiers", async () => {
		const arns = await makeProvider().getResourceArns(
			"default",
			"us-east-1",
			"widget",
		);
		assert.deepStrictEqual(arns, [WIDGET_ARN]);
	});

	test("describeResource renders detail from the list item (self)", async () => {
		const fields = await makeProvider().describeResource(
			"default",
			new ARN(WIDGET_ARN),
		);
		assert.deepStrictEqual(fields, [
			{ field: "Name", value: "w1", type: FieldType.NAME },
			{ field: "State", value: "ACTIVE", type: FieldType.NAME },
			{
				field: "Created",
				value: "1970-01-01T00:00:00.000Z",
				type: FieldType.DATE,
			},
		]);
	});

	test("describeResource renders detail from an explicit describe call", async () => {
		const fields = await makeProvider().describeResource(
			"default",
			new ARN(GADGET_ARN),
		);
		assert.deepStrictEqual(fields, [
			{ field: "Size", value: "5", type: FieldType.NUMBER },
			{ field: "Deep", value: "value", type: FieldType.SHORT_TEXT },
		]);
	});

	test("maps a CloudFormation resource to its type and name", () => {
		const summary = {
			ResourceType: "AWS::Fake::Widget",
			PhysicalResourceId: "w1",
		} as StackResourceSummary;
		assert.deepStrictEqual(
			makeProvider().getArnResourceNameForCloudFormationResource(summary),
			{ resourceType: "widget", resourceName: "w1" },
		);
	});

	test("throws for an unmapped CloudFormation type", () => {
		const summary = {
			ResourceType: "AWS::Other::Thing",
			PhysicalResourceId: "x",
		} as StackResourceSummary;
		assert.throws(() =>
			makeProvider().getArnResourceNameForCloudFormationResource(summary),
		);
	});
});
