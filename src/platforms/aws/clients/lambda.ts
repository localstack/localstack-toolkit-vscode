import {
	GetEventSourceMappingCommand,
	GetFunctionCommand,
	LambdaClient,
	ListEventSourceMappingsCommand,
	ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import type {
	EventSourceMappingConfiguration,
	FunctionConfiguration,
	ListFunctionsCommandOutput,
} from "@aws-sdk/client-lambda";

import { memoize } from "../../../utils/memoize.ts";
import type ARN from "../models/arnModel.ts";
import AWSConfig from "../models/awsConfig.ts";

/**
 * Accessor functions for the AWS "Lambda" service
 */
export class Lambda {
	private static cachedGetLambdaClient = memoize(
		(profile: string, region: string) => {
			return new LambdaClient(AWSConfig.getClientConfig(profile, region));
		},
	);

	/**
	 * List the Lambda functions in the specified profile/region. If the profile is not valid,
	 * reject the promise and let the caller behave appropriately.
	 */
	public static async listFunctions(
		profile: string,
		region: string,
	): Promise<FunctionConfiguration[]> {
		const client = Lambda.cachedGetLambdaClient(profile, region);

		const functions: FunctionConfiguration[] = [];
		let nextToken: string | undefined;
		do {
			const command = new ListFunctionsCommand({ Marker: nextToken });
			const response: ListFunctionsCommandOutput = await client.send(command);
			if (response.Functions) {
				functions.push(...response.Functions);
			}
			nextToken = response.NextMarker;
		} while (nextToken);

		return functions;
	}

	/**
	 * Get details of a specific Lambda function
	 */
	public static async getFunction(
		profile: string,
		region: string,
		functionArn: ARN,
	): Promise<FunctionConfiguration> {
		const client = Lambda.cachedGetLambdaClient(profile, region);
		const command = new GetFunctionCommand({
			FunctionName: functionArn.resourceName,
		});
		const response = await client.send(command);
		if (response.Configuration) {
			return response.Configuration;
		} else {
			throw new Error(
				`Failed to get Lambda function: ${functionArn.resourceName}`,
			);
		}
	}

	/**
	 * List all the event source mappings in the account/region.
	 */
	public static async listEventSourceMappings(
		profile: string,
		region: string,
	): Promise<EventSourceMappingConfiguration[]> {
		const client = Lambda.cachedGetLambdaClient(profile, region);

		const mappings: EventSourceMappingConfiguration[] = [];
		let nextToken: string | undefined;
		do {
			const command: ListEventSourceMappingsCommand =
				new ListEventSourceMappingsCommand({ Marker: nextToken });
			const response = await client.send(command);
			if (response.EventSourceMappings) {
				mappings.push(...response.EventSourceMappings);
			}
			nextToken = response.NextMarker;
		} while (nextToken);

		return mappings;
	}

	/**
	 * Get details of a specific event source mapping
	 */
	public static async getEventSourceMapping(
		profile: string,
		region: string,
		mappingArn: ARN,
	): Promise<EventSourceMappingConfiguration> {
		const client = Lambda.cachedGetLambdaClient(profile, region);

		const command = new GetEventSourceMappingCommand({
			UUID: mappingArn.resourceName,
		});
		return await client.send(command);
	}
}
