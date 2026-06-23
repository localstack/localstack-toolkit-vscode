/*
 * The engine that turns a declarative `ServiceDefinition` into a working
 * `ServiceProvider`. It adapts the definition's data + per-type closures to the
 * provider interface (list resource types, list resources, describe a resource
 * by walking field paths, map CloudFormation types), constructing the service's
 * SDK client through `AWSConfig.getClientConfig` so the same definition works
 * against the LocalStack emulator and real AWS.
 */
import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";
import type * as vscode from "vscode";

import { InternalError } from "../../../../utils/errors.ts";
import { memoize } from "../../../../utils/memoize.ts";
import type ARN from "../../models/arnModel.ts";
import AWSConfig from "../../models/awsConfig.ts";
import { FieldType, ServiceProvider } from "../serviceProvider.ts";

import type {
	FieldSpec,
	ResourceTypeDefinition,
	ServiceDefinition,
} from "./types.ts";

/**
 * Read a value out of a detail object by a dotted/bracketed path,
 * e.g. `"Configuration.State"` or `"Tags[0].Value"`. Returns `undefined` if any
 * segment is missing.
 */
export function getByPath(obj: unknown, path: string): unknown {
	const parts = path
		.replace(/\[(\d+)\]/g, ".$1")
		.split(".")
		.filter((part) => part.length > 0);
	let current: unknown = obj;
	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/** Stringify an unknown value safely (objects as JSON, never `[object Object]`). */
function safeToString(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}
	/* symbol / function: not meaningfully displayable */
	return "";
}

/** Render a raw value as the display string for its `FieldType`. */
export function formatValue(value: unknown, type: FieldType): string {
	if (value === null || value === undefined) {
		return "";
	}
	switch (type) {
		case FieldType.DATE:
			if (value instanceof Date) {
				return value.toISOString();
			}
			/* epoch seconds or millis */
			if (typeof value === "number") {
				const millis = value < 1e12 ? value * 1000 : value;
				return new Date(millis).toISOString();
			}
			return safeToString(value);
		case FieldType.JSON:
			return typeof value === "string" ? value : JSON.stringify(value, null, 2);
		default:
			return safeToString(value);
	}
}

/**
 * A `ServiceProvider` backed by a declarative `ServiceDefinition`. One instance
 * per service; the SDK client is created lazily and memoized per profile/region.
 */
export class DeclarativeServiceProvider<TClient> extends ServiceProvider {
	protected resourceTypes: Record<string, [string, string]>;

	private readonly getClient: (profile: string, region: string) => TClient;

	constructor(
		context: vscode.ExtensionContext,
		private readonly definition: ServiceDefinition<TClient>,
	) {
		super(context);
		this.resourceTypes = Object.fromEntries(
			Object.entries(definition.resourceTypes).map(([id, def]) => [
				id,
				[def.singular, def.plural] as [string, string],
			]),
		);
		this.getClient = memoize((profile: string, region: string) =>
			definition.client(AWSConfig.getClientConfig(profile, region)),
		);
	}

	getId(): string {
		return this.definition.id;
	}

	getName(): string {
		return this.definition.name;
	}

	async getResourceArns(
		profile: string,
		region: string,
		resourceType: string,
	): Promise<string[]> {
		const def = this.definition.resourceTypes[resourceType];
		if (!def) {
			throw new InternalError(`Unknown resource type: ${resourceType}`);
		}
		const client = this.getClient(profile, region);
		const items = await def.list(client, { profile, region });
		return items.map((item) => def.id(item, { profile, region }));
	}

	async describeResource(
		profile: string,
		arn: ARN,
	): Promise<{ field: string; value: string; type: FieldType }[]> {
		const def = this.resolveResourceType(arn);
		const client = this.getClient(profile, arn.region);

		let detailObject: unknown;
		if (def.describe) {
			detailObject = await def.describe(client, arn, {
				profile,
				region: arn.region,
			});
		} else {
			/* "self": list and find the matching item by identifier. */
			const ctx = { profile, region: arn.region };
			const items = await def.list(client, ctx);
			detailObject = items.find((item) => def.id(item, ctx) === arn.toString());
			if (detailObject === undefined) {
				throw new InternalError(`Resource not found: ${arn.toString()}`);
			}
		}

		return def.detail.map((spec: FieldSpec) => ({
			field: spec.label,
			value: formatValue(getByPath(detailObject, spec.path), spec.type),
			type: spec.type,
		}));
	}

	getArnResourceNameForCloudFormationResource(
		stackResourceSummary: StackResourceSummary,
	): { resourceType: string; resourceName: string } {
		const cfnType = stackResourceSummary.ResourceType;
		const entry = Object.entries(this.definition.resourceTypes).find(
			([, def]) => def.cfn === cfnType,
		);
		if (!entry) {
			throw new Error(
				`Unsupported resource type for ${this.definition.name}: ${cfnType}`,
			);
		}
		const [resourceType, def] = entry;
		const resourceName = def.cfnResourceName
			? def.cfnResourceName(stackResourceSummary)
			: stackResourceSummary.PhysicalResourceId;
		if (!resourceName) {
			throw new Error(
				`Missing identifier for CloudFormation resource ${cfnType}`,
			);
		}
		return { resourceType, resourceName };
	}

	/**
	 * Resolve which resource type an ARN refers to. With a single type, that type
	 * is used; otherwise the ARN's resource-segment token is matched against each
	 * type's `arnType` (defaulting to its id), case-insensitively.
	 */
	private resolveResourceType(
		arn: ARN,
		// biome-ignore lint/suspicious/noExplicitAny: item type is erased across the record
	): ResourceTypeDefinition<TClient, any> {
		const entries = Object.entries(this.definition.resourceTypes) as [
			string,
			ResourceTypeDefinition<TClient, unknown>,
		][];
		if (entries.length === 1) {
			return entries[0][1];
		}
		/* An explicit predicate wins (for types sharing an ARN resource token). */
		const byPredicate = entries.find(([, def]) => {
			const predicate = def.matchArn;
			return typeof predicate === "function" && predicate(arn);
		});
		if (byPredicate) {
			return byPredicate[1];
		}
		const arnToken = arn.resourceType?.toLowerCase();
		const match = entries.find(
			([id, def]) => (def.arnType ?? id).toLowerCase() === arnToken,
		);
		if (!match) {
			throw new InternalError(
				`Cannot resolve resource type for ARN: ${arn.toString()}`,
			);
		}
		return match[1];
	}
}
