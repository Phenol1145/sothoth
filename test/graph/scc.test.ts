import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphNodeDeclarationV1,
} from "../../packages/graph/src/digraph.js";
import { stronglyConnectedComponentsV1 } from "../../packages/graph/src/scc.js";

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

const t17: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a"), nd("B", "k-b"), nd("C", "k-c"), nd("D", "k-d")],
  edges: [
    ed("x", "s-x", "A", "B"),
    ed("y", "s-y", "B", "A"),
    ed("c1", "s-c", "C", "A"),
  ],
};

describe("stronglyConnectedComponentsV1 (T17–T18)", () => {
  test("T17: SCC literal for the F2-derived fixture, F3, and the empty graph", () => {
    const result = stronglyConnectedComponentsV1(createCanonicalGraphV1(t17));
    expect(result).toEqual({
      ok: true,
      components: [["A", "B"], ["C"], ["D"]],
    });
    const f3: DirectedMultigraphDeclarationV1 = {
      nodes: [nd("A", "k-a")],
      edges: [ed("z", "s-z", "A", "A")],
    };
    expect(stronglyConnectedComponentsV1(createCanonicalGraphV1(f3))).toEqual({
      ok: true,
      components: [["A"]],
    });
    expect(stronglyConnectedComponentsV1(createCanonicalGraphV1({ nodes: [], edges: [] }))).toEqual({
      ok: true,
      components: [],
    });
  });

  test("T18: every permutation of the T17 fixture yields the identical components value", () => {
    for (const nodes of permutations(t17.nodes)) {
      for (const edges of permutations(t17.edges)) {
        const result = stronglyConnectedComponentsV1(createCanonicalGraphV1({ nodes, edges }));
        expect(result).toEqual({
          ok: true,
          components: [["A", "B"], ["C"], ["D"]],
        });
      }
    }
  });
});
