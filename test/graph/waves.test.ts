import { canonicalJson } from "@sothoth/core/canonical-json";
import { describe, expect, test } from "vitest";
import { createCanonicalGraphV1 } from "../../packages/graph/src/digraph.js";
import type {
  CreateCanonicalGraphResultV1,
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

const f2: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a"), nd("B", "k-b")],
  edges: [ed("x", "s-x", "A", "B"), ed("y", "s-y", "B", "A")],
};

const f3: DirectedMultigraphDeclarationV1 = {
  nodes: [nd("A", "k-a")],
  edges: [ed("z", "s-z", "A", "A")],
};

const notADag = {
  ok: false,
  issues: [{ code: "sothoth.graph/not-a-dag", subject: "A", witnessNodeIds: ["A", "B"] }],
} as const;

describe("topologicalWavesV1 (T21–T24, T34–T36)", () => {
  test("T21: the frozen plan example holds exactly for every permutation of F1", () => {
    for (const nodes of permutations(f1.nodes)) {
      for (const edges of permutations(f1.edges)) {
        expect(topologicalWavesV1(createCanonicalGraphV1({ nodes, edges }))).toEqual({
          ok: true,
          waves: [["A", "B"], ["C"], ["D"]],
        });
      }
    }
  });

  test("T22: the empty graph has zero waves and edge-less nodes all sit in wave 0", () => {
    expect(topologicalWavesV1(createCanonicalGraphV1({ nodes: [], edges: [] }))).toEqual({
      ok: true,
      waves: [],
    });
    expect(topologicalWavesV1(createCanonicalGraphV1({ nodes: f1.nodes, edges: [] }))).toEqual({
      ok: true,
      waves: [["A", "B", "C", "D"]],
    });
  });

  test("T23: the deterministic cycle witness is identical for every permutation", () => {
    const composed: DirectedMultigraphDeclarationV1 = {
      nodes: [...f2.nodes, nd("D", "k-d")],
      edges: [...f2.edges, ed("r", "s-r", "D", "A")],
    };
    const expected = { ...notADag };
    for (const nodes of permutations(composed.nodes)) {
      for (const edges of permutations(composed.edges)) {
        expect(topologicalWavesV1(createCanonicalGraphV1({ nodes, edges }))).toEqual(expected);
      }
    }
  });

  test("T24: a self-loop witnesses as the single node cycle", () => {
    expect(topologicalWavesV1(createCanonicalGraphV1(f3))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/not-a-dag", subject: "A", witnessNodeIds: ["A"] }],
    });
  });

  test("T16: a creation failure forwards as equal canonical value and bytes to topologicalWavesV1", () => {
    const failure = createCanonicalGraphV1({
      nodes: [nd("A", "k-a1"), nd("A", "k-a2"), nd("A", "k-a3")],
      edges: [],
    });
    expect(failure.ok).toBe(false);
    const forwarded = topologicalWavesV1(failure);
    expect(forwarded).toEqual(failure);
    expect(canonicalJson(forwarded)).toBe(canonicalJson(failure));
  });

  test("T34: malformed algorithm result envelopes fail closed under the shared validator", () => {
    const created = createCanonicalGraphV1(f1);
    if (!created.ok) {
      throw new Error("F1 must build");
    }
    const graph = created.graph;
    expect(topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>(null))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph" }],
    });
    expect(topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: true }))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/missing-field", subject: "graph.graph" }],
    });
    expect(
      topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: true, graph, issues: [] })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "graph.issues" }],
    });
    expect(
      topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: [] })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues" }],
    });
    expect(
      topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: "x" })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues" }],
    });
    expect(topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: 1 }))).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.ok" }],
    });
  });

  test("T35: decorated, sparse, cyclic, accessor, extra, and unknown-code issue entries fail closed", () => {
    const invalidIssues = {
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues" }],
    };

    const decorated = hostile<unknown[]>([{ code: "sothoth.graph/duplicate-node-id", subject: "A" }]);
    Object.defineProperty(decorated, "extra", {
      value: 1,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    expect(
      topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: decorated })),
    ).toEqual(invalidIssues);

    const holed = hostile<unknown[]>([
      { code: "sothoth.graph/duplicate-node-id", subject: "A" },
    ]);
    delete (holed as { 0?: unknown })[0];
    expect(
      topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: holed })),
    ).toEqual(invalidIssues);

    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(
      topologicalWavesV1(hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: cyclic })),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues[0]" }],
    });

    let calls = 0;
    const accessorEntry: Record<string, unknown> = { subject: "A" };
    Object.defineProperty(accessorEntry, "code", {
      enumerable: true,
      get() {
        calls += 1;
        return "sothoth.graph/duplicate-node-id";
      },
    });
    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({ ok: false, issues: [accessorEntry] }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues[0].code" }],
    });
    expect(calls).toBe(0);

    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A", extra: 1 }],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/unknown-field", subject: "graph.issues[0].extra" }],
    });

    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [{ code: "sothoth.graph/nope", subject: "A" }],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: "graph.issues[0].code" }],
    });

    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [{ code: "sothoth.graph/duplicate-node-id" }],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/missing-field", subject: "graph.issues[0].subject" }],
    });
  });

  test("T36: conditional witness checks, duplicate coalescing, and the valid crafted failure", () => {
    const witnessSubject = "graph.issues[0].witnessNodeIds";
    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [{ code: "sothoth.graph/not-a-dag", subject: "A" }],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/missing-field", subject: witnessSubject }],
    });
    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A", witnessNodeIds: ["A"] }],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: witnessSubject }],
    });
    for (const witnessNodeIds of hostile<unknown[]>([["B", "A"], ["A", "A"], []])) {
      expect(
        topologicalWavesV1(
          hostile<CreateCanonicalGraphResultV1>({
            ok: false,
            issues: [{ code: "sothoth.graph/not-a-dag", subject: "A", witnessNodeIds }],
          }),
        ),
      ).toEqual({
        ok: false,
        issues: [{ code: "sothoth.graph/invalid-field", subject: witnessSubject }],
      });
    }
    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [
            { code: "sothoth.graph/not-a-dag", subject: "A", witnessNodeIds: "x" },
          ],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/invalid-field", subject: witnessSubject }],
    });

    expect(
      topologicalWavesV1(
        hostile<CreateCanonicalGraphResultV1>({
          ok: false,
          issues: [
            { code: "sothoth.graph/duplicate-node-id", subject: "A" },
            { code: "sothoth.graph/duplicate-node-id", subject: "A" },
          ],
        }),
      ),
    ).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A" }],
    });

    const crafted = hostile<CreateCanonicalGraphResultV1>({
      ok: false,
      issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A" }],
    });
    const forwarded = topologicalWavesV1(crafted);
    expect(forwarded).toEqual({
      ok: false,
      issues: [{ code: "sothoth.graph/duplicate-node-id", subject: "A" }],
    });
    expect(canonicalJson(forwarded)).toBe(canonicalJson(crafted));
    expect(forwarded).not.toBe(crafted);
    (crafted as unknown as { issues: Array<{ subject: string }> }).issues[0]!.subject = "B";
    expect(canonicalJson(forwarded)).toBe(
      '{"issues":[{"code":"sothoth.graph/duplicate-node-id","subject":"A"}],"ok":false}',
    );
  });
});
