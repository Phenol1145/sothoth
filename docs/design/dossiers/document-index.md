# @sothoth/document-index Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER` revision `1`

Design identity: `SOTHOTH-DOCUMENT-INDEX-DOSSIER` revision `1`

Component: `@sothoth/document-index`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the structural document indexing package of Sothoth
`0.1.0` under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no
implementation: `packages/document-index/src/**` stays empty until accepted Dossiers, an accepted
Architecture Baseline, and a mechanically admissible Scope BOM admit implementation at all.

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

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/document-index`, classified as a document-governance
domain library: pure functions over caller-supplied document content and identities. Its design
identity is `SOTHOTH-DOCUMENT-INDEX-DOSSIER@1`, its document identity is
`DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER@1`, and it sits in the domain layer of the accepted package
direction, above the pinned foundation `graph -> core -> contracts`.

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
supersession, or traceability declaration exists, with exact spans; it never grades it.

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

`parse` turns exact content into the CommonMark AST with position information; `sections` binds
stable section markers to headings and derives stable section identities under the frozen grammar;
`anchors` derives heading identities and anchors; `references` indexes explicit references,
supersession, and traceability declarations with their spans; `index` assembles the deterministic
Document/Artifact Index Projection with provenance; `cache` produces the optional blob-addressed
memo entries. Primary consumers are `@sothoth/selectors`, which selects over the index,
`@sothoth/governance`, which compiles conformance and closure over it, and `@sothoth/planning`,
which uses the same structural facts. The SDK exposes index construction through its compilation
facade; the CLI reaches it through `sothoth index`.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a value protocol on both sides. Inputs are exact document content strings plus
declared identity inputs; nothing is fetched, nothing is ambient. Outputs are plain deterministic
structures whose canonical identities and bytes come from `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`
of `@sothoth/core`, and whose section and reference graphs are assembled with the generic
algorithms of `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` of `@sothoth/graph` — the package never
re-implements traversal or canonicalization and never calls back into a compilation driver.

The SDK boundary is likewise structural: callers construct an index from exact inputs and receive
an immutable projection. There is no registration hook, no mutation surface, and no ambient
document discovery to drift from the contract. Diagnostic identity and the shared schema
vocabulary for structural findings are owned by `@sothoth/contracts` and consumed directly through
the required `CONTRACT/SOTHOTH/SCHEMAS@1` surface — never via a transitive re-export or an
undeclared type-only path; this package returns typed structural results the calling compiler
turns into Structured Diagnostics.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/document-index` completes its layer of the accepted direction and may depend only on
the pure foundation packages whose contracts it requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/document-index",
  "runtimeImportAllowlist": [
    "@sothoth/contracts",
    "@sothoth/core",
    "@sothoth/graph"
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

`CONTRACT/SOTHOTH/SCHEMAS@1` is required directly from `@sothoth/contracts` because the index's
typed inputs and findings are expressed in the shared schema, identity, and diagnostic vocabulary.
The allowlist is the closed import boundary for runtime and type-level internal imports alike, so
no vocabulary and no capability may arrive through a transitive dependency.

The provided contract `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` is the structural index surface:
parsing, stable section identity, anchors, spans, and the reference/supersession/traceability
index with provenance. Importing any adapter, SDK, CLI, or sibling domain package would point
outward and is a design violation, as would any attempt by those layers to be imported here.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

An index is built once, immutably, from exact inputs, and lives only as long as its caller holds
it. There is no stored index state between compilations: every compilation re-derives the
projection from the exact content and identity inputs, which is what keeps the projection
disposable, rebuildable, and comparable across environments.

Data flow is strictly feed-forward: exact content and identity inputs in, CommonMark AST
mid-way, deterministic index out. Nothing is inferred from the environment, defaulted from
ambient state, or reordered by arrival accident. The one derived state the package owns is the
optional cache entry, produced by `@sothoth/document-index/cache`: a memo bound to exactly one
blob identity and one compiler identity. Addressing a cache entry by anything less exact — a path,
a timestamp, a "similar" digest — is forbidden, and a cache is consumed only by presenting the
same exact identities again.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, adopted without
narrowing: an index projection can inform validation and review but grants no authority, and
nothing the package computes becomes a Source Fact or modifies one.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `adopts`.

Security posture follows from the value protocol: no filesystem, Git, process, network, or
executable capability exists in the package, so the only attack surface is the parsed content
itself. Hostile documents are bounded by the parser's own structural guarantees and by
caller-declared size and time budgets; structural failures are reported, never guessed past, and
a rejected input leaves no partial index.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures are structural and reported as typed findings with precise source spans: unparseable
content, a stable marker whose next non-blank sibling is not a heading, duplicate section
identities, or declared references that do not resolve against the supplied identity set.
Recovery is always the caller fixing its document or its inputs; the package never repairs,
aliases, or partially accepts a broken structure.

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
Entries are ordered by canonical identity in Unicode code-point order, with ties broken by
precise source span — never by insertion order, hash traversal, locale collation, or parse timing.
Deleting the cache changes no output byte: a cache hit and a cache miss produce the identical
projection, because the cache only memoizes a derivation whose result is already pinned by its
exact input identities. Concurrency needs no coordination; immutable inputs and pure functions
make parallel compilations independent.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package keeps no logs, counters, or telemetry of its own, but its output is the audit
substrate for everyone else: every index entry carries provenance — which exact content, which
declared identity inputs, which compiler identity produced it — and every structural finding
carries a precise source span an auditor can re-verify by re-running the same pure derivation.

What the package does not do is decide what deserves observation. Structural findings become
Structured Diagnostics only when the calling compiler emits them under the identity vocabulary of
`@sothoth/contracts`; the index merely guarantees the finding is exact, spanned, and reproducible.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly the three declared
foundation packages beneath it: `@sothoth/contracts`, `@sothoth/core`, and `@sothoth/graph`.
Conformance fixtures published alongside the package let any consumer verify
the structural and determinism claims on its own machine.

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
dual behavior flags.

Migration is therefore re-reference: a consumer moves to a successor revision by editing its
exact required-contract reference, and its golden index fixtures move with the revision. The
package ships no shims, no deprecated aliases, and no auto-migration of previously computed
indexes — an old index is simply re-derived from the exact inputs under the new revision.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A domain developer gets the structural problem pre-solved: hand over exact content and
identities, receive a deterministic, span-exact, provenance-carrying index — without writing a
parser wrapper, fighting regex heuristics, or worrying about ordering. The deliberate sharp edge:
the API refuses to read files or infer meaning, so the developer must acquire bytes and declare
identities where reviewers can see them. That refusal is what keeps the index honest as the shared
substrate of governance, planning, and profiles.

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

`document-index-structural-parse-boundary` requires conformance tests proving every index fact is
derived from the parsed CommonMark AST — headings, markers, spans, and references — with zero
source-text substring matching and zero undeclared inference.
`document-index-deterministic-index-projection` requires cross-run and cross-environment byte
equality of the index projection for identical exact inputs, including entry ordering under the
declared tie-breaking. `document-index-cache-byte-neutrality` requires cache-hit and cache-miss
paths to produce identical output bytes and every cache entry to be addressed by exactly one blob
identity and one compiler identity.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability boundaries

Growth stays structural: richer anchor schemes, incremental re-indexing over unchanged subtrees,
or additional declared-relation kinds may join later revisions of
`CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`, always preserving byte stability for identical inputs and
the exact-identity cache addressing.

No future revision will begin inferring undeclared semantics, selecting current revisions, or
evaluating conformance: those boundaries are compatibility boundaries of this Dossier, not `0.1`
limitations, and moving one would require a new accepted architecture decision rather than a
parser feature.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, `documents-and-selectors`, and
`pre-design-boundary`; to `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`,
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, and `CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from the
foundation packages beneath it; and to the catalog candidate `@sothoth/document-index` in
`SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-DOCUMENT-INDEX-DOSSIER@1` bound to
`DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER@1`, providing `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` and
requiring `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, and
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
