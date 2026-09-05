# @project-sothoth/profile-sdk Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-PROFILE-SDK-DOSSIER` revision `2`

Design identity: `SOTHOTH-PROFILE-SDK-DOSSIER` revision `2`

Component: `@project-sothoth/profile-sdk`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the Consumer Profile contract, loading, and
conformance package of Sothoth `0.1.0` under the Dossier Document Contract
`sothoth.design-dossier/full/v1`. It authorizes no implementation:
`packages/profile-sdk/src/**` stays empty until accepted Dossiers, an accepted Architecture
Baseline, and a mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@project-sothoth/profile-sdk` is a consumer-neutral contract, loading, and conformance boundary. A
Consumer Profile is an externally owned and accepted Source Fact; this package validates its
closed shape, exact references, compatibility, and conformance, and returns a non-authoritative
Projection or diagnostic. It is not a consumer policy engine.

The package composes other public contracts as caller-owned exact-reference data. It imports no
domain implementation, acquires no domain authority, and never reinterprets domain semantics.
Consumer identity and policy, FRACTA identity/policy/release rules, and Registry, Plan Graph,
Task State, Capacity Policy, Evidence, and Release BOM truth all remain outside this package.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@project-sothoth/profile-sdk`, classified as a pure-function
profile-contract and conformance library. Its design identity is
`SOTHOTH-PROFILE-SDK-DOSSIER@2`, its document identity is
`DOC-SOTHOTH-PROFILE-SDK-DOSSIER@2`, and it sits on the inward foundation
`core -> contracts` without touching any domain package above it.

It ships compiled ESM plus TypeScript declarations with an explicit exports map. It owns no
release membership and no profile content; it only validates and conforms profile facts that
callers already own.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one neutral boundary: load caller-supplied Consumer Profile values; validate
closed structure, exact references, revision compatibility, and conformance; compile explicit,
versioned relation-role mappings; and return a non-authoritative conformance Projection or
Structured Diagnostic without modifying the Profile.

The non-goals are the policy-engine fence:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "capabilityClasses": {
    "automatic-default-policy": "forbidden",
    "automatic-skill-discovery": "forbidden",
    "consumer-identity-ownership": "forbidden",
    "consumer-policy-ownership": "forbidden",
    "consumer-repository-scanning": "forbidden",
    "domain-implementation-invocation": "forbidden",
    "filesystem": "forbidden",
    "floating-revision-resolution": "forbidden",
    "fracta-policy-ownership": "forbidden",
    "fracta-release-ownership": "forbidden",
    "git": "forbidden",
    "implicit-impact-ordering": "forbidden",
    "network": "forbidden",
    "process": "forbidden",
    "profile-mutation": "forbidden",
    "skill-download": "forbidden",
    "skill-execution": "forbidden",
    "skill-installation": "forbidden",
    "skill-search": "forbidden",
    "unknown-field-ignoring": "forbidden",
    "unknown-mapping-ignoring": "forbidden"
  }
}
```

In practice: the package never scans a consumer repository to guess a Profile, never creates a
default policy to fill missing fields, never invokes domain implementations for hidden semantics,
and never turns an `impact` relation into an Ordering Edge without an explicit, versioned,
explainable Profile mapping.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the correctness and determinism of its conformance result over the exact
caller-owned facts it was given:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "producedStateRefs": [
    "sothoth.profile-sdk/conformance-result@1"
  ],
  "issuedAuthorityRefs": [],
  "emittedObservationRefs": [
    "sothoth.profile-sdk/profile-diagnostic@1"
  ],
  "effectOwnership": "non-authoritative-conformance-projection"
}
```

Consumer Profiles, Recommended Skill Catalogs, FRACTA profiles, and every truth domain they
reference belong to external owners. Profile SDK validates and conforms them; it never accepts,
repairs, writes back, or re-authors them, and it issues no authority over any domain.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "publicModules": [
    "@project-sothoth/profile-sdk/conformance",
    "@project-sothoth/profile-sdk/contract-composition",
    "@project-sothoth/profile-sdk/load",
    "@project-sothoth/profile-sdk/recommendations",
    "@project-sothoth/profile-sdk/relation-roles"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`load` reads caller-supplied profile values; `contract-composition` closes exact public contract
references as caller-owned data; `conformance` validates structure, compatibility, and
conformance; `relation-roles` validates explicit versioned relation-role mappings;
`recommendations` records and outputs explicit recommendation references. Primary consumers are
`@project-sothoth/sdk` and `@project-sothoth/cli` through the SDK, plus external owners supplying profiles.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is data-shaped: caller-owned profile data in, conformance Projection or diagnostic
out. Canonicalization and outcome aggregation come from
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`; the shared schema, identity, and diagnostic
vocabulary comes from `CONTRACT/SOTHOTH/SCHEMAS@1`. Public contracts from other domains are
composed only as exact, caller-owned reference data and are never imported through package
dependencies.

Recommended Skill Catalog is a caller-supplied, human-curated, versioned data asset:

```json
{
  "kind": "sothoth-dossier/skill-recommendation-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "sourceKind": "caller-supplied-curated-versioned-catalog",
  "automaticDiscovery": false,
  "revisionLocking": "exact-only",
  "allowedFields": [
    "applicable-diagnostic",
    "digest",
    "exact-commit-or-tag",
    "license",
    "path",
    "source-repository"
  ],
  "prohibitedOperations": [
    "crawl",
    "discover",
    "download",
    "host",
    "install",
    "invoke",
    "search"
  ],
  "namedCandidate": {
    "sourceRepository": "mattpocock/skills",
    "path": "domain-modeling"
  },
  "lockedRevision": null,
  "lockedDigest": null
}
```

The intended first recommendation is Matt Pocock `mattpocock/skills` `domain-modeling`, recorded
above without a fabricated commit, tag, or digest because the current Source Facts provide none.
The SDK records and outputs explicit references only; it cannot discover, crawl, search,
download, install, host, invoke, or use floating revisions.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@project-sothoth/profile-sdk` may import only the two foundation packages whose contracts it directly
requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "runtimeImportAllowlist": [
    "@project-sothoth/contracts",
    "@project-sothoth/core"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/CONSUMER-PROFILE@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ]
}
```

`runtimeImportAllowlist` is the closed runtime and type-level internal import boundary. The SDK
does not import Governance, Planning, Graph, Selectors, Document Index, Git, CLI, or FRACTA, and
it does not obtain domain contracts or semantics through re-exports.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

A conformance run is the only lifecycle: caller-owned Profile values enter, the package validates
closed structure and exact references, compiles relation-role mappings, checks revision
compatibility, and returns one immutable conformance result. Nothing persists between calls; the
Profile itself is never mutated, staged, or written back.

Data flow is strictly feed-forward and read-only. Conformance results are deletable and
rebuildable from the same facts; deleting one loses no Source Fact authority.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited from the accepted governance control plane design and specialized for
this component: Consumer Profiles and Recommended Skill Catalogs are caller-owned Source Facts;
the SDK validates them without owning consumer identity, consumer policy, or any referenced
domain truth.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3`, section `authority-boundary`,
applicability `specializes`.

The specialization is a closed ownership boundary:

```json
{
  "kind": "sothoth-dossier/profile-boundary-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "compositionMode": "caller-owned-exact-reference-data",
  "ownsConsumerIdentity": false,
  "ownsConsumerPolicy": false,
  "ownsFractaIdentity": false,
  "ownsFractaPolicy": false,
  "ownsFractaReleaseRules": false,
  "ownsRegistryTruth": false,
  "ownsPlanGraphTruth": false,
  "ownsTaskStateTruth": false,
  "ownsCapacityPolicyTruth": false,
  "ownsEvidenceTruth": false,
  "ownsReleaseBomTruth": false,
  "importsDomainImplementations": false,
  "impactPromotedToOrderingEdge": false
}
```

Sothoth does not depend on a FRACTA package and does not write FRACTA vocabulary into generic
contracts. FRACTA profiles are owned and published separately by FRACTA. An `impact` relation
expands review scope but never becomes an Ordering Edge by itself; only an explicit versioned
mapping can create one, and that mapping is caller-owned data.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Unknown fields, unknown mappings, floating refs, missing providers, duplicate identities, and
incompatible revisions fail closed. Recovery is always the external owner editing the Profile
fact; the package never fills, defaults, or repairs it.

The failure surface is closed and deterministic:

```json
{
  "kind": "sothoth-dossier/profile-failure-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "conformanceResult": "non-authoritative-projection-or-diagnostic",
  "failClosedConditions": [
    "duplicate-identity",
    "floating-ref",
    "incompatible-revision",
    "missing-provider",
    "unknown-field",
    "unknown-mapping"
  ],
  "profileMutation": "forbidden"
}
```

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@project-sothoth/profile-sdk",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-diagnostic-code"
}
```

Conformance results and diagnostics are byte-stable for identical caller-owned facts, ordered by
canonical identity and then diagnostic code in Unicode code-point order. Concurrency is safe by
construction: pure validation shares no mutable state.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package emits exactly one observation identity, `sothoth.profile-sdk/profile-diagnostic@1`,
under the Structured Diagnostic vocabulary of `@project-sothoth/contracts` and the aggregation contract of
`@project-sothoth/core`. It keeps no logs, counters, or telemetry of its own.

Every conformance result records the exact profile facts and contract references it evaluated, so
an auditor can re-run the same pure validation and compare bytes. A conformance result never
mutates the Profile it describes.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly
`@project-sothoth/contracts` and `@project-sothoth/core`.

There is nothing to configure or operate: profiles and recommended-skill catalogs arrive as
explicit caller-owned values, no environment variable or config file is consulted, and the
package cannot be started or probed. "Operations" means consuming a new revision and re-running
the owner's conformance suite.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/CONSUMER-PROFILE@1`, identical profile facts yield the same conformance
verdict, diagnostics, relation-role mapping output, and recommendation references. Any change to
closed fields, fail-closed conditions, or mapping rules is a new contract revision that
consumers reference explicitly.

Migration is re-reference: a profile owner moves to a successor contract revision by editing its
exact references. No shims, deprecated fields, or automatic rewrites are shipped.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A profile author receives precise, field-level validation with exact subjects for unknown fields,
unknown mappings, floating refs, missing providers, duplicate identities, and incompatible
revisions. The deliberate sharp edge is that the SDK never guesses a missing field or defaults a
policy; the owner's next edit is the only repair path.

Operators see predictable conformance output that states facts but never becomes a substitute
for an owned Profile or an accepted policy.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@project-sothoth/profile-sdk",
  "criteria": [
    {
      "criterionId": "profile-consumer-neutral-boundary",
      "sectionId": "responsibility-and-truth-ownership"
    },
    {
      "criterionId": "profile-fail-closed-conformance",
      "sectionId": "failure-recovery-and-consistency"
    },
    {
      "criterionId": "profile-impact-no-ordering",
      "sectionId": "authority-security-and-effects"
    },
    {
      "criterionId": "profile-skills-curated-exact-only",
      "sectionId": "core-sdk-protocol-boundary"
    }
  ]
}
```

`profile-consumer-neutral-boundary` requires dependency and vocabulary scans proving no consumer
identity/policy, FRACTA policy/release, or domain truth ownership. `profile-fail-closed-conformance`
requires fixtures for every declared fail-closed condition. `profile-impact-no-ordering` requires
fixtures where impact remains non-ordering absent an explicit versioned mapping.
`profile-skills-curated-exact-only` requires fixtures proving recommendations come only from a
caller-supplied, human-curated, versioned catalog with exact revision and digest fields.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Future profile contract revisions may add richer relation-role mappings, additional conformance
dimensions, and new curated catalog fields, always preserving fail-closed loading, exact
references, and byte-stable results. No future revision will acquire consumer identity/policy,
FRACTA policy/release rules, automatic skill discovery/installation/execution, profile
mutation, or domain-implementation imports.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` sections `decision`,
`authority-boundary`, `package-architecture`, `graphs-change-order-and-scheduling`, and
`extensions-and-evidence`; to `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed directly from
`@project-sothoth/core`; to `CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from `@project-sothoth/contracts`; and
to the catalog candidate `@project-sothoth/profile-sdk` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-PROFILE-SDK-DOSSIER@2` bound to
`DOC-SOTHOTH-PROFILE-SDK-DOSSIER@2`, providing `CONTRACT/SOTHOTH/CONSUMER-PROFILE@1` and
requiring `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` and `CONTRACT/SOTHOTH/SCHEMAS@1`. Every
reference uses the exact grammar `<identity>@<positive integer revision>`; paths, bare names,
and `latest` are forbidden.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

Seventeen of the eighteen closed topics are resolved locally by this Dossier: `identity` by
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
inherited exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` section
`authority-boundary` with applicability `specializes`; the consumer-neutral conformance
ownership boundary is the specialization declared in that section.
