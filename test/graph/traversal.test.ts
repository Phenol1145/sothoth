import { canonicalJson } from "@project-sothoth/core/canonical-json";
import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphNodeDeclarationV1,
} from "../../packages/graph/src/digraph.js";
import { adjacencyV1, reachableFromV1 } from "../../packages/graph/src/traversal.js";

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

describe("traversal (T13–T16, T37)", () => {
  test("T13: adjacency literal with self-loop, isolated node, and canonical edge order", () => {
    const fixture: DirectedMultigraphDeclarationV1 = {
      nodes: [...f1.nodes, nd("I", "k-i")],
      edges: [...f1.edges, ed("z", "s-z", "C", "C")],
    };
    const result = adjacencyV1(createCanonicalGraphV1(fixture));
    expect(result).toEqual({
      ok: true,
      entries: [
        { nodeId: "A", outgoingEdgeIds: ["e1"], incomingEdgeIds: [] },
        { nodeId: "B", outgoingEdgeIds: ["e2"], incomingEdgeIds: [] },
        { nodeId: "C", outgoingEdgeIds: ["e3", "z"], incomingEdgeIds: ["e1", "e2", "z"] },
        { nodeId: "D", outgoingEdgeIds: [], incomingEdgeIds: ["e3"] },
        { nodeId: "I", outgoingEdgeIds: [], incomingEdgeIds: [] },
      ],
    });
  });

  test("T14: reachability is reflexive, forward-only, deduplicated, and canonically ordered", () => {
    const graph = createCanonicalGraphV1(f1);
    expect(reachableFromV1(graph, "A")).toEqual({ ok: true, nodeIds: ["A", "C", "D"] });
    expect(reachableFromV1(graph, "D")).toEqual({ ok: true, nodeIds: ["D"] });
    const diamond: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c"), nd("D", "k-d")],
      edges: [
        ed("d1", "s-1", "A", "B"),
        ed("d2", "s-2", "A", "C"),
        ed("d3", "s-3", "B", "D"),
        ed("d4", "s-4", "C", "D"),
      ],
    };
    expect(reachableFromV1(createCanonicalGraphV1(diamond), "A")).toEqual({
      ok: true,
      nodeIds: ["A", "B", "C", "D"],
    });
  });

  test("T15: unknown start nodes are rejected on populated and empty graphs", () => {
    const graph = createCanonicalGraphV1(f1);
    expect(reachableFromV1(graph, "X")).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-start-node", subject: "X" }],
    });
    expect(reachableFromV1(createCanonicalGraphV1({ nodes: [], edges: [] }), "A")).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-start-node", subject: "A" }],
    });
  });

  test("T16: a creation failure forwards as equal canonical value and bytes to reachableFromV1", () => {
    const failure = createCanonicalGraphV1({
      nodes: [nd("A", "k-a1"), nd("A", "k-a2"), nd("A", "k-a3")],
      edges: [],
    });
    expect(failure.ok).toBe(false);
    const forwarded = reachableFromV1(failure, "A");
    expect(forwarded).toEqual(failure);
    expect(canonicalJson(forwarded)).toBe(canonicalJson(failure));
  });

  test("T37: hostile start node ids fail closed in the declared order", () => {
    const graph = createCanonicalGraphV1(f1);
    const invalid = {
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "startNodeId" }],
    };
    expect(reachableFromV1(graph, hostile<string>(42))).toEqual(invalid);
    expect(reachableFromV1(graph, hostile<string>(Symbol("x")))).toEqual(invalid);
    expect(reachableFromV1(graph, hostile<string>({}))).toEqual(invalid);
    expect(reachableFromV1(graph, "")).toEqual(invalid);
    expect(reachableFromV1(graph, "X")).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-start-node", subject: "X" }],
    });
    expect(reachableFromV1(hostile(null), hostile<string>(42))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph" }],
    });
  });
});
