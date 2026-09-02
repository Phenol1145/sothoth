# @sothoth/graph Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-GRAPH-DOSSIER` revision `1`

Design identity: `SOTHOTH-GRAPH-DOSSIER` revision `1`

Component: `@sothoth/graph`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the generic graph package of Sothoth `0.1.0` under the
Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no implementation:
`packages/graph/src/**` stays empty until accepted Dossiers, an accepted Architecture Baseline, and
a mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/graph` owns the deterministic, meaning-free graph machinery of the control plane: a
generic directed multigraph representation plus traversal, strongly connected components,
condensation, topological waves, and DAG longest paths. Every domain that needs to reason about
ordering — governance change plans, planning waves, document inheritance review — calls the same
algorithms instead of growing its own.

The defining decision is that the package understands graphs and nothing else. Nodes are opaque
identities with caller-assigned sort keys; edges are caller-declared pairs with optional weights
and roles the package never interprets. What an edge means — prerequisite, derivation, validation,
history, navigation, impact — is decided by the consuming domain package and its Consumer Profile.
This is the exact boundary that keeps document governance from absorbing scheduler semantics and
planning from absorbing Registry authority.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/graph`, classified as a generic algorithm library: pure
functions over caller-constructed graphs, with conformance-tested determinism. Its design identity
is `SOTHOTH-GRAPH-DOSSIER@1`, its document identity is `DOC-SOTHOTH-GRAPH-DOSSIER@1`, and it is
the top declared layer of the pinned foundation direction `graph -> core -> contracts`.

It ships compiled ESM plus declarations with an explicit exports map. It is a public package in
its own right: the accepted design places generic graph algorithms in the public surface rather
than inside a private domain module.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one deterministic graph toolkit: build a directed multigraph from explicit node,
edge, weight, and sort-key declarations; traverse it; split it into strongly connected components;
condense it into a DAG of components; order it into topological waves; and, on the condensation,
compute deterministic longest paths for critical-path style questions. Every operation accepts the
caller's stable ordering keys and returns results ordered by them.

The non-goals are the mirror of that purpose — the package must not know what it is ordering:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/graph",
  "capabilityClasses": {
    "consumer-fracta-semantics": "forbidden",
    "document-reference-semantics": "forbidden",
    "external-executable": "forbidden",
    "filesystem": "forbidden",
    "git": "forbidden",
    "governance-policy": "forbidden",
    "network": "forbidden",
    "planning-scheduling-policy": "forbidden",
    "process": "forbidden",
    "relation-role-semantics": "forbidden"
  }
}
```

In practice that means: no `impact`, authority, release, Registry, or Ledger relation roles; no
document or reference domain meaning; no governance, planning, or scheduling policy; no
consumer or FRACTA vocabulary; and no capability to touch a filesystem, a process, the network, a
repository, or an external executable. If a caller wants `impact` edges to order anything, the
caller maps them into explicit ordering edges first — the package will not do it silently.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the correctness and determinism of its algorithm results over the exact input it
was given, and nothing else:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/graph",
  "producedStateRefs": [
    "sothoth.graph/algorithm-result@1"
  ],
  "issuedAuthorityRefs": [],
  "effectOwnership": "pure-algorithms-only"
}
```

The domain-semantics boundary is declared as a closed fact rather than a habit:

```json
{
  "kind": "sothoth-dossier/domain-semantics-declaration@1",
  "packageId": "@sothoth/graph",
  "ownedDomainSemantics": [],
  "interpretedEdgeRoles": [],
  "semanticsDeferredTo": "consuming-domain-package"
}
```

Responsibilities explicitly declined: deciding which relations create ordering (Consumer Profile
and domain mapping rules), validating reference identities (domain compilers and contracts),
assigning dispositions like `revise` or `rebuild` (the change-plan domain), and any scheduling
axis beyond deterministic waves (the Schedule Solution in `@sothoth/planning`). The package
returns structures; the meaning of the structures is assembled by whoever called it.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/graph",
  "publicModules": [
    "@sothoth/graph/digraph",
    "@sothoth/graph/traversal",
    "@sothoth/graph/scc",
    "@sothoth/graph/condensation",
    "@sothoth/graph/waves",
    "@sothoth/graph/longest-paths"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`digraph` builds an immutable directed multigraph from explicit declarations and rejects duplicate
or unresolved identities; `traversal` walks reachable sets deterministically; `scc` computes
strongly connected components; `condensation` collapses them into a component DAG;
`waves` assigns deterministic topological waves with canonical intra-wave order; `longest-paths`
solves longest paths over the acyclic condensation with caller weights. Primary consumers are
`@sothoth/governance`, `@sothoth/planning`, `@sothoth/document-index`, and `@sothoth/selectors`;
the SDK exposes none of this directly, and the CLI reaches it only through domain compilation.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a value protocol: the package consumes the canonical identity, canonical JSON, and
digest utilities of `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` from `@sothoth/core` when a result
must carry canonical bytes, and the type vocabulary of `CONTRACT/SOTHOTH/SCHEMAS@1` from
`@sothoth/contracts`; it returns plain deterministic structures. It never calls the kernel's
compilation driver, and the kernel never calls back — the acyclicity of the package graph is itself
an instance of what this package proves.

The SDK does not wrap these algorithms as a public API surface of its own; domain packages embed
graph results inside their projections. Consequently there is no public SDK protocol to drift from:
the only contract `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` exposes is the algorithm surface above,
consumed by packages, not by end users.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/graph` completes the pinned direction `graph -> core -> contracts` and may depend only on
the two pure foundation packages beneath it:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/graph",
  "runtimeImportAllowlist": [
    "@sothoth/contracts",
    "@sothoth/core"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/GENERIC-GRAPH@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ]
}
```

Importing any domain package, adapter, SDK, or CLI would point outward and is a design violation,
as is any attempt by those layers to be imported here. The provided contract
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1` is the graph representation and algorithm surface at revision
1; the required contracts are the pure kernel and schema utilities it builds results with.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

A graph is built once, immutably, from explicit declarations; every algorithm is a pure read of
that structure. There is no mutation API, no incremental editing, and no stored graph state
between calls — a domain re-derives its graph from its Source Facts whenever it compiles, which is
what keeps projections disposable and rebuildable.

Data flow is strictly feed-forward: declarations in, immutable structure mid-way, deterministic
result out. Weights and sort keys arrive with the declarations; nothing is inferred, defaulted
from the environment, or reordered by insertion accident. Cycle findings, wave assignments, and
path lengths are returned with the identities needed to explain them, and the caller decides what
the explanation means.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, adopted without
narrowing: an algorithm result can inform a recommendation but grants no authority, and nothing the
package computes becomes a Source Fact.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `adopts`.

Security posture is minimal by construction: the package opens no files, spawns no processes,
touches no network, runs no repository command, and loads no extension code. Its inputs are
in-memory structures, so its only limits are computational — size and time budgets are the
caller's duty to declare and the algorithms' duty to respect deterministically.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures are structural and reported as caller-typed rejections: duplicate node identities,
edges referencing unknown nodes, malformed weights, non-DAG input to the DAG-only algorithms, and
missing sort keys where a deterministic order is required. Recovery is always the caller fixing
its declarations; the package never guesses, repairs, or partially accepts input. A rejected input
leaves no half-built graph.

Consistency is the product: the same declared graph yields the same components, waves, and paths on
every machine and release, under the closed determinism contract:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/graph",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "caller-sort-key-then-node-identity"
}
```

Node and edge orderings follow the caller-provided stable sort keys compared in Unicode code-point
order; ties break by canonical node identity and then by code-point order — never by insertion
order, hash traversal, locale collation, or iteration timing. Concurrency needs no coordination:
immutable inputs and pure functions make parallel compilations independent.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

This topic is resolved as not-applicable, with the closed reason recorded in this component's
registration: `@sothoth/graph` computes pure results over caller-provided nodes, edges, weights,
and sort keys; every diagnostic, audit trail, and observation identity is declared by
`@sothoth/contracts` and aggregated by `@sothoth/core` or the consuming domain compiler, so the
graph package owns no observation or audit surface of its own.

The algorithms do return explain-capable structures — which nodes form a cycle, which edges
carried a wave assignment — but an explanation becomes an observation only when the calling domain
compiler emits it as a Structured Diagnostic. The package itself keeps no logs, counters, or
telemetry.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with no runtime dependencies beyond the two
foundation packages beneath it. Conformance tests published alongside the algorithms let any
consumer verify determinism claims on its own machine.

There is nothing to configure or operate: budgets are caller-declared arguments, no environment
variables or flags exist, and the package cannot be started, probed, or monitored because it is a
library. "Operations" for this artifact means consuming a new published revision and re-running
the consumer's own conformance suite.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` the results of every algorithm are stable for identical
declared inputs, including ordering. Any change to component numbering, wave assignment, tie
breaking, or result ordering is a new contract revision that consumers must reference explicitly;
there are no silent renumberings and no dual behavior flags.

Migration is therefore re-reference: a domain compiler moves from `CONTRACT/SOTHOTH/GENERIC-GRAPH@1`
to a successor revision by editing its exact required-contract reference, and its golden outputs
move with the revision. The package ships no shims, no deprecated aliases, and no
auto-migration of previously computed results.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A domain developer gets the ordering problem pre-solved: build a graph, call waves or longest
paths, receive an explainable deterministic answer — without writing SCC code or worrying about
tie-breaking. The sharp edge is deliberate and documented: the API refuses to interpret edges, so
the developer must map domain relations to ordering edges in the domain package where reviewers
can see the mapping. That refusal is what keeps `impact`-style relations from silently becoming
dependencies.

Operators never see this package. They see its guarantees: reproducible change waves in plans,
stable inheritance reviews in governance output, and identical answers across CI and local runs.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/graph",
  "criteria": [
    {
      "criterionId": "graph-generic-algorithm-surface",
      "sectionId": "public-surface-and-consumers"
    },
    {
      "criterionId": "graph-zero-domain-semantics",
      "sectionId": "responsibility-and-truth-ownership"
    },
    {
      "criterionId": "graph-deterministic-waves",
      "sectionId": "failure-recovery-and-consistency"
    }
  ]
}
```

`graph-generic-algorithm-surface` requires conformance tests covering traversal, SCC,
condensation, waves, and longest paths over shared fixtures, including duplicate-identity,
unknown-node, and non-DAG rejections. `graph-zero-domain-semantics` requires dependency and
vocabulary scans proving no document, reference, relation-role, governance, planning, scheduling,
consumer, or FRACTA semantics, plus zero I/O, process, network, Git, and executable references.
`graph-deterministic-waves` requires cross-run and cross-environment equality of wave assignment
and intra-wave order under caller sort keys with the declared tie-breaking.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability boundaries

Growth stays generic: additional order statistics over condensations, richer caller-declared edge
weights, or parallel-friendly query variants may join later revisions of
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`, always preserving deterministic ordering for identical inputs.
Scheduling intelligence — calendars, resources, placement, release trains — will never live here;
it extends the Schedule Solution in `@sothoth/planning` while this package keeps supplying only
dependency and wave primitives.

No future revision will begin interpreting relation roles: the domain-semantics boundary declared
in this Dossier is a compatibility boundary, not a `0.1` limitation, and moving it would require a
new accepted architecture decision rather than a minor algorithm addition.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, and `graphs-change-order-and-scheduling`; to
`CONTRACT/SOTHOTH/SCHEMAS@1` and `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed from the
foundation packages beneath it; and to the catalog candidate `@sothoth/graph` in
`SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-GRAPH-DOSSIER@1` bound to
`DOC-SOTHOTH-GRAPH-DOSSIER@1`, providing `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` and requiring
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` plus `CONTRACT/SOTHOTH/SCHEMAS@1`. Every reference
follows the exact grammar `<identity>@<positive integer revision>` with the last `@` separating
the revision.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

Seventeen of the eighteen closed topics are resolved by this Dossier: `identity` by
`artifact-identity-and-classification`; `intent-and-non-goals` by `purpose-and-non-goals`;
`responsibility` and `truth-ownership` by `responsibility-and-truth-ownership`; `public-surface` by
`public-surface-and-consumers`; `core-sdk-boundary` and `protocol-and-data-flow` by
`core-sdk-protocol-boundary`; `dependency-boundary` by `dependency-and-topology`;
`state-and-lifecycle` by `state-lifecycle-and-data-flow`; `failure-and-recovery` and
`concurrency-and-consistency` by `failure-recovery-and-consistency`; `deployment-and-configuration`
by `deployment-configuration-and-operations`; `compatibility-and-migration` by
`compatibility-and-migration`; `developer-and-operator-experience` by
`developer-and-operator-experience`; `verification` by `verification-and-acceptance-criteria`; and
`future-compatibility` by `future-capability-compatibility`. `authority-and-security` is inherited
exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` section `authority-boundary` with
applicability `adopts`. `observation-and-audit` is resolved as not-applicable for the closed reason
declared in that section and recorded verbatim in the registration.
