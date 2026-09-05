/**
 * Public module `@project-sothoth/document-index/sections`: stable section binding.
 * Binds root-level exact markers to their next-sibling headings and forwards
 * failures canonically. All external imports live in the internal modules;
 * the shared vocabulary is imported type-only from `/parse`.
 */

import type {
  DocumentIndexFailureV1,
  ParseDocumentResultV1,
  SourceSpanV1,
} from "./parse.js";
import { validateStageEnvelope, finalizeFailure, type IssueDraft } from "./internal/validation.js";
import { boundSections } from "./internal/markdown.js";
import { deepFreezeInPlace } from "./internal/immutable.js";

export interface StableSectionRecordV1 {
  readonly sectionId: string;
  readonly markerSpan: SourceSpanV1;
  readonly headingId: string;
  readonly headingSpan: SourceSpanV1;
}

export interface SectionsSuccessV1 {
  readonly ok: true;
  readonly sections: readonly StableSectionRecordV1[];
}

export type SectionsResultV1 = SectionsSuccessV1 | DocumentIndexFailureV1;

/**
 * Validates one hostile `ParseDocumentResultV1` through the shared §8.1.2
 * stage-envelope validator, then binds the sections of a validated success.
 * A validated crafted failure forwards with equal canonical value and bytes;
 * a validated crafted success is indistinguishable from a produced one.
 */
export function bindStableSectionsV1(parsed: ParseDocumentResultV1): SectionsResultV1 {
  const outcome = validateStageEnvelope(parsed, "parsed");
  if (outcome.kind === "failure") {
    return finalizeFailure(outcome.drafts);
  }
  const { sections, drafts } = boundSections(outcome.value.nodes, outcome.value.artifactId);
  if (drafts.length > 0) {
    return finalizeFailure(drafts as IssueDraft[]);
  }
  const records = sections.map((section) => ({
    sectionId: section.sectionId,
    markerSpan: section.markerSpan,
    headingId: `${outcome.value.artifactId}#h${section.headingOrdinal}`,
    headingSpan: section.headingSpan,
  }));
  return deepFreezeInPlace({
    ok: true as const,
    sections: deepFreezeInPlace(records) as readonly StableSectionRecordV1[],
  });
}
