# @project-sothoth/selectors Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-SELECTORS-DOSSIER` revision `2`

Design identity: `SOTHOTH-SELECTORS-DOSSIER` revision `2`

Component: `@project-sothoth/selectors`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the declarative selector engine of Sothoth `0.1.0`
under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no
implementation: `packages/selectors/src/**` stays empty until accepted Dossiers, an accepted
Architecture Baseline, and a mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@project-sothoth/selectors` owns the closed query algebra of the control plane. A Selector is a
declarative expression — `all`, `any`, `not` over exact identities, normalized path globs,
kind/status/owner/tag sets, explicit reference and traceability relations, diagnostic identity
and namespace terms, and cardinality bounds — that compiles once into a canonical AST and then
matches deterministically against entries of a `@project-sothoth/document-index` projection.

The defining decision is that selection is a closed language, not an escape hatch. Nothing that
would make a Selector convenient by borrowing power is admitted: no JavaScript predicates, no
shell expressions, no network lookups, no free-text inference, no unrestricted backtracking
regular expressions. What a Selector can express is exactly the closed algebra; what it cannot
express is a job for the owning domain, stated as data, not smuggled in as code. Every selection
can say why it matched, because an explain trace is a first-class output, not a debug mode.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@project-sothoth/selectors`, classified as a document-governance domain
library: a pure compiler-and-matcher over index entries supplied by
`CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`. Its design identity is `SOTHOTH-SELECTORS-DOSSIER@2`, its
document identity is `DOC-SOTHOTH-SELECTORS-DOSSIER@2`, and it completes the structural half of
the document-governance layer above the pinned foundation `graph -> core -> contracts`.

It ships compiled ESM plus declarations with an explicit exports map, as a public package in its
own right: every consumer of Sothoth — governance closure checks, change-plan scoping, Consumer
Profile workflows — states what it operates on as Selectors, so the algebra is public surface.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one deterministic selection engine: parse a Selector into a canonical AST with a
hostile-input budget, match that AST against document-index entries, enforce cardinality
constraints, and return a selection result plus an explain trace — ordered by canonical identity
regardless of the order candidates arrived in, with zero matches producing a diagnostic by
default rather than a silent empty set.

The non-goals close the algebra:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@project-sothoth/selectors",
  "capabilityClasses": {
    "external-executable": "forbidden",
    "filesystem": "forbidden",
    "free-text-inference": "forbidden",
    "git": "forbidden",
    "input-order-dependent-output": "forbidden",
    "javascript-predicate": "forbidden",
    "network": "forbidden",
    "process": "forbidden",
    "registry-authority": "forbidden",
    "relation-semantics-interpretation": "forbidden",
    "selection-authorization": "forbidden",
    "shell-expression": "forbidden",
    "unbudgeted-hostile-glob": "forbidden",
    "unrestricted-backtracking-regexp": "forbidden"
  }
}
```

In practice: no embedded code of any kind evaluates during compilation or matching; no glob or
pattern runs without a budget; no selection consults a Registry, rewrites candidate order,
interprets what a relation means, or authorizes anything. A Selector selects. Deciding what a
match means, who must act on it, and in what order change flows is the consuming domain's work.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the correctness and determinism of two things: what a Selector expression means
as a canonical AST, and which index entries that AST matches — over the exact index it was given,
and nothing else:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@project-sothoth/selectors",
  "producedStateRefs": [
    "sothoth.selectors/selector-canonical-ast@1",
    "sothoth.selectors/selection-result@1",
    "sothoth.selectors/explain-trace@1"
  ],
  "issuedAuthorityRefs": [],
  "effectOwnership": "selection-results-only"
}
```

The knowledge inside those truths is bounded and declared:

```json
{
  "kind": "sothoth-dossier/domain-semantics-declaration@1",
  "packageId": "@project-sothoth/selectors",
  "ownedDomainSemantics": [
    "selector-syntax",
    "selector-canonical-ast",
    "exact-identity-matching",
    "normalized-path-glob",
    "facet-set-matching",
    "explicit-relation-matching",
    "diagnostic-identity-matching",
    "cardinality-constraints",
    "explain-trace"
  ],
  "interpretedEdgeRoles": [],
  "semanticsDeferredTo": "governance-and-consumer-profiles"
}
```

Responsibilities explicitly declined: owning or reading a Registry (the index is an input),
interpreting relation semantics such as whether a reference is normative or merely an impact
signal (governance compiles explicit versioned mappings for that), reordering anyone's change
plan, and granting any authorization — a selection is a set with an explanation, never a
permission.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@project-sothoth/selectors",
  "publicModules": [
    "@project-sothoth/selectors/parse",
    "@project-sothoth/selectors/ast",
    "@project-sothoth/selectors/match",
    "@project-sothoth/selectors/cardinality",
    "@project-sothoth/selectors/explain"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`parse` turns Selector source into a canonical AST or a typed rejection within the hostile-input
budget; `ast` exposes the closed canonical form — combinators `all`/`any`/`not`, exact identity
terms, normalized path globs, kind/status/owner/tag set terms, explicit reference and traceability
terms, diagnostic identity and namespace terms; `match` evaluates an AST against document-index
entries; `cardinality` enforces declared bounds and produces the default zero-match diagnostic;
`explain` emits the trace showing which term admitted or rejected each candidate. Primary
consumers are `@project-sothoth/governance` for closure scoping and change-plan compilation, and Consumer
Profiles through the SDK's selection hooks; the CLI reaches the same surface through
`sothoth select` and `sothoth explain`.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is a closed value protocol. A Selector arrives as declarative source or data — never
as an executable — and compiles against the canonical identity, digest, and canonical JSON
utilities of `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` from `@project-sothoth/core`; matching consumes
only the structural facts of `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` from `@project-sothoth/document-index`.
The typed Selector terms, the selection-result shapes, and the zero-match diagnostic identity are
expressed in the `CONTRACT/SOTHOTH/SCHEMAS@1` vocabulary of `@project-sothoth/contracts`, required and
imported directly rather than through any transitive surface. The package never calls a
compilation driver, and no driver calls back into a running match.

The SDK exposes Selector compilation, execution, and explain-trace hooks as public library
surface. There is no ambient index, no lazy fetching, and no mutable compilation context to drift
from the contract: a Selector compiled twice from the same source is the identical canonical AST,
byte for byte.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@project-sothoth/selectors` may depend only on the pure packages whose contracts it requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@project-sothoth/selectors",
  "runtimeImportAllowlist": [
    "@project-sothoth/contracts",
    "@project-sothoth/core",
    "@project-sothoth/document-index"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/SELECTOR@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ]
}
```

`CONTRACT/SOTHOTH/SCHEMAS@1` is required directly from `@project-sothoth/contracts` because the algebra's
typed terms, result shapes, and diagnostic identities are expressed in the shared schema,
identity, and diagnostic vocabulary. The allowlist is the closed import boundary for runtime and
type-level internal imports alike, so no vocabulary and no capability may arrive through a
transitive dependency.

The provided contract `CONTRACT/SOTHOTH/SELECTOR@1` is the selector algebra: the canonical AST,
its closed term vocabulary, matching, cardinality, explain traces, and the hostile-input budget
contract. Importing any adapter, SDK, CLI, or sibling domain package would point outward and is a
design violation, as would any attempt by those layers to be imported here.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

A Selector is compiled once into an immutable canonical AST and may then be matched any number of
times against any index; matches are pure reads that hold no state between calls. There is no
incremental evaluation cache to invalidate, no session, and no stored result set — a selection is
re-derived from the exact AST and the exact index whenever the caller asks, which is what keeps
selections disposable and comparable across environments.

Data flow is strictly feed-forward: declarative Selector in, canonical AST mid-way, deterministic
selection result plus explain trace out. The engine never mutates the index it reads, never
reorders it, and never consults anything but the AST and the index entries. The same AST matched
against the same entries yields the same result bytes regardless of when, where, or in what order
the entries were supplied.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, adopted without
narrowing: a selection can scope a review or a check but grants no authority, and nothing the
package matches becomes a Source Fact or modifies one.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3`, section `authority-boundary`,
applicability `adopts`.

Security posture is dominated by hostile-input discipline, because Selectors are authored text
that must never become an execution vector. The algebra admits no code execution of any kind, and
every pattern construct runs under a declared budget — bounded parse depth, bounded pattern
length, bounded state space, or an equivalence-closure bound — that fails deterministically with
a typed rejection instead of hanging, backtracking without limit, or degrading silently. No
filesystem, Git, process, network, or executable capability exists in the package.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures are typed rejections with exact positions: malformed Selector syntax, an unknown term
outside the closed vocabulary, a cardinality bound expressed negatively, a pattern rejected by
its budget, or a reference term that resolves against no declared identity. Recovery is always
the caller fixing the Selector; the engine never repairs, guesses, or partially accepts input, and
a rejected Selector leaves no half-built AST.

Consistency is the product, under the closed determinism contract:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@project-sothoth/selectors",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-by-default"
}
```

Selection results and explain traces are byte-stable for identical ASTs and indexes. Ordering is
canonical identity in Unicode code-point order by default — input order cannot change output
order, and a contract may supply a different deterministic key only by explicit declaration.
Ties never break by arrival order, hash traversal, locale collation, or match timing.
Concurrency needs no coordination; immutable ASTs and pure matching make parallel selections
independent.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The engine's own observation surface is exactly one emission: the default zero-match diagnostic,
declared as `sothoth.selectors/zero-match-diagnostic@1` and produced whenever a selection that
did not opt out matches nothing. Silence is never the report of an empty result.

Everything else audit needs is carried by the explain trace: for each candidate, which terms
admitted or rejected it, under which canonical identities. The trace is a result, not a log — the
engine keeps no counters, history, or telemetry — so an auditor replays the same pure selection
and compares traces byte for byte. Diagnostic identity and namespace terms are matched as data
declared in `@project-sothoth/contracts` vocabulary; the engine never invents observation identities.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly the three declared
packages beneath it: `@project-sothoth/contracts`, `@project-sothoth/core`, and `@project-sothoth/document-index`.
Conformance fixtures published alongside the algebra let any consumer verify
closed-vocabulary rejections, budget determinism, and ordering claims on its own machine.

There is nothing to configure or operate: budgets are declared per Selector or per caller as
data, not read from environment variables or flags, and the package acquires nothing itself.
"Operations" for this artifact means consuming a new published revision and re-running the
consumer's own conformance suite.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/SELECTOR@1` the canonical AST, matching semantics, default canonical-
identity ordering, and zero-match default are stable for identical inputs. Any change to the term
vocabulary, glob normalization, budget semantics, or result ordering is a new contract revision
that consumers must reference explicitly; there are no silent re-interpretations and no dual
behavior flags.

Migration is therefore re-reference: a consumer moves to a successor revision by editing its
exact required-contract reference, and its golden selection fixtures move with the revision. The
package ships no shims, no deprecated aliases, and no auto-migration of previously compiled
Selectors — an old Selector is re-compiled from its source under the new revision, and a
vocabulary term that no longer exists fails closed with a typed rejection.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A domain developer gets the scoping problem pre-solved: state what to operate on as a declarative
Selector, receive a deterministically ordered selection with a per-candidate explanation —
without writing matching code, without regex pitfalls, and without wondering whether an empty
result was real or a bug. The deliberate sharp edge: the algebra refuses escapes to code, so a
need it cannot express must become explicit data in the owning domain, where reviewers can see
it. That refusal is what keeps selection honest as the shared scoping substrate.

Operators never see this package. They see its guarantees: identical scoping in CI and locally,
empty results that announce themselves, and hostile patterns that fail fast with a position
instead of hanging a pipeline.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

Section binding convention, recorded for this and every Dossier under this contract: the
registration's `acceptanceCriteria[].sectionId` points at this unified verification entry point,
while each criterion declared below points at the subject section it constrains.

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@project-sothoth/selectors",
  "criteria": [
    {
      "criterionId": "selectors-closed-selector-algebra",
      "sectionId": "public-surface-and-consumers"
    },
    {
      "criterionId": "selectors-hostile-input-budgets",
      "sectionId": "failure-recovery-and-consistency"
    },
    {
      "criterionId": "selectors-order-independence",
      "sectionId": "failure-recovery-and-consistency"
    }
  ]
}
```

`selectors-closed-selector-algebra` requires conformance tests covering every combinator and term
kind of the canonical AST, plus typed rejections for JavaScript predicates, shell expressions,
network lookups, free-text inference, and unrestricted regular expressions.
`selectors-hostile-input-budgets` requires proof that hostile globs are bounded by the declared
budget dimensions and fail deterministically with a typed rejection, never by timeout accident.
`selectors-order-independence` requires byte-equal selection results and explain traces under
permuted index input order, with canonical-identity default ordering verified against fixtures.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability boundaries

Growth stays inside the algebra: additional closed term kinds — new facet sets, richer declared
cardinality operators, additional budget dimensions — may join later revisions of
`CONTRACT/SOTHOTH/SELECTOR@1`, always preserving canonical-identity ordering and budget
determinism for identical inputs.

No future revision will admit embedded code execution, unrestricted pattern matching, ambient
index access, or authorization semantics: those boundaries are compatibility boundaries of this
Dossier, not `0.1` limitations, and moving one would require a new accepted architecture decision
rather than a convenience feature.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` sections `decision`,
`authority-boundary`, `package-architecture`, `documents-and-selectors`, and
`diagnostics-and-process-outcomes`; to `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed from
`@project-sothoth/core`, `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` consumed from `@project-sothoth/document-index`, and
`CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from `@project-sothoth/contracts`; and to the catalog
candidate `@project-sothoth/selectors` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-SELECTORS-DOSSIER@2` bound to
`DOC-SOTHOTH-SELECTORS-DOSSIER@2`, providing `CONTRACT/SOTHOTH/SELECTOR@1` and requiring
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`, and
`CONTRACT/SOTHOTH/SCHEMAS@1`. Every reference follows the exact grammar
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
inherited exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@3` section
`authority-boundary` with applicability `adopts`.
