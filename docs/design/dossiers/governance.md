# @project-sothoth/governance Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-GOVERNANCE-DOSSIER` revision `2`

Design identity: `SOTHOTH-GOVERNANCE-DOSSIER` revision `2`

Component: `@project-sothoth/governance`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the document governance compilation package of
Sothoth `0.1.0` under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It
authorizes no implementation: `packages/governance/src/**` stays empty until accepted Dossiers, an
accepted Architecture Baseline, and a mechanically admissible Scope BOM admit implementation at
all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@project-sothoth/governance` owns the compilation of document governance: it reads Registry, Ledger,
Traceability, and Manifest facts, verifies append-only history, compiles pre-design closure and
change impact, and produces the non-authoritative projections the method runs on — Design Closure
and Scope BOM Admissibility above all. It hosts the closed relation-role vocabulary and its
explicit, versioned mapping from domain relations to generic edge roles, and it expands and
validates Gate Macros without ever executing one.

The defining decision is that all of this power concludes nothing. Every Source Fact it consumes
— Registry, Ledger, Design Scope Catalog, Dossier, Architecture Baseline, Scope BOM — is owned by
an external accountable owner; Governance reads, validates, compiles, and projects, and stops. It
cannot create, rewrite, or write back a Source Fact; it cannot mark a Dossier or Baseline
`accepted`; it cannot emit an authoritative Scope BOM; and it cannot turn an `impact` relation
into an Ordering Edge without an explicit versioned mapping saying so. Validation passing is
evidence for an owner, never an act of acceptance by the tool.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@project-sothoth/governance`, classified as the document-governance
domain compiler: pure compilation functions over caller-supplied Source Fact values. Its design
identity is `SOTHOTH-GOVERNANCE-DOSSIER@2`, its document identity is
`DOC-SOTHOTH-GOVERNANCE-DOSSIER@2`, and it is the top layer of the document-governance half of
the accepted package direction, above `document-index`, `selectors`, and the pinned foundation
`graph -> core -> contracts`.

It ships compiled ESM plus declarations with an explicit exports map, as a public package in its
own right: governance compilation — not planning compilation — is the capability external owners
consume to close and admit designs, so its surface is public and profile-neutral.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one governance compiler: validate Registry lifecycle bindings and Ledger
append-only lineage; verify Traceability and Manifest consistency; compile pre-design closure
over a Design Scope Catalog, Dossiers, and registrations into a digest-bearing Design Closure
Projection; compile Scope BOM Admissibility over an accepted Architecture Baseline and a candidate
Scope BOM; compile change impact from a Git Source Snapshot or an explicit changed-artifact
Selector into a non-authoritative change-plan projection; and expand and validate Gate Macros
into acyclic gate graphs of Check References.

The non-goals are the authority fence:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@project-sothoth/governance",
  "capabilityClasses": {
    "acceptance-state-marking": "forbidden",
    "authoritative-scope-bom-write": "forbidden",
    "business-authorization": "forbidden",
    "evidence-check-execution": "forbidden",
    "external-executable": "forbidden",
    "filesystem": "forbidden",
    "gate-macro-execution": "forbidden",
    "git": "forbidden",
    "implicit-ordering-edge-promotion": "forbidden",
    "network": "forbidden",
    "process": "forbidden",
    "prose-substring-conformance": "forbidden",
    "rule-module-discovery-or-install": "forbidden",
    "source-fact-write": "forbidden"
  }
}
```

In practice: the package never creates, rewrites, or writes back any Source Fact; it never flips a
`proposed` Dossier, registration, or Architecture Baseline to `accepted`; it never creates,
writes, or substitutes an authoritative Scope BOM; it never evaluates Document Contract
conformance by prose substring — structure comes from `@project-sothoth/document-index`; it never
executes a Gate Macro's content, an Evidence Check, or any shell, JavaScript, or network call; it
never discovers, downloads, or auto-installs a Trusted Rule Module; and it owns no top-level
outcome, process exit, or business authorization — callers and Core aggregate outcomes.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the correctness and determinism of its compiled conclusions over the exact facts
it was given, and of nothing it was not given:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@project-sothoth/governance",
  "producedStateRefs": [
    "sothoth.governance/design-closure-projection@1",
    "sothoth.governance/scope-bom-admissibility-projection@1",
    "sothoth.governance/change-plan-projection@1",
    "sothoth.governance/registry-compilation@1",
    "sothoth.governance/ledger-verification@1"
  ],
  "issuedAuthorityRefs": [],
  "effectOwnership": "non-authoritative-projections-only"
}
```

Registry, Ledger, Traceability records, Manifests, Design Scope Catalogs, Dossiers, Architecture
Baselines, and Scope BOMs are external owners' Source Facts. Governance can prove them invalid or
mutually inconsistent; it cannot replace them with a "fixed" version, because issuing authority is
not among its truths. The domain knowledge it does own is closed and declared:

```json
{
  "kind": "sothoth-dossier/domain-semantics-declaration@1",
  "packageId": "@project-sothoth/governance",
  "ownedDomainSemantics": [
    "registry-lifecycle-compilation",
    "ledger-append-only-verification",
    "traceability",
    "manifest",
    "pre-design-closure",
    "scope-bom-admissibility",
    "change-impact-compilation",
    "relation-role-mapping-compilation",
    "gate-macro-expansion"
  ],
  "interpretedEdgeRoles": [
    "normative-dependency",
    "derivation",
    "validation",
    "history",
    "navigation",
    "impact"
  ],
  "semanticsDeferredTo": "consumer-profiles"
}
```

The package interprets the six closed generic edge roles — that is precisely its job — but only
through explicit, versioned, explainable mappings from domain relation names; Consumer Profiles
own those mappings' content. What no mapping says, no compilation invents.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@project-sothoth/governance",
  "publicModules": [
    "@project-sothoth/governance/registry",
    "@project-sothoth/governance/ledger",
    "@project-sothoth/governance/traceability",
    "@project-sothoth/governance/manifest",
    "@project-sothoth/governance/pre-design",
    "@project-sothoth/governance/change-plan",
    "@project-sothoth/governance/gate-macros"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`registry` compiles lifecycle bindings from Registry facts; `ledger` verifies append-only history
and receipts; `traceability` and `manifest` verify their named consistencies; `pre-design`
compiles Dossier coverage, exact inheritance, producer/consumer edges, truth ownership, and
criteria into the Design Closure Projection, and Baseline-bound member admissibility into the
Scope BOM Admissibility Projection; `change-plan` compiles affected closure, dispositions, and
Ordering Edges into the change-plan projection; `gate-macros` expands and validates versioned
macros into acyclic check graphs. Primary consumers are `@project-sothoth/sdk` and `@project-sothoth/cli`
(`sothoth compile governance`, `sothoth check`, `sothoth change-plan`), plus Consumer Profiles
through the SDK; planning compilation deliberately does not consume governance, keeping the two
domains independent.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a value protocol over exact facts: Source Fact values in, typed compilations and
projections out. Canonical identity, canonical bytes, digests, and outcome aggregation come from
`@project-sothoth/core`'s `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` surface, required and imported
directly because this package emits canonical, digest-bearing projections; structural document
facts come from `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`; scoping comes from
`CONTRACT/SOTHOTH/SELECTOR@1`; graph assembly comes from `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`; and
the shared schema, identity, and diagnostic vocabulary that types every fact and finding is
consumed directly as `CONTRACT/SOTHOTH/SCHEMAS@1` from `@project-sothoth/contracts`. The package never
re-implements canonicalization or traversal, never calls back into a driver, and reaches none of
these surfaces through a transitive re-export or an undeclared type-only path.

Gate Macro handling is the sharpest protocol edge, so it is closed here: a macro is expanded and
validated deterministically — parameters bound, references resolved, acyclicity and bounds proven
— and nothing more. Embedding shell, JavaScript, network requests, or dynamic expressions in a
macro fails closed as invalid input. Trusted Rule Modules are consumed only when explicitly
installed, allowlisted, and integrity-locked by the operator; the package neither discovers,
downloads, nor installs them. Evidence Checks are consumed only as bound result contracts
executed externally by a user or CI; the package validates snapshot, check-definition, and report
bindings, and never starts the process itself.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@project-sothoth/governance` may depend only on the pure packages whose contracts it requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@project-sothoth/governance",
  "runtimeImportAllowlist": [
    "@project-sothoth/contracts",
    "@project-sothoth/core",
    "@project-sothoth/document-index",
    "@project-sothoth/graph",
    "@project-sothoth/selectors"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/CHANGE-PLAN@1",
    "CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1",
    "CONTRACT/SOTHOTH/PRE-DESIGN@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1",
    "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1",
    "CONTRACT/SOTHOTH/SELECTOR@1"
  ]
}
```

`CONTRACT/SOTHOTH/SCHEMAS@1` is required directly from `@project-sothoth/contracts` because every fact
type, identity, and diagnostic this compiler consumes or emits is expressed in the shared schema,
identity, and diagnostic vocabulary, and `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` is required
directly from `@project-sothoth/core` because the Design Closure, Admissibility, and Change Plan
projections are canonical and digest-bearing. The allowlist is the closed import boundary for
runtime and type-level internal imports alike, so no vocabulary, canonicalization, or capability
may arrive through a transitive dependency, and the package still never re-implements
canonicalization itself.

The provided contracts are the governance compilation surface at revision 1:
`CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1` for Registry/Ledger/Traceability/Manifest
compilation, `CONTRACT/SOTHOTH/PRE-DESIGN@1` for Design Scope Catalog, Dossier, registration,
closure, and admissibility compilation, and `CONTRACT/SOTHOTH/CHANGE-PLAN@1` for change-impact
compilation. Importing any adapter, SDK, CLI, or the planning domain package would point outward
and is a design violation, as would any attempt by those layers to be imported here.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

Every compilation is a pure derivation from exact Source Fact values: facts in, projection out,
no state retained between calls. The Design Closure Projection and the Scope BOM Admissibility
Projection are deletable and rebuildable by contract — deleting them loses nothing, because
rebuilding from the same facts reproduces the same bytes — and each carries a digest over the
deterministic normalized Source Fact values it was derived from, so a consumer can prove which
facts produced which conclusion without trusting the projection's continued existence.

Data flow is strictly feed-forward and read-only: Registry, Ledger, Catalog, Dossier, Baseline,
and Scope BOM values enter as inputs; the compiler validates identities and lifecycle bindings,
assembles reference graphs, computes closure and admissibility, and emits typed findings plus the
projection. Nothing is staged, written back, or mutated; the package cannot express a write to a
Source Fact, and the projections it produces are derived state, never authority. A failed
compilation leaves no partial projection.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited from the accepted governance control plane design and narrowed for this
component: the Source Fact ownership and Projection non-authority rules apply in full, and this
package additionally declares that relation semantics cannot silently become modification order.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3`, section `authority-boundary`,
applicability `narrows`.

The narrowing has four edges. First, an `impact` relation expands review scope and creates no
order by itself; only an explicit, versioned, explainable Consumer Profile mapping can produce an
Ordering Edge, and every produced edge records its originating reference and mapping rule so
`explain` can show why an order exists. Second, `proposed`-to-`accepted` transitions for Dossiers,
registrations, and Architecture Baselines are external owner acts; a passing validation changes no
status field anywhere. Third, an authoritative Scope BOM is created by its owner, not by this
package; admissibility is a projection about a candidate, never a replacement for the candidate.
Fourth, evidence and rules arrive bound — modules integrity-locked, checks executed externally —
so the package's security posture is that of a pure compiler: no filesystem, Git, process,
network, or executable capability, and hostile fact sets fail closed as typed invalid input.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures are typed findings against exact identities: an unresolvable exact reference, a broken
Registry lifecycle binding, an append-only violation in the Ledger, a duplicate truth owner, an
inheritance cycle, a Baseline that is not accepted where admissibility requires one, a Scope BOM
member whose design reference does not bind, an unexpanded or cyclic Gate Macro, an unbound or
stale Evidence Check result. Recovery is always an owner acting on the Source Fact; the compiler
never repairs, defaults, or partially accepts input.

Consistency is the product, under the closed determinism contract:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@project-sothoth/governance",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-diagnostic-code"
}
```

Projections are byte-stable for identical fact sets: member and set ordering follow canonical
identity in Unicode code-point order, with diagnostics ordered by code then subject — never by
file read order, JSON key order, hash traversal, locale collation, or compilation timing.
Digests bind the normalized fact values, so insignificant input ordering cannot change a
projection's bytes while any significant change must. Concurrency needs no coordination; immutable
inputs and pure compilation make parallel runs independent.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package's emissions are exactly its two declared diagnostic identities:
`sothoth.governance/pre-design-diagnostic@1` for closure and admissibility findings, and
`sothoth.governance/document-governance-diagnostic@1` for Registry, Ledger, Traceability, and
Manifest findings — all under the Structured Diagnostic vocabulary of `@project-sothoth/contracts`,
aggregated by `@project-sothoth/core`. Nothing else is emitted, and no emission mutates the failing
source.

Auditability is otherwise carried by the projections themselves: every closure and admissibility
conclusion records the exact identities and digest of the facts it derived from, every Ordering
Edge records its originating reference and mapping rule, and every Ledger verification points at
the append-only records it checked. An auditor re-runs the same pure compilation and compares
bytes; the package keeps no logs, counters, or telemetry of its own.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly the five declared
pure packages beneath it: `@project-sothoth/contracts`, `@project-sothoth/core`, `@project-sothoth/document-index`,
`@project-sothoth/graph`, and `@project-sothoth/selectors`. Conformance fixtures published alongside the compiler
let any consumer verify closure, admissibility, append-only, and determinism claims on its own
machine.

There is nothing to configure or operate in the package itself: fact sets arrive as values,
budgets and policy variants arrive as explicit versioned arguments, and the package acquires
nothing. Operational acts that look like governance — accepting a Baseline, authoring a formal
Scope BOM, running an Evidence Check, installing a Trusted Rule Module — happen outside this
package, by owners and CI, on data this package can then validate. "Operations" for this artifact
means consuming a new published revision and re-running the consumer's own conformance suite.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within revision 1 of its three provided contracts, compilation results are stable for identical
fact sets: closure members and counts, admissibility conclusions, diagnostic codes and ordering,
digest values, and change-plan dispositions. Any change to a diagnostic code, a projection field
shape, digest normalization, or a mapping rule is a new contract revision that consumers must
reference explicitly; there are no silent reclassifications and no dual behavior flags.

Migration is therefore re-reference: a consumer moves from `CONTRACT/SOTHOTH/PRE-DESIGN@1` or a
sibling contract to a successor revision by editing its exact required-contract reference, and its
golden projections move with the revision. The package ships no shims, no deprecated aliases, and
no auto-migration of previously compiled projections — an old projection is re-derived from its
digest-recorded facts under the new revision, which is exactly what its deletable, rebuildable
contract promises.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A domain developer gets the governance question pre-solved: hand over exact fact values, receive
typed findings, a digest-bearing closure, an admissibility conclusion, and a change plan with
explainable ordering — without writing registry validators, append-only checkers, or SCC code, and
without ever wondering whether an empty finding set was real or a skip. The deliberate sharp
edge: the compiler refuses to fix what it finds, so every repair becomes an owner's explicit
revision where reviewers can see it. That refusal is what makes its conclusions admissible
evidence rather than silent side effects.

Operators see this package through its guarantees: reproducible closure reviews, admissibility
that cannot be forged by a passing check, change plans whose every ordering step names its rule,
and evidence that stays honestly `unresolved` until an external runner supplies it.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

Section binding convention, recorded for this and every Dossier under this contract: the
registration's `acceptanceCriteria[].sectionId` points at this unified verification entry point,
while each criterion declared below points at the subject section it constrains.

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@project-sothoth/governance",
  "criteria": [
    {
      "criterionId": "governance-source-fact-non-authority",
      "sectionId": "responsibility-and-truth-ownership"
    },
    {
      "criterionId": "governance-impact-edge-non-ordering",
      "sectionId": "authority-security-and-effects"
    },
    {
      "criterionId": "governance-projection-rebuild-determinism",
      "sectionId": "state-lifecycle-and-data-flow"
    },
    {
      "criterionId": "governance-gate-macro-static-expansion",
      "sectionId": "core-sdk-protocol-boundary"
    }
  ]
}
```

`governance-source-fact-non-authority` requires proof by dependency and vocabulary scans plus
golden fixtures that no compilation path creates, rewrites, writes back, accepts, or replaces a
Source Fact, and that validation success mutates no status anywhere.
`governance-impact-edge-non-ordering` requires fixtures where `impact`-only cycles remain legal,
impact edges expand review scope, and Ordering Edges appear only under an explicit versioned
mapping that the explain trace records. `governance-projection-rebuild-determinism` requires
byte-equal closure and admissibility projections across rebuilds, environments, and permuted
input orderings, with digests binding the normalized facts.
`governance-gate-macro-static-expansion` requires macro fixtures proving deterministic expansion
and validation with fail-closed rejections for embedded shell, JavaScript, network references,
cyclic macro references, and unbound Evidence Check results.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability boundaries

Growth stays compilational: richer closure dimensions, additional admissibility rules, new
diagnostic conditions, and richer change-plan dispositions may join later revisions of the three
provided contracts, always preserving byte stability, digest binding, and fail-closed behavior
for identical fact sets.

No future revision will acquire Source Fact write-back, acceptance marking, authoritative Scope
BOM creation, implicit ordering promotion, Gate Macro or Evidence Check execution, or top-level
outcome ownership: those boundaries are compatibility boundaries of this Dossier, not `0.1`
limitations, and moving one would require a new accepted architecture decision rather than a
compiler feature.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` sections `decision`,
`authority-boundary`, `package-architecture`, `documents-and-selectors`,
`graphs-change-order-and-scheduling`, `pre-design-boundary`, `extensions-and-evidence`,
`diagnostics-and-process-outcomes`, and `release-boundary`; to
`CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`, `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, and
`CONTRACT/SOTHOTH/SELECTOR@1` consumed from the domain packages beneath it, to
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed directly from `@project-sothoth/core`, and to
`CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from `@project-sothoth/contracts`; and to the catalog
candidate `@project-sothoth/governance` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-GOVERNANCE-DOSSIER@2` bound to
`DOC-SOTHOTH-GOVERNANCE-DOSSIER@2`, providing `CONTRACT/SOTHOTH/CHANGE-PLAN@1`,
`CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1`, and `CONTRACT/SOTHOTH/PRE-DESIGN@1`, and requiring
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`,
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, `CONTRACT/SOTHOTH/SCHEMAS@1`, and
`CONTRACT/SOTHOTH/SELECTOR@1`. Every reference follows the exact grammar
`<identity>@<positive integer revision>` with the last `@` separating the revision.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

Seventeen of the eighteen closed topics are resolved by this Dossier: `identity` by
`artifact-identity-and-classification`; `intent-and-non-goals` by `purpose-and-non-goals`;
`responsibility` and `truth-ownership` by `responsibility-and-truth-ownership`; `public-surface`
by `public-surface-and-consumers`; `core-sdk-boundary` and `protocol-and-data-flow` by
`core-sdk-protocol-boundary`; `dependency-boundary` by `dependency-and-topology`;
`state-and-lifecycle` by `state-lifecycle-and-data-flow`; `failure-and-recovery` and
`concurrency-and-consistency` by `failure-recovery-and-consistency`; `observation-and-audit` by
`observation-and-audit`; `deployment-and-configuration` by
`deployment-configuration-and-operations`; `compatibility-and-migration` by
`compatibility-and-migration`; `developer-and-operator-experience` by
`developer-and-operator-experience`; `verification` by `verification-and-acceptance-criteria`;
and `future-compatibility` by `future-capability-compatibility`. `authority-and-security` is
inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` section `authority-boundary` with
applicability `narrows`, the component-specific narrowing being declared in that section.
