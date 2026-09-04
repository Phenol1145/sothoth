/**
 * Public module `@sothoth/document-index/cache`: the untrusted,
 * content-neutral derivation witness builder. The builder validates the
 * hostile source/budgets/compiler, verifies the content digest, and derives
 * directly from that exact content under those budgets. There is no
 * cross-stage mixture surface: no independently supplied stage result is
 * accepted. All external imports live in the internal modules; the shared
 * vocabulary is imported type-only from `/parse` and `/index`.
 */

import type { CompilerIdentityV1 } from "./index.js";
import type {
  DocumentIndexBudgetsV1,
  DocumentIndexFailureV1,
  DocumentSourceV1,
  HeadingDepthV1,
  ParsedBlockNodeV1,
  SourceSpanV1,
} from "./parse.js";
import {
  draft,
  type BudgetShape,
  type CompilerShape,
  type IssueDraft,
  type SourceShape,
  finalizeFailure,
  validateBudgets,
  validateCompiler,
  validateSourceShape,
  digestOfValue,
} from "./internal/validation.js";
import { deriveParsedNodes, headingDerivations, boundSections } from "./internal/markdown.js";
import { deepFreezeInPlace } from "./internal/immutable.js";

/** The cache key: exactly one blob identity and one compiler identity (frozen). */
export interface BlobCacheKeyV1 {
  readonly contentDigest: string;
  readonly compiler: CompilerIdentityV1;
}

/** One content-neutral heading derivation. `ordinal` is the positive 1-based heading ordinal. */
export interface CachedHeadingDerivationV1 {
  readonly ordinal: number;
  readonly depth: HeadingDepthV1;
  readonly text: string;
  readonly anchor: string;
  readonly span: SourceSpanV1;
}

/** One content-neutral section derivation, linked to its heading by ordinal. */
export interface CachedSectionDerivationV1 {
  readonly sectionId: string;
  readonly markerSpan: SourceSpanV1;
  readonly headingOrdinal: number;
  readonly headingSpan: SourceSpanV1;
}

/**
 * The content-neutral derivation witness: root nodes, ordinal-keyed headings, and
 * ordinal-linked sections. Contains no artifactId, path, version, metadata, relation,
 * ParsedDocumentV1/HeadingRecordV1/StableSectionRecordV1 value, or artifact-derived
 * heading id (§8.8).
 */
export interface CachedDocumentDerivationV1 {
  readonly schema: "sothoth.document-index/blob-cache-entry@1";
  readonly contentDigest: string;
  readonly nodes: readonly ParsedBlockNodeV1[];
  readonly headings: readonly CachedHeadingDerivationV1[];
  readonly sections: readonly CachedSectionDerivationV1[];
  readonly derivationDigest: string;
}

export interface BlobCacheEntryV1 {
  readonly key: BlobCacheKeyV1;
  readonly value: CachedDocumentDerivationV1;
}

export interface BlobCacheEntrySuccessV1 {
  readonly ok: true;
  readonly entry: BlobCacheEntryV1;
}

export type BlobCacheEntryResultV1 = BlobCacheEntrySuccessV1 | DocumentIndexFailureV1;

const CACHE_SCHEMA = "sothoth.document-index/blob-cache-entry@1" as const;

/**
 * Builds one entry by validating the hostile source/budgets/compiler (§8.1
 * stage-1 order), verifying the source content digest, and deriving the
 * neutral value from that exact content under those budgets. The derivation
 * digest covers the value minus its own field (integrity only). The public
 * signature accepts no stage-result parameter.
 */
export function buildBlobCacheEntryV1(
  source: DocumentSourceV1,
  budgets: DocumentIndexBudgetsV1,
  compiler: CompilerIdentityV1,
): BlobCacheEntryResultV1 {
  const drafts: IssueDraft[] = [];
  const budgetShape: BudgetShape | null = validateBudgets(budgets, "input.budgets", drafts);
  const compilerShape: CompilerShape | null = validateCompiler(compiler, "input.compiler", drafts);
  const sourceShape: SourceShape | null = validateSourceShape(source, "sources[0]", drafts);
  if (sourceShape === null || budgetShape === null || compilerShape === null) {
    return finalizeFailure(drafts);
  }
  const nodes = deriveParsedNodes(sourceShape, budgetShape, "sources[0]", drafts);
  if (nodes === null) {
    return finalizeFailure(drafts);
  }
  if (sourceShape.references.length > budgetShape.maxRelationsPerDocument) {
    drafts.push(draft("sothoth.document-index/budget-exhausted", "sources[0].references"));
    return finalizeFailure(drafts);
  }
  if (drafts.length > 0) {
    return finalizeFailure(drafts);
  }
  const headings = headingDerivations(nodes);
  const { sections } = boundSections(nodes, sourceShape.artifactId);
  const value = {
    schema: CACHE_SCHEMA,
    contentDigest: sourceShape.contentDigest,
    nodes,
    headings: headings.map((heading) => ({
      ordinal: heading.ordinal,
      depth: heading.depth,
      text: heading.text,
      anchor: heading.anchor,
      span: heading.span,
    })),
    sections: sections.map((section) => ({
      sectionId: section.sectionId,
      markerSpan: section.markerSpan,
      headingOrdinal: section.headingOrdinal,
      headingSpan: section.headingSpan,
    })),
  };
  const entry = {
    key: {
      contentDigest: sourceShape.contentDigest,
      compiler: { compilerId: compilerShape.compilerId, compilerRevision: compilerShape.compilerRevision },
    },
    value: {
      schema: value.schema,
      contentDigest: value.contentDigest,
      nodes: value.nodes,
      headings: value.headings,
      sections: value.sections,
      derivationDigest: digestOfValue(value),
    },
  };
  return deepFreezeInPlace({
    ok: true as const,
    entry: deepFreezeInPlace(entry) as BlobCacheEntryV1,
  });
}
