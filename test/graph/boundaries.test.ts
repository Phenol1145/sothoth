import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as graphDigraph from "../../packages/graph/src/digraph.js";
import * as graphTraversal from "../../packages/graph/src/traversal.js";
import * as graphScc from "../../packages/graph/src/scc.js";
import * as graphCondensation from "../../packages/graph/src/condensation.js";
import * as graphWaves from "../../packages/graph/src/waves.js";
import * as graphLongestPaths from "../../packages/graph/src/longest-paths.js";
import type * as DigraphTypes from "../../packages/graph/src/digraph.js";
import type * as TraversalTypes from "../../packages/graph/src/traversal.js";
import type * as SccTypes from "../../packages/graph/src/scc.js";
import type * as CondensationTypes from "../../packages/graph/src/condensation.js";
import type * as WavesTypes from "../../packages/graph/src/waves.js";
import type * as LongestPathTypes from "../../packages/graph/src/longest-paths.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

// §5.1 type-level export closure pins: each listed type is imported and used
// in a value-shaped position, so a missing or renamed export fails to compile.
const typePins: unknown[] = [
  ((): DigraphTypes.GraphNodeDeclarationV1 => ({ node: { id: "A" }, sortKey: "k" }))(),
  ((): DigraphTypes.GraphEdgeDeclarationV1 => ({
    id: "e",
    edge: { role: "dep", fromNodeId: "A", toNodeId: "B" },
    sortKey: "s",
  }))(),
  ((): DigraphTypes.DirectedMultigraphDeclarationV1 => ({ nodes: [], edges: [] }))(),
  ((): DigraphTypes.CanonicalGraphV1 => ({ nodes: [], edges: [] }))(),
  ((): DigraphTypes.GraphIssueV1 => ({
    code: "sothoth.graph/not-a-dag",
    subject: "A",
    witnessNodeIds: ["A"],
  }))(),
  ((): DigraphTypes.CreateCanonicalGraphSuccessV1 => ({ ok: true, graph: { nodes: [], edges: [] } }))(),
  ((): DigraphTypes.GraphFailureV1 => ({
    ok: false,
    issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A" }],
  }))(),
  ((): DigraphTypes.CreateCanonicalGraphResultV1 => ({ ok: false, issues: [] }))(),
  ((): TraversalTypes.AdjacencyEntryV1 => ({
    nodeId: "A",
    outgoingEdgeIds: [],
    incomingEdgeIds: [],
  }))(),
  ((): TraversalTypes.AdjacencySuccessV1 => ({ ok: true, entries: [] }))(),
  ((): TraversalTypes.AdjacencyResultV1 => ({ ok: false, issues: [] }))(),
  ((): TraversalTypes.ReachableFromSuccessV1 => ({ ok: true, nodeIds: [] }))(),
  ((): TraversalTypes.ReachableFromResultV1 => ({ ok: false, issues: [] }))(),
  ((): SccTypes.StronglyConnectedComponentsSuccessV1 => ({ ok: true, components: [] }))(),
  ((): SccTypes.StronglyConnectedComponentsResultV1 => ({ ok: false, issues: [] }))(),
  ((): CondensationTypes.CondensationComponentV1 => ({ componentId: "A", nodeIds: ["A"] }))(),
  ((): CondensationTypes.CondensationV1 => ({
    components: [],
    componentOfNode: {},
    dag: { nodes: [], edges: [] },
  }))(),
  ((): CondensationTypes.CondenseGraphSuccessV1 => ({
    ok: true,
    condensation: { components: [], componentOfNode: {}, dag: { nodes: [], edges: [] } },
  }))(),
  ((): CondensationTypes.CondenseGraphResultV1 => ({ ok: false, issues: [] }))(),
  ((): WavesTypes.TopologicalWavesSuccessV1 => ({ ok: true, waves: [] }))(),
  ((): WavesTypes.TopologicalWavesResultV1 => ({ ok: false, issues: [] }))(),
  ((): LongestPathTypes.LongestPathNodeV1 => ({
    nodeId: "A",
    longestPathWeight: 0,
    criticalEdgeId: null,
  }))(),
  ((): LongestPathTypes.LongestPathDagSuccessV1 => ({
    ok: true,
    nodes: [],
    criticalPathNodeIds: [],
    criticalPathWeight: 0,
  }))(),
  ((): LongestPathTypes.LongestPathDagResultV1 => ({ ok: false, issues: [] }))(),
];

async function collectProductionSources(): Promise<string[]> {
  const entries = await readdir(`${root}/packages/graph/src`, { recursive: true });
  return entries
    .filter((entry) => String(entry).endsWith(".ts"))
    .map((entry) => `packages/graph/src/${entry}`)
    .sort();
}

describe("zero-domain-semantics boundary (T32–T33) and surface pins", () => {
  test("T32: production sources contain no domain vocabulary and no I/O capability", async () => {
    const sources = await collectProductionSources();
    expect(sources).toEqual([
      "packages/graph/src/condensation.ts",
      "packages/graph/src/digraph.ts",
      "packages/graph/src/internal/code-point.ts",
      "packages/graph/src/internal/immutable.ts",
      "packages/graph/src/internal/validation.ts",
      "packages/graph/src/longest-paths.ts",
      "packages/graph/src/scc.ts",
      "packages/graph/src/traversal.ts",
      "packages/graph/src/waves.ts",
    ]);
    const forbidden: Array<[RegExp, string]> = [
      [/\bimpact\b/i, "impact edge vocabulary"],
      [/\bfracta\w*/i, "consumer vocabulary"],
      [/\bgovernance\b/i, "governance vocabulary"],
      [/\bplanning\b/i, "planning vocabulary"],
      [/\bdocuments?\b/i, "reference vocabulary"],
      [/\bselectors?\b/i, "selector vocabulary"],
      [/\brelease[-\s]trains?\b/i, "release vocabulary"],
      [/node:fs/, "filesystem capability"],
      [/node:child_process/, "process capability"],
      [/node:net/, "network capability"],
      [/node:http/, "network capability"],
      [/process\./, "process reference"],
      [/\bDate\b/, "clock reference"],
      [/Math\.random/, "random reference"],
      [/localeCompare/, "locale collation"],
      [/\bimport\s*\(/, "dynamic import"],
    ];
    for (const relativePath of sources) {
      const text = await readFile(`${root}/${relativePath}`, "utf8");
      for (const [pattern, label] of forbidden) {
        expect(text.match(pattern), `${relativePath} must not contain ${label}`).toBeNull();
      }
    }
  });

  test("T32: package.json stays inside the accepted dependency allowlist with no devDependencies", async () => {
    const manifest = JSON.parse(await readFile(`${root}/packages/graph/package.json`, "utf8")) as {
      exports?: Record<string, unknown>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      main?: string;
      types?: string;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      "@project-sothoth/contracts",
      "@project-sothoth/core",
    ]);
    expect(manifest.devDependencies).toBeUndefined();
    expect(manifest.main).toBeUndefined();
    expect(manifest.types).toBeUndefined();
    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual([
      "./condensation",
      "./digraph",
      "./longest-paths",
      "./scc",
      "./traversal",
      "./waves",
    ]);
  });

  test("T33: the exports map resolves exactly the six accepted subpaths", async () => {
    const probe = `
      const out = [];
      for (const sub of ["digraph", "traversal", "scc", "condensation", "waves", "longest-paths"]) {
        out.push(import.meta.resolve("@project-sothoth/graph/" + sub));
      }
      let bare = "";
      try { import.meta.resolve("@project-sothoth/graph"); } catch (error) { bare = error.code; }
      console.log(JSON.stringify({ out, bare }));
    `;
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: `${root}/packages/graph`,
      encoding: "utf8",
    });
    const resolution = JSON.parse(stdout) as { out: string[]; bare: string };
    const repo = root.endsWith("/") ? root.slice(0, -1) : root;
    expect(resolution.out).toEqual([
      `file://${repo}/packages/graph/dist/digraph.js`,
      `file://${repo}/packages/graph/dist/traversal.js`,
      `file://${repo}/packages/graph/dist/scc.js`,
      `file://${repo}/packages/graph/dist/condensation.js`,
      `file://${repo}/packages/graph/dist/waves.js`,
      `file://${repo}/packages/graph/dist/longest-paths.js`,
    ]);
    expect(resolution.bare).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
  });

  test("§5.1: each public module exports exactly its listed runtime surface", () => {
    expect(Object.keys(graphDigraph).sort()).toEqual(["createCanonicalGraphV1"]);
    expect(typeof graphDigraph.createCanonicalGraphV1).toBe("function");
    expect(Object.keys(graphTraversal).sort()).toEqual(["adjacencyV1", "reachableFromV1"]);
    expect(typeof graphTraversal.adjacencyV1).toBe("function");
    expect(typeof graphTraversal.reachableFromV1).toBe("function");
    expect(Object.keys(graphScc).sort()).toEqual(["stronglyConnectedComponentsV1"]);
    expect(typeof graphScc.stronglyConnectedComponentsV1).toBe("function");
    expect(Object.keys(graphCondensation).sort()).toEqual(["condenseGraphV1"]);
    expect(typeof graphCondensation.condenseGraphV1).toBe("function");
    expect(Object.keys(graphWaves).sort()).toEqual(["topologicalWavesV1"]);
    expect(typeof graphWaves.topologicalWavesV1).toBe("function");
    expect(Object.keys(graphLongestPaths).sort()).toEqual(["longestPathDagV1"]);
    expect(typeof graphLongestPaths.longestPathDagV1).toBe("function");
    expect(typePins).toHaveLength(24);
  });
});
