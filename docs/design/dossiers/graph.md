# @project-sothoth/graph Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-GRAPH-DOSSIER` revision `3`

Design identity: `SOTHOTH-GRAPH-DOSSIER` revision `3`

Component: `@project-sothoth/graph`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the generic graph package of Sothoth `0.1.0` under the
Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no implementation:
`packages/graph/src/**` stays empty until accepted Dossiers, an accepted Architecture Baseline, and
a mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@project-sothoth/graph` owns the deterministic, meaning-free graph machinery of the control plane: a
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

Document revision 2 closes what revision 1 left open: the exact declaration wrappers, the canonical
graph value, the seven public function signatures with their result envelopes, the closed ten-code
diagnostic vocabulary with its suppression, coalescing, and ordering rules, the deterministic
cycle-witness and overflow-taint rules, and the runtime deep-copy/deep-freeze semantics. It
supersedes `SOTHOTH-GRAPH-DOSSIER@1` and by itself authorizes no implementation.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@project-sothoth/graph`, classified as a generic algorithm library: pure
functions over caller-constructed graphs, with conformance-tested determinism. Its design identity
is `SOTHOTH-GRAPH-DOSSIER@3`, its document identity is `DOC-SOTHOTH-GRAPH-DOSSIER@3`, and it is
the top declared layer of the pinned foundation direction `graph -> core -> contracts`. Revision 2
supersedes `SOTHOTH-GRAPH-DOSSIER@1`, which closed the module surface, boundary declarations, and
determinism posture; revision 2 adds the closed public contract — the declaration wrappers, the
canonical value, the seven callables, the diagnostics, and the runtime immutability rules — without
changing any contract ref, package dependency, public module, criterion, or section identity.

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
  "packageId": "@project-sothoth/graph",
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
  "packageId": "@project-sothoth/graph",
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
  "packageId": "@project-sothoth/graph",
  "ownedDomainSemantics": [],
  "interpretedEdgeRoles": [],
  "semanticsDeferredTo": "consuming-domain-package"
}
```

Responsibilities explicitly declined: deciding which relations create ordering (Consumer Profile
and domain mapping rules), validating reference identities (domain compilers and contracts),
assigning dispositions like `revise` or `rebuild` (the change-plan domain), and any scheduling
axis beyond deterministic waves (the Schedule Solution in `@project-sothoth/planning`). The package
returns structures; the meaning of the structures is assembled by whoever called it.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@project-sothoth/graph",
  "publicModules": [
    "@project-sothoth/graph/digraph",
    "@project-sothoth/graph/traversal",
    "@project-sothoth/graph/scc",
    "@project-sothoth/graph/condensation",
    "@project-sothoth/graph/waves",
    "@project-sothoth/graph/longest-paths"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`digraph` builds an immutable directed multigraph from explicit declarations and rejects duplicate
or unresolved identities; `traversal` walks reachable sets deterministically; `scc` computes
strongly connected components; `condensation` collapses them into a component DAG;
`waves` assigns deterministic topological waves with canonical intra-wave order; `longest-paths`
solves longest paths with caller weights over the condensation of its input — which for an acyclic
graph is the graph itself — rejecting cyclic input itself with the deterministic cycle witness,
while component-level critical paths over cyclic graphs re-enter through the condensation's DAG.
Primary consumers are `@project-sothoth/governance`, `@project-sothoth/planning`, `@project-sothoth/document-index`, and
`@project-sothoth/selectors`; the SDK exposes none of this directly, and the CLI reaches it only through
domain compilation.

Revision 2 closes the exact export matrix. Each public module exports exactly this surface and
nothing else:

| Public module | Required exports (complete list) |
| --- | --- |
| `@project-sothoth/graph/digraph` | `createCanonicalGraphV1`; types `GraphNodeDeclarationV1`, `GraphEdgeDeclarationV1`, `DirectedMultigraphDeclarationV1`, `CanonicalGraphV1`, `GraphIssueV1`, `CreateCanonicalGraphSuccessV1`, `GraphFailureV1`, `CreateCanonicalGraphResultV1` |
| `@project-sothoth/graph/traversal` | `adjacencyV1`, `reachableFromV1`; types `AdjacencyEntryV1`, `AdjacencySuccessV1`, `AdjacencyResultV1`, `ReachableFromSuccessV1`, `ReachableFromResultV1` |
| `@project-sothoth/graph/scc` | `stronglyConnectedComponentsV1`; types `StronglyConnectedComponentsSuccessV1`, `StronglyConnectedComponentsResultV1` |
| `@project-sothoth/graph/condensation` | `condenseGraphV1`; types `CondensationComponentV1`, `CondensationV1`, `CondenseGraphSuccessV1`, `CondenseGraphResultV1` |
| `@project-sothoth/graph/waves` | `topologicalWavesV1`; types `TopologicalWavesSuccessV1`, `TopologicalWavesResultV1` |
| `@project-sothoth/graph/longest-paths` | `longestPathDagV1`; types `LongestPathNodeV1`, `LongestPathDagSuccessV1`, `LongestPathDagResultV1` |

The shared result types (`GraphIssueV1`, `GraphFailureV1`, `CanonicalGraphV1`,
`CreateCanonicalGraphResultV1`) are exported from `digraph` and imported type-only by the other
five modules; this adds no seventh public module.

The input vocabulary is wrapper-owned because the contracts-owned `GraphNodeV1` and `GraphEdgeV1`
deliberately carry no sort keys and no edge identity: a caller declares
`GraphNodeDeclarationV1 { node, sortKey }` and `GraphEdgeDeclarationV1 { id, edge, sortKey }`,
and the whole input is a `DirectedMultigraphDeclarationV1 { nodes, edges }` that may arrive in any
array order and may be invalid. Node identity is the inner `node.id`; edge identity lives in the
wrapper `id`, so parallel edges with equal endpoints, role, and weight are legal whenever their
identities differ, and duplicates of either identity fail closed. Sort keys are required,
non-empty, and never inferred from identity, insertion order, locale, hashes, or environment
state. `createCanonicalGraphV1` validates a declaration fail-closed and returns the canonically
ordered, deeply frozen `CanonicalGraphV1` — structurally a declaration, semantically the accepted
form. Canonical node order is ascending by `(sortKey, node identity)` and canonical edge order by
`(edge sortKey, edge identity)`, both compared in Unicode code-point order; the deterministic
topological order repeatedly takes the zero-indegree node with the smallest canonical node rank.

The package root is deliberately absent: importing the bare specifier `@project-sothoth/graph` fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. Every declared consumer is a package that can import exact
subpaths, the SDK wraps none of this surface (criterion `sdk-no-generic-graph-wrap`), and a root
entry would be a seventh import surface the accepted six-module declaration above does not name.

The exact public declarations are closed as follows; nothing in them is left to the implementer.
Every value returned by any function below is runtime-frozen and descriptor-safely deep-copied;
`readonly` is compile-time documentation only and is not the runtime guarantee.

```ts
// @project-sothoth/graph/digraph
import type { DiagnosticCodeV1, GraphEdgeV1, GraphNodeV1 } from "@project-sothoth/contracts";

/** A caller-declared node: the contracts-owned node plus its explicit sort key. */
export interface GraphNodeDeclarationV1 {
  readonly node: GraphNodeV1;
  readonly sortKey: string;
}

/** A caller-declared edge: edge identity, the contracts-owned edge, and its explicit sort key. */
export interface GraphEdgeDeclarationV1 {
  readonly id: string;
  readonly edge: GraphEdgeV1;
  readonly sortKey: string;
}

/** The whole caller input: any order, possibly invalid, never mutated. */
export interface DirectedMultigraphDeclarationV1 {
  readonly nodes: readonly GraphNodeDeclarationV1[];
  readonly edges: readonly GraphEdgeDeclarationV1[];
}

/** The validated, canonically ordered, deeply frozen graph value. */
export interface CanonicalGraphV1 {
  readonly nodes: readonly GraphNodeDeclarationV1[];
  readonly edges: readonly GraphEdgeDeclarationV1[];
}

/** One typed graph rejection. `witnessNodeIds` is present iff `code` is `sothoth.graph/not-a-dag`. */
export interface GraphIssueV1 {
  readonly code: DiagnosticCodeV1;
  readonly subject: string;
  readonly witnessNodeIds?: readonly string[] | undefined;
}

/** The single failure envelope shared by all seven functions. */
export interface GraphFailureV1 {
  readonly ok: false;
  readonly issues: readonly GraphIssueV1[];
}

export interface CreateCanonicalGraphSuccessV1 {
  readonly ok: true;
  readonly graph: CanonicalGraphV1;
}

export type CreateCanonicalGraphResultV1 =
  | CreateCanonicalGraphSuccessV1
  | GraphFailureV1;

/** Validates a declaration fail-closed and returns it in canonical order, or every issue. */
export function createCanonicalGraphV1(
  declaration: DirectedMultigraphDeclarationV1,
): CreateCanonicalGraphResultV1;

// @project-sothoth/graph/traversal
/** One node's incident edges. Self-loop edge ids appear in both lists. */
export interface AdjacencyEntryV1 {
  readonly nodeId: string;
  readonly outgoingEdgeIds: readonly string[];
  readonly incomingEdgeIds: readonly string[];
}

export interface AdjacencySuccessV1 {
  readonly ok: true;
  readonly entries: readonly AdjacencyEntryV1[];
}

export type AdjacencyResultV1 = AdjacencySuccessV1 | GraphFailureV1;

/** Adjacency for every declared node, in canonical node order; edge lists in canonical edge order. */
export function adjacencyV1(graph: CreateCanonicalGraphResultV1): AdjacencyResultV1;

export interface ReachableFromSuccessV1 {
  readonly ok: true;
  readonly nodeIds: readonly string[];
}

export type ReachableFromResultV1 = ReachableFromSuccessV1 | GraphFailureV1;

/** Reflexive forward closure of `startNodeId`, reported once per node in canonical node order. */
export function reachableFromV1(
  graph: CreateCanonicalGraphResultV1,
  startNodeId: string,
): ReachableFromResultV1;

// @project-sothoth/graph/scc
export interface StronglyConnectedComponentsSuccessV1 {
  readonly ok: true;
  /** components[i] lists component i's node ids in canonical node order; components ordered canonically. */
  readonly components: readonly (readonly string[])[];
}

export type StronglyConnectedComponentsResultV1 =
  | StronglyConnectedComponentsSuccessV1
  | GraphFailureV1;

export function stronglyConnectedComponentsV1(
  graph: CreateCanonicalGraphResultV1,
): StronglyConnectedComponentsResultV1;

// @project-sothoth/graph/condensation
/** One component: its representative-derived identity and its members in canonical node order. */
export interface CondensationComponentV1 {
  readonly componentId: string;
  readonly nodeIds: readonly string[];
}

export interface CondensationV1 {
  readonly components: readonly CondensationComponentV1[];
  /** Maps every declared node id to its component id. Ordinary-object record, own-data keys defined prototype-safely. */
  readonly componentOfNode: Readonly<Record<string, string>>;
  /** The component DAG; a valid canonical graph, so it re-enters createCanonicalGraphV1. */
  readonly dag: CanonicalGraphV1;
}

export interface CondenseGraphSuccessV1 {
  readonly ok: true;
  readonly condensation: CondensationV1;
}

export type CondenseGraphResultV1 = CondenseGraphSuccessV1 | GraphFailureV1;

export function condenseGraphV1(
  graph: CreateCanonicalGraphResultV1,
): CondenseGraphResultV1;

// @project-sothoth/graph/waves
export interface TopologicalWavesSuccessV1 {
  readonly ok: true;
  /** waves[i] lists wave i's node ids in canonical node order; wave indices are consecutive from 0. */
  readonly waves: readonly (readonly string[])[];
}

export type TopologicalWavesResultV1 = TopologicalWavesSuccessV1 | GraphFailureV1;

export function topologicalWavesV1(
  graph: CreateCanonicalGraphResultV1,
): TopologicalWavesResultV1;

// @project-sothoth/graph/longest-paths
/** Per-node longest-path value and the deterministic incoming edge that achieves it. */
export interface LongestPathNodeV1 {
  readonly nodeId: string;
  readonly longestPathWeight: number;
  /** Null iff the node is a source (no incoming edges). */
  readonly criticalEdgeId: string | null;
}

export interface LongestPathDagSuccessV1 {
  readonly ok: true;
  readonly nodes: readonly LongestPathNodeV1[];
  /** The deterministic maximum path, listed source-first. Empty iff the graph is empty. */
  readonly criticalPathNodeIds: readonly string[];
  readonly criticalPathWeight: number;
}

export type LongestPathDagResultV1 = LongestPathDagSuccessV1 | GraphFailureV1;

export function longestPathDagV1(
  graph: CreateCanonicalGraphResultV1,
): LongestPathDagResultV1;
```

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a value protocol: the package consumes the canonical identity, canonical JSON, and
digest utilities of `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` from `@project-sothoth/core` when a result
must carry canonical bytes, and the type vocabulary of `CONTRACT/SOTHOTH/SCHEMAS@1` from
`@project-sothoth/contracts`; it returns plain deterministic structures. It never calls the kernel's
compilation driver, and the kernel never calls back — the acyclicity of the package graph is itself
an instance of what this package proves.

The SDK does not wrap these algorithms as a public API surface of its own; domain packages embed
graph results inside their projections. Consequently there is no public SDK protocol to drift from:
the only contract `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` exposes is the algorithm surface above,
consumed by packages, not by end users.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@project-sothoth/graph` completes the pinned direction `graph -> core -> contracts` and may depend only on
the two pure foundation packages beneath it:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@project-sothoth/graph",
  "runtimeImportAllowlist": [
    "@project-sothoth/contracts",
    "@project-sothoth/core"
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

Revision 2 closes the runtime shape of that immutability. No function mutates an input: every
accepted graph value, success result, failure result, nested array/object, and facet is a
descriptor-safe deep copy with no shared mutable reference to caller input, and every returned
container — the canonical graph, every result envelope and issue object, adjacency entries,
component arrays, the `componentOfNode` record, the condensation DAG, wave arrays, longest-path
node objects, and all nested facet containers — is recursively `Object.freeze`d before exposure.
The copy/freeze walk is iterative (an explicit work stack, so it adds no call-stack depth
proportional to graph size), operates only on values that already passed the closed JSON grammar
validation, preserves every own string key — including `"__proto__"`, through
`Object.defineProperty` or an equivalent prototype-safe operation, never plain assignment that
could hit the inherited setter — and keeps the canonical JSON own-data value and bytes identical
to the validated input. Null-prototype input objects may normalize to ordinary objects; reference,
object, and prototype identity are never part of the contract, and "facets preserved verbatim"
means the semantic JSON own-data value and its canonical bytes, nothing more. An algorithm may
return an incoming object only when it is already exactly canonical — validated, coalesced,
sorted, and deeply frozen.

The data flow runs exclusively through the closed public declarations reproduced in the
public-surface section: `createCanonicalGraphV1(declaration)` produces the
`CreateCanonicalGraphResultV1` union, and the six algorithm functions each take that full union
(plus the validated `startNodeId` for `reachableFromV1`) and return their own success envelope or
the shared `GraphFailureV1`. There is no other entry point, no mutation API, and no stored state.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, adopted without
narrowing: an algorithm result can inform a recommendation but grants no authority, and nothing the
package computes becomes a Source Fact.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3`, section `authority-boundary`,
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
  "packageId": "@project-sothoth/graph",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "caller-sort-key-then-node-identity"
}
```

Node and edge orderings follow the caller-provided stable sort keys compared in Unicode code-point
order; ties break by canonical node identity and then by code-point order — never by insertion
order, hash traversal, locale collation, or iteration timing. Concurrency needs no coordination:
immutable inputs and pure functions make parallel compilations independent.

Revision 2 closes the rejection vocabulary as exactly ten codes under `sothoth.graph/`:
`invalid-declaration`, `unknown-field`, `missing-field`, `invalid-field`, `duplicate-node-id`,
`duplicate-edge-id`, `unresolved-endpoint`, `unknown-start-node`, `not-a-dag`, and
`weight-overflow`. A rejection is a list of `GraphIssueV1 { code, subject, witnessNodeIds? }`
entries; `witnessNodeIds` is present on exactly `not-a-dag` and is itself validated.
Declaration-structural codes anchor the exact input path (`nodes[3].node.id`);
algorithm-envelope codes anchor under `graph` (`graph.ok`, `graph.issues[0].code`);
identity-level codes anchor identities (so they are independent of array positions); and
`unknown-start-node` anchors the requested start string itself. No graph result or issue ever
carries an exit code: the outcome-to-exit mapping is owned by `@project-sothoth/contracts` and rendered by
the CLI only.

Validation is descriptor-only and hostile. Parameters are typed narrowly, but every function
treats its runtime argument as hostile `unknown`: it reads own data properties through descriptors
only — an accessor on a known field fails closed with `invalid-field` and the getter never
executes — and it never coerces, never mutates, and never invokes a value method. A missing
required own field is `missing-field`; a present field with a wrong value, type, or descriptor —
including a non-plain object, a sparse or decorated array, or an empty string where non-empty is
required — is `invalid-field`; an extra own string or symbol key outside the closed field set is
`unknown-field` regardless of whether it is a data or accessor property. Suppression is part of
the contract, not an optimization: an invalid parent or container shape suppresses all descendant
validation, and an invalid field suppresses every cross-field or cross-entry check that depends on
it. Facets are validated by the `canonicalJson` grammar of `@project-sothoth/core/canonical-json` inside a
fail-closed try/catch — the single owner of the JSON value grammar, so this package contains no
second grammar implementation — and any exception that grammar raises, including a depth-induced
native `RangeError`, becomes `invalid-field` on the facets path; nothing is thrown onward. Every
failure's `issues` array is first coalesced — no two byte-identical issues remain, compared by
canonical issue value — and then sorted by `(code, subject, canonical witness value)` in Unicode
code-point order. A rejected input leaves no half-built graph: if any issue exists, the result is
exactly `{ ok: false, issues }`.

Weights are closed: an optional finite IEEE-754 double. An omitted weight contributes `1` to path
arithmetic, so wave indices are exactly unit-weight longest-path levels; any finite double,
negative values and `-0` included, is legal; `NaN`, `+Infinity`, `-Infinity`, and non-number
values fail closed at creation with `invalid-field` on the weight path.

Cycle rejection is deterministic. `topologicalWavesV1` and `longestPathDagV1` fail closed on any
multi-node strongly connected component or any self-loop with exactly one `not-a-dag` issue whose
witness is selected by the closed rule: among all on-cycle nodes — members of components of size
at least two plus nodes with a self-loop edge — take the one with the smallest canonical rank; a
self-loop at that node witnesses `[node]`; otherwise walk from it within its component, at each
node choosing the outgoing same-component target with the smallest canonical rank (among parallel
edges to that target, the first in canonical edge order), appending targets until a node already
in the walk reappears and the witness closes at its first occurrence. Every witness entry lies on
a real directed cycle, and the rule is a pure function of the canonical graph, so every machine
and every run — including under multiple disjoint or interlocked cycles — produces the same
witness.

Overflow is a conservative fail-closed taint. While `longestPathDagV1` processes nodes in the
deterministic topological order, a node becomes affected iff any incoming candidate `L(u) + w(e)`
produces a non-finite value (magnitude overflow to either infinity, or the NaN of adding
opposite-signed infinities) or any predecessor of an incoming edge is already affected; a finite
alternative candidate never clears affectedness, and affectedness propagates through every
outgoing edge. If the affected set is non-empty the function fails closed with exactly one
`weight-overflow` issue per affected node — subject: the literal node id — in canonical issue
order, and no numeric value and no partial success is returned, so no non-finite number ever
appears in a success result.

Failure forwarding is closed as equal canonical value and canonical bytes, never JavaScript
reference identity. When creation failed, each algorithm function returns a failure whose
canonical issue value and canonical UTF-8 bytes equal the creation failure's — coalesced, sorted,
frozen. A hand-built failure that passes the shared envelope validation is observationally
indistinguishable from a package-produced failure: the algorithm's output canonical bytes equal
the validated crafted failure's canonical bytes. Reference identity is not part of the contract
anywhere.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

This topic is resolved as not-applicable, with the closed reason recorded in this component's
registration: `@project-sothoth/graph` computes pure results over caller-provided nodes, edges, weights,
and sort keys; every diagnostic, audit trail, and observation identity is declared by
`@project-sothoth/contracts` and aggregated by `@project-sothoth/core` or the consuming domain compiler, so the
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

Revision 2 supersedes `SOTHOTH-GRAPH-DOSSIER@1` without touching `CONTRACT/SOTHOTH/SCHEMAS@1`:
the contracts-owned `GraphNodeV1`, `GraphEdgeV1`, and `GraphNodeWaveV1` shapes are consumed
as-is, and the sort-key and edge-identity vocabulary is Graph-owned wrapper input vocabulary, so
no closed shape gains a second owner. `GraphNodeWaveV1` remains consumer-side projection
vocabulary: a domain that needs per-node wave assignments maps the Graph `waves` array into them;
Graph itself emits the wave-array envelope.

Two readings are closed deliberately. First, the six algorithm functions accept the full
`CreateCanonicalGraphResultV1` union rather than the bare canonical graph, so
`topologicalWavesV1(createCanonicalGraphV1(fixture))` composes without destructuring and failure
forwarding — equal canonical value and canonical bytes — is part of the contract. Second,
`longestPathDagV1` accepts the general canonical graph result and rejects cyclic input itself
with the deterministic witness: for an acyclic graph the condensation is the graph itself (every
strongly connected component is a singleton), and component-level critical paths over cyclic
graphs re-enter through the closed composition
`longestPathDagV1(createCanonicalGraphV1(condensation.dag))`, because the condensation DAG is
itself a valid canonical graph whose endpoints always resolve. Determinism is scoped exactly:
for any declaration that passes validation, every public result is invariant under any
permutation of the input arrays; for a rejected declaration the issue list is a deterministic
function of the exact input sequence. Stack safety is a hard compatibility promise, not a
preference: no public function may recurse at a depth proportional to graph size, and a valid
directed path of exactly 100,000 nodes and 99,999 edges must complete every function without
`RangeError`, within the caller-declared size and time budgets this Dossier already assigns.

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
  "packageId": "@project-sothoth/graph",
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
it extends the Schedule Solution in `@project-sothoth/planning` while this package keeps supplying only
dependency and wave primitives.

No future revision will begin interpreting relation roles: the domain-semantics boundary declared
in this Dossier is a compatibility boundary, not a `0.1` limitation, and moving it would require a
new accepted architecture decision rather than a minor algorithm addition.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` sections `decision`,
`authority-boundary`, `package-architecture`, and `graphs-change-order-and-scheduling`; to
`CONTRACT/SOTHOTH/SCHEMAS@1` and `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed from the
foundation packages beneath it; and to the catalog candidate `@project-sothoth/graph` in
`SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-GRAPH-DOSSIER@3`, superseding
`SOTHOTH-GRAPH-DOSSIER@2` and bound to `DOC-SOTHOTH-GRAPH-DOSSIER@3`, providing
`CONTRACT/SOTHOTH/GENERIC-GRAPH@1` and requiring
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
exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` section `authority-boundary` with
applicability `adopts`. `observation-and-audit` is resolved as not-applicable for the closed reason
declared in that section and recorded verbatim in the registration.
