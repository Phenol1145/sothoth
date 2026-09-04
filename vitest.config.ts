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
      // @sothoth/sdk imports these public subpaths as values when delegating,
      // so the test run resolves them to workspace sources like the entries
      // above.
      "@sothoth/document-index/index": fileURLToPath(
        new URL("./packages/document-index/src/index.ts", import.meta.url),
      ),
      "@sothoth/governance/pre-design": fileURLToPath(
        new URL("./packages/governance/src/pre-design.ts", import.meta.url),
      ),
      "@sothoth/governance/change-plan": fileURLToPath(
        new URL("./packages/governance/src/change-plan.ts", import.meta.url),
      ),
      "@sothoth/planning/schedule": fileURLToPath(
        new URL("./packages/planning/src/schedule.ts", import.meta.url),
      ),
      "@sothoth/profile-sdk/load": fileURLToPath(
        new URL("./packages/profile-sdk/src/profile.ts", import.meta.url),
      ),
      "@sothoth/profile-sdk/conformance": fileURLToPath(
        new URL("./packages/profile-sdk/src/conformance.ts", import.meta.url),
      ),
      "@sothoth/git/commit": fileURLToPath(
        new URL("./packages/git/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
