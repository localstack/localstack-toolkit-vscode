import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse } from "js-ini";
import type { IIniObject, IIniObjectSection } from "js-ini";

import { UserConfigurationError } from "../../../utils/errors.ts";

/**
 * Class to handle reading AWS configuration files and extracting profiles and regions.
 */
export default class AWSConfig {
	private static AWS_CONFIG_FILE = path.join(os.homedir(), ".aws", "config");

	/**
	 * Return the names of profiles found in the AWS config file. This will include 'default'
	 * as the name of the default profile.
	 */
	public static getProfileNames(): string[] {
		try {
			const parsedConfig = AWSConfig.readAWSConfigFile();

			const profiles: string[] = [];
			for (const section in parsedConfig) {
				if (typeof parsedConfig[section] === "object") {
					if (section.startsWith("profile ")) {
						profiles.push(section.replace("profile ", ""));
					} else if (section === "default") {
						profiles.push("default");
					}
				}
			}
			return profiles;
		} catch (err) {
			if (err instanceof UserConfigurationError) {
				throw err;
			}
			/* file not found or other error */
			return [];
		}
	}

	/**
	 * Return the default region name. First, check the AWS_REGION environment variable,
	 * and then check the .aws/config file.
	 */
	public static getRegionForProfile(profile: string): string | undefined {
		/* The environment variable takes precedence */
		if (process.env.AWS_REGION) {
			return process.env.AWS_REGION;
		}

		const region = AWSConfig.getSectionForProfile(profile)?.region;
		return typeof region === "string" ? region : undefined;
	}

	/** Last-resort region when neither the call nor the profile supplies one. */
	private static DEFAULT_REGION = "us-east-1";

	/**
	 * Return a configuration object suitable for passing to an AWS SDK client constructor. This
	 * is necessary to ensure the endpoint is set correctly when using a non-standard endpoint
	 * (such as LocalStack).
	 *
	 * When no region is supplied, fall back to the profile's default region and
	 * then a built-in default. Some resources have region-less ARNs (e.g. an S3
	 * bucket `arn:aws:s3:::name`); describing one passes the empty ARN region
	 * here, and the SDK rejects an empty region with "Region is missing". Listing
	 * is unaffected because it always passes the focus region.
	 */
	public static getClientConfig(profile: string, region?: string): object {
		/* use endpoint from profile, if it's defined */
		const endpoint = AWSConfig.getEndpointForProfile(profile);
		const resolvedRegion =
			region || AWSConfig.getRegionForProfile(profile) || AWSConfig.DEFAULT_REGION;
		return { profile, region: resolvedRegion, endpoint };
	}

	/**
	 * Return the custom `endpoint_url` configured for a profile, or `undefined`
	 * when the profile targets real AWS (no override). A custom endpoint is the
	 * signal that a profile points at LocalStack (or another local emulator).
	 */
	public static getEndpointForProfile(profile: string): string | undefined {
		const endpointUrl = AWSConfig.getSectionForProfile(profile)?.endpoint_url;
		return typeof endpointUrl === "string" ? endpointUrl : undefined;
	}

	/** Read and parse the AWS config file */
	private static readAWSConfigFile(): IIniObject {
		try {
			const configContent = fs.readFileSync(AWSConfig.AWS_CONFIG_FILE, "utf-8");
			return parse(configContent, { comment: [";", "#"] });
		} catch (error: unknown) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				/* file does not exist, return empty config */
				return {};
			}
			if (error instanceof Error) {
				/* file exists but is malformed */
				throw new UserConfigurationError(error.message);
			}
			/* other unknown error */
			throw error;
		}
	}

	/** Return the configuration section for the specified profile */
	private static getSectionForProfile(
		profile: string,
	): IIniObjectSection | undefined {
		const parsedConfig = AWSConfig.readAWSConfigFile();
		const section = profile === "default" ? "default" : `profile ${profile}`;
		const value = parsedConfig[section];
		/* A section is an object; skip scalars and data sections (string[]). */
		if (typeof value !== "object" || Array.isArray(value)) {
			return undefined;
		}
		return value;
	}
}
