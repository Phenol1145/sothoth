# @sothoth/contracts Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-CONTRACTS-DOSSIER` revision `1`

Design identity: `SOTHOTH-CONTRACTS-DOSSIER` revision `1`

Component: `@sothoth/contracts`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier is the closed pre-design fact for the contract-owning foundation package of Sothoth
`0.1.0`. It binds the component to the Dossier Document Contract `sothoth.design-dossier/full/v1`
and authorizes no implementation: no production source may appear under `packages/contracts/src/**`
before the retained catalog candidates hold accepted Dossiers and an accepted Architecture Baseline.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/contracts` is the single normative owner of every closed schema, TypeScript type,
canonical identity grammar, diagnostic contract, projection contract, pre-design contract, and
extension protocol consumed by the Sothoth compilation stack. Everything the system treats as a
closed fact — the shape of a Diagnostic, the envelope of a Projection, the topic set of a Dossier,
the protocol of a Trusted Rule Module — is declared here and nowhere else.

The package is deliberately inert. It declares what is true and what is rejected; it does not
compile, parse, traverse, digest, or execute anything. Compilation algorithms live in
`@sothoth/core`, generic graph algorithms live in `@sothoth/graph`, CommonMark parsing and source
spans live in `@sothoth/document-index`, and every I/O concern lives in an adapter. A declaration in
this package is authoritative for identity and shape only; accepting a Source Fact, admitting a
release, or writing any byte remains outside Sothoth entirely.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is one npm package `@sothoth/contracts`, classified as a declarative type-and-schema
library with zero runtime dependencies. Its artifact identity is bound by this Dossier's design
identity `SOTHOTH-CONTRACTS-DOSSIER@1`; its document identity is
`DOC-SOTHOTH-CONTRACTS-DOSSIER@1`; and its release membership is only ever expressed by a future
formal Scope BOM, never by this catalog candidate record.

The package publishes compiled ESM modules plus TypeScript declarations. It is consumed at both
design time (Dossier and registration validation) and compile time (every Sothoth compiler pass),
but it contains no executable behavior beyond closed-set validation helpers that answer questions
about declared shapes.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose of `@sothoth/contracts` is to make the vocabulary of the control plane closed and
checkable: one place defines what a Structured Diagnostic, a Change Plan Projection, a Design Scope
Catalog entry, an Artifact Design Registration, a Selector AST node, a Gate Macro, or an Evidence
Check Reference may contain. Closing the vocabulary here is what allows every other package to stay
small and mutually consistent.

The non-goals are structural, not stylistic. The package is forbidden from owning any executable
capability beyond shape validation, as declared below:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/contracts",
  "capabilityClasses": {
    "business-authority": "forbidden",
    "canonical-json-implementation": "forbidden",
    "commonmark-parsing": "forbidden",
    "compilation-algorithm": "forbidden",
    "consumer-semantics": "forbidden",
    "filesystem": "forbidden",
    "git": "forbidden",
    "graph-algorithm": "forbidden",
    "network": "forbidden",
    "process": "forbidden",
    "source-fact-write": "forbidden"
  }
}
```

Concretely: canonical JSON serialization is defined here as a contract but implemented in
`@sothoth/core`; SCC and wave algorithms over contract-declared graph shapes are implemented in
`@sothoth/graph`; CommonMark structure is parsed by `@sothoth/document-index`; and consumer or
FRACTA-specific semantics belong to `@sothoth/profile-sdk` and `@fracta/sothoth-profile`. The
package also never writes Source Facts and never grants business acceptance.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns exactly one truth: the identity of the closed contract set. When a contract
revision is published, this package is the single place that says which schemas, identities, and
closed enumerations exist at that revision.

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/contracts",
  "producedStateRefs": [
    "sothoth.contracts/schema-identity@1"
  ],
  "issuedAuthorityRefs": [],
  "effectOwnership": "declarative-only"
}
```

Responsibilities that look nearby but are explicitly not owned here: diagnostic aggregation and
digest computation (`@sothoth/core`), diagnostic emission policy for a compiled domain
(`@sothoth/governance` and `@sothoth/planning`), document conformance evaluation
(`@sothoth/governance`), and the projection bytes themselves (always compiled, never authored
here). Because the package only declares, its effects are limited to import-time type information
and pure validation predicates; it has no side effects to reconcile.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

The public TypeScript surface is organized by contract family, so a consumer can depend on the
narrow vocabulary it actually uses:

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/contracts",
  "publicModules": [
    "@sothoth/contracts/identity",
    "@sothoth/contracts/schema",
    "@sothoth/contracts/diagnostic",
    "@sothoth/contracts/projection",
    "@sothoth/contracts/pre-design",
    "@sothoth/contracts/extension"
  ],
  "surfaceKind": "types-and-validation-only"
}
```

`identity` holds canonical identity grammars and the exact reference forms; `schema` holds the
closed envelope schemas for catalog, registry, and registration facts; `diagnostic` holds the
Structured Diagnostic shape and the code grammar `<owner>.<domain>/<condition>`; `projection` holds
the projection envelopes and their digest fields; `pre-design` holds the Dossier topic sets,
resolution kinds, and applicability kinds; `extension` holds the Gate Macro, Trusted Rule Module,
and Evidence Check contracts. Every other `@sothoth/*` package is a consumer; the public SDK
re-exports nothing from here privately, and the CLI never reaches around the SDK.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol this package defines is data-shaped, not behavioral: types and closed enumerations
that the kernel, domain compilers, adapters, SDK, and CLI agree on. `@sothoth/core` consumes these
types as the input and output vocabulary of the compilation kernel; the SDK exposes them to library
consumers unchanged; the CLI renders them. No participant may extend a closed set locally — an
unknown diagnostic verdict, topic, applicability, or reference field is a schema violation, not a
graceful extension point.

There is no private channel between this package and Core, the SDK, or the CLI: everything the
package offers is in the public modules above. The kernel may not invent contract semantics that
are not declared here, and this package may not grow a convenience implementation of kernel
behavior; the dependency and the discipline point the same way.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/contracts` is the base of the pinned dependency direction
`graph -> core -> contracts`. It imports nothing at runtime:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/contracts",
  "runtimeImportAllowlist": [],
  "providedContracts": [
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ],
  "requiredContracts": []
}
```

The provided contract `CONTRACT/SOTHOTH/SCHEMAS@1` is the closed schema, identity, diagnostic,
projection, pre-design, and extension vocabulary at revision 1. Because the allowlist is empty, any
runtime import — including `@sothoth/core`, `@sothoth/graph`, a domain package, an adapter, an SDK,
or a CLI — would invert the pinned direction and is a design violation even before a cycle forms.
Type-level and test-time dependencies follow the same allowlist.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

The package holds no mutable state. Its artifacts have one lifecycle: a contract revision is
authored, closed, and then never edited — change arrives as a new revision that supersedes the old
one, exactly as this Dossier itself does. In-memory, every exported value is an immutable
declaration or a pure predicate over such declarations.

Data flows in one direction only: consumers import declarations and receive validation verdicts.
Nothing flows back: the package observes no input events, keeps no cache, and produces no output
beyond return values. A process that imports it twice sees identical declarations.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design, narrowed to
schema facts: the package may read and reject declared shapes, never create, accept, or write back
any Source Fact.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `narrows`.

Security posture follows from closed sets: unknown fields, unknown enumeration members, and
non-exact references fail closed at validation time instead of being ignored. The package handles
no secrets, no credentials, no environment variables, and no untrusted execution; its only attack
surface is being imported.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Failures in this package's scope are declaration failures: a shape does not match a closed schema.
They are reported as structured validation verdicts with exact field paths; recovery is always the
consumer's edit of the offending fact, never a rewrite by this package. Because validation is pure,
a failed validation leaves no partial state behind.

Consistency is anchored in canonical ordering: every identity enumeration, field set, and topic
list declared here has a deterministic order, so two validators reading the same revision always
agree byte-for-byte:

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/contracts",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "declared-enumeration-order"
}
```

Ties cannot arise inside a closed set because each declaration pins its own enumeration order;
where a consumer must order identities, the contract requires Unicode code-point ordering rather
than locale collation.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package defines the observation vocabulary but emits no observations. The Structured Diagnostic
contract — origin, category, phase, verdict, severity, rule, location, subjects, parameters,
causes, help, and the identity fields behind a Diagnostic Digest — is declared here so that every
emitting package produces comparable, deduplicatable records.

Audit consumers therefore trace any diagnostic they receive back to a contract-declared code
grammar and a contract-declared shape. The package itself keeps no logs, counters, or telemetry,
and its declarations make audit possible without making the package an audit participant.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment form is a single reproducible npm package: compiled ESM, declarations, an explicit
exports map, and Apache-2.0 license inclusion, published from a clean CI candidate exactly as the
release policy requires. There is nothing to configure: no environment variables, no feature
flags, no config files, and no runtime services.

Operationally the package is invisible. It runs wherever its consumers run, needs no health check,
no daemon, no database, and no process supervision; upgrading it is a versioned dependency change,
never a migration event.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Compatibility is revision-scoped and closed. A contract revision never changes after publication;
breaking change means a new revision that consumers reference explicitly. Reference grammar stays
`<identity>@<positive integer revision>` — bare names, `latest`, implicit-current pointers, and
revision `0` remain inexpressible. Semantic-version and digest-shaped references are deliberately
excluded at revision 1 and may only arrive as a new contract revision.

Migration is therefore consumer-driven: a consumer moves from `CONTRACT/SOTHOTH/SCHEMAS@1` to a
successor revision by editing its exact references. The package ships no compatibility shims, no
deprecated aliases across revisions, and no automatic rewrites, so two reference spellings can
never silently mean the same fact.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

Developers experience this package as the place where an error stops being mysterious: every
rejection names the exact field, the closed set it violated, and the code grammar the diagnostic
will carry. Types are total — exhaustive unions instead of stringly-typed fields — so misuse is a
compile error rather than a runtime surprise. Adding a capability means changing a contract here
first, which forces the design conversation before the implementation.

Operators never interact with the package directly. For them, its value is indirect but
concrete: stable diagnostic codes and shapes mean alerts, dashboards, and SARIF exports keep
working across Sothoth versions.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/contracts",
  "criteria": [
    {
      "criterionId": "contracts-schema-closure",
      "sectionId": "responsibility-and-truth-ownership"
    },
    {
      "criterionId": "contracts-zero-dependency-floor",
      "sectionId": "dependency-and-topology"
    },
    {
      "criterionId": "contracts-identity-code-point-order",
      "sectionId": "failure-recovery-and-consistency"
    }
  ]
}
```

`contracts-schema-closure` requires that every schema, identity grammar, and closed enumeration
consumed by the `0.1.0` packages resolves to a declaration in this package, with no second owner.
`contracts-zero-dependency-floor` requires an empty runtime import allowlist, proven by dependency
scans in the release conformance suite. `contracts-identity-code-point-order` requires that every
declared ordering rule uses Unicode code-point order with pinned enumeration tie-breaking, proven
by ordering conformance tests.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Future growth extends the closed vocabulary by new revisions, never by reopening closed sets.
Known future directions: semver- and digest-shaped exact references as a new contract revision;
new diagnostic categories under the existing code grammar; richer Selector AST nodes inside the
existing canonical AST; and extension protocol evolution for sandboxed hosting, which will remain a
consumption contract here while any hosting capability stays outside Sothoth.

Nothing in this Dossier promises a data migration, an alias layer, or a deprecated-forever surface.
A consumer holding exact references at revision 1 keeps compiling against revision 1 semantics
regardless of later revisions.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, `documents-and-selectors`, and
`diagnostics-and-process-outcomes`; to the Dossier Document Contract
`sothoth.design-dossier/full/v1` at `docs/design/contracts/artifact-design-dossier.v1.json`; and to
the catalog candidate `@sothoth/contracts` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

Every cross-artifact reference in this Dossier and its registration uses the exact grammar
`<identity>@<positive integer revision>`, with the last `@` separating the revision. The
registration for this component is `SOTHOTH-CONTRACTS-DOSSIER@1` bound to
`DOC-SOTHOTH-CONTRACTS-DOSSIER@1`; its provided contract is `CONTRACT/SOTHOTH/SCHEMAS@1`.

<!-- sothoth:section id="topic-coverage-declaration" -->

## Topic coverage declaration

All eighteen closed topics of `sothoth.design-dossier/full/v1` are resolved by this Dossier:
seventeen locally — `identity` by `artifact-identity-and-classification`; `intent-and-non-goals`
by `purpose-and-non-goals`; `responsibility` and `truth-ownership` by
`responsibility-and-truth-ownership`; `public-surface` by `public-surface-and-consumers`;
`core-sdk-boundary` and `protocol-and-data-flow` by `core-sdk-protocol-boundary`;
`dependency-boundary` by `dependency-and-topology`; `state-and-lifecycle` by
`state-lifecycle-and-data-flow`; `failure-and-recovery` and `concurrency-and-consistency` by
`failure-recovery-and-consistency`; `observation-and-audit` by `observation-and-audit`;
`deployment-and-configuration` by `deployment-configuration-and-operations`;
`compatibility-and-migration` by `compatibility-and-migration`;
`developer-and-operator-experience` by `developer-and-operator-experience`; `verification` by
`verification-and-acceptance-criteria`; and `future-compatibility` by
`future-capability-compatibility` — plus `authority-and-security`, which is inherited exactly from
`DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` section `authority-boundary` with applicability
`narrows`. No topic is resolved as not-applicable.
