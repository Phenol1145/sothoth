import { canonicalJson } from "@sothoth/core/canonical-json";
import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphNodeDeclarationV1,
} from "../../packages/graph/src/digraph.js";
import { condenseGraphV1 } from "../../packages/graph/src/condensation.js";
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

const t17: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c"), nd("D", "k-d")],
  edges: [
    ed("x", "s-x", "A", "B"),
    ed("y", "s-y", "B", "A"),
    ed("c1", "s-c", "C", "A"),
  ],
};

describe("condenseGraphV1 (T19–T20, T39)", () => {
  test("T19: condensation literal — identities, mapping, surviving dag edges", () => {
    const result = condenseGraphV1(createCanonicalGraphV1(t17));
    if (!result.ok) {
      throw new Error("T17 fixture must condense successfully");
    }
    const condensation = result.condensation;
    expect(condensation.components).toEqual([
      { componentId: "A", nodeIds: ["A", "B"] },
      { componentId: "C", nodeIds: ["C"] },
      { componentId: "D", nodeIds: ["D"] },
    ]);
    expect(condensation.componentOfNode).toEqual({ A: "A", B: "A", C: "C", D: "D" });
    expect(
      condensation.dag.nodes.map((node) => [node.node.id, node.sortKey]),
    ).toEqual([
      ["A", "k-a"],
      ["C", "k-c"],
      ["D", "k-d"],
    ]);
    expect(condensation.dag.nodes.map((node) => Object.hasOwn(node.node, "facets"))).toEqual([
      false,
      false,
      false,
    ]);
    expect(condensation.dag.edges).toEqual([
      { id: "c1", sortKey: "s-c", edge: { role: "dep", fromNodeId: "C", toNodeId: "A" } },
    ]);
    expect(condensation.dag.edges.map((edge) => Object.hasOwn(edge.edge, "weight"))).toEqual([
      false,
    ]);
  });

  test("T20: the condensation dag re-enters createCanonicalGraphV1 and longestPathDagV1", () => {
    const condensed = condenseGraphV1(createCanonicalGraphV1(t17));
    if (!condensed.ok) {
      throw new Error("T17 fixture must condense successfully");
    }
    const dag = condensed.condensation.dag;
    const reentry = createCanonicalGraphV1(dag);
    if (!reentry.ok) {
      throw new Error("the condensation dag must be a valid declaration");
    }
    expect(reentry.graph).toEqual(dag);
    expect(canonicalJson(reentry.graph)).toBe(canonicalJson(dag));
    const critical = longestPathDagV1(createCanonicalGraphV1(dag));
    expect(critical).toEqual({
      ok: true,
      nodes: [
        { nodeId: "A", longestPathWeight: 1, criticalEdgeId: "c1" },
        { nodeId: "C", longestPathWeight: 0, criticalEdgeId: null },
        { nodeId: "D", longestPathWeight: 0, criticalEdgeId: null },
      ],
      criticalPathNodeIds: ["C", "A"],
      criticalPathWeight: 1,
    });
  });

  test("T39: componentOfNode owns a legal \"__proto__\" node id as an enumerable frozen own entry", () => {
    const declaration: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("__proto__", "k-a"), nd("B", "k-b")],
      edges: [],
    };
    const result = condenseGraphV1(createCanonicalGraphV1(declaration));
    if (!result.ok) {
      throw new Error("the __proto__ fixture must condense successfully");
    }
    const condensation = result.condensation;
    expect(condensation.components).toEqual([
      { componentId: "__proto__", nodeIds: ["__proto__"] },
      { componentId: "B", nodeIds: ["B"] },
    ]);
    expect(condensation.dag.nodes.map((node) => node.node.id)).toEqual(["__proto__", "B"]);
    const record = condensation.componentOfNode;
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(record, "__proto__")).toBe(true);
    expect(record["__proto__"]).toBe("__proto__");
    const descriptor = Object.getOwnPropertyDescriptor(record, "__proto__");
    expect(descriptor?.enumerable).toBe(true);
    expect(Object.isFrozen(record)).toBe(true);
    expect(canonicalJson(record)).toBe('{"B":"B","__proto__":"__proto__"}');
  });
});
