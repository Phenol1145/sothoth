# @sothoth/core Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-CORE-DOSSIER` revision `1`

Design identity: `SOTHOTH-CORE-DOSSIER` revision `1`

Component: `@sothoth/core`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the pure compilation kernel of Sothoth `0.1.0` under
the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no implementation:
`packages/core/src/**` stays empty until the retained candidates hold accepted Dossiers and an
accepted Architecture Baseline admit a formal Scope BOM.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/core` is the single functional kernel every compiler passes through: canonicalization,
digesting, diagnostic aggregation, and outcome aggregation. One Sothoth version, one canonical
input, one Profile and Rule Module lock, and one compilation budget must yield byte-identical
projections, and that guarantee is manufactured here before any domain meaning is attached.

The kernel is a pure function assembly line. It receives already-parsed, already-validated facts
whose shapes come from `@sothoth/contracts`; it never fetches, reads, parses, or mutates anything
on its own initiative. Domain compilers (`@sothoth/governance`, `@sothoth/planning`,
`@sothoth/document-index`, `@sothoth/selectors`) decide what the facts mean; the kernel decides
what the compiled bytes are. Keeping those two powers in different packages is what prevents a
mega-core and keeps every domain module replaceable.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/core`, classified as a pure-function compilation library:
no daemon, no service, no CLI, no adapter. Its design identity is `SOTHOTH-CORE-DOSSIER@1`, its
document identity is `DOC-SOTHOTH-CORE-DOSSIER@1`, and it sits one layer above `@sothoth/contracts`
in the pinned direction `graph -> core -> contracts`.

It ships compiled ESM plus declarations with an explicit exports map. Everything it exports is a
function or an immutable value; there is no class hierarchy to inherit behavior from and no plugin
slot to smuggle effects through.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The kernel exists to make compilation reproducible and rejection structured. Canonical JSON
serialization, SHA-256 digesting over canonical bytes, diagnostic deduplication and ordering,
severity aggregation into process outcomes, and the exit-code mapping are all owned here so that no
domain module can accidentally invent a second serialization or a friendlier outcome.

Everything that would make the kernel environmental is excluded by the closed classification:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/core",
  "capabilityClasses": {
    "business-acceptance": "forbidden",
    "consumer-identity": "forbidden",
    "consumer-path": "forbidden",
    "document-domain-semantics": "forbidden",
    "external-executable": "forbidden",
    "filesystem": "forbidden",
    "fracta-term": "forbidden",
    "git": "forbidden",
    "graph-domain-semantics": "forbidden",
    "network": "forbidden",
    "process": "forbidden",
    "source-fact-mutation": "forbidden"
  }
}
```

So the kernel does not know that a document, a plan, a Registry, or a Ledger exists; it does not
know any consumer's name; it never mentions FRACTA; it spawns nothing, opens nothing, and contacts
nobody. Where a rule module must execute, the kernel normalizes its protocol violations — the
module itself runs under Sothoth's process privilege elsewhere, never here.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The kernel owns the compiled form of everything: which bytes are canonical, which digest they bear,
which diagnostics coalesce, and which single outcome a compilation produces.

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/core",
  "producedStateRefs": [
    "sothoth.core/canonical-bytes@1",
    "sothoth.core/compilation-outcome@1"
  ],
  "issuedAuthorityRefs": [],
  "effectOwnership": "pure-computation-only"
}
```

It does not own the facts it compiles — those belong to their external accountable owners — and it
does not own domain conclusions: whether a change plan says `revise`, whether evidence is trusted,
or whether a Baseline is accepted are domain and human decisions. Provenance, environment
inspection, and I/O orchestration belong to adapters. The kernel's effects stop at allocated
return values; it cannot be observed from the outside except through its results.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/core",
  "publicModules": [
    "@sothoth/core/canonical-json",
    "@sothoth/core/digest",
    "@sothoth/core/compile",
    "@sothoth/core/diagnostics",
    "@sothoth/core/outcome"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`canonical-json` serializes recursively key-sorted with compact separators; `digest` produces
`sha256:`-prefixed hex over canonical bytes; `compile` drives a declared compilation over validated
facts within a budget; `diagnostics` deduplicates, orders, and digests Structured Diagnostics;
`outcome` folds severities into the `valid | invalid | invalid-input | extension-error |
internal-error` verdict and its exit code. Consumers are the domain packages, `@sothoth/graph` for
shared pure utilities, the Git adapter for canonical path handling, and — through the public SDK
only — external library users. The CLI consumes the kernel indirectly and can obtain no private
kernel capability.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol between the kernel and its consumers is a closed data protocol: validated facts in,
canonical results and diagnostics out, all shaped by `@sothoth/contracts`. The public SDK wraps
kernel functions for library consumers without adding behavior, and the boundary rule runs in both
directions: the SDK exposes only what the kernel declares publicly, and the kernel accepts only
inputs the contracts declare.

There is no hidden channel: no ambient context object, no global configuration, no environment
sniffing, no clock or random source inside compilation. Compilation budgets are explicit
parameters, not environment variables, so the same arguments always produce the same bytes — and a
budget exhaustion is a structured `internal-error`, never a partial answer.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/core` occupies the middle of the pinned direction `graph -> core -> contracts` and may
depend only on the contract vocabulary beneath it:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/core",
  "runtimeImportAllowlist": [
    "@sothoth/contracts"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ]
}
```

Any import of `@sothoth/graph`, a domain package, an adapter, the SDK, or the CLI would create a
reverse edge or a cycle and is a design violation. The provided contract
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` is the canonicalization, digest, diagnostic-aggregation,
and outcome-aggregation behavior at revision 1; the required contract is the schema and identity
vocabulary the kernel consumes.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

A compilation is the only lifecycle: facts arrive already parsed and validated, flow through
canonicalization, digesting, rule evaluation by the calling compiler, diagnostic aggregation, and
outcome folding, and leave as one immutable result. Nothing persists between calls — no cache, no
memo table keyed on the environment, no lazy singletons. The optional Document Index cache lives in
`@sothoth/document-index`, keyed by blob and compiler identity, and never here.

Data flow is therefore fully reconstructible from the arguments of a single call. A process that
runs the same compilation twice allocates twice and observes no difference; deleting any derived
artifact and re-running must rebuild identical bytes.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, adopted without
narrowing: rules can reject input but cannot grant business authority, and projections are
non-authoritative, disposable, and rebuildable.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `adopts`.

The security consequence is concrete: because the kernel touches no file, process, socket, or
repository, its blast radius is memory and CPU only. It must still defend its own invariants —
budget enforcement, cycle-safe aggregation, and the rule that extension crashes normalize to
`extension-error` rather than escaping as stack traces or unbounded stderr inside a projection.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Kernel failures are classified, never improvised: invalid inputs are `invalid-input` with exact
field paths; rule rejections are `invalid` with diagnostics; extension misbehavior is
`extension-error`; a kernel defect is `internal-error`. Recovery from the kernel's perspective is
always re-run-with-fixed-inputs, because no call leaves partial state. Consistency across calls,
machines, and releases is the core product:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/core",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-code-point"
}
```

Canonical JSON sorts keys in Unicode code-point order with compact separators; diagnostics sort by
code then subject in the same order; identical inputs rebuild identical bytes and digests. Ties
between otherwise equal elements break by canonical identity and then by code-point order — never
by insertion order, hash traversal, locale, or timing. Concurrency is safe by construction: pure
functions share nothing, so parallel compilations cannot interleave state.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The kernel emits the aggregate observation of a compilation: the deduplicated, ordered diagnostic
set and its digest, recorded as `sothoth.core/diagnostic-aggregate@1` in this component's
registration, which downstream consumers cite when they explain a verdict.

It keeps no audit log of its own: audit trails, receipts, and Ledger appends are Source Facts owned
outside Sothoth. What the kernel guarantees to auditors is stronger than a log — the property that
the same inputs will always rebuild the same diagnostics with the same digest, so an audit can
re-derive rather than trust.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package: compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, published from clean CI exactly like every other Sothoth package. Runtime
dependencies are admitted only where the standard library would materially weaken correctness, and
revision 1 expects none.

Configuration is a function argument, not a deployment concern: budgets, locks, and profiles are
passed in per call. There is no environment variable, no config file, no service port, and no
operational surface — the package cannot be "run", only called. Upgrading it changes compilation
identity, which is precisely why projections record the identities they were compiled under.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

The compatibility promise is byte-level: within `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`, the
same canonical input, Sothoth version, Profile, Rule Module lock, and budget rebuild identical
bytes. Any change that would alter bytes — key ordering, separator policy, digest construction,
diagnostic ordering — is a new contract revision, and consumers reference the revision they
compiled against.

Migration is re-reference, not translation: there are no deprecated serializer variants, no
compatibility shims between revisions, and no automatic re-digesting of historical projections.
Golden and conformance tests against the preserved Governance Compiler and Planning Compiler
behavior are the equivalence evidence any future kernel revision must reproduce before it replaces
this one.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A developer building a domain compiler imports the kernel and immediately gets the hard guarantees
for free — canonical bytes, stable digests, ordered diagnostics, one outcome — instead of
re-deriving them. Errors during development are the same structured diagnostics operators see in
production, with exact subjects and help text, so a failing rule never becomes a debugger session.

Operators experience the kernel as predictability: identical CI runs produce identical projections,
digests make caches and evidence checkable, and exit codes 0–4 mean the same thing in every
command. The one deliberate cost — no ambient environment access — is the same feature that makes
results trustworthy.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/core",
  "criteria": [
    {
      "criterionId": "core-pure-kernel-boundary",
      "sectionId": "purpose-and-non-goals"
    },
    {
      "criterionId": "core-canonical-byte-stability",
      "sectionId": "failure-recovery-and-consistency"
    },
    {
      "criterionId": "core-outcome-aggregation-closure",
      "sectionId": "public-surface-and-consumers"
    }
  ]
}
```

`core-pure-kernel-boundary` requires dependency and import scans proving zero filesystem, process,
network, Git, consumer, FRACTA, and external-executable references. `core-canonical-byte-stability`
requires cross-environment byte equality for identical canonical inputs, including key order,
diagnostic order, and digest stability. `core-outcome-aggregation-closure` requires that every
documented failure classification folds to exactly one exit code and that extension crashes never
leak traces into projections.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Planned growth stays inside the pure-function surface: streaming compilation for larger fact sets
must preserve byte equality; richer severity policies must remain deterministic folds; sandboxed
extension hosting, whenever it exists, will sit outside the kernel and keep the crash-normalization
contract unchanged. Budget semantics may grow finer granularity, but exhaustion will keep failing
closed rather than degrading silently.

Nothing here promises backward-compatible bytes across contract revisions — the opposite: the
boundary between "same bytes" and "new revision" is the product, and it will stay sharp.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, and `diagnostics-and-process-outcomes`; to the
contract vocabulary `CONTRACT/SOTHOTH/SCHEMAS@1` owned by `@sothoth/contracts`; and to the catalog
candidate `@sothoth/core` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-CORE-DOSSIER@1` bound to
`DOC-SOTHOTH-CORE-DOSSIER@1`, providing `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` and requiring
`CONTRACT/SOTHOTH/SCHEMAS@1`. All references use the exact grammar
`<identity>@<positive integer revision>`; none may be a path, a bare name, or `latest`.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

All eighteen closed topics are resolved by this Dossier: seventeen locally — `identity` by
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
`future-compatibility` by `future-capability-compatibility` — plus `authority-and-security`, which
is inherited exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` section
`authority-boundary` with applicability `adopts`. No topic is resolved as not-applicable.
