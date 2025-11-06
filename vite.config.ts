import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: path.dirname(fileURLToPath(import.meta.url)),
	plugins: [react()],
	root: path.join(import.meta.dirname, "src/app-inspector"),
	build: {
		outDir: "../../resources/app-inspector/dist",
	},
});
