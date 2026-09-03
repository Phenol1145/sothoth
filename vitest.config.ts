import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Run tests against workspace sources, not stale build output; the
      // published packages still resolve @sothoth/contracts through their
      // exports maps.
      "@sothoth/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
