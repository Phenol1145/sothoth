import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  CreateCanonicalGraphResultV1,
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphNodeDeclarationV1,
} from "../../packages/graph/src/digraph.js";
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

const f1: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c"), nd("D", "k-d")],
  edges: [ed("e1", "s-1", "A", "C"), ed("e2", "s-2", "B", "C"), ed("e3", "s-3", "C", "D")],
};

const f2: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a"), nd("B", "k-b")],
  edges: [ed("x", "s-x", "A", "B"), ed("y", "s-y", "B", "A")],
};

describe("longestPathDagV1 (T25–T29, T34)", () => {
  test("T25: weighted longest-path literal with the canonical tie-free critical path", () => {
    const weighted: DirectedMultigraphDeclarationV1 = {
      nodes: f1.nodes,
      edges: [
        ed("e1", "s-1", "A", "C", 3),
        ed("e2", "s-2", "B", "C", 1),
        ed("e3", "s-3", "C", "D", 2),
      ],
    };
    expect(longestPathDagV1(createCanonicalGraphV1(weighted))).toEqual({
      ok: true,
      nodes: [
        { nodeId: "A", longestPathWeight: 0, criticalEdgeId: null },
        { nodeId: "B", longestPathWeight: 0, criticalEdgeId: null },
        { nodeId: "C", longestPathWeight: 3, criticalEdgeId: "e1" },
        { nodeId: "D", longestPathWeight: 5, criticalEdgeId: "e3" },
      ],
      criticalPathNodeIds: ["A", "C", "D"],
      criticalPathWeight: 5,
    });
  });

  test("T26: omitted weights default to 1 and ties break to the first canonical edge", () => {
    expect(longestPathDagV1(createCanonicalGraphV1(f1))).toEqual({
      ok: true,
      nodes: [
        { nodeId: "A", longestPathWeight: 0, criticalEdgeId: null },
        { nodeId: "B", longestPathWeight: 0, criticalEdgeId: null },
        { nodeId: "C", longestPathWeight: 1, criticalEdgeId: "e1" },
        { nodeId: "D", longestPathWeight: 2, criticalEdgeId: "e3" },
      ],
      criticalPathNodeIds: ["A", "C", "D"],
      criticalPathWeight: 2,
    });

    const equalParallel: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a"), nd("C", "k-c")],
      edges: [ed("p1", "s-p", "A", "C", 5), ed("p2", "s-p", "A", "C", 5)],
    };
    const equalResult = longestPathDagV1(createCanonicalGraphV1(equalParallel));
    if (!equalResult.ok) {
      throw new Error("parallel equal edges must be accepted");
    }
    expect(equalResult.nodes[1]).toEqual({
      nodeId: "C",
      longestPathWeight: 5,
      criticalEdgeId: "p1",
    });

    const unequalParallel: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a"), nd("C", "k-c")],
      edges: [ed("p1", "s-p", "A", "C", 2), ed("p2", "s-p", "A", "C", 5)],
    };
    const unequalResult = longestPathDagV1(createCanonicalGraphV1(unequalParallel));
    if (!unequalResult.ok) {
      throw new Error("parallel edges must be accepted");
    }
    expect(unequalResult.nodes[1]).toEqual({
      nodeId: "C",
      longestPathWeight: 5,
      criticalEdgeId: "p2",
    });
  });

  test("T27: with all-negative weights the global critical path is the source's empty path", () => {
    const allNegative: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c")],
      edges: [ed("e", "s-e", "A", "B", -5), ed("f", "s-f", "A", "C", -1)],
    };
    expect(longestPathDagV1(createCanonicalGraphV1(allNegative))).toEqual({
      ok: true,
      nodes: [
        { nodeId: "A", longestPathWeight: 0, criticalEdgeId: null },
        { nodeId: "B", longestPathWeight: -5, criticalEdgeId: "e" },
        { nodeId: "C", longestPathWeight: -1, criticalEdgeId: "f" },
      ],
      criticalPathNodeIds: ["A"],
      criticalPathWeight: 0,
    });
  });

  test("T28: empty graph, positive overflow taint, conservative propagation, and losing negative overflow", () => {
    expect(longestPathDagV1(createCanonicalGraphV1({ nodes: [], edges: [] }))).toEqual({
      ok: true,
      nodes: [],
      criticalPathNodeIds: [],
      criticalPathWeight: 0,
    });

    const chainOverflow: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c")],
      edges: [ed("e1", "s-1", "A", "B", 1e308), ed("e2", "s-2", "B", "C", 1e308)],
    };
    expect(longestPathDagV1(createCanonicalGraphV1(chainOverflow))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/weight-overflow", subject: "C" }],
    });

    const propagated: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c"), nd("D", "k-d")],
      edges: [
        ed("e1", "s-1", "A", "B", 1e308),
        ed("e2", "s-2", "B", "C", 1e308),
        ed("e3", "s-3", "C", "D", 0),
        ed("e4", "s-4", "A", "D", 0),
      ],
    };
    expect(longestPathDagV1(createCanonicalGraphV1(propagated))).toEqual({
      ok: false,
      issues: [
        { code: "sothoth.graph/weight-overflow", subject: "C" },
        { code: "sothoth.graph/weight-overflow", subject: "D" },
      ],
    });

    const losingNegative: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("N", "k-n"), nd("S", "k-s"), nd("T", "k-t")],
      edges: [
        ed("f1", "s-1", "S", "N", -1e308),
        ed("f2", "s-2", "N", "T", -1e308),
        ed("f3", "s-3", "S", "T", 0),
      ],
    };
    expect(longestPathDagV1(createCanonicalGraphV1(losingNegative))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/weight-overflow", subject: "T" }],
    });
  });

  test("T29: non-DAG input returns the deterministic not-a-dag witness", () => {
    expect(longestPathDagV1(createCanonicalGraphV1(f2))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/not-a-dag", subject: "A", witnessNodeIds: ["A", "B"] }],
    });
  });

  test("T34: malformed algorithm result envelopes fail closed under the shared validator", () => {
    const created = createCanonicalGraphV1(f1);
    if (!created.ok) {
      throw new Error("F1 must build");
    }
    const graph = created.graph;
    expect(longestPathDagV1(hostile<CreateCanonicalGraphResultV1>(null))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph" }],
    });
    expect(longestPathDagV1(hostile<CreateCanonicalGraphResultV1>({ ok: true }))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/missing-field", subject: "graph.graph" }],
    });
    expect(
      longestPathDagV1(hostile<CreateCanonicalGraphResultV1>({ ok: true, graph, issues: [] })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "graph.issues" }],
    });
    expect(
      longestPathDagV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: [] })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues" }],
    });
    expect(
      longestPathDagV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: "x" })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues" }],
    });
    expect(longestPathDagV1(hostile<CreateCanonicalGraphResultV1>({ ok: 1 }))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.ok" }],
    });
  });
});
