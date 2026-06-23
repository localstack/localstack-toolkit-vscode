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
 * Mapping of AWS service IDs to their providers.
 */
let providers: Map<string, ServiceProvider>;

/**
 * Sorted array of providers (same as providers map, but sorted by name).
 */
let providersArray: ServiceProvider[];

/**
 * A factory for providing access to AWS service providers.
 *
 * Providers are resolved by manifest service id. A manifest service with no
 * registered provider is simply absent — there is no generic/fallback provider.
 */
export const ProviderFactory = {
	/**
	 * Initialize the ProviderFactory so it's able to provide service provider
	 * instances. Both declarative definitions and imperative subclasses are
	 * registered into the same map, keyed by their service id.
	 */
	initialize() {
		const map = new Map<string, ServiceProvider>();

		/* Declarative providers (data-authored, executed by the engine). */
		for (const definition of serviceDefinitions) {
			map.set(definition.id, new DeclarativeServiceProvider(definition));
		}

		/* Imperative providers (escape hatch). */
		for (const Provider of IMPERATIVE_PROVIDERS) {
			const provider = new Provider();
			map.set(provider.getId(), provider);
		}

		providers = map;
		providersArray = Array.from(map.values()).sort((a, b) =>
			a.getName().localeCompare(b.getName()),
		);
	},

	/**
	 * Get the service provider for a given service ID. It should not be
	 * possible to pass an illegal name into this method, so treat it like
	 * an internal error.
	 *
	 * @param id The service ID.
	 * @returns The service provider for the given service ID.
	 */
	getProviderForService(id: string): ServiceProvider {
		const provider = providers.get(id);
		if (!provider) {
			throw new InternalError(`Unhandled service: ${id}`);
		}
		return provider;
	},

	/**
	 * Return the provider for a service id, or `undefined` if no provider is
	 * registered (e.g. a manifest service not yet curated). Callers that should
	 * tolerate uncurated services use this and skip/log the absence.
	 */
	tryGetProviderForService(id: string): ServiceProvider | undefined {
		return providers.get(id);
	},

	/**
	 * Whether a provider is registered for the given service id.
	 */
	hasProviderForService(id: string): boolean {
		return providers.has(id);
	},

	/**
	 * Return every registered provider's service id.
	 */
	getRegisteredServiceIds(): string[] {
		return [...providers.keys()];
	},

	/**
	 * Return the complete list of supported ServiceProviders, in alphabetical
	 * (display) order.
	 */
	getSupportedServices(): ServiceProvider[] {
		return providersArray;
	},
};
