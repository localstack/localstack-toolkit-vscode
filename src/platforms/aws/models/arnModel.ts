import { InternalError } from "../../../utils/errors.ts";

/**
 * Represents an AWS ARN (Amazon Resource Name). This class is used for extracting
 * the various fields from the ARN string.
 */
export default class ARN {
	readonly partition: string;
	readonly service: string;
	readonly region: string;
	readonly accountId: string;
	readonly resourceId: string;
	readonly resourceType?: string;
	readonly resourceName?: string;

	constructor(public readonly arn: string) {
		const arnRegex =
			/^arn:(aws[-a-z]*):([a-zA-Z0-9\-.]+):([a-zA-Z0-9\-.]*):([0-9]{12})?(:|\/)(.*)$/;
		const match = arnRegex.exec(arn);
		if (!match) {
			throw new InternalError(`Invalid or unhandled ARN: ${arn}`);
		}

		/* required fields */
		this.partition = match[1];
		this.service = match[2];
		this.region = match[3];
		this.accountId = match[4];
		this.resourceId = match[6];

		/* depending on the service, the resourceId can be dissected further */
		const resourceParts = this.resourceId.split(/[/:]/);
		if (resourceParts.length > 1) {
			this.resourceType = resourceParts[0];
			if (this.service === "cloudformation") {
				this.resourceName =
					resourceParts[1]; /* ignore the UUID from the CloudFormation stack ARN */
			} else {
				this.resourceName = this.resourceId.substring(
					this.resourceType.length + 1,
				);
			}
		} else {
			this.resourceName = this.resourceId;
		}
	}

	toString(): string {
		return this.arn;
	}
}
