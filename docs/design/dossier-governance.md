# Dossier Governance (Bootstrap)

Status: bootstrap documentation, pending registration as a governed design document

Version: `SOTHOTH-DOSSIER-GOVERNANCE-BOOTSTRAP-2`

Decision date: 2026-09-02 (revision 2 records the Task 8 accepted-scope extension)

This document records the consumer-neutral Dossier governance bootstrap that gates Sothoth `0.1.0`
pre-design closure. It is implemented by the temporary bootstrap oracle
`scripts/check-pre-design.mjs` and will be replaced by `@sothoth/governance` plus a self-host replay
once implementation is authorized. The bootstrap checker and the formal compiler must agree on
closure and admissibility conclusions before any candidate release.

## Source Facts

The checker consumes six version-controlled Source Facts and never writes any of them back:

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
  `sothoth.artifact-design-registrations/v1` collection. Tasks 3–6 appended one proposed
  registration per candidate component. On 2026-09-03 the external human owner reviewed the Task 7
  Dossiers, cross-artifact edge review, and closure projection and accepted
  `SOTHOTH-ARCHITECTURE-BASELINE-0.1` revision 1; Task 8 transcribes that owner action by changing
  exactly the eleven registration statuses from `proposed` to `accepted`. No other registration
  field changed. Acceptance is never produced by the checker, a test, or a projection;
- `docs/design/v0.1.0-architecture-baseline.json` — the accepted
  `sothoth.architecture-baseline/v1` Architecture Baseline described below;
- `docs/release/v0.1.0-scope-bom.json` — the formal `sothoth.release-bom/v1` Scope BOM described
  below. The interim `sothoth.candidate-scope-bom/v1` bootstrap fixture from Task 2 is no longer an
  admissible scope input: the `scope` phase accepts only `sothoth.release-bom/v1`, and the old
  candidate schema fails closed with the normal Scope BOM schema diagnostic.

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

## Architecture Baseline V1 and the human acceptance fact

The Architecture Baseline is an externally authored, accepted Source Fact with the closed top-level
shape `schema | baselineId | baselineRevision | targetRelease | status | acceptedBy | acceptedAt |
members`. The committed Baseline is `SOTHOTH-ARCHITECTURE-BASELINE-0.1` revision `2`, targets release
`0.1.0`, and is `accepted`. Revision 1 was accepted in the historical `2026-09-03` owner act
recorded in the registrations section above; revision 2 — the Graph Dossier revision-2 acceptance —
records its own externally authored acceptance metadata, with `acceptedBy`
`{"principalType":"human","principalId":"anzhize"}` and `acceptedAt` `2026-09-03` supplied verbatim
by that later human acceptance act. `principalType` is structurally fixed to `human`, and
`acceptedAt` must be a valid `YYYY-MM-DD` calendar date; an in-memory fixture may carry another
non-empty `principalId` and valid date, but the checker never synthesizes acceptance metadata from a
passing projection and no agent, checker, or test is an accepting principal.

Each of the eleven `members` is closed as
`componentId | designId | designRevision | documentRef | dossierDigest`, appears exactly once, is a
Design Scope Catalog candidate, and is listed in Unicode code-point `componentId` order. Every member
must bind the unique retained registration of its **own** component at the identical `designId`,
`designRevision`, and `documentRef` (`documentId` + `documentRevision`). `dossierDigest` is lowercase
`sha256:` plus 64 hexadecimal characters over the exact UTF-8 bytes of the referenced CommonMark
Dossier; the checker recomputes it from the consumed document bytes, so any Dossier edit without a
Baseline revision fails closed. The Baseline adds no Dossier status change: registry lifecycle and
registration status remain owned by their own Source Facts.

## Formal Scope BOM V1 and completion gates

The formal Scope BOM is the closed `sothoth.release-bom/v1` shape
`schema | bomId | bomRevision | targetRelease | members`. The committed BOM is
`SOTHOTH-RELEASE-SCOPE-BOM-0.1` revision `2` targeting `0.1.0` with exactly the eleven catalog
candidates in Unicode code-point `id` order and no external relations: `@fracta/sothoth-profile`
is a FRACTA-owned external companion and can never appear as a member. Each member carries
`id`, `version: "0.1.0"`, `type: "npm-package"`, `layer: "required"`, `owner: "sothoth"`, exactly one
`designRef`, and non-empty `completionGates`. The member `version` is the declared release target
required by this plan; it is not a claim that candidate tarballs, digests, or a release lock exist,
and the BOM carries no artifact, integrity, provenance, completion-state, or release-lock fields.

Every `designRef` is closed as
`architectureBaselineId | architectureBaselineRevision | designId | designRevision` and must resolve
to that member's own accepted registration and to a member of the exact accepted Baseline identity
and revision named by the Baseline. Each gate is closed as `gateId | criterionIds`. Gate IDs must be
unique within a member and code-point sorted; criterion IDs must be non-empty, unique across the
member's gates, and code-point sorted; and the union of a member's criterion IDs must equal its
registration's acceptance-criterion identities exactly — no missing, unknown, or duplicated
criterion. The committed BOM uses exactly one gate per member with the stable gate ID
`<unscoped-package-name>-dossier-criteria`.

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
  status is permitted. With the eleven reviewed registrations in place this phase is valid over the
  repository facts.
- `closure` — additionally requires retained (non-superseded) registrations, closed contract edges
  (every required contract identity resolves to a provision at the identical revision; a single
  identity referenced at multiple revisions is a mismatch), unique truth owners (each produced state
  has exactly one producer), an acyclic exact-inheritance graph, and at least one acceptance
  criterion per retained registration. It emits a byte-bound `DesignClosureProjectionV1` that reports
  `readyForAcceptance: true` when every check passes. The checker never flips a Dossier, a
  registration, or a Baseline to `accepted`: acceptance is an external, accountable action.
- `scope` — additionally requires the accepted Architecture Baseline, `accepted` registration status
  for every candidate, and the formal `sothoth.release-bom/v1`. Baseline membership must cover every
  catalog candidate exactly once with own-component bindings and recomputed Dossier digests; release
  membership must cover every candidate exactly once (`scope-bom-member-missing` /
  `scope-bom-member-unknown`); each member's single `designRef` must resolve into a registration of
  that member's **own** component at the exact `designId` and `designRevision` and point at that
  exact Baseline (`design-ref-unresolved` / `design-ref-component-mismatch` /
  `design-ref-baseline-mismatch`); and the completion gates must cover the registration criteria
  exactly. It emits a `ScopeBomAdmissibilityProjectionV1` stating admissibility only; it never writes
  an authoritative Scope BOM.

## Scope diagnostics

The `scope` phase distinguishes, with stable subjects, the established diagnostics
`baseline-missing`, `baseline-invalid`, `baseline-not-accepted`, `registration-not-accepted`,
`scope-bom-missing`, `scope-bom-invalid`, `scope-bom-member-missing`, `scope-bom-member-unknown`,
`design-ref-unresolved`, `design-ref-component-mismatch`, and `design-ref-baseline-mismatch` (all
under `sothoth.pre-design/`), plus the new Baseline-member, gate, digest, and criterion
diagnostics, also under `sothoth.pre-design/`:

- `baseline-member-missing` / `baseline-member-unknown` / `baseline-member-duplicate` — subject is
  the `componentId`;
- `baseline-member-invalid` — subject is `<componentId>:<field>` for an unknown, missing, or
  malformed member field, or `members` for a non-object member;
- `baseline-member-component-mismatch` — the member's `designId` belongs to another component;
  subject is the `componentId`;
- `baseline-member-design-mismatch` — wrong `designId`, `designRevision`, or `documentRef` against
  the component's own registration; subject is the `componentId`;
- `baseline-dossier-digest-mismatch` — the recomputed Dossier digest differs; subject is the
  `componentId`;
- `scope-bom-gate-invalid` / `scope-bom-gate-duplicate` — malformed gate or repeated gate identity;
  subject is `<id>:<gateId>`;
- `scope-bom-gate-order` — a member's gates are not code-point sorted by `gateId`; subject is the
  member `id`;
- `scope-bom-criterion-missing` — a registration criterion is not covered by any gate; subject is
  the member `id`;
- `scope-bom-criterion-unknown` / `scope-bom-criterion-duplicate` — subject is
  `<id>:<criterionId>`;
- `scope-bom-criterion-order` — a gate's criterion IDs are not code-point sorted; subject is
  `<id>:<gateId>`.

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
registrations; the scope projection additionally binds the full accepted Architecture Baseline and
the formal Scope BOM, with Baseline and BOM member sets canonically sorted. Projection members are
sorted by `componentId` in Unicode code-point order.

The scope projection reports the Baseline identity/status object
(`baselineId`, `baselineRevision`, `status`) and a `scopeBom` identity object
(`bomId`, `bomRevision`, `targetRelease`). Each projected member is keyed by `componentId` (mapped
from the formal member `id`) and reports `registrationStatus`, `documentRef`, `designId`,
`designRevision`, `designRefResolved`, `baselineMemberResolved`, and `completionCriteriaResolved`.
`admissible` is true only when the complete check is valid. The projection carries no acceptance
metadata: it reads the Baseline's recorded facts but never asserts, creates, or re-accepts them.

Canonical JSON serializes recursively key-sorted (Unicode code-point order) with compact separators;
the projection's canonical bytes are its identity, so identical inputs always rebuild identical
bytes. Diagnostic order is deterministic: issues are sorted by code, then subject, regardless of
input traversal order.

The default CLI writes only canonical JSON (one trailing newline) to stdout and creates no files.
Exit codes follow the design: `0` valid, `1` invalid, `2` invalid-input. Schema or envelope
violations in any of the four base input Source Facts — the contract, the catalog, the registry, or
the registrations wrapper — are `invalid-input` with a null projection, as are unreadable or
unparseable source files. Projection files are written only when `--output <explicit-path>` is
supplied, and the file bytes are exactly the stdout bytes; if the requested output path cannot be
written, stdout carries exactly one canonical `invalid-input` result with the diagnostic
`sothoth.pre-design/output-unwritable`, the process exits `2`, and no check result is emitted
first. `--baseline <path>` and `--scope-bom <path>` supply the scope-phase Source Facts. For
`--phase scope`, omitting a flag loads its repository default —
`docs/design/v0.1.0-architecture-baseline.json` for `--baseline` and
`docs/release/v0.1.0-scope-bom.json` for `--scope-bom` — so the plan command
`npm run check:pre-design:scope` works without flags; explicit flags still override the defaults for
fixtures and external callers, and missing or unreadable files fail closed through the existing
`sothoth.pre-design/source-unreadable` input-error path.

## Authority boundaries

The bootstrap checker validates facts and reports readiness; it cannot accept Dossiers,
registrations, Architecture Baselines, or Scope BOMs, and it cannot create authoritative release
membership. The eleven `accepted` registration statuses and the accepted Baseline recorded in this
repository are transcriptions of one explicit external human owner action; neither the checker nor
any projection is their author. Passing a check is never an acceptance act. The formal compiler that
replaces this oracle must reproduce the same conclusions or the candidate release fails.
