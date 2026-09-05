/**
 * Public module `@project-sothoth/graph/traversal`: canonical adjacency and
 * reachability over a canonical graph result. Both callables accept the full
 * creation result union and forward failures by canonical value and bytes.
 */

import type { CreateCanonicalGraphResultV1, GraphFailureV1 } from "./digraph.js";
import { deepFreezeInPlace } from "./internal/immutable.js";
import { finalizeFailure, prepareAlgorithmInput } from "./internal/validation.js";

/** One node's incident edges. Self-loop edge ids appear in both lists. */
export interface AdjacencyEntryV1 {
  readonly nodeId: string;
  readonly outgoingEdgeIds: readonly string[];
  readonly incomingEdgeIds: readonly string[];
}

export interface AdjacencySuccessV1 {
  readonly ok: true;
  readonly entries: readonly AdjacencyEntryV1[];
}

export type AdjacencyResultV1 = AdjacencySuccessV1 | GraphFailureV1;

/** Adjacency for every declared node, in canonical node order; edge lists in canonical edge order. */
export function adjacencyV1(graph: CreateCanonicalGraphResultV1): AdjacencyResultV1 {
  const prepared = prepareAlgorithmInput(graph);
  if (prepared.kind === "failure") {
    return prepared.failure;
  }
  const model = prepared.model;
  const entries: AdjacencyEntryV1[] = model.nodeIds.map((nodeId, index) => ({
    nodeId,
    outgoingEdgeIds: model.outEdges[index]!.map((edgeIndex) => model.edgeDecls[edgeIndex]!.id),
    incomingEdgeIds: model.inEdges[index]!.map((edgeIndex) => model.edgeDecls[edgeIndex]!.id),
  }));
  const success: AdjacencySuccessV1 = { ok: true, entries };
  return deepFreezeInPlace(success);
}

export interface ReachableFromSuccessV1 {
  readonly ok: true;
  readonly nodeIds: readonly string[];
}

export type ReachableFromResultV1 = ReachableFromSuccessV1 | GraphFailureV1;

/** Reflexive forward closure of `startNodeId`, reported once per node in canonical node order. */
export function reachableFromV1(
  graph: CreateCanonicalGraphResultV1,
  startNodeId: string,
): ReachableFromResultV1 {
  const prepared = prepareAlgorithmInput(graph);
  if (prepared.kind === "failure") {
    return prepared.failure;
  }
  const model = prepared.model;
  if (typeof startNodeId !== "string" || startNodeId === "") {
    return finalizeFailure([{ code: "sothoth.graph/invalid-field", subject: "startNodeId" }]);
  }
  const start = model.rankOf.get(startNodeId);
  if (start === undefined) {
    return finalizeFailure([{ code: "sothoth.graph/unknown-start-node", subject: startNodeId }]);
  }
  const count = model.nodeIds.length;
  const visited = new Uint8Array(count);
  visited[start] = 1;
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    for (const edgeIndex of model.outEdges[current]!) {
      const target = model.edgeTargets[edgeIndex]!;
      if (visited[target] === 0) {
        visited[target] = 1;
        queue.push(target);
      }
    }
  }
  const nodeIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    if (visited[index] === 1) {
      nodeIds.push(model.nodeIds[index]!);
    }
  }
  const success: ReachableFromSuccessV1 = { ok: true, nodeIds };
  return deepFreezeInPlace(success);
}
