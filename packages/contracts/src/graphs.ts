/**
 * Generic graph shape contracts.
 *
 * Internal implementation file of the accepted `@project-sothoth/contracts/schema`
 * family, re-exported by `schema.ts` and never exposed under its own
 * subpath. Nodes, edges, weights, and sort keys are caller-provided; this
 * contract declares no relation meaning, so no domain semantics can leak
 * into the generic algorithms.
 */

import type { JsonValue } from "./identity.js";

/** A caller-provided graph node identified by an exact string identity. */
export interface GraphNodeV1 {
  readonly id: string;
  readonly facets?: Readonly<Record<string, JsonValue>> | undefined;
}

/** A directed edge between two node identities under a caller-declared role. */
export interface GraphEdgeV1 {
  readonly role: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly weight?: number | undefined;
}

/** One node's assignment to a deterministic wave index. */
export interface GraphNodeWaveV1 {
  readonly nodeId: string;
  readonly wave: number;
}
