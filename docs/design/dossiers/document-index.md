# @sothoth/document-index Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER` revision `2`

Design identity: `SOTHOTH-DOCUMENT-INDEX-DOSSIER` revision `2`

Component: `@sothoth/document-index`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the structural document indexing package of Sothoth
`0.1.0` under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no
implementation: `packages/document-index/src/**` stays empty until accepted Dossiers, an accepted
Architecture Baseline, and a mechanically admissible Scope BOM admit implementation at all.
Revision 2 supersedes `SOTHOTH-DOCUMENT-INDEX-DOSSIER@1` and closes the exact public contract —
the six subpath export matrix, the complete declarations and signatures, the closed structural
issue vocabulary, the span, marker, anchor, relation, ordering, digest, budget, and untrusted
witness cache semantics, and the runtime import boundary — without changing any contract
reference, public module, capability class, criterion, or section identity.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/document-index` owns the single place where Markdown stops being text and becomes
structure. It receives exact document content — bytes already acquired and identity-bound by the
caller — parses it with a CommonMark parser into an AST, and derives the deterministic
Document/Artifact Index Projection every downstream consumer reasons over: headings, anchors,
stable section identities, precise source spans, declared references, supersession, traceability,
and provenance.

The defining decision is that indexing is structural and only structural. Whatever a document
means, whether it conforms to its Document Contract, which of its revisions is current — none of
that is decided here. The package turns parsed structure into identity-addressed facts and stops.
Conformance evaluation belongs to `@sothoth/governance`, contract schemas to `@sothoth/contracts`,
and current-pointer selection to the external Registry owner. This is the boundary that lets one
index feed governance, planning, and Consumer Profiles without any of them capturing it.

Revision 2 keeps that decision fixed and closes what revision 1 left open. The public surface is
exactly six independent subpaths and no root export. Every public callable validates its runtime
argument as hostile input through one shared descriptor-only validator, returns a closed success
or failure envelope, and carries the closed fifteen-code `sothoth.document-index/*` structural
issue vocabulary, whose two content-born codes carry an exact owning artifact and source span.
Declared relations originate only from caller metadata and never from Markdown content. The
optional blob cache is an untrusted, content-neutral derivation witness: every invocation derives
freshly from the current content under the current budgets, a supplied entry proves transport
integrity only and is verified by canonical comparison, and hit, miss, and deletion are byte
neutral. Budgets are five deterministic dimensions with no clock anywhere. Revision 2 supersedes
`SOTHOTH-DOCUMENT-INDEX-DOSSIER@1` and by itself authorizes no implementation.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/document-index`, classified as a document-governance
domain library: pure functions over caller-supplied document content and identities. Its design
identity is `SOTHOTH-DOCUMENT-INDEX-DOSSIER@2`, its document identity is
`DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER@2`, and it sits in the domain layer of the accepted package
direction, above the pinned foundation `graph -> core -> contracts`. Revision 2 supersedes
`SOTHOTH-DOCUMENT-INDEX-DOSSIER@1`, which closed the module surface, boundary declarations, and
determinism posture; revision 2 adds the closed public contract — the export matrix, the exact
declarations and callables, the closed issue vocabulary, the cache trust model, and the runtime
immutability rules — without changing any contract ref, package dependency direction, public
module, criterion, or section identity.

It ships compiled ESM plus declarations with an explicit exports map, as a public package in its
own right: document indexing is a first-class Sothoth capability, not a private helper of the
governance compiler.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one deterministic index: given exact document content and its declared identity
inputs — document/artifact identity, kind, lifecycle status, version, owner, tags, and a
normalized path or Git blob identity with content digest — parse the content through the
CommonMark AST and project headings and anchors, stable section identity bound to the frozen
marker grammar, precise source spans, explicit references, supersession relations, traceability
relations, and the provenance needed to rebuild and explain the index later.

The non-goals close the boundary from the other side:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/document-index",
  "capabilityClasses": {
    "external-executable": "forbidden",
    "filesystem": "forbidden",
    "git": "forbidden",
    "governance-conformance-evaluation": "forbidden",
    "network": "forbidden",
    "non-exact-identity-cache-addressing": "forbidden",
    "process": "forbidden",
    "registry-authority": "forbidden",
    "source-document-mutation": "forbidden",
    "source-text-substring-matching": "forbidden",
    "undeclared-semantics-inference": "forbidden"
  }
}
```

In practice: the package never matches source strings or keywords where the CommonMark AST must be
consulted — a heading is a heading node, a marker is an HTML node followed by a heading sibling,
and prose content is opaque. It is not a Registry and never selects a current revision. It does not
infer semantics a document did not declare, does not evaluate Document Contract conformance, and
does not modify, reformat, or write back any source document. It opens no files, spawns no
processes, contacts no network, touches no repository, and loads no executable code: acquiring
document bytes is the caller's duty, so the index is reproducible from the exact inputs alone.
Reimplementing or copying a CommonMark parser is equally forbidden: the pinned external parser of
the dependency declaration is the only CommonMark implementation this package uses.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the correctness, completeness, and determinism of the structural facts in its
index projection over the exact content it was given, and nothing else:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/document-index",
  "producedStateRefs": [
    "sothoth.document-index/document-index@1",
    "sothoth.document-index/blob-cache-entry@1"
  ],
  "issuedAuthorityRefs": [],
  "effectOwnership": "structural-index-projections-only"
}
```

What the index says about a document's parsed structure is this package's truth; what anyone
should do about it is nobody's here. The domain meaning carried by that structure is declared
explicitly and deferred:

```json
{
  "kind": "sothoth-dossier/domain-semantics-declaration@1",
  "packageId": "@sothoth/document-index",
  "ownedDomainSemantics": [
    "commonmark-structure",
    "stable-section-identity",
    "heading-and-anchor-identity",
    "precise-source-span",
    "declared-reference-index",
    "supersession-index",
    "traceability-index",
    "index-provenance"
  ],
  "interpretedEdgeRoles": [],
  "semanticsDeferredTo": "governance-and-consumer-profiles"
}
```

Responsibilities explicitly declined: deciding whether a relation is a prerequisite or an impact
(relation-role interpretation is compiled by governance from explicit versioned mappings), judging
conformance or admissibility (governance), choosing current pointers (the Registry owner), and
attaching business meaning to a heading (Consumer Profiles). The index records that a reference,
supersession, or traceability declaration exists, with its exact declaration identity; it never
grades it. Declared relations are caller metadata and carry no source spans — no frozen
in-Markdown relation grammar exists in accepted facts — while the content-born structural findings
of marker and section handling carry exact artifact-and-span locations.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/document-index",
  "publicModules": [
    "@sothoth/document-index/parse",
    "@sothoth/document-index/sections",
    "@sothoth/document-index/anchors",
    "@sothoth/document-index/references",
    "@sothoth/document-index/index",
    "@sothoth/document-index/cache"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`parse` turns exact content into the package-owned CommonMark projection with position
information; `sections` binds stable section markers to headings and derives stable section
identities under the frozen grammar; `anchors` derives heading identities and anchors;
`references` resolves declared relations against the supplied identity universe and assembles the
canonical relation graph snapshot; `index` assembles the deterministic Document/Artifact Index
Projection with provenance; `cache` produces the optional blob-addressed derivation witness
entries. Primary consumers are `@sothoth/selectors`, which selects over the index,
`@sothoth/governance`, which compiles conformance and closure over it, and `@sothoth/planning`,
which uses the same structural facts. The SDK exposes index construction through its compilation
facade; the CLI reaches it through `sothoth index`.

Revision 2 closes the exact export matrix. Each public module exports exactly this surface and
nothing else:

| Public module | Runtime exports | Type exports |
| --- | --- | --- |
| `@sothoth/document-index/parse` | `parseDocumentV1`, `DEFAULT_DOCUMENT_INDEX_BUDGETS_V1` | `SourceSpanV1`, `StructuralIssueCodeV1`, `LocatedStructuralIssueCodeV1`, `StructuralIssueLocationV1`, `StructuralIssueV1`, `DocumentIndexFailureV1`, `DocumentIndexBudgetsV1`, `HeadingDepthV1`, `ParsedBlockNodeV1`, `ParsedDocumentV1`, `NormalizedSourceSnapshotV1`, `RelationTargetV1`, `DeclaredRelationV1`, `DocumentSourceV1`, `ParseDocumentSuccessV1`, `ParseDocumentResultV1` |
| `@sothoth/document-index/sections` | `bindStableSectionsV1` | `StableSectionRecordV1`, `SectionsSuccessV1`, `SectionsResultV1` |
| `@sothoth/document-index/anchors` | `deriveHeadingAnchorsV1` | `HeadingRecordV1`, `AnchorsSuccessV1`, `AnchorsResultV1` |
| `@sothoth/document-index/references` | `resolveDocumentRelationsV1` | `ResolvedRelationRecordV1`, `RelationGraphSnapshotV1`, `ReferencesSuccessV1`, `ReferencesResultV1` |
| `@sothoth/document-index/index` | `buildDocumentIndexV1` | `CompilerIdentityV1`, `DocumentIndexInputV1`, `DocumentEntryV1`, `IndexProvenanceV1`, `DocumentIndexProjectionV1`, `DocumentIndexSuccessV1`, `DocumentIndexResultV1` |
| `@sothoth/document-index/cache` | `buildBlobCacheEntryV1` | `BlobCacheKeyV1`, `CachedHeadingDerivationV1`, `CachedSectionDerivationV1`, `CachedDocumentDerivationV1`, `BlobCacheEntryV1`, `BlobCacheEntrySuccessV1`, `BlobCacheEntryResultV1` |

Shared vocabulary (`SourceSpanV1`, the issue union and its code/location types,
`DocumentIndexFailureV1`, budgets, source/relation input types) is owned by `/parse`;
`/sections`, `/anchors`, `/references`, `/index`, `/cache` import it type-only from `/parse` —
the Graph-revision-2 pattern that adds no seventh public module. `SECTION_ID_PATTERN` and
`SECTION_MARKER_PATTERN` are consumed from `@sothoth/contracts` inside the internal modules and
are never re-exported: no convenience alias, no second truth source. The package root is
deliberately absent: importing the bare specifier `@sothoth/document-index` fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`, and no accepted fact names a root export.

The exact public declarations are closed as follows; nothing in them is left to the implementer.
Every value returned by any function below is runtime-frozen and descriptor-safely deep-copied;
`readonly` is compile-time documentation only and is not the runtime guarantee.

```ts
// @sothoth/document-index/parse

/** UTF-16-code-unit range into the exact content string. Lines/columns 1-based; end exclusive. */
export interface SourceSpanV1 {
  readonly startLine: number;
  readonly startColumn: number;
  readonly startOffset: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly endOffset: number;
}

/** The closed fifteen-code Document Index structural-issue vocabulary. */
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
 * by this union and at runtime by the shared validator.
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

/** Deterministic budgets. Positive integers; no time dimension exists. */
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
 * selected, and never interpreted as currency.
 */
export interface RelationTargetV1 {
  readonly artifactId: string;
  readonly revision: number | null;
  readonly external: boolean;
}

/** Declared relation, caller metadata only; opaque role, never interpreted. */
export type DeclaredRelationV1 =
  | { readonly kind: "reference"; readonly role: string; readonly target: RelationTargetV1 }
  | { readonly kind: "supersession"; readonly target: RelationTargetV1 }
  | { readonly kind: "traceability"; readonly target: RelationTargetV1 };

/** One caller-supplied document. Closed field set; every string non-empty unless stated. */
export interface DocumentSourceV1 {
  readonly artifactId: string;
  readonly path: string;               // normalized-path grammar
  readonly version: string;
  readonly content: string;            // exact content; may be empty
  readonly contentDigest: string;      // sha256: + 64 hex over content UTF-8 (string form)
  readonly blobSha: string | null;     // optional Git blob object id: 40 or 64 lowercase hex
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];    // dense; entries non-empty; duplicates invalid
  readonly references: readonly DeclaredRelationV1[];
}

export interface ParseDocumentSuccessV1 {
  readonly ok: true;
  readonly source: NormalizedSourceSnapshotV1;
  readonly parsed: ParsedDocumentV1;
}

export type ParseDocumentResultV1 = ParseDocumentSuccessV1 | DocumentIndexFailureV1;

/** Validates one hostile source descriptor-only, enforces budgets, parses, and projects. */
export function parseDocumentV1(
  source: DocumentSourceV1,
  budgets: DocumentIndexBudgetsV1,
): ParseDocumentResultV1;

// @sothoth/document-index/sections
import type {
  DocumentIndexFailureV1,
  ParseDocumentResultV1,
  SourceSpanV1,
} from "./parse.js";

export interface StableSectionRecordV1 {
  readonly sectionId: string;
  readonly markerSpan: SourceSpanV1;
  readonly headingId: string;
  readonly headingSpan: SourceSpanV1;
}

export interface SectionsSuccessV1 {
  readonly ok: true;
  readonly sections: readonly StableSectionRecordV1[]; // document order
}

export type SectionsResultV1 = SectionsSuccessV1 | DocumentIndexFailureV1;

/** Binds root-level exact markers to their next-sibling headings; forwards failures canonically. */
export function bindStableSectionsV1(parsed: ParseDocumentResultV1): SectionsResultV1;

// @sothoth/document-index/anchors
import type {
  DocumentIndexFailureV1,
  HeadingDepthV1,
  ParseDocumentResultV1,
  SourceSpanV1,
} from "./parse.js";

export interface HeadingRecordV1 {
  readonly headingId: string;  // `${artifactId}#h${ordinal}`, ordinal 1-based in document order
  readonly depth: HeadingDepthV1;
  readonly text: string;       // extracted heading text
  readonly anchor: string;     // disambiguated slug
  readonly span: SourceSpanV1;
}

export interface AnchorsSuccessV1 {
  readonly ok: true;
  readonly headings: readonly HeadingRecordV1[]; // document order
}

export type AnchorsResultV1 = AnchorsSuccessV1 | DocumentIndexFailureV1;

/** Derives heading records and anchors; forwards failures canonically. */
export function deriveHeadingAnchorsV1(parsed: ParseDocumentResultV1): AnchorsResultV1;

// @sothoth/document-index/references
import type {
  DocumentIndexFailureV1,
  ParseDocumentResultV1,
} from "./parse.js";

export interface ResolvedRelationRecordV1 {
  readonly relationId: string;       // canonical-JSON identity
  readonly fromArtifactId: string;
  readonly kind: "reference" | "supersession" | "traceability";
  readonly role: string | null;      // non-null iff kind === "reference"
  readonly target: { readonly artifactId: string; readonly revision: number | null;
                    readonly external: boolean };
}

/** The canonical Graph value assembled from the resolved relations. */
export interface RelationGraphSnapshotV1 {
  readonly relationOrder: readonly string[]; // canonical edge ids == relationIds, Graph order
}

export interface ReferencesSuccessV1 {
  readonly ok: true;
  readonly relations: readonly ResolvedRelationRecordV1[]; // canonical identity order
  readonly graph: RelationGraphSnapshotV1;
}

export type ReferencesResultV1 = ReferencesSuccessV1 | DocumentIndexFailureV1;

/** Resolves all sources' declared relations against the supplied universe and orders them. */
export function resolveDocumentRelationsV1(
  parsed: readonly ParseDocumentResultV1[],
): ReferencesResultV1;

// @sothoth/document-index/index
import type { BlobCacheEntryV1 } from "./cache.js";
import type {
  DocumentIndexBudgetsV1,
  DocumentIndexFailureV1,
  DocumentSourceV1,
} from "./parse.js";
import type { HeadingRecordV1 } from "./anchors.js";
import type { ResolvedRelationRecordV1 } from "./references.js";
import type { StableSectionRecordV1 } from "./sections.js";

export interface CompilerIdentityV1 {
  readonly compilerId: string;        // non-empty
  readonly compilerRevision: number;  // positive integer
}

export interface DocumentIndexInputV1 {
  readonly sources: readonly DocumentSourceV1[]; // any order; dense
  readonly budgets: DocumentIndexBudgetsV1;
  readonly compiler: CompilerIdentityV1;
  readonly cache?: readonly BlobCacheEntryV1[] | undefined; // caller-held, optional
}

export interface DocumentEntryV1 {
  readonly schema: "sothoth.document-index/document-index@1";
  readonly artifactId: string;
  readonly path: string;
  readonly version: string;
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];                       // code-point sorted
  readonly contentDigest: string;
  readonly blobSha: string | null;
  readonly headings: readonly HeadingRecordV1[];          // document order
  readonly sections: readonly StableSectionRecordV1[];    // document order
  readonly relations: readonly ResolvedRelationRecordV1[]; // canonical identity order
  readonly entryDigest: string;
}

export interface IndexProvenanceV1 {
  readonly compiler: CompilerIdentityV1;
  readonly budgets: DocumentIndexBudgetsV1;
  readonly inputs: readonly {
    readonly artifactId: string; readonly path: string; readonly version: string;
    readonly contentDigest: string;
  }[]; // artifactId code-point order
}

export interface DocumentIndexProjectionV1 {
  readonly schema: "sothoth.document-index/document-index@1";
  readonly documents: readonly DocumentEntryV1[]; // artifactId code-point order
  readonly provenance: IndexProvenanceV1;
  readonly indexDigest: string;
}

export interface DocumentIndexSuccessV1 {
  readonly ok: true;
  readonly projection: DocumentIndexProjectionV1;
}

export type DocumentIndexResultV1 = DocumentIndexSuccessV1 | DocumentIndexFailureV1;

/**
 * Whole-index assembly: validate (including cache shapes), freshly derive every document
 * from current content under current budgets, resolve, digest, freeze. A matching cache
 * entry is verified by fresh canonical comparison and never substitutes for derivation.
 */
export function buildDocumentIndexV1(input: DocumentIndexInputV1): DocumentIndexResultV1;

// @sothoth/document-index/cache
import type { CompilerIdentityV1 } from "./index.js";
import type {
  DocumentIndexBudgetsV1,
  DocumentIndexFailureV1,
  DocumentSourceV1,
  HeadingDepthV1,
  ParsedBlockNodeV1,
  SourceSpanV1,
} from "./parse.js";

/** The cache key: exactly one blob identity and one compiler identity (frozen). */
export interface BlobCacheKeyV1 {
  readonly contentDigest: string;   // the blob identity
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
 * heading id.
 */
export interface CachedDocumentDerivationV1 {
  readonly schema: "sothoth.document-index/blob-cache-entry@1";
  readonly contentDigest: string;
  readonly nodes: readonly ParsedBlockNodeV1[];
  readonly headings: readonly CachedHeadingDerivationV1[];
  readonly sections: readonly CachedSectionDerivationV1[];
  readonly derivationDigest: string; // over this value minus the field itself (integrity only)
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

/**
 * Builds one entry by validating the hostile source/budgets/compiler, verifying the
 * content digest, and deriving directly from that exact content under those budgets.
 * There is no cross-stage mixture surface: no independently supplied stage result is
 * accepted.
 */
export function buildBlobCacheEntryV1(
  source: DocumentSourceV1,
  budgets: DocumentIndexBudgetsV1,
  compiler: CompilerIdentityV1,
): BlobCacheEntryResultV1;
```

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a value protocol on both sides. Inputs are exact document content strings plus
declared identity inputs; nothing is fetched, nothing is ambient. Outputs are plain deterministic
structures whose canonical identities and bytes come from `canonicalJson` of
`@sothoth/core/canonical-json` and `sha256Digest` of `@sothoth/core/digest` under
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, and whose resolved relation order is the canonical
order produced by `createCanonicalGraphV1` of `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` — the package
never re-implements traversal, canonicalization, or a second ordering, and never calls back into a
compilation driver. The Graph consumption is exactly one runtime import of `createCanonicalGraphV1`
through `@sothoth/graph/digraph` plus `import type` declaration imports, inside the accepted
`runtimeImportAllowlist`; every other cross-subpath dependency in the public declarations is
type-only.

The SDK boundary is likewise structural: callers construct an index from exact inputs and receive
an immutable projection. There is no registration hook, no mutation surface, and no ambient
document discovery to drift from the contract. `SECTION_ID_PATTERN` and
`SECTION_MARKER_PATTERN` are consumed directly from `@sothoth/contracts` under
`CONTRACT/SOTHOTH/SCHEMAS@1` — never via a transitive re-export or an undeclared type-only path.
The closed fifteen-code issue vocabulary is package-local wrapper vocabulary: every literal
happens to conform to the Contracts diagnostic-code grammar as a compatibility fact only, the
union neither revises nor re-exports Contracts, and it is not a Structured Diagnostic authority.
This package returns typed structural results that the calling compiler turns into Structured
Diagnostics under `CONTRACT/SOTHOTH/SCHEMAS@1`; it emits no diagnostic of its own and provides no
converter, so no second diagnostic authority is manufactured.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/document-index` completes its layer of the accepted direction and may depend only on
the pure foundation packages whose contracts it requires, plus the pinned external CommonMark
parser its parsing stage requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/document-index",
  "runtimeImportAllowlist": [
    "@sothoth/contracts",
    "@sothoth/core",
    "@sothoth/graph",
    "mdast-util-from-markdown"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ]
}
```

The package publishes exactly four runtime dependencies: the three foundation workspace packages
`@sothoth/contracts`, `@sothoth/core`, and `@sothoth/graph`, plus the pinned external CommonMark
parser `mdast-util-from-markdown` at the exact version `mdast-util-from-markdown@2.0.2` — no
range. TypeScript compilation does not bundle the parser, so an honest dependency statement
requires the fourth entry; the parser is imported only inside the internal parsing module, and the
public declaration blocks import no external package at all. The exact deployment fact of the pin
is owned by the package manifest, the repository lockfile, the release SBOM, and this Dossier; the
registration's `deploymentDependencyRefs` stays empty because the exact-reference grammar admits
only `<identity>@<positive integer revision>` and cannot express `@2.0.2`, and a weaker `@2`
entry would be a second, less exact truth beside the manifest's pin.

`CONTRACT/SOTHOTH/SCHEMAS@1` is required directly from `@sothoth/contracts` because the index's
typed inputs and findings are expressed in the shared schema, identity, and diagnostic vocabulary.
The allowlist is the closed import boundary for runtime and type-level internal imports alike, so
no vocabulary and no capability may arrive through a transitive dependency. Importing any adapter,
SDK, CLI, or sibling domain package would point outward and is a design violation, as would any
attempt by those layers to be imported here. No internal edge is reversed: the parser is not a
Sothoth package and creates no Sothoth contract edge or package-dependency edge, so the accepted
cross-artifact edge topology and waves are unchanged by this declaration.

The provided contract `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` is the structural index surface:
parsing, stable section identity, anchors, spans, and the reference/supersession/traceability
index with provenance.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

An index is built once, immutably, from exact inputs, and lives only as long as its caller holds
it. There is no stored index state between compilations: every compilation re-derives the
projection from the exact content and identity inputs, which is what keeps the projection
disposable, rebuildable, and comparable across environments.

Data flow is strictly feed-forward, and the public callables chain through one closed result
union: `parseDocumentV1` validates and parses one source; `bindStableSectionsV1`,
`deriveHeadingAnchorsV1`, and `resolveDocumentRelationsV1` consume parse results;
`buildDocumentIndexV1` assembles the whole index; `buildBlobCacheEntryV1` derives one cache entry
directly from one source. Every public function treats its runtime argument as hostile `unknown`
and reads only own data properties through descriptors: a getter on a known field never executes
and is `invalid-field`; a non-plain object is `invalid-input`; an extra own string or symbol key
is `unknown-field`; a missing required field is `missing-field`; sparse or decorated arrays are
rejected; an invalid parent or container shape suppresses every check that depends on it while
independent fields still validate. Because signatures stay narrow but runtime values are hostile,
a downstream stage revalidates a supplied stage envelope through the same shared validator,
including the cross-field check that a success's `parsed.artifactId` equals its
`source.artifactId`; a hand-built failure that passes this validator is forwarded with equal
canonical value and canonical UTF-8 bytes, never JavaScript reference identity. The truth
boundary is exact: only `parseDocumentV1`, `buildBlobCacheEntryV1`, and `buildDocumentIndexV1`
receive sources and verify content digests, so only they claim correspondence to real content.

`buildDocumentIndexV1` validates in one fixed order: input container and closed keys, budgets
shape, `sources.length <= maxDocuments`, per-source shape validation with issues accumulated,
cross-source duplicates, compiler identity, cache entry shapes and digest integrity, per-source
fresh derivation, per-source cache comparison for fresh-success sources only, per-document
sections and anchors, relation resolution, assembly. Two valid sources sharing an `artifactId` or
a normalized `path` yield one issue per duplicated identity beyond the first and suppress only
those sources' participation in the resolution universe.

The one derived state the package owns is the optional cache entry, produced by
`@sothoth/document-index/cache`: a witness bound to exactly one blob identity (the verified
`contentDigest` of the source content) and one compiler identity. Addressing a cache entry by
anything less exact — a path, a timestamp, a "similar" digest — is forbidden, and a cache is
consumed only by presenting the same exact identities again. The cache is a caller-held array in
the index input; there is no ambient store. The derivation value is content-neutral: nodes plus
ordinal-keyed headings and ordinal-linked sections, with no artifact identity field, so one
blob/compiler witness may be presented for two same-content documents without leaking either
document's identity; a verified value is rebound to the current source by constructing
`headingId = ${artifactId}#h${ordinal}` and substituting the matching heading id into section
records. Cache bytes, keys, and hit metadata never enter the projection or the provenance.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, adopted without
narrowing: an index projection can inform validation and review but grants no authority, and
nothing the package computes becomes a Source Fact or modifies one.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `adopts`.

Security posture follows from the value protocol: no filesystem, Git, process, network, or
executable capability exists in the package, so the only attack surface is the parsed content
itself and the hostile shapes around it. Hostile inputs are bounded by the five deterministic
caller-declared budget dimensions — maximum content code units, maximum documents, maximum AST
nodes, maximum relations per document, and maximum heading text code units — with no time budget
anywhere: no clock read, interrupt, worker, or partial output exists, and exhaustion is always the
deterministic `budget-exhausted` issue. Structural failures are reported, never guessed past, and
a rejected input leaves no partial index.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures are structural and reported as typed findings in the closed fifteen-code
`sothoth.document-index/*` vocabulary. Exactly the two content-born codes carry an exact owning
artifact and span; every other code carries `location: null`, because its subject is an input
path, an identity, or a cache position that has no content span:

| Code | Trigger | Subject | Location |
| --- | --- | --- | --- |
| `invalid-input` | Top-level argument or stage envelope not a plain own-data object; non-dense arrays | `input` / `sources[n]` / `parsed` / `parsed[k]` / `cache[k]` | `null` |
| `unknown-field` | Own string/symbol key outside the closed field set | `<path>.<key>` | `null` |
| `missing-field` | Required own field absent | `<path>.<field>` | `null` |
| `invalid-field` | Wrong type/value; accessor on a known field (getter never runs); sparse or decorated array; duplicate tag; parser exception; unknown issue code; wrong location/code pairing | `<path>[.<field>]` | `null` |
| `budget-exhausted` | Any of the five budget dimensions exceeded, on miss and verified-hit paths alike | `input.sources` / `sources[n].content` / `sources[n]` / `sources[n].references` | `null` |
| `duplicate-artifact-id` | Two valid sources share an `artifactId` | the `artifactId` | `null` |
| `duplicate-path` | Two valid sources share a normalized `path` | the `path` | `null` |
| `content-digest-mismatch` | Recomputed digest differs from the declared digest | `sources[n].contentDigest` | `null` |
| `marker-not-followed-by-heading` | A root marker candidate's next root sibling is not a heading (any node kind, including a definition) or is end-of-input | the `sectionId` | `{ artifactId, span }` — the exact marker candidate span |
| `duplicate-section-id` | The same `sectionId` is bound twice in one document | the `sectionId` | `{ artifactId, span }` — the later occurrence's marker span |
| `unresolved-relation-target` | A non-external target is absent from the resolution universe | `sources[n].references[m].target.artifactId` | `null` |
| `external-target-contradiction` | An external target is present in the resolution universe | `sources[n].references[m].target.artifactId` | `null` |
| `duplicate-relation` | An equal canonical relation value declared twice in one source | `sources[n].references[m]` | `null` |
| `invalid-cache-key` | Malformed or duplicated cache key | `cache[k].key` | `null` |
| `cache-entry-corrupt` | Cached value fails shape or digest integrity, or fails the fresh canonical comparison that runs only when the matching source's fresh derivation succeeded | `cache[k]` | `null` |

No CommonMark syntax-failure code exists: default CommonMark accepts effectively every string, and
the parser throws only on non-string input (already `invalid-field`) or pathological depth (also
`invalid-field`); nothing is thrown onward. No anchor codes exist: anchor derivation is total and
duplicates are disambiguated by construction. Every relation issue keeps `location: null` because
relation declarations are caller metadata with no Markdown span; no relation issue claims a span.

Recovery is always the caller fixing its document or its inputs; the package never repairs,
aliases, or partially accepts a broken structure. Issue coalescing identity is the canonical JSON
of the complete issue value, and the global order is `(code, subject, canonicalJson(location))` in
Unicode code-point order with the empty string for `null` locations — total and deterministic, so
two byte-identical issues never remain and equal canonical forwarding values are observationally
indistinguishable from package-produced failures.

Consistency is the product, under the closed determinism contract:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/document-index",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-source-span"
}
```

The same exact inputs yield byte-identical index projections on every machine and release.
Documents order ascending by `artifactId` in Unicode code-point order (ties are structurally
impossible: duplicates fail closed); within an entry, `tags` are code-point sorted, headings and
sections keep document order (structural order derived from spans — content is one string, so
input array order is irrelevant), and relations keep the canonical Graph edge order. Records that
carry identities order by canonical identity in code-point order, and content-born records whose
identities tie order by `(startOffset, endOffset)`; in this contract every such tie is
structurally impossible, which completes the tie-breaking statement. Never insertion order, hash
traversal, locale collation, or parse timing. Source spans count UTF-16 code units: lines and
columns are 1-based, offsets are 0-based, and ends are exclusive.

Deleting the cache changes no output byte, and the promise holds for an exact reason. A supplied
cache entry is an untrusted, content-neutral derivation witness: its `derivationDigest` proves
transport integrity only — it is not authentication and never authorizes this package to assert
structural truth without deriving that truth again from the exact current content. Every
invocation re-derives each document from the current content under the current budgets — a
tightened budget fails identically with or without a matching candidate — and for every source
whose fresh derivation succeeds, a key-matching candidate is compared by complete canonical value
and canonical UTF-8 bytes; a mismatch, including a forged-but-self-consistent payload whose digest
recomputes correctly, is `cache-entry-corrupt`, and an equal value is a verified hit. A source
whose fresh derivation fails skips only its own comparison and forwards that failure unchanged.
The projection is assembled exclusively from freshly derived, current-artifact-rebound values, so
verified hit, miss, and total cache deletion are byte neutral by construction. v0.1 claims no CPU
fast path and no trusted acceleration; a future trusted path would require a separately accepted
trust or proof mechanism. Concurrency needs no coordination; immutable inputs and pure functions
make parallel compilations independent.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package keeps no logs, counters, or telemetry of its own, but its output is the audit
substrate for everyone else: every index entry carries provenance — which exact content, which
declared identity inputs, which compiler identity produced it — and every structural finding
carries its exact location or a well-typed `location: null`, so an auditor can re-verify any
finding by re-running the same pure derivation. Provenance binds exactly the compiler identity,
the budgets, and the per-document identity tuple in `artifactId` code-point order; it never
records cache-hit state, cache bytes, or any witness metadata.

What the package does not do is decide what deserves observation. Structural findings become
Structured Diagnostics only when the calling compiler emits them under the identity vocabulary of
`@sothoth/contracts`; the index merely guarantees the finding is exact, located, and reproducible.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly the four declared
above: the three foundation packages `@sothoth/contracts`, `@sothoth/core`, and `@sothoth/graph`
beneath it, plus the external parser `mdast-util-from-markdown` at the exact pin
`mdast-util-from-markdown@2.0.2`. The manifest declares the four dependencies; the repository
lockfile pins the full parser closure with integrity values; the release SBOM records the
externally licensed (MIT) parser subtree next to this package's own Apache-2.0 inclusion; and the
registration's `deploymentDependencyRefs` stays empty for the exact-reference grammar reason
stated under the dependency declaration. A future mechanical lockfile maintenance may promote the
already-pinned parser tree records from dev-only reachability when this package's workspace entry
is added; that is a manifest-and-lockfile deployment fact owned by those files, and no manifest or
lockfile content is changed by this Dossier's acceptance. Conformance fixtures published alongside
the package let any consumer verify the structural and determinism claims on its own machine.

There is nothing to configure or operate: no environment variables, flags, paths, or services,
because the package acquires nothing itself. "Operations" for this artifact means consuming a new
published revision and re-running the consumer's own conformance suite; cache behavior needs no
operational attention since deleting a cache is always safe by contract.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` the projection is stable for identical inputs,
including entry ordering, span computation, and marker-grammar interpretation. Any change to
anchor derivation, section identity binding, span precision, or ordering is a new contract
revision that consumers must reference explicitly; there are no silent re-derivations and no
dual behavior flags. This Dossier revision fills in the contract's exact content without bumping
the contract identity, exactly as the Graph Dossier revision 2 did within
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`.

Migration is therefore re-reference: a consumer moves to a successor revision by editing its
exact required-contract reference, and its golden index fixtures move with the revision. The
package ships no shims, no deprecated aliases, and no auto-migration of previously computed
indexes — an old index is simply re-derived from the exact inputs under the new revision.
Revision 2 supersedes `SOTHOTH-DOCUMENT-INDEX-DOSSIER@1` without touching
`CONTRACT/SOTHOTH/SCHEMAS@1`, `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, or
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`: the contracts-owned patterns and the Core canonical and
digest utilities are consumed as-is, and the issue-code vocabulary is package-local wrapper
vocabulary, so no closed shape gains a second owner.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A domain developer gets the structural problem pre-solved: hand over exact content and
identities, receive a deterministic, span-exact, provenance-carrying index — without writing a
parser wrapper, fighting regex heuristics, or worrying about ordering. The deliberate sharp edge:
the API refuses to read files or infer meaning, so the developer must acquire bytes and declare
identities where reviewers can see them. Every callable treats its runtime argument as hostile
and fails closed with exact issue subjects instead of coercing, so shape mistakes surface as
typed findings at development time, never as silently tolerated input. That refusal is what keeps
the index honest as the shared substrate of governance, planning, and profiles.

Operators never see this package. They see its guarantees: identical conformance answers in CI
and locally, explainable findings that point at exact source spans, and rebuilds that never
depend on a cache surviving.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

Section binding convention, recorded for this and every Dossier under this contract: the
registration's `acceptanceCriteria[].sectionId` points at this unified verification entry point,
while each criterion declared below points at the subject section it constrains.

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/document-index",
  "criteria": [
    {
      "criterionId": "document-index-structural-parse-boundary",
      "sectionId": "purpose-and-non-goals"
    },
    {
      "criterionId": "document-index-deterministic-index-projection",
      "sectionId": "state-lifecycle-and-data-flow"
    },
    {
      "criterionId": "document-index-cache-byte-neutrality",
      "sectionId": "failure-recovery-and-consistency"
    }
  ]
}
```

`document-index-structural-parse-boundary` requires conformance tests proving the six-subpath
surface is closed and root-free, that every index fact is derived from the parsed CommonMark AST
— headings, markers, spans, and relation records — with zero source-text substring matching, zero
undeclared inference, and no parser or hash reimplementation.

`document-index-deterministic-index-projection` requires cross-run and cross-environment byte
equality of the index projection for identical exact inputs, including entry ordering under the
declared tie-breaking, digest self-exclusion recomputation, deep freezing without shared mutable
references, stack safety on oversized valid inputs, and the exact closed-vocabulary failure
behavior over hostile inputs, crafted stage envelopes, and multi-failure issue sets.

`document-index-cache-byte-neutrality` requires cache-hit, cache-miss, and cache-deletion paths
to produce identical output bytes; every cache entry to be addressed by exactly one blob identity
and one compiler identity; the witness value to be content-neutral; forged-but-self-consistent
entries to be rejected by fresh canonical comparison; current budgets to bind on the hit path;
and per-source comparison eligibility to hold when a source's fresh derivation fails.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability boundaries

Growth stays structural: richer anchor schemes, incremental re-indexing over unchanged subtrees,
or additional declared-relation kinds may join later revisions of
`CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`, always preserving byte stability for identical inputs and
the exact-identity cache addressing. An in-Markdown relation grammar remains a future capability:
revision 2 keeps relations as caller metadata and invents no Markdown relation syntax.

No future revision will begin inferring undeclared semantics, selecting current revisions, or
evaluating conformance: those boundaries are compatibility boundaries of this Dossier, not `0.1`
limitations, and moving one would require a new accepted architecture decision rather than a
parser feature. No revision of this Dossier introduces a wall-clock time budget, a trusted cache
acceleration path without a separately accepted trust or proof mechanism, a root export, or a
second diagnostic authority.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, `documents-and-selectors`, and
`pre-design-boundary`; to `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`,
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, and `CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from the
foundation packages beneath it; and to the catalog candidate `@sothoth/document-index` in
`SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-DOCUMENT-INDEX-DOSSIER@2`, superseding
`SOTHOTH-DOCUMENT-INDEX-DOSSIER@1` and bound to `DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER@2`,
providing `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` and requiring
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, and
`CONTRACT/SOTHOTH/SCHEMAS@1`. Every reference follows the exact grammar
`<identity>@<positive integer revision>` with the last `@` separating the revision.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

Seventeen of the eighteen closed topics are resolved by this Dossier: `identity` by
`artifact-identity-and-classification`; `intent-and-non-goals` by `purpose-and-non-goals`;
`responsibility` and `truth-ownership` by `responsibility-and-truth-ownership`; `public-surface` by
`public-surface-and-consumers`; `core-sdk-boundary` and `protocol-and-data-flow` by
`core-sdk-protocol-boundary`; `dependency-boundary` by `dependency-and-topology`;
`state-and-lifecycle` by `state-lifecycle-and-data-flow`; `failure-and-recovery` and
`concurrency-and-consistency` by `failure-recovery-and-consistency`; `observation-and-audit` by
`observation-and-audit`; `deployment-and-configuration` by
`deployment-configuration-and-operations`; `compatibility-and-migration` by
`compatibility-and-migration`; `developer-and-operator-experience` by
`developer-and-operator-experience`; `verification` by `verification-and-acceptance-criteria`;
and `future-compatibility` by `future-capability-compatibility`. `authority-and-security` is
inherited exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` section
`authority-boundary` with applicability `adopts`.
