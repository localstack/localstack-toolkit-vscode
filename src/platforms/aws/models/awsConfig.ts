import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse } from "js-ini";

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

		const profileConfig = AWSConfig.getSectionForProfile(profile);
		if (profileConfig && profileConfig["region"]) {
			return profileConfig["region"];
		}
		return undefined;
	}

	/**
	 * Return a configuration object suitable for passing to an AWS SDK client constructor. This
	 * is necessary to ensure the endpoint is set correctly when using a non-standard endpoint
	 * (such as LocalStack).
	 */
	public static getClientConfig(profile: string, region?: string): object {
		/* use endpoint from profile, if it's defined */
		let endpoint: string | undefined;
		const profileConfig = AWSConfig.getSectionForProfile(profile);
		if (profileConfig && profileConfig["endpoint_url"]) {
			endpoint = profileConfig["endpoint_url"];
		}
		return { profile, region, endpoint };
	}

	/** Read and parse the AWS config file */
	private static readAWSConfigFile() {
		let parsedConfig: any = {};
		try {
			const configContent = fs.readFileSync(AWSConfig.AWS_CONFIG_FILE, "utf-8");
			parsedConfig = parse(configContent, { comment: [";", "#"] });
		} catch (error: any) {
			if (error.code === "ENOENT") {
				/* file does not exist, return empty config */
				return {};
			}
			if (error instanceof Error) {
				/* file exists but is malformed */
				throw new UserConfigurationError(error.message);
			} else {
				/* other unknown error */
				throw error;
			}
		}
		return parsedConfig;
	}

	/** Return the configuration section for the specified profile */
	private static getSectionForProfile(profile: string): any {
		const parsedConfig = AWSConfig.readAWSConfigFile();
		const section = profile === "default" ? "default" : `profile ${profile}`;
		if (!parsedConfig[section] || typeof parsedConfig[section] !== "object") {
			return undefined;
		}
		return parsedConfig[section];
	}
}
