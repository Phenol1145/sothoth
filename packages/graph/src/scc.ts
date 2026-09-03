/**
 * Public module `@sothoth/graph/scc`: strongly connected components of the
 * directed multigraph, canonically re-ordered so the output is independent
 * of the traversal algorithm used to find the partition.
 */

import type { CreateCanonicalGraphResultV1, GraphFailureV1 } from "./digraph.js";
import { deepFreezeInPlace } from "./internal/immutable.js";
import { prepareAlgorithmInput, type GraphModel } from "./internal/validation.js";

export interface StronglyConnectedComponentsSuccessV1 {
  readonly ok: true;
  /** components[i] lists component i's node ids in canonical node order; components ordered canonically (§7.4). */
  readonly components: readonly (readonly string[])[];
}

export type StronglyConnectedComponentsResultV1 =
  | StronglyConnectedComponentsSuccessV1
  | GraphFailureV1;

/**
 * Iterative Tarjan strongly-connected-components pass over the canonical
 * model: an explicit call stack keeps the traversal depth constant, so a long
 * directed path cannot overflow the call stack.
 */
function sccPartition(model: GraphModel): number[][] {
  const count = model.nodeIds.length;
  const indices = new Int32Array(count).fill(-1);
  const lowlinks = new Int32Array(count).fill(-1);
  const onStack = new Uint8Array(count);
  const nodeStack: number[] = [];
  const callStack: Array<{ node: number; cursor: number }> = [];
  const components: number[][] = [];
  let nextIndex = 0;
  for (let root = 0; root < count; root += 1) {
    if (indices[root] !== -1) {
      continue;
    }
    callStack.push({ node: root, cursor: 0 });
    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1]!;
      if (frame.cursor === 0) {
        indices[frame.node] = nextIndex;
        lowlinks[frame.node] = nextIndex;
        nextIndex += 1;
        nodeStack.push(frame.node);
        onStack[frame.node] = 1;
      }
      const edges = model.outEdges[frame.node]!;
      if (frame.cursor < edges.length) {
        const edgeIndex = edges[frame.cursor]!;
        frame.cursor += 1;
        const target = model.edgeTargets[edgeIndex]!;
        if (indices[target] === -1) {
          callStack.push({ node: target, cursor: 0 });
        } else if (onStack[target] === 1) {
          lowlinks[frame.node] = Math.min(lowlinks[frame.node]!, indices[target]!);
        }
        continue;
      }
      callStack.pop();
      if (lowlinks[frame.node] === indices[frame.node]) {
        const component: number[] = [];
        for (;;) {
          const member = nodeStack.pop()!;
          onStack[member] = 0;
          component.push(member);
          if (member === frame.node) {
            break;
          }
        }
        components.push(component);
      }
      const parent = callStack[callStack.length - 1];
      if (parent !== undefined) {
        lowlinks[parent.node] = Math.min(lowlinks[parent.node]!, lowlinks[frame.node]!);
      }
    }
  }
  return components;
}

export function stronglyConnectedComponentsV1(
  graph: CreateCanonicalGraphResultV1,
): StronglyConnectedComponentsResultV1 {
  const prepared = prepareAlgorithmInput(graph);
  if (prepared.kind === "failure") {
    return prepared.failure;
  }
  const model = prepared.model;
  const components = sccPartition(model)
    .map((group) => group.sort((left, right) => left - right))
    .sort((left, right) => left[0]! - right[0]!)
    .map((group) => group.map((node) => model.nodeIds[node]!));
  const success: StronglyConnectedComponentsSuccessV1 = { ok: true, components };
  return deepFreezeInPlace(success);
}
