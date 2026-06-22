import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import AWSConfig from "../../platforms/aws/models/awsConfig.ts";

/**
 * AWSConfig reads a hardcoded `~/.aws/config` path via a private static field.
 * The tests repoint that field at a temporary fixture file (and control the
 * `AWS_REGION` env var) so the parsing logic can be exercised deterministically
 * without touching the developer's real AWS configuration.
 */
const configHandle = AWSConfig as unknown as { AWS_CONFIG_FILE: string };

const CONFIG_CONTENTS = `[default]
region = us-east-1
endpoint_url = http://localhost:4566

[profile staging]
region = eu-west-1
`;

suite("AWSConfig", () => {
	let tempDir: string;
	let configPath: string;
	let originalConfigFile: string;
	let originalAwsRegion: string | undefined;

	suiteSetup(() => {
		originalConfigFile = configHandle.AWS_CONFIG_FILE;
		originalAwsRegion = process.env.AWS_REGION;
		delete process.env.AWS_REGION;

		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "awsconfig-test-"));
		configPath = path.join(tempDir, "config");
		fs.writeFileSync(configPath, CONFIG_CONTENTS, "utf-8");
		configHandle.AWS_CONFIG_FILE = configPath;
	});

	suiteTeardown(() => {
		configHandle.AWS_CONFIG_FILE = originalConfigFile;
		if (originalAwsRegion === undefined) {
			delete process.env.AWS_REGION;
		} else {
			process.env.AWS_REGION = originalAwsRegion;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	teardown(() => {
		/* Ensure tests that set the env var don't leak into the next test. */
		delete process.env.AWS_REGION;
	});

	test("getProfileNames lists the default profile and named profiles", () => {
		assert.deepStrictEqual(AWSConfig.getProfileNames(), ["default", "staging"]);
	});

	test("getRegionForProfile reads the region from the config file", () => {
		assert.strictEqual(AWSConfig.getRegionForProfile("default"), "us-east-1");
		assert.strictEqual(AWSConfig.getRegionForProfile("staging"), "eu-west-1");
	});

	test("getRegionForProfile lets AWS_REGION take precedence", () => {
		process.env.AWS_REGION = "ap-southeast-2";
		assert.strictEqual(
			AWSConfig.getRegionForProfile("default"),
			"ap-southeast-2",
		);
		assert.strictEqual(
			AWSConfig.getRegionForProfile("staging"),
			"ap-southeast-2",
		);
	});

	test("getClientConfig surfaces the profile's endpoint_url when present", () => {
		assert.deepStrictEqual(AWSConfig.getClientConfig("default", "us-east-1"), {
			profile: "default",
			region: "us-east-1",
			endpoint: "http://localhost:4566",
		});
	});

	test("getClientConfig leaves the endpoint undefined when not configured", () => {
		assert.deepStrictEqual(AWSConfig.getClientConfig("staging", "eu-west-1"), {
			profile: "staging",
			region: "eu-west-1",
			endpoint: undefined,
		});
	});

	test("returns safe empty values when the config file is missing", () => {
		const previous = configHandle.AWS_CONFIG_FILE;
		configHandle.AWS_CONFIG_FILE = path.join(tempDir, "does-not-exist");
		try {
			assert.deepStrictEqual(AWSConfig.getProfileNames(), []);
			assert.strictEqual(AWSConfig.getRegionForProfile("default"), undefined);
		} finally {
			configHandle.AWS_CONFIG_FILE = previous;
		}
	});
});
