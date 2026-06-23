import assert from "node:assert";

import { ThemeIcon } from "vscode";

import type {
	ProfileFocus,
	RegionFocus,
	ResourceTypeFocus,
	ServiceFocus,
} from "../../models/focus.ts";
import type { ServiceProvider } from "../../platforms/aws/services/serviceProvider.ts";
import {
	ResourceProfileTreeItem,
	ResourceRegionTreeItem,
	ResourceServiceTypeTreeItem,
} from "../../views/resources/treeItems.ts";

/**
 * The combined service-and-resource-type row carries a target-aware icon: the
 * LocalStack mark for LocalStack-targeted profiles and a generic `cloud`
 * codicon for AWS-targeted profiles. No AWS-derived service icon is used.
 */
suite("resource browser tree item icons", () => {
	const profile: ProfileFocus = { id: "p", regions: [] };
	const region: RegionFocus = { id: "us-east-1", services: [] };
	const resourceType: ResourceTypeFocus = { id: "queues", arns: [] };
	const service: ServiceFocus = { id: "sqs", resourcetypes: [resourceType] };

	/* The row only calls getName + getResourceTypeNames on its provider. */
	const provider = {
		getName: () => "SQS",
		getResourceTypeNames: () => ["Queue", "Queues"],
	} as unknown as ServiceProvider;

	function rowForTarget(isLocalStack: boolean): ResourceServiceTypeTreeItem {
		const profileItem = new ResourceProfileTreeItem(
			profile,
			"000000000000",
			"",
			isLocalStack,
		);
		const regionItem = new ResourceRegionTreeItem(
			profileItem,
			region,
			"US East",
		);
		return new ResourceServiceTypeTreeItem(
			regionItem,
			service,
			provider,
			resourceType,
		);
	}

	test("LocalStack-targeted row shows the LocalStack mark", () => {
		const icon = rowForTarget(true).iconPath;
		assert.ok(icon instanceof ThemeIcon);
		assert.strictEqual(icon.id, "localstack-logo");
	});

	test("AWS-targeted row shows a generic cloud icon", () => {
		const icon = rowForTarget(false).iconPath;
		assert.ok(icon instanceof ThemeIcon);
		assert.strictEqual(icon.id, "cloud");
	});
});
