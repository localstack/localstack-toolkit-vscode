import type * as vscode from "vscode";

import { InternalError } from "../../../utils/errors.ts";

import { CloudFormationServiceProvider } from "./cloudformation/provider.ts";
import { DeclarativeServiceProvider } from "./declarative/engine.ts";
import { serviceDefinitions } from "./definitions/index.ts";
import { DynamoDBServiceProvider } from "./dynamodb/provider.ts";
import { IAMServiceProvider } from "./iam/provider.ts";
import { LambdaServiceProvider } from "./lambda/provider.ts";
import type { ServiceProvider } from "./serviceProvider.ts";
import { SnsServiceProvider } from "./sns/provider.ts";
import { SqsServiceProvider } from "./sqs/provider.ts";
import { StatesServiceProvider } from "./states/provider.ts";

/**
 * Imperative `ServiceProvider` subclasses (the escape hatch for services that
 * cannot be expressed declaratively). These register identically to declarative
 * providers — both end up as `ServiceProvider` instances in the same map.
 */
const IMPERATIVE_PROVIDERS = [
	CloudFormationServiceProvider,
	DynamoDBServiceProvider,
	IAMServiceProvider,
	LambdaServiceProvider,
	SnsServiceProvider,
	SqsServiceProvider,
	StatesServiceProvider,
];

/**
 * A factory for providing access to AWS service providers.
 *
 * Providers are resolved by manifest service id. A manifest service with no
 * registered provider is simply absent — there is no generic/fallback provider.
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
	 * instances. Both declarative definitions and imperative subclasses are
	 * registered into the same map, keyed by their service id.
	 */
	public static initialize(context: vscode.ExtensionContext) {
		const providers = new Map<string, ServiceProvider>();

		/* Declarative providers (data-authored, executed by the engine). */
		for (const definition of serviceDefinitions) {
			providers.set(
				definition.id,
				new DeclarativeServiceProvider(context, definition),
			);
		}

		/* Imperative providers (escape hatch). */
		for (const Provider of IMPERATIVE_PROVIDERS) {
			const provider = new Provider(context);
			providers.set(provider.getId(), provider);
		}

		ProviderFactory.providers = providers;
		ProviderFactory.providersArray = Array.from(providers.values()).sort(
			(a, b) => a.getName().localeCompare(b.getName()),
		);
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
	 * Return the provider for a service id, or `undefined` if no provider is
	 * registered (e.g. a manifest service not yet curated). Callers that should
	 * tolerate uncurated services use this and skip/log the absence.
	 */
	public static tryGetProviderForService(
		id: string,
	): ServiceProvider | undefined {
		return ProviderFactory.providers.get(id);
	}

	/**
	 * Whether a provider is registered for the given service id.
	 */
	public static hasProviderForService(id: string): boolean {
		return ProviderFactory.providers.has(id);
	}

	/**
	 * Return every registered provider's service id.
	 */
	public static getRegisteredServiceIds(): string[] {
		return [...ProviderFactory.providers.keys()];
	}

	/**
	 * Return the complete list of supported ServiceProviders, in alphabetical
	 * (display) order.
	 */
	public static getSupportedServices(): ServiceProvider[] {
		return ProviderFactory.providersArray;
	}
}
