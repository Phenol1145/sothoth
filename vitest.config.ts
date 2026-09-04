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
      "@sothoth/core/canonical-json": fileURLToPath(
        new URL("./packages/core/src/canonical-json.ts", import.meta.url),
      ),
      "@sothoth/core/digest": fileURLToPath(
        new URL("./packages/core/src/digests.ts", import.meta.url),
      ),
      "@sothoth/graph/digraph": fileURLToPath(
        new URL("./packages/graph/src/digraph.ts", import.meta.url),
      ),
      // @sothoth/governance imports these public subpaths as values, so the
      // test run resolves them to workspace sources like the entries above.
      "@sothoth/core/diagnostics": fileURLToPath(
        new URL("./packages/core/src/diagnostics.ts", import.meta.url),
      ),
      "@sothoth/core/outcome": fileURLToPath(
        new URL("./packages/core/src/outcome.ts", import.meta.url),
      ),
      "@sothoth/graph/waves": fileURLToPath(
        new URL("./packages/graph/src/waves.ts", import.meta.url),
      ),
      "@sothoth/selectors/match": fileURLToPath(
        new URL("./packages/selectors/src/evaluate.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
