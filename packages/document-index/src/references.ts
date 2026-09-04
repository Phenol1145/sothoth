/**
 * Public module `@sothoth/document-index/references`: declared-relation
 * resolution. Relations originate only from caller metadata; resolution
 * orders records by canonical identity, which is exactly the Graph canonical
 * edge order produced by the package's single Graph call,
 * `createCanonicalGraphV1`, consumed through the internal resolution unit
 * that owns the package's only Graph value import (§6.1/§8.6/§10.1).
 * Self-relations and cycles of any kind are recorded, never rejected;
 * contradictory targets fail closed; `revision` is opaque caller data that
 * participates in identity and is never compared to any version. Nothing
 * graph-shaped beyond `RelationGraphSnapshotV1` joins the public contract.
 */

import type {
  DocumentIndexFailureV1,
  ParseDocumentResultV1,
} from "./parse.js";
import {
  resolveRelations,
  validateStageArray,
  validateStageEnvelope,
  finalizeFailure,
  type IssueDraft,
  type ValidatedSuccess,
} from "./internal/validation.js";

export interface ResolvedRelationRecordV1 {
  readonly relationId: string;
  readonly fromArtifactId: string;
  readonly kind: "reference" | "supersession" | "traceability";
  readonly role: string | null;
  readonly target: { readonly artifactId: string; readonly revision: number | null;
                    readonly external: boolean };
}

/** The canonical Graph value assembled from the resolved relations (§8.6). */
export interface RelationGraphSnapshotV1 {
  readonly relationOrder: readonly string[];
}

export interface ReferencesSuccessV1 {
  readonly ok: true;
  readonly relations: readonly ResolvedRelationRecordV1[];
  readonly graph: RelationGraphSnapshotV1;
}

export type ReferencesResultV1 = ReferencesSuccessV1 | DocumentIndexFailureV1;

/**
 * Resolves every supplied source's declared relations against the universe
 * of supplied artifact identities and orders the records canonically.
 * Self-relations and cycles of any kind are recorded, never rejected;
 * contradictory targets fail closed; `revision` is opaque caller data that
 * participates in identity and is never compared to any version.
 */
export function resolveDocumentRelationsV1(
  parsed: readonly ParseDocumentResultV1[],
): ReferencesResultV1 {
  const arrayProblem = validateStageArray(parsed);
  if (arrayProblem !== null) {
    return finalizeFailure(arrayProblem);
  }
  const drafts: IssueDraft[] = [];
  const successes: ValidatedSuccess[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const outcome = validateStageEnvelope(parsed[index], `parsed[${index}]`);
    if (outcome.kind === "failure") {
      drafts.push(...outcome.drafts);
    } else {
      successes.push(outcome.value);
    }
  }
  if (drafts.length > 0) {
    return finalizeFailure(drafts);
  }
  return resolveRelations(successes, "parsed", drafts) ?? finalizeFailure(drafts);
}
