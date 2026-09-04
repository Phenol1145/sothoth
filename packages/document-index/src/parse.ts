/**
 * Public module `@sothoth/document-index/parse`: hostile single-source
 * validation, budget enforcement, digest verification, and deterministic
 * CommonMark projection. This module owns the shared Document Index
 * vocabulary — spans, the closed fifteen-code issue union, the failure
 * envelope, budgets, parsed documents, normalized source snapshots, and the
 * declared-relation input types — which every other subpath imports
 * type-only. All external imports live in the internal modules; runtime
 * values returned here are descriptor-safe deep copies, recursively frozen.
 */

import {
  draft,
  finalizeFailure,
  type IssueDraft,
  validateSourceShape,
  validateBudgets,
  normalizedSnapshotOf,
  type SourceShape,
  type BudgetShape,
} from "./internal/validation.js";
import { deriveParsedNodes } from "./internal/markdown.js";
import { deepFrozenCopy, deepFreezeInPlace } from "./internal/immutable.js";

/** UTF-16-code-unit range into the exact content string. Lines/columns 1-based; end exclusive. */
export interface SourceSpanV1 {
  readonly startLine: number;
  readonly startColumn: number;
  readonly startOffset: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly endOffset: number;
}

/** The closed fifteen-code Document Index structural-issue vocabulary (§9). */
export type StructuralIssueCodeV1 =
  | "sothoth.document-index/invalid-input"
  | "sothoth.document-index/unknown-field"
  | "sothoth.document-index/missing-field"
  | "sothoth.document-index/invalid-field"
  | "sothoth.document-index/budget-exhausted"
  | "sothoth.document-index/duplicate-artifact-id"
  | "sothoth.document-index/duplicate-path"
  | "sothoth.document-index/content-digest-mismatch"
  | "sothoth.document-index/unresolved-relation-target"
  | "sothoth.document-index/external-target-contradiction"
  | "sothoth.document-index/duplicate-relation"
  | "sothoth.document-index/invalid-cache-key"
  | "sothoth.document-index/cache-entry-corrupt"
  | "sothoth.document-index/marker-not-followed-by-heading"
  | "sothoth.document-index/duplicate-section-id";

/** The two content-born codes whose issues carry an exact owning document and span. */
export type LocatedStructuralIssueCodeV1 =
  | "sothoth.document-index/marker-not-followed-by-heading"
  | "sothoth.document-index/duplicate-section-id";

/** The exact location of one content-born structural issue. */
export interface StructuralIssueLocationV1 {
  readonly artifactId: string;
  readonly span: SourceSpanV1;
}

/**
 * One closed structural finding. Exactly the two located codes carry a location value;
 * every other code carries `location: null`. The correspondence is enforced statically
 * by this union and at runtime by the shared validator (§8.1.2).
 */
export type StructuralIssueV1 =
  | {
      readonly code: Exclude<StructuralIssueCodeV1, LocatedStructuralIssueCodeV1>;
      readonly subject: string;
      readonly location: null;
    }
  | {
      readonly code: LocatedStructuralIssueCodeV1;
      readonly subject: string;
      readonly location: StructuralIssueLocationV1;
    };

/** The single failure envelope shared by every public stage and by buildDocumentIndexV1. */
export interface DocumentIndexFailureV1 {
  readonly ok: false;
  readonly issues: readonly StructuralIssueV1[];
}

/** Deterministic budgets. Positive integers; no time dimension exists (§5.3). */
export interface DocumentIndexBudgetsV1 {
  readonly maxContentCodeUnits: number;
  readonly maxDocuments: number;
  readonly maxAstNodes: number;
  readonly maxRelationsPerDocument: number;
  readonly maxHeadingTextCodeUnits: number;
}

export const DEFAULT_DOCUMENT_INDEX_BUDGETS_V1: Readonly<DocumentIndexBudgetsV1> = Object.freeze({
  maxContentCodeUnits: 2_000_000,
  maxDocuments: 10_000,
  maxAstNodes: 500_000,
  maxRelationsPerDocument: 1_000,
  maxHeadingTextCodeUnits: 2_000,
} as const);

/** ATX depth 1-6; Setext depth 1-2. */
export type HeadingDepthV1 = 1 | 2 | 3 | 4 | 5 | 6;

/** One root-level CommonMark block, projected package-owned; inline prose is opaque. */
export type ParsedBlockNodeV1 =
  | { readonly type: "heading"; readonly depth: HeadingDepthV1; readonly text: string;
      readonly span: SourceSpanV1 }
  | { readonly type: "html"; readonly value: string; readonly span: SourceSpanV1 }
  | { readonly type: "block";
      readonly blockKind:
        | "paragraph"
        | "code"
        | "list"
        | "blockquote"
        | "thematic-break"
        | "definition";
      readonly span: SourceSpanV1 };

/** The package-owned parsed document: root blocks in document order. */
export interface ParsedDocumentV1 {
  readonly artifactId: string;
  readonly nodes: readonly ParsedBlockNodeV1[];
}

/** Validated identity/metadata snapshot of one source (tags code-point sorted, relations deep-copied). */
export interface NormalizedSourceSnapshotV1 {
  readonly artifactId: string;
  readonly path: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly blobSha: string | null;
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];
  readonly relations: readonly DeclaredRelationV1[];
}

/**
 * Exact target of one declared relation. `revision` is an opaque caller assertion: a
 * positive integer or null (unrevisioned). It is recorded verbatim, participates in
 * relation identity, and is never compared to any DocumentSourceV1.version, never
 * selected, and never interpreted as currency (§8.5).
 */
export interface RelationTargetV1 {
  readonly artifactId: string;
  readonly revision: number | null;
  readonly external: boolean;
}

/** Declared relation, caller metadata only (§8.5); opaque role, never interpreted. */
export type DeclaredRelationV1 =
  | { readonly kind: "reference"; readonly role: string; readonly target: RelationTargetV1 }
  | { readonly kind: "supersession"; readonly target: RelationTargetV1 }
  | { readonly kind: "traceability"; readonly target: RelationTargetV1 };

/** One caller-supplied document. Closed field set; every string non-empty unless stated. */
export interface DocumentSourceV1 {
  readonly artifactId: string;
  readonly path: string;
  readonly version: string;
  readonly content: string;
  readonly contentDigest: string;
  readonly blobSha: string | null;
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];
  readonly references: readonly DeclaredRelationV1[];
}

export interface ParseDocumentSuccessV1 {
  readonly ok: true;
  readonly source: NormalizedSourceSnapshotV1;
  readonly parsed: ParsedDocumentV1;
}

export type ParseDocumentResultV1 = ParseDocumentSuccessV1 | DocumentIndexFailureV1;

/**
 * Validates one hostile source against `sources[0]`-anchored subjects
 * (§8.1), enforces the content budget, verifies the declared digest, parses
 * under the pinned parser, enforces the AST-node and heading-text budgets,
 * and projects the closed block model. Nothing is thrown onward; every
 * returned value is deeply frozen.
 */
export function parseDocumentV1(
  source: DocumentSourceV1,
  budgets: DocumentIndexBudgetsV1,
): ParseDocumentResultV1 {
  const drafts: IssueDraft[] = [];
  const budgetShape: BudgetShape | null = validateBudgets(budgets, "input.budgets", drafts);
  const sourceShape: SourceShape | null = validateSourceShape(source, "sources[0]", drafts);
  if (sourceShape !== null && budgetShape !== null) {
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
    return deepFreezeInPlace({
      ok: true as const,
      source: normalizedSnapshotOf(sourceShape),
      parsed: deepFrozenCopy({
        artifactId: sourceShape.artifactId,
        nodes,
      }) as ParsedDocumentV1,
    });
  }
  return finalizeFailure(drafts);
}
