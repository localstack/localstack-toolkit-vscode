import { Stack, StackResource } from "@aws-sdk/client-cloudformation";
import type { StackResourceSummary } from "@aws-sdk/client-cloudformation";
import type { LogOutputChannel } from "vscode";

import { Focus } from "../../../models/focus.ts";
import type { ServiceFocus } from "../../../models/focus.ts";
import { InternalError } from "../../../utils/errors.ts";
import { CloudFormation } from "../clients/cloudformation.ts";
import { ProviderFactory } from "../services/providerFactory.ts";
import type { ServiceResourceArnTuple } from "../services/serviceProvider.ts";

import type ARN from "./arnModel.ts";

/**
 * Model representing a CloudFormation Stack, with the ability to return
 * the equivalent Focus model for the stack's resources. This allows the
 * Focus-based UI to display the resources that belong to a CloudFormation stack.
 */
export default class CfnStackModel {
	private partition: string;
	private region: string;
	private accountId: string;

	/**
	 * Constructor for the CfnStackModel class.
	 * @param profile The profile associated with the CloudFormation stack.
	 * @param arn The ARN of the CloudFormation stack.
	 * @param log Optional output channel used to report stack resources that
	 *   could not be mapped into the Focus model (see `convertToServicesList`).
	 */
	constructor(
		public profile: string,
		public arn: ARN,
		private readonly log?: LogOutputChannel,
	) {
		if (arn.service !== "cloudformation" || arn.resourceType !== "stack") {
			throw new InternalError(
				`Invalid CloudFormation Stack ARN: ${arn.toString()}`,
			);
		}
		this.partition = arn.partition;
		this.region = arn.region;
		this.accountId = arn.accountId;
	}

	/**
	 * Query the resources belonging to this CloudFormation stack, then return an
	 * equivalent Focus model showing only the relevant resources.
	 */
	public async toFocusModel(): Promise<Focus> {
		const stackResources = await CloudFormation.listStackResources(
			this.profile,
			this.arn,
		);
		const servicesList = this.convertToServicesList(stackResources);

		const focus: Focus = Focus.parse({
			version: "1.0",
			profiles: [
				{
					id: this.profile,
					regions: [
						{
							id: this.region,
							services: servicesList,
						},
					],
				},
			],
		});
		return focus;
	}

	/**
	 * Convert the full list of CloudFormation stack resources into the Focus services
	 * format. This is done in multiple steps:
	 * 1. Convert each CloudFormation resource (e.g. "AWS::SQS::Queue") into a tuple of
	 *    (serviceName, resourceTypeName, resourceArn), such as ("sqs", "queue", "arn:aws:sqs:...").
	 *    Conversion is per-resource and fault-tolerant: a resource we can't recognize or
	 *    map to an ARN is skipped (with a warning logged) rather than aborting the whole
	 *    stack, so the stack still shows every resource we *can* represent.
	 * 2. Group the tuples by service and resource type, to create the hierarchical structure
	 *    required by Focus.
	 * 3. Traverse our existing ordered list of services and resource types (within services)
	 *    to build the final services list for the Focus. Using this consistent ordering
	 *    ensures a consistent display on the UI.
	 */
	private convertToServicesList(
		stackResources: StackResourceSummary[],
	): ServiceFocus[] {
		/*
		 * Convert each CloudFormation resource into a (service, resourceType, arn)
		 * tuple. Any resource that can't be converted — an unsupported service or
		 * resource type, or a summary missing the fields we rely on — is skipped
		 * with a warning instead of throwing, which would otherwise prevent the
		 * entire stack from loading.
		 */
		const tuples: ServiceResourceArnTuple[] = [];
		for (const resource of stackResources) {
			try {
				tuples.push(this.convertToTuple(resource));
			} catch (error) {
				this.log?.warn(
					`[cfn-stack] Skipping unrecognized resource ` +
						`${resource.LogicalResourceId} (${resource.ResourceType}): ${String(error)}`,
				);
			}
		}

		/* group the ARNs by service and resource type, so we end up with a hierarchical map */
		const servicesMap = new Map<string, Map<string, string[]>>();
		tuples.forEach(({ serviceId, resourceType, arn }) => {
			if (!servicesMap.has(serviceId)) {
				servicesMap.set(serviceId, new Map<string, string[]>());
			}
			const resourceMap = servicesMap.get(serviceId)!;
			if (!resourceMap.has(resourceType)) {
				resourceMap.set(resourceType, []);
			}
			resourceMap.get(resourceType)!.push(arn);
		});

		/*
		 * Traverse our ordered list of services, and resource types to build the final structure.
		 * This ensures the services and resource types appear in a consistent order on the UI,
		 * regardless of the order they were discovered in the CloudFormation stack.
		 */
		const serviceFocusList: ServiceFocus[] = [];

		ProviderFactory.getSupportedServices().forEach((serviceProvider) => {
			const serviceId = serviceProvider.getId();
			const resourceMap = servicesMap.get(serviceId);

			/* If the cloudformation stack has resources for this service, add them to the list */
			if (resourceMap) {
				const resourceTypes: { id: string; arns: string[] }[] = [];

				/* Traverse the resource types in order */
				const orderedResourceTypes = serviceProvider.getResourceTypes();
				orderedResourceTypes.forEach((resourceType) => {
					const arns = resourceMap.get(resourceType);
					if (arns) {
						resourceTypes.push({ id: resourceType, arns });
					}
				});

				if (resourceTypes.length > 0) {
					serviceFocusList.push({
						id: serviceId,
						resourcetypes: resourceTypes,
					});
				}
			}
		});

		return serviceFocusList;
	}

	/**
	 * Convert a single CloudFormation stack resource into a tuple of
	 * (serviceName, resourceTypeName, resourceArn)
	 */
	private convertToTuple(
		stackResourceSummary: StackResourceSummary,
	): ServiceResourceArnTuple {
		const [aws, service, _resourceTypeName] =
			stackResourceSummary.ResourceType!.split("::"); // e.g. ["SQS", "Queue"]
		const serviceId = service.toLowerCase();

		/* We only support CloudFormation resources that start with AWS:: */
		if (aws !== "AWS") {
			throw new InternalError(
				`Unsupported CloudFormation resource: ${stackResourceSummary.ResourceType}`,
			);
		}

		/* look up the service handler for the AWS service */
		const serviceHandler = ProviderFactory.getProviderForService(serviceId);
		if (!serviceHandler) {
			throw new InternalError(`Unsupported service: ${serviceId}`);
		}

		/*
		 * For the specific CloudFormation resource type (e.g. AWS::SQS::Queue), compute the
		 * resourceType (e.g. "function") and the resourceName name portion of the ARN (e.g. "function:my-lambda-function")
		 */
		const { resourceType, resourceName } =
			serviceHandler.getArnResourceNameForCloudFormationResource(
				stackResourceSummary,
			);
		const arn = `arn:${this.partition}:${serviceId}:${this.region}:${this.accountId}:${resourceName}`;
		return { serviceId, resourceType, arn };
	}
}
