import { Stack } from "@aws-sdk/client-cloudformation";
import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";

import { InternalError } from "../../../utils/errors.ts";
import type ARN from "../models/arnModel.ts";

/**
 * Supported field types for resource descriptions. The type indicates
 * what operations (hyperlinking etc) can be done with the data values
 */
export enum FieldType {
	NAME = "name" /* name, status, type, or any other short ID */,
	ARN = "arn" /* can be hyperlinked */,
	DATE = "date",
	SHORT_TEXT = "shortText",
	LONG_TEXT = "longText" /* can be shown in an editor for easier reading */,
	JSON = "json" /* can be shown in an editor with JSON syntax highlighting */,
	NUMBER = "number" /* numeric value, e.g. count of resources */,
	LOG_GROUP = "logGroup" /* can be hyperlinked to CloudWatch Logs */,
}

/**
 * Used in various places to unique identify a service/resource/ARN combination
 */
export type ServiceResourceArnTuple = {
	serviceId: string;
	resourceType: string;
	arn: string;
};

/**
 * Abstract parent class for all service providers.
 */
export abstract class ServiceProvider {
	/**
	 * Map of the provider's resource types to their human-facing names [singular, plural].
	 * Must be overidden by subclasses
	 */
	protected abstract resourceTypes: Record<string, [string, string]>;

	/**
	 * Provide the ID of the AWS service managed by this provider
	 */
	abstract getId(): string;

	/**
	 * Return the human-readable name of this AWS service.
	 */
	abstract getName(): string;

	/**
	 * Return the ARNs associated with the resource type
	 */
	abstract getResourceArns(
		profile: string,
		region: string,
		resourceType: string,
	): Promise<string[]>;

	/**
	 * Return the fields associated with the resource, to appear in the Resource Details view
	 */
	abstract describeResource(
		profile: string,
		arn: ARN,
	): Promise<{ field: string; value: string; type: FieldType }[]>;

	/**
	 * Given a CloudFormation resource record, compute the corresponding ARN resource name
	 */
	abstract getArnResourceNameForCloudFormationResource(
		stackResourceSummary: StackResourceSummary,
	): { resourceType: string; resourceName: string };

	/**
	 * Return the resource type names [singular, plural] for this AWS service
	 */
	public getResourceTypeNames(resourceType: string): string[] {
		const resourceTypeNames = this.resourceTypes[resourceType];
		if (!resourceTypeNames) {
			throw new InternalError(`Unknown resource type: ${resourceType}`);
		}
		return resourceTypeNames;
	}

	/**
	 * Get the resource types for this AWS service.
	 * @returns An array of resource type IDs.
	 */
	public getResourceTypes(): string[] {
		return Object.keys(this.resourceTypes);
	}
}
