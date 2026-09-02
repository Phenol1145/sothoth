# @sothoth/sdk Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-SDK-DOSSIER` revision `1`

Design identity: `SOTHOTH-SDK-DOSSIER` revision `1`

Component: `@sothoth/sdk`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the aggregate public library facade of Sothoth
`0.1.0` under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no
implementation: `packages/sdk/src/**` stays empty until accepted Dossiers, an accepted Architecture
Baseline, and a mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/sdk` is the sole aggregate public library facade. It composes the public capabilities of
the owning packages behind one typed, versioned surface and delegates every semantic operation to
the package that owns it. It is not the only public package — `@sothoth/contracts` and the domain
packages remain publicly consumable — and it is not a second Core: it adds no canonicalization,
compilation, selection, or scheduling semantics of its own.

The facade owns no domain truth, exposes no mutable singleton, performs no implicit filesystem
scan, no Git mutation, and no arbitrary process execution, and it never selects a process exit
code. Expected SDK/domain failures return through the closed typed outcome/diagnostic envelope; the
process exit mapping belongs to `@sothoth/cli` alone. The SDK does not require or wrap
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, whose direct algorithms stay with domain-package consumers.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/sdk`, classified as an aggregate public library facade.
Its design identity is `SOTHOTH-SDK-DOSSIER@1`, its document identity is
`DOC-SOTHOTH-SDK-DOSSIER@1`, and it sits directly below `@sothoth/cli` at the top of the internal
dependency DAG, importing exactly the eight packages whose contracts it directly requires.

It ships compiled ESM plus TypeScript declarations with an explicit exports map. It owns no release
membership and no domain content; it only re-exposes owned capabilities behind one stable facade.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one facade: give library consumers a single typed entry point that composes the
public capabilities of `@sothoth/governance`, `@sothoth/planning`, `@sothoth/document-index`,
`@sothoth/git`, `@sothoth/profile-sdk`, and `@sothoth/selectors` over the
`@sothoth/contracts`/`@sothoth/core` foundation, returning closed typed outcomes with Structured
Diagnostics and never choosing process exits.

The non-goals are the facade fence:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/sdk",
  "capabilityClasses": {
    "ambient-global-configuration": "forbidden",
    "arbitrary-process-runner": "forbidden",
    "cli-exit-code-ownership": "forbidden",
    "consumer-identity-types": "forbidden",
    "domain-truth-ownership": "forbidden",
    "environment-variable-semantics": "forbidden",
    "evidence-runner": "forbidden",
    "extension-outcome-selection": "forbidden",
    "filesystem-scan": "forbidden",
    "floating-revision-resolution": "forbidden",
    "fracta-policy-ownership": "forbidden",
    "git-mutation": "forbidden",
    "hidden-clock-random-environment": "forbidden",
    "mutable-singleton": "forbidden",
    "network": "forbidden",
    "private-core-import": "forbidden",
    "process": "forbidden",
    "source-fact-write-back": "forbidden"
  }
}
```

In practice: the facade never creates a configurable singleton, never reads ambient configuration
or environment variables, never scans a filesystem or repository to guess inputs, never mutates Git
state, never runs processes, never executes Evidence checks, never introduces consumer-specific
types, never interprets FRACTA policy, never selects an outcome for an extension, never exposes a
private Core capability, never writes Source Facts back, and never owns any domain truth.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The facade owns only the correctness of composition: correct delegation to the owning package,
exact argument passing, and faithful return of the owner's typed outcome without reinterpretation:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/sdk",
  "producedStateRefs": [
    "sothoth.sdk/facade-result@1"
  ],
  "issuedAuthorityRefs": [],
  "emittedObservationRefs": [],
  "ownsDomainTruth": false,
  "effectOwnership": "delegating-library-facade"
}
```

Every truth domain — registry and document governance, plan graphs and scheduling, document
indexes, Git snapshots, Consumer Profiles, selector results, canonical bytes — remains with its
owning package. The facade's single produced state is the envelope carrying the delegated result;
it is a rebuildable projection, never a second copy of domain truth, and the SDK issues no
authority over any domain.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/sdk",
  "publicModules": [
    "@sothoth/sdk/change-plan",
    "@sothoth/sdk/check",
    "@sothoth/sdk/compile",
    "@sothoth/sdk/diagnostics",
    "@sothoth/sdk/documents",
    "@sothoth/sdk/git",
    "@sothoth/sdk/profiles",
    "@sothoth/sdk/verify"
  ],
  "surfaceKind": "typed-outcome-library-facade"
}
```

`check` exposes pre-design checking; `compile` exposes governance and planning compilation;
`change-plan` exposes change-plan projection; `documents` exposes indexing, selection, and
explanation; `git` exposes source snapshots; `profiles` exposes Consumer Profile conformance;
`verify` exposes projection verification; `diagnostics` exposes the closed diagnostic vocabulary of
`@sothoth/contracts` for envelope consumers. Primary consumers are `@sothoth/cli` and external
library consumers; everything the facade exposes is a delegation to an owning public package.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a delegating facade: typed caller arguments in, the owning package's typed outcome
out, with no semantic step performed by the facade itself.

```json
{
  "kind": "sothoth-dossier/facade-capability-declaration@1",
  "packageId": "@sothoth/sdk",
  "facadeKind": "aggregate-public-library-facade",
  "solePublicLibraryFacade": true,
  "secondCore": false,
  "ownsDomainTruth": false,
  "wrapsGenericGraph": false,
  "exposesPrivateCoreCapability": false,
  "delegatesSemanticOperations": true,
  "delegatesTo": [
    "@sothoth/contracts",
    "@sothoth/core",
    "@sothoth/document-index",
    "@sothoth/git",
    "@sothoth/governance",
    "@sothoth/planning",
    "@sothoth/profile-sdk",
    "@sothoth/selectors"
  ],
  "nonDelegatedSemanticOperations": []
}
```

Every semantic operation is delegated to its capability owner; `nonDelegatedSemanticOperations` is
empty by construction. The facade does not wrap `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, whose
algorithms are reserved for direct consumption by domain packages, and it exposes no private Core
capability: whatever Core offers beyond `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` stays inward.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/sdk` may import exactly the eight packages that own the contracts it directly requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/sdk",
  "runtimeImportAllowlist": [
    "@sothoth/contracts",
    "@sothoth/core",
    "@sothoth/document-index",
    "@sothoth/git",
    "@sothoth/governance",
    "@sothoth/planning",
    "@sothoth/profile-sdk",
    "@sothoth/selectors"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/PUBLIC-SDK@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/CHANGE-PLAN@1",
    "CONTRACT/SOTHOTH/CONSUMER-PROFILE@1",
    "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1",
    "CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1",
    "CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1",
    "CONTRACT/SOTHOTH/PLANNING@1",
    "CONTRACT/SOTHOTH/PRE-DESIGN@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1",
    "CONTRACT/SOTHOTH/SELECTOR@1"
  ]
}
```

`runtimeImportAllowlist` is the closed runtime and type-level internal import boundary. The facade
does not import `@sothoth/cli`, does not require or wrap
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, and obtains no contract or semantics through re-exports or
transitive acquisition: every consumed semantic contract is direct, and every allowlisted owner
provides at least one required contract.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

A facade call is the only lifecycle: typed caller arguments enter, the facade delegates to the
owning package, and one immutable typed outcome returns. Nothing persists between calls — no
cache, no singleton, no ambient state — and the facade never mutates caller data or Source Facts.

Data flow is strictly feed-forward. `sothoth.sdk/facade-result@1` values are deletable and
rebuildable from the same delegated call; deleting one loses no Source Fact authority because every
underlying truth stays with its owner.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited from the accepted governance control plane design and narrowed for this
component: the facade is a non-authority surface, so every authority rule of the control plane
applies in full while the facade additionally holds none of the domain truths those rules govern.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `narrows`.

The narrowing is the delegation fence declared in `core-sdk-protocol-boundary`: the SDK issues no
authority, owns no domain truth, performs no implicit effects (no scans, no Git mutation, no
processes, no network), and every effect that a delegated operation performs belongs to and is
constrained by its owning package's Dossier.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Expected SDK/domain failures return through the closed typed outcome/diagnostic envelope. The
envelope is closed: unknown fields, unknown contract revisions, and unknown outcome kinds fail
closed instead of being ignored, and the SDK never selects a process exit — not even a default one.

```json
{
  "kind": "sothoth-dossier/sdk-outcome-declaration@1",
  "packageId": "@sothoth/sdk",
  "outcomeEnvelope": "closed-typed-outcome-with-diagnostics",
  "selectsProcessExitCode": false,
  "extensionSelectsOutcome": false,
  "failClosedConditions": [
    "unknown-contract-revision",
    "unknown-field",
    "unknown-outcome-kind"
  ]
}
```

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/sdk",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-diagnostic-code"
}
```

Facade results are byte-stable for identical delegated calls, ordered by canonical identity and
then diagnostic code in Unicode code-point order, with no hidden clock, randomness, or environment
input. Recovery is always the caller acting on the returned diagnostics; the facade never retries,
repairs, or defaults. Concurrency is safe by construction: the facade shares no mutable state.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The facade emits no observation identity of its own: `emittedObservationRefs` is empty. Structured
Diagnostics originate in the owning packages under `CONTRACT/SOTHOTH/SCHEMAS@1` and reach the
caller unchanged inside the typed envelope.

Every facade result records the exact delegated operation and contract references it composed, so
an auditor can re-run the same pure composition and compare bytes. The facade keeps no logs,
counters, or telemetry.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly the eight
allowlisted internal packages.

There is nothing to configure or operate: no environment variable or config file is consulted, no
daemon exists, and the package cannot be started or probed. "Operations" means consuming a new
facade revision and re-running the consumer's own verification.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/PUBLIC-SDK@1`, identical delegated calls yield identical envelopes. Adding
a newly delegated public capability is additive; changing the envelope shape, the outcome kinds, or
a delegated contract revision is a new facade contract revision that consumers reference
explicitly.

Migration is re-reference: a consumer moves to a successor revision by editing its exact
references. No shims, deprecated fields, or automatic rewrites are shipped.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A library consumer gets one typed facade with full declarations, errors as values, and no implicit
behavior to reverse-engineer. The deliberate sharp edges are that the facade never guesses a
missing argument, never defaults a configuration, and never converts a domain failure into a
process exit — the caller (typically `@sothoth/cli`) owns that mapping explicitly.

Operators see predictable, byte-stable envelopes they can diff and audit; nothing about the facade
substitutes for the owning packages' semantics.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/sdk",
  "criteria": [
    {
      "criterionId": "sdk-facade-delegation-only",
      "sectionId": "core-sdk-protocol-boundary"
    },
    {
      "criterionId": "sdk-import-boundary-closure",
      "sectionId": "dependency-and-topology"
    },
    {
      "criterionId": "sdk-no-domain-truth",
      "sectionId": "responsibility-and-truth-ownership"
    },
    {
      "criterionId": "sdk-no-exit-code-authority",
      "sectionId": "failure-recovery-and-consistency"
    },
    {
      "criterionId": "sdk-no-generic-graph-wrap",
      "sectionId": "dependency-and-topology"
    }
  ]
}
```

`sdk-facade-delegation-only` requires dependency and capability scans proving every semantic
operation delegates to an owner and `nonDelegatedSemanticOperations` stays empty.
`sdk-import-boundary-closure` requires import scans proving the allowlist is exactly the eight
contract owners and that no transitive or re-export acquisition exists. `sdk-no-domain-truth`
requires truth-ownership scans proving the facade's only produced state is the facade envelope.
`sdk-no-exit-code-authority` requires fixtures proving domain failures return as typed outcomes and
no code path selects a process exit. `sdk-no-generic-graph-wrap` requires dependency scans proving
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1` is neither required nor wrapped.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Future facade revisions may add newly delegated public capabilities, richer envelope metadata, and
additional fail-closed conditions, always preserving exact references, byte-stable results, and
delegation-only semantics. No future revision will acquire domain truth, a mutable singleton,
ambient configuration, implicit scanning, Git mutation, process execution, private Core exposure,
extension outcome selection, or exit-code authority.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, `pre-design-boundary`, and
`diagnostics-and-process-outcomes`; to the ten directly required contracts
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, `CONTRACT/SOTHOTH/CHANGE-PLAN@1`,
`CONTRACT/SOTHOTH/CONSUMER-PROFILE@1`, `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`,
`CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1`, `CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1`,
`CONTRACT/SOTHOTH/PLANNING@1`, `CONTRACT/SOTHOTH/PRE-DESIGN@1`, `CONTRACT/SOTHOTH/SCHEMAS@1`, and
`CONTRACT/SOTHOTH/SELECTOR@1`, each consumed directly from its owning package; and to the catalog
candidate `@sothoth/sdk` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-SDK-DOSSIER@1` bound to
`DOC-SOTHOTH-SDK-DOSSIER@1`, providing `CONTRACT/SOTHOTH/PUBLIC-SDK@1` and requiring exactly the
ten contracts above. Every reference uses the exact grammar
`<identity>@<positive integer revision>`; paths, bare names, and `latest` are forbidden.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

Seventeen of the eighteen closed topics are resolved locally by this Dossier: `identity` by
`artifact-identity-and-classification`; `intent-and-non-goals` by `purpose-and-non-goals`;
`responsibility` and `truth-ownership` by `responsibility-and-truth-ownership`; `public-surface` by
`public-surface-and-consumers`; `core-sdk-boundary` and `protocol-and-data-flow` by
`core-sdk-protocol-boundary`; `dependency-boundary` by `dependency-and-topology`;
`state-and-lifecycle` by `state-lifecycle-and-data-flow`; `failure-and-recovery` and
`concurrency-and-consistency` by `failure-recovery-and-consistency`; `observation-and-audit` by
`observation-and-audit`; `deployment-and-configuration` by
`deployment-configuration-and-operations`; `compatibility-and-migration` by
`compatibility-and-migration`; `developer-and-operator-experience` by
`developer-and-operator-experience`; `verification` by `verification-and-acceptance-criteria`; and
`future-compatibility` by `future-capability-compatibility`. `authority-and-security` is inherited
exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` section `authority-boundary` with
applicability `narrows`; the non-authority delegation fence is the narrowing declared in that
section.
