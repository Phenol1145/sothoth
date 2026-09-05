/**
 * Public module `@project-sothoth/graph/longest-paths`: deterministic DAG longest
 * paths with the conservative overflow taint. Cyclic input is rejected with
 * the deterministic cycle witness before any arithmetic runs; the DP then
 * walks the deterministic topological order over IEEE-754 doubles.
 */

import type { CreateCanonicalGraphResultV1, GraphFailureV1 } from "./digraph.js";
import { topologicalWavesV1 } from "./waves.js";
import { deepFreezeInPlace } from "./internal/immutable.js";
import { finalizeFailure, prepareAlgorithmInput, type GraphModel } from "./internal/validation.js";

/** Per-node longest-path value and the deterministic incoming edge that achieves it. */
export interface LongestPathNodeV1 {
  readonly nodeId: string;
  readonly longestPathWeight: number;
  /** Null iff the node is a source (no incoming edges). */
  readonly criticalEdgeId: string | null;
}

export interface LongestPathDagSuccessV1 {
  readonly ok: true;
  readonly nodes: readonly LongestPathNodeV1[];
  /** The deterministic maximum path, listed source-first. Empty iff the graph is empty. */
  readonly criticalPathNodeIds: readonly string[];
  readonly criticalPathWeight: number;
}

export type LongestPathDagResultV1 = LongestPathDagSuccessV1 | GraphFailureV1;

/** Binary min-heap over canonical node ranks. */
class RankHeap {
  private readonly values: number[] = [];

  get size(): number {
    return this.values.length;
  }

  push(value: number): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.values[parent]! <= this.values[index]!) {
        break;
      }
      const swap = this.values[parent]!;
      this.values[parent] = this.values[index]!;
      this.values[index] = swap;
      index = parent;
    }
  }

  pop(): number {
    const top = this.values[0]!;
    const last = this.values.pop()!;
    if (this.values.length > 0) {
      this.values[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = index * 2 + 2;
        let smallest = index;
        if (left < this.values.length && this.values[left]! < this.values[smallest]!) {
          smallest = left;
        }
        if (right < this.values.length && this.values[right]! < this.values[smallest]!) {
          smallest = right;
        }
        if (smallest === index) {
          break;
        }
        const swap = this.values[smallest]!;
        this.values[smallest] = this.values[index]!;
        this.values[index] = swap;
        index = smallest;
      }
    }
    return top;
  }
}

/** The declared weight of a validated edge; an omitted weight contributes 1. */
function declaredWeight(model: GraphModel, edgeIndex: number): number {
  return model.edgeDecls[edgeIndex]!.edge.weight ?? 1;
}

export function longestPathDagV1(
  graph: CreateCanonicalGraphResultV1,
): LongestPathDagResultV1 {
  const prepared = prepareAlgorithmInput(graph);
  if (prepared.kind === "failure") {
    return prepared.failure;
  }
  const model = prepared.model;
  const cycleCheck = topologicalWavesV1({ ok: true, graph: model.canonicalValue });
  if (!cycleCheck.ok) {
    return cycleCheck;
  }
  const count = model.nodeIds.length;
  if (count === 0) {
    const empty: LongestPathDagSuccessV1 = {
      ok: true,
      nodes: [],
      criticalPathNodeIds: [],
      criticalPathWeight: 0,
    };
    return deepFreezeInPlace(empty);
  }
  // Deterministic topological order: repeatedly take the zero-indegree node
  // with the smallest canonical rank.
  const indegree = new Int32Array(count);
  for (let node = 0; node < count; node += 1) {
    indegree[node] = model.inEdges[node]!.length;
  }
  const heap = new RankHeap();
  for (let node = 0; node < count; node += 1) {
    if (indegree[node] === 0) {
      heap.push(node);
    }
  }
  const order: number[] = [];
  while (heap.size > 0) {
    const current = heap.pop();
    order.push(current);
    for (const edgeIndex of model.outEdges[current]!) {
      const target = model.edgeTargets[edgeIndex]!;
      indegree[target]! -= 1;
      if (indegree[target] === 0) {
        heap.push(target);
      }
    }
  }
  const weight = new Float64Array(count);
  const criticalEdge = new Int32Array(count).fill(-1);
  const affected = new Uint8Array(count);
  for (const current of order) {
    let best = 0;
    let bestEdge = -1;
    let isAffected = false;
    for (const edgeIndex of model.inEdges[current]!) {
      const source = model.edgeSources[edgeIndex]!;
      if (affected[source] === 1) {
        isAffected = true;
      }
      const candidate = weight[source]! + declaredWeight(model, edgeIndex);
      if (!Number.isFinite(candidate)) {
        isAffected = true;
        continue;
      }
      if (bestEdge === -1 || candidate > best) {
        best = candidate;
        bestEdge = edgeIndex;
      }
    }
    weight[current] = best;
    criticalEdge[current] = bestEdge;
    affected[current] = isAffected ? 1 : 0;
  }
  const overflowSubjects: string[] = [];
  for (let node = 0; node < count; node += 1) {
    if (affected[node] === 1) {
      overflowSubjects.push(model.nodeIds[node]!);
    }
  }
  if (overflowSubjects.length > 0) {
    return finalizeFailure(
      overflowSubjects.map((id) => ({ code: "sothoth.graph/weight-overflow", subject: id })),
    );
  }
  const nodes: LongestPathNodeV1[] = [];
  for (let node = 0; node < count; node += 1) {
    nodes.push({
      nodeId: model.nodeIds[node]!,
      longestPathWeight: weight[node]!,
      criticalEdgeId:
        criticalEdge[node] === -1 ? null : model.edgeDecls[criticalEdge[node]!]!.id,
    });
  }
  let endRank = 0;
  for (let node = 1; node < count; node += 1) {
    if (weight[node]! > weight[endRank]!) {
      endRank = node;
    }
  }
  const reversed: number[] = [];
  let current = endRank;
  for (;;) {
    reversed.push(current);
    const edgeIndex = criticalEdge[current]!;
    if (edgeIndex === -1) {
      break;
    }
    current = model.edgeSources[edgeIndex]!;
  }
  const criticalPathNodeIds = reversed.reverse().map((rank) => model.nodeIds[rank]!);
  const success: LongestPathDagSuccessV1 = {
    ok: true,
    nodes,
    criticalPathNodeIds,
    criticalPathWeight: weight[endRank]!,
  };
  return deepFreezeInPlace(success);
}
