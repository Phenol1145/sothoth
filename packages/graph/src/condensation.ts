/**
 * Public module `@project-sothoth/graph/condensation`: the component DAG of a
 * canonical graph. Component identity is content-derived from the canonical
 * representative, intra-component edges are omitted without aggregation, and
 * the dag re-enters `createCanonicalGraphV1` unchanged.
 */

import type {
  CanonicalGraphV1,
  CreateCanonicalGraphResultV1,
  GraphEdgeDeclarationV1,
  GraphFailureV1,
} from "./digraph.js";
import { stronglyConnectedComponentsV1 } from "./scc.js";
import { deepFreezeInPlace, defineOwnData } from "./internal/immutable.js";
import { prepareAlgorithmInput } from "./internal/validation.js";

/** One component: its representative-derived identity and its members in canonical node order. */
export interface CondensationComponentV1 {
  readonly componentId: string;
  readonly nodeIds: readonly string[];
}

export interface CondensationV1 {
  readonly components: readonly CondensationComponentV1[];
  /** Maps every declared node id to its component id. Ordinary-object record, own-data keys defined prototype-safely (§7.5, §9.4). */
  readonly componentOfNode: Readonly<Record<string, string>>;
  /** The component DAG; a valid DirectedMultigraphDeclarationV1, so it re-enters createCanonicalGraphV1. */
  readonly dag: CanonicalGraphV1;
}

export interface CondenseGraphSuccessV1 {
  readonly ok: true;
  readonly condensation: CondensationV1;
}

export type CondenseGraphResultV1 = CondenseGraphSuccessV1 | GraphFailureV1;

export function condenseGraphV1(
  graph: CreateCanonicalGraphResultV1,
): CondenseGraphResultV1 {
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
  const componentIdOf = (id: string): string =>
    scc.components[componentOf.get(id)!]![0]!;
  const components: CondensationComponentV1[] = scc.components.map((members) => ({
    componentId: members[0]!,
    nodeIds: members,
  }));
  const componentOfNode: Record<string, string> = {};
  for (const members of scc.components) {
    for (const id of members) {
      defineOwnData(componentOfNode, id, members[0]!);
    }
  }
  const dagNodes = scc.components.map((members) => ({
    node: { id: members[0]! },
    sortKey: model.nodeDecls[model.rankOf.get(members[0]!)!]!.sortKey,
  }));
  const dagEdges: GraphEdgeDeclarationV1[] = [];
  for (const edge of model.edgeDecls) {
    if (componentOf.get(edge.edge.fromNodeId) === componentOf.get(edge.edge.toNodeId)) {
      continue;
    }
    const remapped =
      Object.getOwnPropertyDescriptor(edge.edge, "weight") === undefined
        ? {
            role: edge.edge.role,
            fromNodeId: componentIdOf(edge.edge.fromNodeId),
            toNodeId: componentIdOf(edge.edge.toNodeId),
          }
        : {
            role: edge.edge.role,
            fromNodeId: componentIdOf(edge.edge.fromNodeId),
            toNodeId: componentIdOf(edge.edge.toNodeId),
            weight: edge.edge.weight,
          };
    dagEdges.push({ id: edge.id, sortKey: edge.sortKey, edge: remapped });
  }
  const condensation: CondensationV1 = {
    components,
    componentOfNode,
    dag: { nodes: dagNodes, edges: dagEdges },
  };
  const success: CondenseGraphSuccessV1 = { ok: true, condensation };
  return deepFreezeInPlace(success);
}
