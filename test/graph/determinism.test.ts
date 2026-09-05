import { canonicalJson } from "@project-sothoth/core/canonical-json";
import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  CreateCanonicalGraphResultV1,
  CreateCanonicalGraphSuccessV1,
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphNodeDeclarationV1,
} from "../../packages/graph/src/digraph.js";
import { adjacencyV1, reachableFromV1 } from "../../packages/graph/src/traversal.js";
import { stronglyConnectedComponentsV1 } from "../../packages/graph/src/scc.js";
import { condenseGraphV1 } from "../../packages/graph/src/condensation.js";
import { topologicalWavesV1 } from "../../packages/graph/src/waves.js";
import { longestPathDagV1 } from "../../packages/graph/src/longest-paths.js";

function nd(id: string, sortKey: string): GraphNodeDeclarationV1 {
  return { node: { id }, sortKey };
}

function ed(
  id: string,
  sortKey: string,
  fromNodeId: string,
  toNodeId: string,
  weight?: number,
): GraphEdgeDeclarationV1 {
  const inner =
    weight === undefined
      ? { role: "dep", fromNodeId, toNodeId }
      : { role: "dep", fromNodeId, toNodeId, weight };
  return { id, sortKey, edge: inner };
}

function hostile<T>(value: unknown): T {
  return value as T;
}

function permutations<T>(items: readonly T[]): T[][] {
  const output: T[][] = [];
  const current = [...items];
  function heap(size: number): void {
    if (size === 1) {
      output.push([...current]);
      return;
    }
    heap(size - 1);
    for (let index = 0; index < size - 1; index += 1) {
      if (size % 2 === 0) {
        const swap = current[index]!;
        current[index] = current[size - 1]!;
        current[size - 1] = swap;
      } else {
        const swap = current[0]!;
        current[0] = current[size - 1]!;
        current[size - 1] = swap;
      }
      heap(size - 1);
    }
  }
  heap(current.length);
  return output;
}

const f1: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c"), nd("D", "k-d")],
  edges: [ed("e1", "s-1", "A", "C"), ed("e2", "s-2", "B", "C"), ed("e3", "s-3", "C", "D")],
};

// T30: exactly 100,000 nodes and 99,999 edges in one directed path.
const CHAIN: DirectedMultigraphDeclarationV1 = {
  nodes: Array.from({ length: 100000 }, (_, index) =>
    nd(`n${String(index)}`, `k-${String(index).padStart(6, "0")}`),
  ),
  edges: Array.from({ length: 99999 }, (_, index) =>
    ed(
      `e-${String(index).padStart(5, "0")}`,
      `s-${String(index).padStart(5, "0")}`,
      `n${String(index)}`,
      `n${String(index + 1)}`,
    ),
  ),
};

let chainResult: CreateCanonicalGraphSuccessV1 | null = null;
function canonicalChain(): CreateCanonicalGraphSuccessV1 {
  if (chainResult === null) {
    const created = createCanonicalGraphV1(CHAIN);
    if (!created.ok) {
      throw new Error("the 100,000-node chain must validate");
    }
    chainResult = created;
  }
  return chainResult;
}

describe("stack safety and byte stability (T30–T31, T38)", () => {
  test("T30: createCanonicalGraphV1 completes on the 100,000-node chain", () => {
    const result = canonicalChain();
    expect(result.graph.nodes).toHaveLength(100000);
    expect(result.graph.edges).toHaveLength(99999);
    expect(result.graph.nodes[0]!.node.id).toBe("n0");
    expect(result.graph.nodes[99999]!.node.id).toBe("n99999");
  }, 120000);

  test("T30: adjacencyV1 completes on the 100,000-node chain", () => {
    const result = adjacencyV1(canonicalChain());
    if (!result.ok) {
      throw new Error("adjacency over the chain must succeed");
    }
    expect(result.entries).toHaveLength(100000);
    expect(result.entries[0]).toEqual({
      nodeId: "n0",
      outgoingEdgeIds: ["e-00000"],
      incomingEdgeIds: [],
    });
    expect(result.entries[99999]).toEqual({
      nodeId: "n99999",
      outgoingEdgeIds: [],
      incomingEdgeIds: ["e-99998"],
    });
  }, 120000);

  test("T30: reachableFromV1 completes on the 100,000-node chain", () => {
    const fromStart = reachableFromV1(canonicalChain(), "n0");
    if (!fromStart.ok) {
      throw new Error("reachability over the chain must succeed");
    }
    expect(fromStart.nodeIds).toHaveLength(100000);
    expect(fromStart.nodeIds[0]).toBe("n0");
    expect(fromStart.nodeIds[99999]).toBe("n99999");
    const fromMiddle = reachableFromV1(canonicalChain(), "n50000");
    if (!fromMiddle.ok) {
      throw new Error("reachability over the chain must succeed");
    }
    expect(fromMiddle.nodeIds).toHaveLength(50000);
    expect(fromMiddle.nodeIds[0]).toBe("n50000");
  }, 120000);

  test("T30: stronglyConnectedComponentsV1 completes on the 100,000-node chain", () => {
    const result = stronglyConnectedComponentsV1(canonicalChain());
    if (!result.ok) {
      throw new Error("SCC over the chain must succeed");
    }
    expect(result.components).toHaveLength(100000);
    expect(result.components[0]).toEqual(["n0"]);
    expect(result.components[99999]).toEqual(["n99999"]);
  }, 120000);

  test("T30: condenseGraphV1 completes on the 100,000-node chain", () => {
    const result = condenseGraphV1(canonicalChain());
    if (!result.ok) {
      throw new Error("condensation over the chain must succeed");
    }
    expect(result.condensation.components).toHaveLength(100000);
    expect(result.condensation.dag.nodes).toHaveLength(100000);
    expect(result.condensation.dag.edges).toHaveLength(99999);
    expect(result.condensation.componentOfNode["n0"]).toBe("n0");
  }, 120000);

  test("T30: topologicalWavesV1 completes on the 100,000-node chain", () => {
    const result = topologicalWavesV1(canonicalChain());
    if (!result.ok) {
      throw new Error("waves over the chain must succeed");
    }
    expect(result.waves).toHaveLength(100000);
    expect(result.waves[0]).toEqual(["n0"]);
    expect(result.waves[99999]).toEqual(["n99999"]);
  }, 120000);

  test("T30: longestPathDagV1 completes on the 100,000-node chain", () => {
    const result = longestPathDagV1(canonicalChain());
    if (!result.ok) {
      throw new Error("longest paths over the chain must succeed");
    }
    expect(result.criticalPathWeight).toBe(99999);
    expect(result.criticalPathNodeIds).toHaveLength(100000);
    expect(result.nodes).toHaveLength(100000);
    expect(result.nodes[99999]!.longestPathWeight).toBe(99999);
  }, 120000);

  test("T31: canonical bytes of the waves result are stable across runs and permutations", () => {
    const expected = '{"ok":true,"waves":[["A","B"],["C"],["D"]]}';
    const first = canonicalJson(topologicalWavesV1(createCanonicalGraphV1(f1)));
    const second = canonicalJson(topologicalWavesV1(createCanonicalGraphV1(f1)));
    expect(first).toBe(expected);
    expect(second).toBe(first);
    for (const nodes of permutations(f1.nodes)) {
      for (const edges of permutations(f1.edges)) {
        expect(canonicalJson(topologicalWavesV1(createCanonicalGraphV1({ nodes, edges })))).toBe(
          first,
        );
      }
    }
  });

  test("T38: success and failure results are deep copies with no shared mutable reference", () => {
    const facets = hostile<{ arr: unknown[]; text: string; [key: string]: unknown }>({
      arr: [1, { deep: true }],
      text: "v",
    });
    const declaration: DirectedMultigraphDeclarationV1 = {
      nodes: [
        hostile<GraphNodeDeclarationV1>({ node: { id: "A", facets }, sortKey: "k-a" }),
        nd("B", "k-b"),
      ],
      edges: [ed("e1", "s-1", "A", "B", 2)],
    };
    const created = createCanonicalGraphV1(declaration);
    if (!created.ok) {
      throw new Error("the facets fixture must be accepted");
    }
    const bytesBefore = canonicalJson(created.graph);
    facets.arr.push("mutation");
    facets.injected = true;
    (declaration.nodes as GraphNodeDeclarationV1[])[0] = nd("replaced", "k-z");
    expect(canonicalJson(created.graph)).toBe(bytesBefore);

    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.graph)).toBe(true);
    const frozenStack: object[] = [created.graph];
    while (frozenStack.length > 0) {
      const current = frozenStack.pop()!;
      expect(Object.isFrozen(current)).toBe(true);
      for (const name of Object.getOwnPropertyNames(current)) {
        if (name === "length" && Array.isArray(current)) continue;
        const child = (current as Record<string, unknown>)[name];
        if (child !== null && typeof child === "object") frozenStack.push(child);
      }
    }

    const crafted = hostile<CreateCanonicalGraphResultV1>({
      ok: false,
      issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A" }],
    });
    const forwarded = topologicalWavesV1(crafted);
    if (forwarded.ok) {
      throw new Error("the crafted failure must forward as a failure");
    }
    const failureBytes = canonicalJson(forwarded);
    (crafted as unknown as { issues: Array<{ subject: string }> }).issues[0]!.subject = "B";
    expect(canonicalJson(forwarded)).toBe(failureBytes);
    expect(forwarded.issues).toHaveLength(1);
    expect(forwarded.issues[0]).toEqual({
      code: "sothoth.graph/duplicate-node-id",
      subject: "A",
    });
    expect(Object.isFrozen(forwarded)).toBe(true);
    expect(Object.isFrozen(forwarded.issues)).toBe(true);
    expect(Object.isFrozen(forwarded.issues[0])).toBe(true);
  });
});
