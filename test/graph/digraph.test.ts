import { canonicalJson } from "@sothoth/core/canonical-json";
import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphNodeDeclarationV1,
} from "../../packages/graph/src/digraph.js";
import { topologicalWavesV1 } from "../../packages/graph/src/waves.js";

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

describe("createCanonicalGraphV1 canonical build (T1–T12)", () => {
  test("T1: canonical ordering under every permutation of F1", () => {
    for (const nodes of permutations(f1.nodes)) {
      for (const edges of permutations(f1.edges)) {
        const result = createCanonicalGraphV1({ nodes, edges });
        if (!result.ok) {
          throw new Error(`expected success for permutation of F1: ${canonicalJson(result)}`);
        }
        expect(result.graph.nodes.map((node) => node.node.id)).toEqual(["A", "B", "C", "D"]);
        expect(result.graph.edges.map((edge) => edge.id)).toEqual(["e1", "e2", "e3"]);
        expect(result.graph.nodes.map((node) => node.sortKey)).toEqual(["k-a", "k-b", "k-c", "k-d"]);
      }
    }
  });

  test("T2: code-point (not UTF-16) tie-break orders U+FFFF before an astral node", () => {
    const declaration = {
      nodes: [nd("\uFFFF", "k"), nd("\uD83D\uDE00", "k")],
      edges: [],
    };
    const result = createCanonicalGraphV1(declaration);
    if (!result.ok) {
      throw new Error("expected success for the code-point fixture");
    }
    expect(result.graph.nodes.map((node) => node.node.id)).toEqual(["\uFFFF", "\uD83D\uDE00"]);
    expect(topologicalWavesV1(result)).toEqual({
      ok: true,
      waves: [["\uFFFF", "\uD83D\uDE00"]],
    });
  });

  test("T3: three duplicate node declarations yield exactly one duplicate-node-id issue", () => {
    const result = createCanonicalGraphV1({
      nodes: [nd("A", "k-a1"), nd("A", "k-a2"), nd("A", "k-a3")],
      edges: [],
    });
    expect(result).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A" }],
    });
  });

  test("T4: duplicate edge id yields exactly one duplicate-edge-id issue and no unresolved endpoints", () => {
    const result = createCanonicalGraphV1({
      nodes: [nd("A", "k-a"), nd("B", "k-b")],
      edges: [ed("e1", "s-e1", "A", "B"), ed("e1", "s-e2", "A", "B")],
    });
    expect(result).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/duplicate-edge-id", subject: "e1" }],
    });
  });

  test("T5: parallel edges with equal endpoints, role, and sort key stay distinct", () => {
    const result = createCanonicalGraphV1({
      nodes: [nd("A", "k-a"), nd("B", "k-b")],
      edges: [ed("p1", "s-p", "A", "B"), ed("p2", "s-p", "A", "B")],
    });
    if (!result.ok) {
      throw new Error("parallel edges must be accepted");
    }
    expect(result.graph.edges.map((edge) => edge.id)).toEqual(["p1", "p2"]);
    expect(result.graph.edges.map((edge) => edge.edge.role)).toEqual(["dep", "dep"]);
  });

  test("T6: unresolved endpoints anchor the edge identity, both endpoints reported in order", () => {
    const oneSided = createCanonicalGraphV1({
      nodes: [nd("A", "k-a")],
      edges: [ed("e9", "s-9", "X", "A")],
    });
    expect(oneSided).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unresolved-endpoint", subject: "e9.fromNodeId" }],
    });
    const bothSided = createCanonicalGraphV1({
      nodes: [nd("A", "k-a")],
      edges: [ed("e9", "s-9", "X", "Y")],
    });
    expect(bothSided).toEqual({
      ok: false,
      issues: [
        { code: "sothoth.graph/unresolved-endpoint", subject: "e9.fromNodeId" },
        { code: "sothoth.graph/unresolved-endpoint", subject: "e9.toNodeId" },
      ],
    });
  });

  test("T7: malformed weights fail closed, finite negative and -0 weights are legal", () => {
    for (const weight of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = createCanonicalGraphV1({
        nodes: [nd("A", "k-a"), nd("B", "k-b")],
        edges: [ed("e1", "s-1", "A", "B", weight)],
      });
      expect(result).toEqual({
        ok: false,
        issues: [{ code: "sothoth.graph/invalid-field", subject: "edges[0].edge.weight" }],
      });
    }
    for (const weight of [-5, -0]) {
      const result = createCanonicalGraphV1({
        nodes: [nd("A", "k-a"), nd("B", "k-b")],
        edges: [ed("e1", "s-1", "A", "B", weight)],
      });
      if (!result.ok) {
        throw new Error(`finite weight ${String(weight)} must be accepted`);
      }
      expect(result.graph.edges[0]!.edge.weight).toBe(weight);
    }
  });

  test("T8: missing or empty sort key and empty node id are structural failures", () => {
    const missingSortKey = createCanonicalGraphV1(
      hostile<DirectedMultigraphDeclarationV1>({
        nodes: [{ node: { id: "A" } }],
        edges: [],
      }),
    );
    expect(missingSortKey).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/missing-field", subject: "nodes[0].sortKey" }],
    });
    const emptySortKey = createCanonicalGraphV1({
      nodes: [nd("A", "")],
      edges: [],
    });
    expect(emptySortKey).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "nodes[0].sortKey" }],
    });
    const emptyId = createCanonicalGraphV1({
      nodes: [nd("", "k-a")],
      edges: [],
    });
    expect(emptyId).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "nodes[0].node.id" }],
    });
  });

  test("T9: one extra own key at each of the four levels is one unknown-field each", () => {
    const declarationLevel = createCanonicalGraphV1(
      hostile<DirectedMultigraphDeclarationV1>({
        nodes: f1.nodes,
        edges: f1.edges,
        extra: 1,
      }),
    );
    expect(declarationLevel).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "declaration.extra" }],
    });
    const entryLevel = createCanonicalGraphV1(
      hostile<DirectedMultigraphDeclarationV1>({
        nodes: [{ node: { id: "A" }, sortKey: "k-a", extra: 1 }, ...f1.nodes.slice(1)],
        edges: f1.edges,
      }),
    );
    expect(entryLevel).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "nodes[0].extra" }],
    });
    const innerNodeLevel = createCanonicalGraphV1({
      nodes: [
        hostile<GraphNodeDeclarationV1>({ node: { id: "A", extra: 1 }, sortKey: "k-a" }),
        ...f1.nodes.slice(1),
      ],
      edges: f1.edges,
    });
    expect(innerNodeLevel).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "nodes[0].node.extra" }],
    });
    const innerEdgeLevel = createCanonicalGraphV1({
      nodes: f1.nodes,
      edges: [
        hostile<GraphEdgeDeclarationV1>({
          id: "e1",
          sortKey: "s-1",
          edge: { role: "dep", fromNodeId: "A", toNodeId: "C", extra: 1 },
        }),
        ...f1.edges.slice(1),
      ],
    });
    expect(innerEdgeLevel).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "edges[0].edge.extra" }],
    });
  });

  test("T10: an accessor on a known field fails closed without executing the getter", () => {
    let calls = 0;
    const hostileEntry: Record<string, unknown> = { node: { id: "A" } };
    Object.defineProperty(hostileEntry, "sortKey", {
      enumerable: true,
      get() {
        calls += 1;
        return "k-a";
      },
    });
    const result = createCanonicalGraphV1(
      hostile<DirectedMultigraphDeclarationV1>({
        nodes: [hostileEntry, ...f1.nodes.slice(1)],
        edges: f1.edges,
      }),
    );
    expect(result).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "nodes[0].sortKey" }],
    });
    expect(calls).toBe(0);
  });

  test("T11: facets grammar rejection, byte preservation, deep copy, and freezing", () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    const cyclicResult = createCanonicalGraphV1({
      nodes: [hostile<GraphNodeDeclarationV1>({ node: { id: "A", facets: cyclic }, sortKey: "k-a" })],
      edges: [],
    });
    expect(cyclicResult).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "nodes[0].node.facets" }],
    });

    const symbolKeyed: Record<string, unknown> = {};
    Object.defineProperty(symbolKeyed, "leak", {
      value: 1,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const withSymbol: Record<PropertyKey, unknown> = {};
    Object.defineProperty(withSymbol, "arr", {
      value: symbolKeyed,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(withSymbol, Symbol("s"), {
      value: 1,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const symbolResult = createCanonicalGraphV1({
      nodes: [
        hostile<GraphNodeDeclarationV1>({ node: { id: "A", facets: withSymbol }, sortKey: "k-a" }),
      ],
      edges: [],
    });
    expect(symbolResult).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "nodes[0].node.facets" }],
    });

    const sparse: unknown[] = [1, , 3];
    const sparseResult = createCanonicalGraphV1({
      nodes: [hostile<GraphNodeDeclarationV1>({ node: { id: "A", facets: sparse }, sortKey: "k-a" })],
      edges: [],
    });
    expect(sparseResult).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "nodes[0].node.facets" }],
    });

    const facets: Record<string, unknown> = {};
    Object.defineProperty(facets, "__proto__", {
      value: 1,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(facets, "nested", {
      value: { deep: [1, { ok: true }] },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const bytesBefore = canonicalJson(facets);
    expect(bytesBefore).toBe('{"__proto__":1,"nested":{"deep":[1,{"ok":true}]}}');
    const accepted = createCanonicalGraphV1({
      nodes: [hostile<GraphNodeDeclarationV1>({ node: { id: "A", facets }, sortKey: "k-a" })],
      edges: [],
    });
    if (!accepted.ok) {
      throw new Error("facets with an own __proto__ data key must be accepted");
    }
    const returnedFacets = accepted.graph.nodes[0]!.node.facets!;
    expect(canonicalJson(returnedFacets)).toBe(bytesBefore);
    expect(Object.hasOwn(returnedFacets, "__proto__")).toBe(true);

    (facets as Record<string, unknown>).injected = "later";
    (facets.nested as { deep: unknown[] }).deep.push("mutation");
    expect(canonicalJson(returnedFacets)).toBe(bytesBefore);
    expect(canonicalJson(accepted.graph)).toBe(
      '{"edges":[],"nodes":[{"node":{"facets":' +
        bytesBefore +
        ',"id":"A"},"sortKey":"k-a"}]}',
    );

    const frozenContainers: object[] = [];
    const walkStack: object[] = [returnedFacets];
    while (walkStack.length > 0) {
      const current = walkStack.pop()!;
      frozenContainers.push(current);
      expect(Object.isFrozen(current)).toBe(true);
      for (const name of Object.getOwnPropertyNames(current)) {
        if (name === "length" && Array.isArray(current)) continue;
        const child = (current as Record<string, unknown>)[name];
        if (child !== null && typeof child === "object") walkStack.push(child);
      }
    }
    expect(frozenContainers.length).toBe(4);
  });

  test("T12: the empty declaration builds the empty canonical graph", () => {
    expect(createCanonicalGraphV1({ nodes: [], edges: [] })).toEqual({
      ok: true,
      graph: { nodes: [], edges: [] },
    });
  });
});
