/**
 * Public module `@sothoth/document-index/anchors`: heading records and
 * anchors. Derives the per-document heading identities and disambiguated
 * anchors from a validated parse result and forwards failures canonically.
 * All external imports live in the internal modules; the shared vocabulary
 * is imported type-only from `/parse`.
 */

import type {
  DocumentIndexFailureV1,
  HeadingDepthV1,
  ParseDocumentResultV1,
  SourceSpanV1,
} from "./parse.js";
import { validateStageEnvelope, finalizeFailure, type IssueDraft } from "./internal/validation.js";
import { headingDerivations } from "./internal/markdown.js";
import { deepFreezeInPlace } from "./internal/immutable.js";

export interface HeadingRecordV1 {
  readonly headingId: string;
  readonly depth: HeadingDepthV1;
  readonly text: string;
  readonly anchor: string;
  readonly span: SourceSpanV1;
}

export interface AnchorsSuccessV1 {
  readonly ok: true;
  readonly headings: readonly HeadingRecordV1[];
}

export type AnchorsResultV1 = AnchorsSuccessV1 | DocumentIndexFailureV1;

/**
 * Validates one hostile `ParseDocumentResultV1` through the shared §8.1.2
 * stage-envelope validator, then derives heading records and anchors for a
 * validated success. Ordinals count every heading in document order;
 * anchors are per-document and disambiguated; heading renames change the
 * anchor, never a bound section's `sectionId`.
 */
export function deriveHeadingAnchorsV1(parsed: ParseDocumentResultV1): AnchorsResultV1 {
  const outcome = validateStageEnvelope(parsed, "parsed");
  if (outcome.kind === "failure") {
    return finalizeFailure(outcome.drafts);
  }
  const derivations = headingDerivations(outcome.value.nodes);
  const records = derivations.map((derivation) => ({
    headingId: `${outcome.value.artifactId}#h${derivation.ordinal}`,
    depth: derivation.depth,
    text: derivation.text,
    anchor: derivation.anchor,
    span: derivation.span,
  }));
  return deepFreezeInPlace({
    ok: true as const,
    headings: deepFreezeInPlace(records) as readonly HeadingRecordV1[],
  });
}
