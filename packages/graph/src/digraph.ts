/**
 * Public module `@sothoth/graph/digraph`: fail-closed construction of the
 * canonical directed multigraph value. Hostile declarations are validated
 * descriptor-only; accepted declarations return as descriptor-safe deep
 * copies in canonical order, recursively frozen.
 */

import type { DiagnosticCodeV1, GraphEdgeV1, GraphNodeV1 } from "@sothoth/contracts";
import { deepFreezeInPlace } from "./internal/immutable.js";
import {
  canonicalGraphValue,
  finalizeFailure,
  validateDeclaration,
} from "./internal/validation.js";

/** A caller-declared node: the contracts-owned node plus its explicit sort key. */
export interface GraphNodeDeclarationV1 {
  readonly node: GraphNodeV1;
  readonly sortKey: string;
}

/** A caller-declared edge: edge identity, the contracts-owned edge, and its explicit sort key. */
export interface GraphEdgeDeclarationV1 {
  readonly id: string;
  readonly edge: GraphEdgeV1;
  readonly sortKey: string;
}

/** The whole caller input: any order, possibly invalid, never mutated. */
export interface DirectedMultigraphDeclarationV1 {
  readonly nodes: readonly GraphNodeDeclarationV1[];
  readonly edges: readonly GraphEdgeDeclarationV1[];
}

/** The validated, canonically ordered, deeply frozen graph value. Structurally a declaration; semantically the accepted form. */
export interface CanonicalGraphV1 {
  readonly nodes: readonly GraphNodeDeclarationV1[];
  readonly edges: readonly GraphEdgeDeclarationV1[];
}

/** One typed graph rejection. `witnessNodeIds` is present iff `code` is `sothoth.graph/not-a-dag`. */
export interface GraphIssueV1 {
  readonly code: DiagnosticCodeV1;
  readonly subject: string;
  readonly witnessNodeIds?: readonly string[] | undefined;
}

/** The single failure envelope shared by all seven functions. */
export interface GraphFailureV1 {
  readonly ok: false;
  readonly issues: readonly GraphIssueV1[];
}

export interface CreateCanonicalGraphSuccessV1 {
  readonly ok: true;
  readonly graph: CanonicalGraphV1;
}

export type CreateCanonicalGraphResultV1 =
  | CreateCanonicalGraphSuccessV1
  | GraphFailureV1;

/** Validates a declaration fail-closed and returns it in canonical order, or every issue. */
export function createCanonicalGraphV1(
  declaration: DirectedMultigraphDeclarationV1,
): CreateCanonicalGraphResultV1 {
  const issues = validateDeclaration("declaration", "", declaration);
  if (issues.length > 0) {
    return finalizeFailure(issues);
  }
  const success: CreateCanonicalGraphSuccessV1 = {
    ok: true,
    graph: canonicalGraphValue(declaration),
  };
  return deepFreezeInPlace(success);
}
