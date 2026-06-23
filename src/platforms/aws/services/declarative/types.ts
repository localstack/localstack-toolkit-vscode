/*
 * Declarative service-provider format.
 *
 * A curated provider can be authored as data — a `ServiceDefinition` — instead
 * of a hand-written `ServiceProvider` subclass. A shared engine
 * (`DeclarativeServiceProvider`) executes the definition against the AWS SDK.
 * This is NOT a generic provider: nothing works without a per-service
 * definition that declares its resource types, how to list them, how to
 * identify each resource, how to map its CloudFormation type, and which detail
 * fields to show. It is curation expressed as data.
 */
import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import type ARN from "../../models/arnModel.ts";
import type { FieldType } from "../serviceProvider.ts";

/** Context handed to a resource type's `list` call. */
export type ListContext = {
	profile: string;
	region: string;
};

/** Context handed to a resource type's `describe` call. */
export type DescribeContext = {
	profile: string;
	region: string;
};

/**
 * One field shown in the Resource Details view. `path` is a dotted/bracketed
 * path walked over the detail object (e.g. `"Configuration.State"`,
 * `"Tags[0].Value"`). This is the unit the build-time field generator emits and
 * humans hand-edit.
 */
export type FieldSpec = {
	label: string;
	path: string;
	type: FieldType;
};

/**
 * Declarative definition of a single resource type within a service.
 *
 * @typeParam TClient The service's AWS SDK client type.
 * @typeParam TItem   The shape of one item returned by `list`.
 */
export type ResourceTypeDefinition<TClient = unknown, TItem = unknown> = {
	/** Human-facing singular name, e.g. "Bucket". */
	singular: string;
	/** Human-facing plural name, e.g. "Buckets". */
	plural: string;
	/**
	 * CloudFormation resource type name, e.g. "AWS::S3::Bucket". Omit when the
	 * resource type has no CloudFormation representation.
	 */
	cfn?: string;
	/**
	 * The token used to recognize this resource type within an ARN's resource
	 * segment (case-insensitive), for services with more than one type. Defaults
	 * to the resource type's id (its key in `resourceTypes`).
	 */
	arnType?: string;
	/**
	 * Optional predicate to recognize whether an ARN belongs to this resource
	 * type, for services whose types share an ARN resource token (e.g. a Kinesis
	 * stream vs. its consumer, both under `stream/`). Checked before `arnType`.
	 */
	matchArn?: (identifier: ARN) => boolean;
	/** List the live resources for a profile/region. Returns raw API items. */
	list: (client: TClient, ctx: ListContext) => Promise<TItem[]>;
	/**
	 * The resource's identifier — its ARN where the API returns one, else a
	 * synthesized ARN. The list context is provided so a resource whose list
	 * response omits an ARN can build one from the region (account may be left
	 * empty), keeping identifiers parseable by the details view.
	 */
	id: (item: TItem, ctx: ListContext) => string;
	/**
	 * Fetch the object the detail fields are read from for a single resource.
	 * Omit to reuse the matching `list` item ("self"): the engine lists, then
	 * selects the item whose `id` matches the requested ARN.
	 */
	describe?: (
		client: TClient,
		identifier: ARN,
		ctx: DescribeContext,
	) => Promise<unknown>;
	/** The ordered, typed subset of fields shown in Resource Details. */
	detail: FieldSpec[];
	/**
	 * Derive the ARN resource-name portion for a CloudFormation resource of this
	 * type. For multi-type services this must encode the type so the ARN can be
	 * resolved back to this resource type (e.g. `"statemachine:Name"`). Defaults
	 * to the resource's `PhysicalResourceId`.
	 */
	cfnResourceName?: (summary: StackResourceSummary) => string | undefined;
};

/** Declarative definition of a whole service. */
export type ServiceDefinition<TClient = unknown> = {
	/** AWS service code (manifest id), e.g. "s3". */
	id: string;
	/** Display name, e.g. "S3". */
	name: string;
	/** Construct the service's SDK client from an AWSConfig client config. */
	client: (config: object) => TClient;
	/**
	 * Resource types keyed by their id (the value used in focus/ARN paths). Each
	 * entry may have its own item type, so the item generic is erased here; use
	 * `defineResourceType` to author one with inference.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: per-type item shapes differ; erased at the record level
	resourceTypes: Record<string, ResourceTypeDefinition<TClient, any>>;
};

/**
 * Author a service definition. Identity at runtime; exists for inference and to
 * make definition files read declaratively.
 */
export function defineService<TClient>(
	definition: ServiceDefinition<TClient>,
): ServiceDefinition<TClient> {
	return definition;
}

/**
 * Author a single resource type with full inference of its client and item
 * types (so `list`/`id`/`describe` are type-checked against the API shapes).
 */
export function defineResourceType<TClient, TItem>(
	definition: ResourceTypeDefinition<TClient, TItem>,
): ResourceTypeDefinition<TClient, TItem> {
	return definition;
}
