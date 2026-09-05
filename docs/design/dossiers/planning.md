# @project-sothoth/planning Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-PLANNING-DOSSIER` revision `2`

Design identity: `SOTHOTH-PLANNING-DOSSIER` revision `2`

Component: `@project-sothoth/planning`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the scheduling compilation package of Sothoth
`0.1.0` under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no
implementation: `packages/planning/src/**` stays empty until the retained candidates hold accepted
Dossiers, an accepted Architecture Baseline, and a mechanically admissible Scope BOM admit
implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@project-sothoth/planning` is the pure scheduling domain compiler. It validates dependency constraints
over caller-supplied planning facts, assigns deterministic topological Waves through the generic
graph package, and exposes exactly one non-authoritative Schedule Solution whose axes are all
projections of that same solution. It is not an executor, a task scheduler, or an authoritative
scheduler, and it acquires no Registry or admission policy from Governance.

Version `0.1.0` implements dependency constraint validation and deterministic topological Wave
assignment only. The remaining scheduling dimensions are recognized and returned as explicit
unsupported results that fail closed; none is ignored and none is solved. Future solvers must
extend this same Schedule Solution identity rather than create a parallel scheduling authority.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@project-sothoth/planning`, classified as a pure-function domain compiler
over caller-supplied Plan Graph and constraint values. Its design identity is
`SOTHOTH-PLANNING-DOSSIER@2`, its document identity is `DOC-SOTHOTH-PLANNING-DOSSIER@2`, and it
is an independent sibling of `@project-sothoth/governance` in the accepted package direction.

It ships compiled ESM plus TypeScript declarations with an explicit exports map. It produces
derived scheduling views only; release membership remains a future formal Scope BOM fact, never a
catalog or Dossier claim.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one scheduling compilation: validate dependency constraints, build the ordering
graph, assign deterministic topological Waves, record the satisfied constraint identities, and
return the resulting Schedule Solution without mutating any input. All scheduling axes —
dependency, time, resource, assignment, placement, gate, and release-train — are projections of
that one solution; none owns an independent truth.

The non-goals are the scheduler authority fence:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@project-sothoth/planning",
  "capabilityClasses": {
    "acceptance-authority": "forbidden",
    "calendar-placement-solver": "forbidden",
    "consumer-identity": "forbidden",
    "external-executable": "forbidden",
    "filesystem": "forbidden",
    "gate-axis-solver": "forbidden",
    "git": "forbidden",
    "governance-policy": "forbidden",
    "independent-wave-truth": "forbidden",
    "network": "forbidden",
    "placement-solver": "forbidden",
    "process": "forbidden",
    "registry-authority": "forbidden",
    "release-train-solver": "forbidden",
    "resource-solver": "forbidden",
    "source-fact-mutation": "forbidden",
    "task-dispatch": "forbidden",
    "time-axis-solver": "forbidden",
    "unsupported-dimension-ignoring": "forbidden"
  }
}
```

The closed `0.1.0` capability and the explicit unsupported axes are declared as data:

```json
{
  "kind": "sothoth-dossier/schedule-solution-declaration@1",
  "packageId": "@project-sothoth/planning",
  "solutionIdentity": "sothoth.planning/schedule-solution@1",
  "authority": "non-authoritative-projection",
  "implementedCapabilities": [
    "dependency-constraint-validation",
    "deterministic-wave-assignment"
  ],
  "unsupportedDimensions": [
    "assignment",
    "gate",
    "placement",
    "release-train",
    "resource",
    "time"
  ],
  "waveTruthIdentities": []
}
```

`gate` above is a scheduling axis and is distinct from Governance's declarative Gate Macro:
Planning 0.1 does not solve a gate-axis scheduler, while Governance retains Gate Macro parsing,
expansion, and validation. Unsupported dimensions fail closed with structured diagnostics; they
are never silently dropped. Workstream and organization remain navigation dimensions by default.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the correctness and determinism of its one Schedule Solution over the exact facts
it was given:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@project-sothoth/planning",
  "producedStateRefs": [
    "sothoth.planning/schedule-solution@1"
  ],
  "issuedAuthorityRefs": [],
  "emittedObservationRefs": [
    "sothoth.planning/schedule-diagnostic@1"
  ],
  "effectOwnership": "non-authoritative-schedule-projection"
}
```

Plan Graph, Task State, Capacity Policy, Registry, and every other scheduling Source Fact belong
to their external owners. Planning reads and rejects them; it never writes back, repairs, accepts,
or re-authors any Source Fact. It issues no scheduling authority and cannot dispatch work. The
Evolution Timeline is a past-fact Projection and is never merged with the future Schedule
Solution.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@project-sothoth/planning",
  "publicModules": [
    "@project-sothoth/planning/constraints",
    "@project-sothoth/planning/schedule",
    "@project-sothoth/planning/solution",
    "@project-sothoth/planning/waves"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`constraints` validates dependency constraints and returns exact satisfied constraint identities;
`schedule` drives the closed scheduling compilation; `solution` constructs and exposes the single
Schedule Solution; `waves` assigns deterministic topological Waves over the generic graph surface.
Primary consumers are `@project-sothoth/sdk` and `@project-sothoth/cli` through the SDK. Governance and Git are
not consumers and cannot be imported.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a value protocol: exact caller-supplied planning facts in, one digest-bearing
Schedule Solution and deterministic diagnostics out. Canonicalization, digesting, diagnostic
aggregation, and outcome folding come from `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`; generic
graph algorithms come from `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`; scoping comes from
`CONTRACT/SOTHOTH/SELECTOR@1`; the shared schema and identity vocabulary comes from
`CONTRACT/SOTHOTH/SCHEMAS@1`. Each contract is consumed directly from its owner; no semantic
contract arrives transitively or through a re-export.

In `0.1.0` the only solved protocol operations are dependency-constraint validation and
deterministic topological Wave assignment. A request that names time, resource, assignment,
placement, gate, or release-train returns an explicit unsupported result with the axis identity
and fails closed. The SDK exposes the Schedule Solution unchanged; it adds no scheduler
semantics.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@project-sothoth/planning` may import only the four pure packages whose contracts it directly requires,
and it provides the planning surface to outward layers:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@project-sothoth/planning",
  "runtimeImportAllowlist": [
    "@project-sothoth/contracts",
    "@project-sothoth/core",
    "@project-sothoth/graph",
    "@project-sothoth/selectors"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/PLANNING@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1",
    "CONTRACT/SOTHOTH/SELECTOR@1"
  ]
}
```

`runtimeImportAllowlist` is the closed runtime and type-level internal import boundary. Planning
must not depend on Governance, Git, Profile SDK, SDK, CLI, FRACTA, or `@project-sothoth/document-index`;
the latter is deliberately excluded even though Selectors consumes it internally, because this
package obtains Selector capability only through `CONTRACT/SOTHOTH/SELECTOR@1`.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

Every compilation is a pure derivation: planning facts enter, the compiler validates dependency
constraints, assembles an ordering graph, calls the generic graph package for topological Waves,
records the constraint identities the solution satisfied, and emits one immutable Schedule
Solution. Nothing persists between calls, no mutable graph survives a compilation, and the
solution never points at an unbound future state.

Data flow is feed-forward and read-only. The output never modifies Plan Graph, Task State,
Capacity Policy, Registry, or any Source Fact. A failed compilation leaves no partial solution.
Deleting a Schedule Solution loses nothing; re-running the same facts rebuilds identical bytes.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited from the accepted governance control plane design and narrowed for this
component: the Schedule Solution is a non-authoritative Projection, unsupported scheduling axes
fail closed, and Planning acquires no Registry or admission policy from Governance.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3`, section `authority-boundary`,
applicability `narrows`.

The component-specific narrowing is explicit: every axis answer is a projection of one Schedule
Solution, not an independent wave truth; `0.1.0` reports unsupported axes instead of ignoring
them; cycle, duplicate, missing-reference, unsupported-dimension, and budget-exhaustion
conditions produce structured diagnostics; and validation success grants no authority to
schedule, admit, or dispatch anything. Planning and Governance remain independent domain
compilers.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures are deterministic and structured: dependency cycles, duplicate task identities, missing
references, unsupported scheduling dimensions, and budget exhaustion are reported with exact
subjects and never partially solved. Recovery is always the owner correcting the Source Fact and
re-running; the compiler never repairs or defaults input.

Output bytes are independent of input order, Map/Set traversal order, locale, clock, randomness,
and concurrent scheduling:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@project-sothoth/planning",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-diagnostic-code"
}
```

Waves, intra-wave order, satisfied constraint identities, and diagnostics sort by canonical
identity and then by diagnostic code in Unicode code-point order. Concurrency is safe by
construction: pure compilation shares no mutable state.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package emits exactly one observation identity, `sothoth.planning/schedule-diagnostic@1`,
under the Structured Diagnostic vocabulary of `@project-sothoth/contracts` and the aggregation contract of
`@project-sothoth/core`. It keeps no logs, counters, or telemetry of its own.

Every Schedule Solution records the exact constraint identities it satisfied and the compilation
facts it derived from, so an auditor can re-run the same pure compilation and compare bytes
instead of trusting retained state. Observations never mutate the failing input.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly the four pure
packages declared beneath it: `@project-sothoth/contracts`, `@project-sothoth/core`, `@project-sothoth/graph`, and
`@project-sothoth/selectors`.

There is nothing to configure or operate in the package itself: facts and budgets arrive as
explicit versioned arguments, no environment variable or config file is consulted, and the
package cannot be started or probed. "Operations" means consuming a new revision and re-running
the consumer's conformance suite.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/PLANNING@1`, identical planning facts yield the same satisfied
constraint identities, waves, diagnostics, and solution bytes. Any change to wave assignment,
tie-breaking, unsupported-axis reporting, or the solution shape is a new contract revision that
consumers reference explicitly.

Migration is re-reference: a consumer moves to a successor planning contract revision by editing
its exact required-contract reference. No shims, deprecated axis solvers, or dual behavior flags
are shipped.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A developer building scheduling tooling receives validation, wave assignment, explainable
ordering edges, and the single Schedule Solution without writing graph or canonicalization code.
The deliberate sharp edge is that unsupported axes fail closed with named diagnostics, so a
future solver must extend the existing solution identity in a visible contract revision.

Operators see deterministic, rebuildable schedule projections that never claim to be an
authoritative schedule and never modify Plan Graph, Task State, or Capacity Policy.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@project-sothoth/planning",
  "criteria": [
    {
      "criterionId": "planning-dependency-wave-only",
      "sectionId": "core-sdk-protocol-boundary"
    },
    {
      "criterionId": "planning-deterministic-projection",
      "sectionId": "failure-recovery-and-consistency"
    },
    {
      "criterionId": "planning-single-schedule-solution",
      "sectionId": "purpose-and-non-goals"
    },
    {
      "criterionId": "planning-source-fact-read-only",
      "sectionId": "responsibility-and-truth-ownership"
    }
  ]
}
```

`planning-dependency-wave-only` requires fixtures proving `0.1.0` solves dependency-constraint
validation and deterministic topological Wave assignment, and nothing else.
`planning-deterministic-projection` requires byte-equal solutions across permuted input order,
environments, and concurrent runs. `planning-single-schedule-solution` requires proof that every
scheduling axis is a projection of one Schedule Solution identity with no independent wave truth.
`planning-source-fact-read-only` requires dependency and vocabulary scans plus golden fixtures
proving no Plan Graph, Task State, Capacity Policy, Registry, or Source Fact mutation.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Future solvers for time, resource, assignment, placement, gate, and release-train must extend
`CONTRACT/SOTHOTH/PLANNING@1` successors around the same `sothoth.planning/schedule-solution@1`
identity. No future revision may create parallel scheduling authorities, silently ignore
unsupported axes, mutate Source Facts, or absorb Registry/admission policy from Governance.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` sections `decision`,
`authority-boundary`, `package-architecture`, and `graphs-change-order-and-scheduling`; to
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, `CONTRACT/SOTHOTH/SELECTOR@1`, and
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed directly from their owning packages; to
`CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from `@project-sothoth/contracts`; and to the catalog
candidate `@project-sothoth/planning` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-PLANNING-DOSSIER@2` bound to
`DOC-SOTHOTH-PLANNING-DOSSIER@2`, providing `CONTRACT/SOTHOTH/PLANNING@1` and requiring
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`,
`CONTRACT/SOTHOTH/SCHEMAS@1`, and `CONTRACT/SOTHOTH/SELECTOR@1`. Every reference uses the exact
grammar `<identity>@<positive integer revision>`; paths, bare names, and `latest` are forbidden.

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
`authority-boundary` with applicability `narrows`; the Schedule Solution non-authority is the
component-specific narrowing declared in that section.
