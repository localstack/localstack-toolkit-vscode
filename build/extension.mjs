import esbuild from "esbuild";

const production = process.argv.includes("--production");
const dev = process.argv.includes("--dev");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",
	setup(build) {
		build.onStart(() => {
			console.log("[dev] build started");
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(
					`    ${location.file}:${location.line}:${location.column}:`,
				);
			});
			console.log("[dev] build finished");
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ["src/extension.ts", "src/test/**/*.test.ts"],
		bundle: true,
		format: "cjs",
		/* Preserve original function/class names through bundling (and
		 * minification). The AWS SDK command classes are dispatched on by
		 * `constructor.name` (in tests, via a fake client), which esbuild would
		 * otherwise rename on identifier collisions (e.g. `DescribeKeyCommand2`). */
		keepNames: true,
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: "node",
		outdir: "out",
		external: ["vscode"],
		logLevel: "silent",
		define: {
			"process.env.LOCALSTACK_WEB_AUTH_REDIRECT": JSON.stringify(
				process.env.LOCALSTACK_WEB_AUTH_REDIRECT ?? "",
			),
			"process.env.ANALYTICS_API_URL": JSON.stringify(
				process.env.ANALYTICS_API_URL ?? "",
			),
			"process.env.NODE_ENV": JSON.stringify(
				process.env.NODE_ENV ?? "development",
			),
			"import.meta.dirname": "__dirname",
		},
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (dev) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
