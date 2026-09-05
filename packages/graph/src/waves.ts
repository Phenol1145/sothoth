/**
 * Public module `@project-sothoth/graph/waves`: deterministic topological waves with
 * canonical intra-wave order, plus the closed deterministic cycle-witness
 * rule that rejects cyclic input with exactly one `not-a-dag` issue.
 */

import type { CreateCanonicalGraphResultV1, GraphFailureV1 } from "./digraph.js";
import { stronglyConnectedComponentsV1 } from "./scc.js";
import { deepFreezeInPlace } from "./internal/immutable.js";
import { finalizeFailure, prepareAlgorithmInput, type GraphModel } from "./internal/validation.js";

export interface TopologicalWavesSuccessV1 {
  readonly ok: true;
  /** waves[i] lists wave i's node ids in canonical node order; wave indices are consecutive from 0. */
  readonly waves: readonly (readonly string[])[];
}

export type TopologicalWavesResultV1 = TopologicalWavesSuccessV1 | GraphFailureV1;

/**
 * The closed deterministic cycle-witness rule: from the on-cycle node with
 * the smallest canonical rank, a self-loop witnesses `[node]`; otherwise the
 * walk stays inside that node's strongly connected component and always
 * steps to the same-component target with the smallest canonical rank,
 * closing at the first repeated node. A pure function of the canonical
 * graph, so every run produces the same witness.
 */
function cycleWitness(
  model: GraphModel,
  componentOf: ReadonlyMap<string, number>,
  selfLoops: ReadonlySet<string>,
  startRank: number,
): string[] {
  const startId = model.nodeIds[startRank]!;
  if (selfLoops.has(startId)) {
    return [startId];
  }
  const component = componentOf.get(startId)!;
  const walk: number[] = [startRank];
  const positions = new Map<number, number>([[startRank, 0]]);
  let current = startRank;
  for (;;) {
    let bestTarget = -1;
    for (const edgeIndex of model.outEdges[current]!) {
      const target = model.edgeTargets[edgeIndex]!;
      if (componentOf.get(model.nodeIds[target]!) !== component) {
        continue;
      }
      if (bestTarget === -1 || target < bestTarget) {
        bestTarget = target;
      }
    }
    const next = bestTarget;
    if (positions.has(next)) {
      const closure = positions.get(next)!;
      return walk.slice(closure).map((rank) => model.nodeIds[rank]!);
    }
    positions.set(next, walk.length);
    walk.push(next);
    current = next;
  }
}

export function topologicalWavesV1(
  graph: CreateCanonicalGraphResultV1,
): TopologicalWavesResultV1 {
  const prepared = prepareAlgorithmInput(graph);
  if (prepared.kind === "failure") {
    return prepared.failure;
  }
  const model = prepared.model;
  const scc = stronglyConnectedComponentsV1({ ok: true, graph: model.canonicalValue });
  if (!scc.ok) {
    return scc;
  }
  const componentOf = new Map<string, number>();
  scc.components.forEach((members, index) => {
    for (const id of members) {
      componentOf.set(id, index);
    }
  });
  const selfLoops = new Set<string>();
  for (const edge of model.edgeDecls) {
    if (edge.edge.fromNodeId === edge.edge.toNodeId) {
      selfLoops.add(edge.edge.fromNodeId);
    }
  }
  let smallestOnCycle = -1;
  for (const members of scc.components) {
    if (members.length >= 2) {
      for (const id of members) {
        const rank = model.rankOf.get(id)!;
        if (smallestOnCycle === -1 || rank < smallestOnCycle) {
          smallestOnCycle = rank;
        }
      }
    }
  }
  for (const id of selfLoops) {
    const rank = model.rankOf.get(id)!;
    if (smallestOnCycle === -1 || rank < smallestOnCycle) {
      smallestOnCycle = rank;
    }
  }
  if (smallestOnCycle !== -1) {
    const witness = cycleWitness(model, componentOf, selfLoops, smallestOnCycle);
    return finalizeFailure([
      { code: "sothoth.graph/not-a-dag", subject: witness[0]!, witnessNodeIds: witness },
    ]);
  }
  // Kahn's wave assignment: a node enters the queue only when every incoming
  // edge has been relaxed, so its wave is final before it propagates.
  const count = model.nodeIds.length;
  const indegree = new Int32Array(count);
  for (let node = 0; node < count; node += 1) {
    indegree[node] = model.inEdges[node]!.length;
  }
  const wave = new Int32Array(count);
  const queue: number[] = [];
  for (let node = 0; node < count; node += 1) {
    if (indegree[node] === 0) {
      queue.push(node);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    for (const edgeIndex of model.outEdges[current]!) {
      const target = model.edgeTargets[edgeIndex]!;
      const candidate = wave[current]! + 1;
      if (wave[target]! < candidate) {
        wave[target] = candidate;
      }
      indegree[target]! -= 1;
      if (indegree[target] === 0) {
        queue.push(target);
      }
    }
  }
  let waveCount = 0;
  for (let node = 0; node < count; node += 1) {
    if (wave[node]! + 1 > waveCount) {
      waveCount = wave[node]! + 1;
    }
  }
  const buckets: string[][] = Array.from({ length: waveCount }, () => []);
  for (let node = 0; node < count; node += 1) {
    buckets[wave[node]!]!.push(model.nodeIds[node]!);
  }
  const success: TopologicalWavesSuccessV1 = { ok: true, waves: buckets };
  return deepFreezeInPlace(success);
}
