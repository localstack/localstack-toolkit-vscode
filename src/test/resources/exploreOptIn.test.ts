import assert from "node:assert";

import type {
	LocalStackStatus,
	LocalStackStatusTracker,
} from "../../utils/localstack-status.ts";
import {
	AppInspectorTreeItem,
	FocusSelectorTreeItem,
	InstanceTreeItem,
	OptInTreeItem,
	OptOutTreeItem,
	SectionTreeItem,
} from "../../views/explore/treeItems.ts";
import type { LocalStackTreeItem } from "../../views/explore/treeItems.ts";
import { LocalStackViewProvider } from "../../views/explore/viewProvider.ts";

/** A minimal status tracker stub: the provider only reads `status()`. */
function fakeTracker(status: LocalStackStatus): LocalStackStatusTracker {
	return {
		status: () => status,
		onChange: () => {},
		forceContainerStatus: () => {},
		dispose: () => {},
	};
}

async function children(
	provider: LocalStackViewProvider,
	element?: LocalStackTreeItem,
): Promise<LocalStackTreeItem[]> {
	return (await Promise.resolve(provider.getChildren(element))) ?? [];
}

/**
 * The Explore tree is gated by the resource-browser opt-in: opted out, it shows
 * only the LocalStack Instances section plus an opt-in node, and the instance
 * exposes only the App Inspector; opted in, it shows all three sections plus an
 * opt-out node, and the instance regains its focus selectors.
 */
suite("explore view opt-in gating", () => {
	test("opted out: root shows only LocalStack Instances + opt-in node", async () => {
		const provider = new LocalStackViewProvider(
			fakeTracker("running"),
			() => false,
		);
		const roots = await children(provider);
		assert.strictEqual(roots.length, 2);
		assert.ok(roots[0] instanceof SectionTreeItem);
		assert.strictEqual(roots[0].kind, "instances");
		assert.ok(roots[1] instanceof OptInTreeItem);
	});

	test("opted in: root shows three sections + opt-out node", async () => {
		const provider = new LocalStackViewProvider(
			fakeTracker("running"),
			() => true,
		);
		const roots = await children(provider);
		assert.deepStrictEqual(
			roots.slice(0, 3).map((r) => (r as SectionTreeItem).kind),
			["instances", "profiles", "workspace"],
		);
		assert.ok(roots[3] instanceof OptOutTreeItem);
	});

	test("opted out: running instance exposes only the App Inspector", async () => {
		const provider = new LocalStackViewProvider(
			fakeTracker("running"),
			() => false,
		);
		const kids = await children(
			provider,
			new InstanceTreeItem("localhost:4566", "running"),
		);
		assert.strictEqual(kids.length, 1);
		assert.ok(kids[0] instanceof AppInspectorTreeItem);
		assert.ok(!kids.some((k) => k instanceof FocusSelectorTreeItem));
	});

	test("opted in: running instance exposes App Inspector + a focus selector", async () => {
		const provider = new LocalStackViewProvider(
			fakeTracker("running"),
			() => true,
		);
		const kids = await children(
			provider,
			new InstanceTreeItem("localhost:4566", "running"),
		);
		assert.ok(kids[0] instanceof AppInspectorTreeItem);
		assert.ok(kids.some((k) => k instanceof FocusSelectorTreeItem));
	});
});
