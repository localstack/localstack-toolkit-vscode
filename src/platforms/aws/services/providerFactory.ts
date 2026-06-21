import type * as vscode from "vscode";

import { InternalError } from "../../../utils/errors.ts";

import { CloudFormationServiceProvider } from "./cloudformation/provider.ts";
import { DynamoDBServiceProvider } from "./dynamodb/provider.ts";
import { IAMServiceProvider } from "./iam/provider.ts";
import { LambdaServiceProvider } from "./lambda/provider.ts";
import type { ServiceProvider } from "./serviceProvider.ts";
import { SnsServiceProvider } from "./sns/provider.ts";
import { SqsServiceProvider } from "./sqs/provider.ts";
import { StatesServiceProvider } from "./states/provider.ts";

/**
 * A factory for providing access to AWS service providers.
 */
export class ProviderFactory {
	/**
	 * Mapping of AWS service IDs to their providers.
	 */
	private static providers: Map<string, ServiceProvider>;

	/**
	 * Sorted array of providers (same as providers map, but sorted by name).
	 */
	private static providersArray: ServiceProvider[];

	/**
	 * Initialize the ProviderFactory so it's able to provide service provider
	 * instances.
	 */
	public static initialize(context: vscode.ExtensionContext) {
		ProviderFactory.providers = new Map<string, ServiceProvider>([
			["cloudformation", new CloudFormationServiceProvider(context)],
			["dynamodb", new DynamoDBServiceProvider(context)],
			["iam", new IAMServiceProvider(context)],
			["lambda", new LambdaServiceProvider(context)],
			["sns", new SnsServiceProvider(context)],
			["sqs", new SqsServiceProvider(context)],
			["states", new StatesServiceProvider(context)],
		]);

		ProviderFactory.providersArray = Array.from(
			ProviderFactory.providers.values(),
		).sort((a, b) => {
			return a.getName().localeCompare(b.getName());
		});
	}

	/**
	 * Get the service provider for a given service ID. It should not be
	 * possible to pass an illegal name into this method, so treat it like
	 * an internal error.
	 *
	 * @param id The service ID.
	 * @returns The service provider for the given service ID.
	 */
	public static getProviderForService(id: string): ServiceProvider {
		const provider = ProviderFactory.providers.get(id);
		if (!provider) {
			throw new InternalError(`Unhandled service: ${id}`);
		}
		return provider;
	}

	/**
	 * Return the complete list of supported ServiceProviders, in alphabetical
	 * (display) order.
	 */
	public static getSupportedServices(): ServiceProvider[] {
		return ProviderFactory.providersArray;
	}
}
