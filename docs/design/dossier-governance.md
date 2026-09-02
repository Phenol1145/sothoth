# Dossier Governance (Bootstrap)

Status: bootstrap documentation, pending registration as a governed design document

Version: `SOTHOTH-DOSSIER-GOVERNANCE-BOOTSTRAP-1`

Decision date: 2026-09-02

This document records the consumer-neutral Dossier governance bootstrap that gates Sothoth `0.1.0`
pre-design closure. It is implemented by the temporary bootstrap oracle
`scripts/check-pre-design.mjs` and will be replaced by `@sothoth/governance` plus a self-host replay
once implementation is authorized. The bootstrap checker and the formal compiler must agree on
closure and admissibility conclusions before any candidate release.

## Source Facts

The checker consumes four version-controlled Source Facts and never writes any of them back:

- `docs/design/v0.1.0-design-scope-catalog.json` — the provisional `sothoth.design-scope-catalog/v1`
  candidate inventory validated by `scripts/check-design-scope-catalog.mjs`;
- `docs/design/contracts/artifact-design-dossier.v1.json` — the closed
  `sothoth.design-dossier/full/v1` Dossier Document Contract: eighteen required stable section IDs in
  exact order, the eighteen-topic closed set, the `local | inherited | not-applicable` resolutions,
  and the `adopts | narrows | specializes` inheritance applicability (there is no `overrides`);
- `docs/design/document-registry.json` — the `sothoth.design-document-registry/v1` registry binding
  each design document to an exact `documentId`, `documentRevision`, path, lifecycle status, and its
  declared stable section IDs. The local design capsule is registered as
  `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN` revision `2` with the nine section IDs frozen by
  Task 1;
- `docs/design/artifact-design-registrations.json` — the
  `sothoth.artifact-design-registrations/v1` collection, initially empty. Tasks 3–6 append one
  proposed registration per candidate component.

Registrations follow the accepted design's `ArtifactDesignRegistrationV1` shape: identity fields
(`designId`, `componentId`, `designRevision`, `designRequirement`, `status`, `supersedes`), an exact
`documentRef`, the full `topicCoverage` record, the producer/consumer edge fields
(`providedContractRefs`, `requiredContractRefs`), truth and authority fields
(`producedStateRefs`, `consumedStateRefs`, `issuedAuthorityRefs`, `requiredAuthorityRefs`),
`emittedObservationRefs`, `deploymentDependencyRefs`, and `acceptanceCriteria` of stable
`DesignCriterionRefV1` entries. Every field set is closed; unknown fields fail closed.

Every entry in all eight `*Refs` arrays uses one bootstrap exact-reference grammar:
`<non-empty identity>@<positive integer revision>`, where the **last** `@` separates the revision, so
scoped npm-style identities remain valid. Bare names, paths, `latest`, implicit-current references,
and revision `0` are not exact. A non-conforming entry is diagnosed per field: contract refs report
`sothoth.pre-design/contract-ref-not-exact` and the six non-contract fields report
`sothoth.pre-design/reference-not-exact`, each with the componentId, the field name, and the original
entry in the subject. Semver- and digest-shaped references remain future contract revisions.

## Stable section markers

A stable section marker is an HTML comment that exactly matches
`<!-- sothoth:section id="[a-z][a-z0-9-]*" -->` and whose next non-blank CommonMark AST sibling is a
heading. Blank source lines between a marker and its heading are permitted: adjacency is a property
of the parsed AST, not of physical lines. A marker followed by any other node (or by nothing) binds
no section and is reported. HTML comments that do not match the exact pattern are not markers and are
ignored. Documents are parsed with `mdast-util-from-markdown`; the checker never scans prose, never
matches substrings, and never infers structure, topics, or permissions from text.

## Phased checking

`checkPreDesign({ phase })` is cumulative across three phases:

- `dossiers` — validates the registry against document bytes, the registrations collection, the
  closed topic set with exactly one well-formed resolution per topic, exact section and document
  references, resolvable criteria shapes, and one registration per catalog candidate. `proposed`
  status is permitted. This phase reports the repository's current gap: eleven missing registrations.
- `closure` — additionally requires retained (non-superseded) registrations, closed contract edges
  (every required contract identity resolves to a provision at the identical revision; a single
  identity referenced at multiple revisions is a mismatch), unique truth owners (each produced state
  has exactly one producer), an acyclic exact-inheritance graph, and at least one acceptance
  criterion per retained registration. It emits a byte-bound `DesignClosureProjectionV1` that reports
  `readyForAcceptance: true` when every check passes. The checker never flips a Dossier, a
  registration, or a Baseline to `accepted`: acceptance is an external, accountable action.
- `scope` — additionally requires an externally accepted Architecture Baseline, `accepted`
  registration status for every candidate, and a candidate Scope BOM whose membership is bound to
  the catalog: every catalog candidate must appear exactly once (`scope-bom-member-missing` /
  `scope-bom-member-unknown`), and each member's single `designRef` must resolve into a registration
  of that member's **own** component at the exact `designId` and `designRevision` and point at that
  Baseline (`design-ref-unresolved` / `design-ref-component-mismatch` /
  `design-ref-baseline-mismatch`). It emits a `ScopeBomAdmissibilityProjectionV1` stating
  admissibility only; it never writes an authoritative Scope BOM.

## Projections, canonical JSON, and the CLI

Both projections are non-authoritative, disposable, and rebuildable from exact input identities.
Each records the readable identity and revision of every Source Fact it consumed — the contract
(`contractId`/`contractRevision`), the catalog, the document registry, and the registrations
collection — plus a `sourceFactsDigest` and, per member, the exact `documentRef` needed to trace the
member back to its Dossier document. The `sourceFactsDigest` is a SHA-256 hash
(`sha256:`-prefixed hex) over a deterministically normalized value of the consumed Source Facts:
CommonMark document strings participate verbatim (changing prose without changing markers changes
the digest), registration collections and Scope BOM member sets are canonically sorted (input order
cannot change the digest or the projection bytes), and JSON object key insertion order is
irrelevant. The closure projection binds the contract, catalog, registry, documents, and
registrations; the scope projection additionally binds the Architecture Baseline and the Scope BOM.
Projection members are sorted by `componentId` in Unicode code-point order.

Canonical JSON serializes recursively key-sorted (Unicode code-point order) with compact separators;
the projection's canonical bytes are its identity, so identical inputs always rebuild identical
bytes. Diagnostic order is deterministic: issues are sorted by code, then subject, regardless of
input traversal order.

The default CLI writes only canonical JSON (one trailing newline) to stdout and creates no files.
Exit codes follow the design: `0` valid, `1` invalid, `2` invalid-input. Schema or envelope
violations in any of the four input Source Facts — the contract, the catalog, the registry, or the
registrations wrapper — are `invalid-input` with a null projection, as are unreadable or
unparseable source files. Projection files are written only when `--output <explicit-path>` is
supplied, and the file bytes are exactly the stdout bytes; if the requested output path cannot be
written, stdout carries exactly one canonical `invalid-input` result with the diagnostic
`sothoth.pre-design/output-unwritable`, the process exits `2`, and no check result is emitted
first. `--baseline <path>` and `--scope-bom <path>` supply the scope-phase Source Facts when they
exist.

## Authority boundaries

The bootstrap checker validates `proposed` facts and reports readiness; it cannot accept Dossiers,
registrations, Architectures Baselines, or Scope BOMs, and it cannot create authoritative release
membership. Passing a check is never an acceptance act. The formal compiler that replaces this
oracle must reproduce the same conclusions or the candidate release fails.
