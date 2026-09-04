/**
 * Public module `@sothoth/document-index/index`: whole-index assembly.
 * Validates (including cache shapes), freshly derives every document from
 * current content under current budgets, resolves, digests, and freezes. A
 * matching cache entry is verified by fresh canonical comparison and never
 * substitutes for derivation (§8.8). All external imports live in the
 * internal modules; the shared vocabulary is imported type-only.
 */

import type { BlobCacheEntryV1 } from "./cache.js";
import type {
  DocumentIndexBudgetsV1,
  DocumentIndexFailureV1,
  DocumentSourceV1,
  ParsedBlockNodeV1,
} from "./parse.js";
import type { HeadingRecordV1 } from "./anchors.js";
import type { ResolvedRelationRecordV1 } from "./references.js";
import type { StableSectionRecordV1 } from "./sections.js";
import {
  canonicalBytes,
  checkClosedKeys,
  digestOfValue,
  draft,
  finalizeFailure,
  isDenseArray,
  isPlainObject,
  readOwnField,
  validateBudgets,
  validateCacheContainer,
  validateCompiler,
  resolveRelations,
  validateSourceShape,
  type BudgetShape,
  type CacheCandidate,
  type CompilerShape,
  type IssueDraft,
  type RelationEmitter,
  type SourceShape,
} from "./internal/validation.js";
import { boundSections, deriveParsedNodes, headingDerivations } from "./internal/markdown.js";
import { deepFrozenCopy, deepFreezeInPlace } from "./internal/immutable.js";
import { compareCodePointOrder } from "./internal/code-point.js";

export interface CompilerIdentityV1 {
  readonly compilerId: string;
  readonly compilerRevision: number;
}

export interface DocumentIndexInputV1 {
  readonly sources: readonly DocumentSourceV1[];
  readonly budgets: DocumentIndexBudgetsV1;
  readonly compiler: CompilerIdentityV1;
  readonly cache?: readonly BlobCacheEntryV1[] | undefined;
}

export interface DocumentEntryV1 {
  readonly schema: "sothoth.document-index/document-index@1";
  readonly artifactId: string;
  readonly path: string;
  readonly version: string;
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];
  readonly contentDigest: string;
  readonly blobSha: string | null;
  readonly headings: readonly HeadingRecordV1[];
  readonly sections: readonly StableSectionRecordV1[];
  readonly relations: readonly ResolvedRelationRecordV1[];
  readonly entryDigest: string;
}

export interface IndexProvenanceV1 {
  readonly compiler: CompilerIdentityV1;
  readonly budgets: DocumentIndexBudgetsV1;
  readonly inputs: readonly {
    readonly artifactId: string;
    readonly path: string;
    readonly version: string;
    readonly contentDigest: string;
  }[];
}

export interface DocumentIndexProjectionV1 {
  readonly schema: "sothoth.document-index/document-index@1";
  readonly documents: readonly DocumentEntryV1[];
  readonly provenance: IndexProvenanceV1;
  readonly indexDigest: string;
}

export interface DocumentIndexSuccessV1 {
  readonly ok: true;
  readonly projection: DocumentIndexProjectionV1;
}

export type DocumentIndexResultV1 = DocumentIndexSuccessV1 | DocumentIndexFailureV1;

const INDEX_SCHEMA = "sothoth.document-index/document-index@1" as const;
const CACHE_SCHEMA = "sothoth.document-index/blob-cache-entry@1" as const;

/**
 * Whole-index assembly per §8.1's exact whole-input order: input container
 * and closed keys, budgets shape, the `maxDocuments` budget, per-source
 * shape validation with issues accumulated, cross-source duplicates,
 * compiler identity, cache phases 1–2, per-source fresh derivation (phase
 * 3), per-source cache comparison for fresh-success sources only (phase 4),
 * per-document sections and anchors, relation resolution, assembly. The
 * projection is a pure function of `(sources, budgets, compiler)`: verified
 * hit, miss, and total cache deletion produce identical canonical bytes
 * because the cached value is never substituted for the fresh derivation.
 */
export function buildDocumentIndexV1(input: DocumentIndexInputV1): DocumentIndexResultV1 {
  const drafts: IssueDraft[] = [];
  if (!isPlainObject(input)) {
    return finalizeFailure([draft("sothoth.document-index/invalid-input", "input")]);
  }
  checkClosedKeys(input, ["sources", "budgets", "compiler", "cache"], "input", drafts);
  const budgetsField = readOwnField(input, "budgets");
  let budgets: BudgetShape | null = null;
  if (budgetsField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", "input.budgets"));
  } else if (budgetsField.state === "data") {
    budgets = validateBudgets(budgetsField.value, "input.budgets", drafts);
  }
  const sourcesField = readOwnField(input, "sources");
  let sourceList: readonly unknown[] | null = null;
  if (sourcesField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", "input.sources"));
  } else if (sourcesField.state === "data") {
    if (isDenseArray(sourcesField.value)) {
      sourceList = sourcesField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-input", "input.sources"));
    }
  }
  if (budgets !== null && sourceList !== null && sourceList.length > budgets.maxDocuments) {
    drafts.push(draft("sothoth.document-index/budget-exhausted", "input.sources"));
  }
  const shapes: (SourceShape | null)[] =
    sourceList === null
      ? []
      : sourceList.map((source, index) => validateSourceShape(source, `sources[${index}]`, drafts));
  const compilerField = readOwnField(input, "compiler");
  let compiler: CompilerShape | null = null;
  if (compilerField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", "input.compiler"));
  } else if (compilerField.state === "data") {
    compiler = validateCompiler(compilerField.value, "input.compiler", drafts);
  }
  const cacheField = readOwnField(input, "cache");
  let candidates: readonly CacheCandidate[] = [];
  if (cacheField.state === "data" && cacheField.value !== undefined) {
    // `cache` is explicitly optional-and-undefined in §7; an undefined data
    // value is the absent container, not a malformed one.
    candidates = validateCacheContainer(cacheField.value, drafts);
  }

  // Phase 3: fresh derivation from the current content under the current
  // invocation budgets, including full AST-node, heading-text, and
  // declared-relations enforcement. A too-tight budget fails identically
  // with or without a matching cache candidate.
  const freshNodes: (readonly ParsedBlockNodeV1[] | null)[] = shapes.map((shape, index) => {
    if (shape === null || budgets === null) {
      return null;
    }
    const nodes = deriveParsedNodes(shape, budgets, `sources[${index}]`, drafts);
    if (nodes === null) {
      return null;
    }
    // §8.1 stage-1 tail: `references.length ≤ maxRelationsPerDocument` —
    // the raw length of the shape-validated declarations, every relation
    // form counted, no dedup (equal values are the separate
    // `duplicate-relation` diagnostic, not a length reduction). This is the
    // last stage-1 check, so a shape-valid source whose earlier checks all
    // passed reaches exactly here. The failure is a closed fresh-derivation
    // failure: the issue forwards unchanged, and the source becomes
    // comparison-ineligible in phase 4 exactly like every other derivation
    // failure, scoped to this source alone.
    if (shape.references.length > budgets.maxRelationsPerDocument) {
      drafts.push(draft("sothoth.document-index/budget-exhausted", `sources[${index}].references`));
      return null;
    }
    return nodes;
  });

  // Per-document sections and anchors for fresh successes, then the phase-4
  // cache comparison, run only for fresh-success sources. A source whose
  // fresh derivation failed skips its comparison and forwards that failure;
  // the skip is scoped to that source only.
  const headingRecords: HeadingRecordV1[][] = [];
  const sectionRecords: StableSectionRecordV1[][] = [];
  shapes.forEach((shape, index) => {
    headingRecords.push([]);
    sectionRecords.push([]);
    const nodes = freshNodes[index] ?? null;
    if (shape === null || nodes === null) {
      return;
    }
    const headings = headingDerivations(nodes);
    headingRecords[index] = headings.map((heading) => ({
      headingId: `${shape.artifactId}#h${heading.ordinal}`,
      depth: heading.depth,
      text: heading.text,
      anchor: heading.anchor,
      span: heading.span,
    }));
    const bound = boundSections(nodes, shape.artifactId);
    sectionRecords[index] = bound.sections.map((section) => ({
      sectionId: section.sectionId,
      markerSpan: section.markerSpan,
      headingId: `${shape.artifactId}#h${section.headingOrdinal}`,
      headingSpan: section.headingSpan,
    }));
    drafts.push(...bound.drafts);
    // §8.8 phase 4: only a fresh success is comparison-eligible. A
    // marker/section structural failure in `bound.drafts` is a closed fresh
    // derivation failure, so the comparison is genuinely not run for this
    // source (not post-filtered) and the failure forwards unchanged.
    if (compiler !== null && bound.drafts.length === 0) {
      compareCacheCandidate(candidates, shape, nodes, headings, bound.sections, compiler, drafts);
    }
  });

  // Relation resolution over the shape-valid subset (§8.5/§8.1.1): a
  // shape-invalid source is not validly identified — it contributes no
  // duplicates, no universe identity, and no relations — and it never
  // suppresses diagnostics between valid sources. Emitters carry their
  // original input positions so §9 subjects stay `sources[i]`.
  const emitters: RelationEmitter[] = [];
  shapes.forEach((shape, index) => {
    if (shape === null) {
      return;
    }
    emitters.push({
      artifactId: shape.artifactId,
      path: shape.path,
      relations: shape.references,
      sourceIndex: index,
    });
  });
  let resolved: ReturnType<typeof resolveRelations> = null;
  // Unconditional: the empty emitter set is the §8.5 empty universe, which
  // succeeds with zero relations; `resolveRelations` itself fails exactly
  // when drafts accumulated.
  resolved = resolveRelations(emitters, "sources", drafts);
  if (drafts.length > 0 || resolved === null) {
    return finalizeFailure(drafts);
  }

  // Assembly: documents ascending by artifactId; tags code-point sorted;
  // headings/sections in document order; relations in canonical identity
  // order; the schema literal inside every digest input; the digest field
  // never part of its own input.
  const entries: DocumentEntryV1[] = shapes.map((shape, index) => {
    const valid = shape!;
    const withoutDigest = {
      schema: INDEX_SCHEMA,
      artifactId: valid.artifactId,
      path: valid.path,
      version: valid.version,
      kind: valid.kind,
      status: valid.status,
      owner: valid.owner,
      tags: [...valid.tags].sort(compareCodePointOrder),
      contentDigest: valid.contentDigest,
      blobSha: valid.blobSha,
      headings: headingRecords[index]!,
      sections: sectionRecords[index]!,
      relations: resolved!.relations.filter(
        (relation) => relation.fromArtifactId === valid.artifactId,
      ),
    };
    return {
      ...withoutDigest,
      tags: deepFrozenCopy(withoutDigest.tags) as readonly string[],
      entryDigest: digestOfValue(withoutDigest),
    };
  });
  entries.sort((left, right) => compareCodePointOrder(left.artifactId, right.artifactId));
  const documents = deepFrozenCopy(entries) as readonly DocumentEntryV1[];
  const provenance = deepFrozenCopy({
    compiler: { ...compiler! },
    budgets: { ...budgets! },
    inputs: documents.map((document) => ({
      artifactId: document.artifactId,
      path: document.path,
      version: document.version,
      contentDigest: document.contentDigest,
    })),
  }) as {
    compiler: CompilerIdentityV1;
    budgets: DocumentIndexBudgetsV1;
    inputs: readonly {
      artifactId: string;
      path: string;
      version: string;
      contentDigest: string;
    }[];
  };
  const projection = {
    schema: INDEX_SCHEMA,
    documents,
    provenance,
    indexDigest: digestOfValue({ schema: INDEX_SCHEMA, documents, provenance }),
  };
  return deepFreezeInPlace({
    ok: true as const,
    projection: deepFreezeInPlace(projection) as DocumentIndexProjectionV1,
  });
}

/**
 * Phase 4 for one comparison-eligible fresh success: derive the
 * content-neutral value from the fresh result and compare its complete
 * canonical value and bytes with every key-matching candidate's complete
 * value; a mismatch — including a forged-but-self-consistent payload whose
 * digest recomputes correctly — is `cache-entry-corrupt` at the candidate's
 * position. At most one candidate matches (duplicates already failed
 * `invalid-cache-key` before comparison); an equal value is a verified hit
 * whose bytes never enter the projection.
 */
function compareCacheCandidate(
  candidates: readonly CacheCandidate[],
  shape: SourceShape,
  nodes: readonly ParsedBlockNodeV1[],
  headings: ReturnType<typeof headingDerivations>,
  sections: ReturnType<typeof boundSections>["sections"],
  compiler: CompilerShape,
  drafts: IssueDraft[],
): void {
  const keyBytes = canonicalBytes({
    contentDigest: shape.contentDigest,
    compiler: { compilerId: compiler.compilerId, compilerRevision: compiler.compilerRevision },
  });
  // The digest input is the value minus its own field (§8.7).
  const freshWithoutDigest = {
    schema: CACHE_SCHEMA,
    contentDigest: shape.contentDigest,
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
  const freshBytes = canonicalBytes({
    ...freshWithoutDigest,
    derivationDigest: digestOfValue(freshWithoutDigest),
  });
  for (const candidate of candidates) {
    if (canonicalBytes(candidate.key) !== keyBytes) {
      continue;
    }
    if (canonicalBytes(candidate.value) !== freshBytes) {
      drafts.push(
        draft("sothoth.document-index/cache-entry-corrupt", `cache[${candidate.index}]`),
      );
    }
  }
}
