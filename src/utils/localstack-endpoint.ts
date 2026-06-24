import { readFile } from "node:fs/promises";

import { AWS_CONFIG_FILENAME } from "./configure-aws.ts";
import { parseIni } from "./ini-parser.ts";

/**
 * The endpoint used when the `localstack` AWS profile has not been configured
 * yet. Mirrors the default the configure-aws plugin writes when DNS resolves.
 */
const DEFAULT_ENDPOINT = "http://localhost.localstack.cloud:4566";

const LOCALSTACK_PROFILE_SECTION = "profile localstack";

/**
 * Return the endpoint URL the Toolkit is configured to use for the local
 * emulator. This is the single source of truth shared by the LocalStack
 * instance label, the metamodel fetch, and the SDK providers: it reads the
 * `localstack` profile's `endpoint_url` from `~/.aws/config`, falling back to
 * the Toolkit's default when the profile is not configured.
 */
export async function getLocalStackEndpointUrl(): Promise<string> {
	try {
		const contents = await readFile(AWS_CONFIG_FILENAME, "utf-8");
		const ini = parseIni(contents);
		const section = ini.sections.find(
			(s) => s.name === LOCALSTACK_PROFILE_SECTION,
		);
		const url = section?.properties.endpoint_url;
		if (url) {
			return url;
		}
	} catch {
		/* config missing or unreadable: fall back to the default */
	}
	return DEFAULT_ENDPOINT;
}

/**
 * Reduce an endpoint URL to its `host:port` (or just host) for display.
 */
export function endpointHostPort(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
	} catch {
		return url;
	}
}
