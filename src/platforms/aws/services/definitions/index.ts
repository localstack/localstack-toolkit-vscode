/*
 * Registry of declarative service definitions. Each entry is executed by the
 * `DeclarativeServiceProvider` engine and registered through `ProviderFactory`
 * exactly like an imperative provider. Add a service by authoring a definition
 * (see `defineService`) and listing it here.
 *
 * The item generic of each definition is erased here (`any`) because every
 * service has its own client and item shapes; the engine treats them uniformly.
 */
import type { ServiceDefinition } from "../declarative/types.ts";

import { apiGatewayDefinition } from "./apigateway.ts";
import { cognitoIdpDefinition } from "./cognito-idp.ts";
import { ecrDefinition } from "./ecr.ts";
import { eventsDefinition } from "./events.ts";
import { kinesisDefinition } from "./kinesis.ts";
import { kmsDefinition } from "./kms.ts";
import { logsDefinition } from "./logs.ts";
import { s3Definition } from "./s3.ts";
import { secretsManagerDefinition } from "./secretsmanager.ts";
import { ssmDefinition } from "./ssm.ts";

export const serviceDefinitions: ServiceDefinition<// biome-ignore lint/suspicious/noExplicitAny: each definition has its own client type; erased in the registry
any>[] = [
	s3Definition,
	apiGatewayDefinition,
	ssmDefinition,
	secretsManagerDefinition,
	kinesisDefinition,
	logsDefinition,
	eventsDefinition,
	kmsDefinition,
	cognitoIdpDefinition,
	ecrDefinition,
];
