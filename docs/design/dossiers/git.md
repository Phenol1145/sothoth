# @sothoth/git Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-GIT-DOSSIER` revision `1`

Design identity: `SOTHOTH-GIT-DOSSIER` revision `1`

Component: `@sothoth/git`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the read-only Git Source Adapter of Sothoth `0.1.0`
under the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no
implementation: `packages/git/src/**` stays empty until accepted Dossiers, an accepted
Architecture Baseline, and a mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/git` is the single Sothoth package allowed to read repositories and invoke Git
processes. It supports exactly three explicit modes — `commit`, `compare`, and `workspace` — and
never mutates a repository. Path normalization, canonical identity, digest, diagnostic, and
projection vocabulary remain inward from `@sothoth/core` and `@sothoth/contracts`; no filesystem,
Git, or process capability leaks outward to Core, Graph, or any other pure domain component.

The adapter is read-only by design. Every byte it returns is bound to an exact snapshot identity,
Git object identity, normalized repository-relative POSIX path, and digest, and every input that
cannot be normalized or bounded fails closed.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/git`, classified as a read-only source adapter with the
narrowest permitted I/O surface in the control plane. Its design identity is
`SOTHOTH-GIT-DOSSIER@1`, its document identity is `DOC-SOTHOTH-GIT-DOSSIER@1`, and it sits on the
inward foundation `core -> contracts` without importing any domain package.

It ships compiled ESM plus TypeScript declarations with an explicit exports map. GitHub and other
forge APIs are future independent adapters and are explicitly not part of this component.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one closed read boundary: bind exact commit/tree/blob bytes, exact base/head
comparisons, and explicitly composed workspace bytes; normalize repository-relative POSIX paths;
and return digest-bearing snapshots for downstream compilers.

The non-goals are the mutation and ambiguity fence:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/git",
  "capabilityClasses": {
    "ambiguous-ref-acceptance": "forbidden",
    "environment-variable-semantics": "forbidden",
    "forge-api": "forbidden",
    "git-mutation": "forbidden",
    "path-escape-acceptance": "forbidden",
    "shell-invocation": "forbidden",
    "snapshot-truncation-success": "forbidden",
    "workspace-commit-masquerade": "forbidden"
  }
}
```

In practice: the adapter rejects ambiguous refs; rejects absolute paths, `..` escape,
repository escape, NUL, and unnormalizable paths; invokes Git only through the allowlisted
subcommands with fixed argument arrays; reads no environment variable to change semantics; never
calls a shell; and never truncates an over-budget read while pretending it succeeded.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The package owns the binding of exact snapshot bytes to exact snapshot identities, Git object
identities, normalized paths, and digests:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/git",
  "producedStateRefs": [
    "sothoth.git/commit-snapshot@1",
    "sothoth.git/compare-snapshot@1",
    "sothoth.git/workspace-snapshot@1"
  ],
  "issuedAuthorityRefs": [],
  "emittedObservationRefs": [
    "sothoth.git/git-adapter-diagnostic@1"
  ],
  "effectOwnership": "read-only-source-adapter"
}
```

The repository itself is owned by its external owner. Git never acquires authority over Source
Facts and never creates, stages, or mutates repository bytes.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/git",
  "publicModules": [
    "@sothoth/git/commit",
    "@sothoth/git/compare",
    "@sothoth/git/path",
    "@sothoth/git/process",
    "@sothoth/git/snapshot",
    "@sothoth/git/workspace"
  ],
  "surfaceKind": "pure-functions-only"
}
```

`commit` binds exact commit/tree/blob snapshots for CI, release, and immutable evidence;
`compare` binds exact base/head snapshots; `workspace` binds the explicit HEAD/index/unstaged/
untracked composition for local feedback only; `path` normalizes and rejects unsafe paths;
`process` executes the closed Git allowlist with fixed argument arrays; `snapshot` emits the
digest-bearing snapshot contract. Primary consumers are `@sothoth/sdk` and `@sothoth/cli`
through the SDK; pure domain packages never import Git.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The protocol is byte-shaped: exact snapshot requests in, digest-bearing snapshots and structured
diagnostics out. Canonical identity, digest, diagnostic, and projection vocabulary comes from
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` and `CONTRACT/SOTHOTH/SCHEMAS@1`. The Git adapter is
the only process and repository boundary; those capabilities stop here and are never re-exported
into Core, Graph, or other pure components.

The SDK exposes snapshots through the same contract and never grants a domain package a hidden
path to filesystem, Git, or process capability.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/git` may import only the two foundation packages whose contracts it directly requires:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/git",
  "runtimeImportAllowlist": [
    "@sothoth/contracts",
    "@sothoth/core"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
    "CONTRACT/SOTHOTH/SCHEMAS@1"
  ]
}
```

`runtimeImportAllowlist` is the closed runtime and type-level internal import boundary. Git does
not import Graph, Selectors, Document Index, Governance, Planning, Profile SDK, SDK, CLI, or any
forge API. No pure package may import Git to gain I/O capability.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

Each read is an isolated request/response lifecycle: request modes and paths enter, the adapter
normalizes and budgets them, invokes only the allowlisted Git subcommands, binds every returned
byte to its exact snapshot identity, Git object identity, path, and digest, and returns an
immutable snapshot value. Nothing persists between calls.

Provenance is structurally separated:

```json
{
  "kind": "sothoth-dossier/git-provenance-declaration@1",
  "packageId": "@sothoth/git",
  "workspaceMasqueradesAsCommit": false,
  "provenanceIdentitySeparation": "strict",
  "modes": [
    {
      "mode": "commit",
      "binding": "exact-commit-tree-blob",
      "intendedUse": "ci-release-immutable-evidence"
    },
    {
      "mode": "compare",
      "binding": "exact-base-head",
      "intendedUse": "impact-regression-and-append-only-checks"
    },
    {
      "mode": "workspace",
      "binding": "head-index-unstaged-untracked-composition",
      "intendedUse": "local-feedback-only"
    }
  ],
  "workspaceByteClasses": [
    "head",
    "index",
    "unstaged",
    "untracked"
  ]
}
```

Commit, compare, and workspace provenance use different, non-confusable structured identities.
A dirty workspace snapshot must list every participating byte class and can never be presented
as commit-bound evidence.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited exactly from the accepted governance control plane design: Git snapshots
bind input bytes, and the Git adapter never checks out, stages, commits, tags, or pushes.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `adopts`.

The read-only process boundary is closed:

```json
{
  "kind": "sothoth-dossier/git-process-declaration@1",
  "packageId": "@sothoth/git",
  "executableSubcommands": [
    "diff",
    "ls-tree",
    "rev-parse",
    "show",
    "status"
  ],
  "argumentStyle": "fixed-argument-array",
  "shellInvocation": "forbidden",
  "environmentVariableSemantics": "forbidden",
  "mutationSubcommands": [
    "add",
    "checkout",
    "cherry-pick",
    "clean",
    "clone",
    "commit",
    "config",
    "fetch",
    "merge",
    "pull",
    "push",
    "rebase",
    "reset",
    "rm",
    "stash",
    "switch",
    "tag",
    "worktree"
  ],
  "mutationCapability": "forbidden"
}
```

Every allowed Git invocation uses a fixed argument array for one of the five allowlisted
executable subcommands. No shell is invoked, no command string is concatenated, and no
environment variable changes adapter semantics. All mutation subcommands are rejected before
process creation.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Ambiguous refs, unsafe paths, budget exhaustion, malformed requests, and any disallowed Git
subcommand fail closed with structured diagnostics. Recovery is always the caller supplying an
exact, bounded, normalizable request; the adapter never truncates, guesses, or partially
succeeds.

Path rejection and budget enforcement are closed:

```json
{
  "kind": "sothoth-dossier/git-path-declaration@1",
  "packageId": "@sothoth/git",
  "normalization": "repository-relative-posix",
  "ambiguousRefPolicy": "reject",
  "rejectedPathClasses": [
    "absolute-path",
    "nul-byte",
    "parent-escape",
    "repository-escape",
    "unnormalizable-path"
  ]
}
```

```json
{
  "kind": "sothoth-dossier/git-budget-declaration@1",
  "packageId": "@sothoth/git",
  "enforcedBudgets": [
    "file-count",
    "per-file-byte",
    "process-output",
    "total-byte"
  ],
  "exhaustionPolicy": "fail-closed",
  "truncationPolicy": "forbidden"
}
```

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/git",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-diagnostic-code"
}
```

Snapshot members, paths, and diagnostics are ordered by canonical identity and then diagnostic
code in Unicode code-point order. Identical requests yield identical bytes; over-budget requests
never yield truncated bytes with a success verdict.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The package emits exactly one observation identity, `sothoth.git/git-adapter-diagnostic@1`,
under the Structured Diagnostic vocabulary of `@sothoth/contracts` and the aggregation contract of
`@sothoth/core`. It keeps no logs, counters, or telemetry of its own.

Every returned snapshot records exact snapshot identity, Git object identity, normalized path,
and digest, so an auditor can re-derive which bytes were read and prove they were not edited.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package — compiled ESM, declarations, explicit exports map,
Apache-2.0 inclusion, clean CI publication — with runtime dependencies exactly
`@sothoth/contracts` and `@sothoth/core`.

The package is configured only by explicit request arguments: budgets, mode, exact refs, and
paths. No environment variable, config file, daemon, or service exists, and Git discovery and
invocation remain strictly bounded by the process declaration.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1`, identical exact requests yield the same
snapshot bytes, provenance identities, digests, and diagnostics. Any change to allowlisted
subcommands, budget semantics, path rejection, or provenance identity shape is a new contract
revision that consumers reference explicitly.

Migration is re-reference: a consumer moves to a successor snapshot contract revision by editing
its exact required-contract reference. No shims, deprecated modes, or dual Git invocation paths
are shipped.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

A developer consuming snapshots gets a narrow, predictable surface: choose an explicit mode,
receive bound bytes with provenance and digest, or receive a precise diagnostic for an unsafe or
unbounded request. The deliberate sharp edge is that workspace bytes can only be local feedback
and never become commit-bound evidence.

Operators see CI, release, and local review flows with the same read-only adapter, and can prove
no Sothoth invocation mutated a repository.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/git",
  "criteria": [
    {
      "criterionId": "git-command-allowlist-closure",
      "sectionId": "authority-security-and-effects"
    },
    {
      "criterionId": "git-no-mutation-boundary",
      "sectionId": "authority-security-and-effects"
    },
    {
      "criterionId": "git-path-and-ref-fail-closed",
      "sectionId": "failure-recovery-and-consistency"
    },
    {
      "criterionId": "git-provenance-separation",
      "sectionId": "state-lifecycle-and-data-flow"
    },
    {
      "criterionId": "git-snapshot-budget-fail-closed",
      "sectionId": "failure-recovery-and-consistency"
    }
  ]
}
```

`git-command-allowlist-closure` requires process-call fixtures proving only `diff`, `ls-tree`,
`rev-parse`, `show`, and `status` execute, always through fixed argument arrays.
`git-no-mutation-boundary` requires dependency and invocation scans plus fixtures proving every
listed mutation subcommand is rejected before execution. `git-path-and-ref-fail-closed` requires
fixtures for absolute paths, `..` escape, repository escape, NUL, unnormalizable paths, and
ambiguous refs. `git-provenance-separation` requires fixtures proving commit/compare/workspace
provenance identities are distinct and non-confusable. `git-snapshot-budget-fail-closed` requires
fixtures proving file-count, per-file-byte, total-byte, and process-output exhaustion fail
closed without truncation.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Future snapshot contract revisions may add new read-only bindings or forge adapters as separate
packages, always preserving exact provenance, path fail-closed behavior, budget enforcement, and
the no-mutation boundary. No future revision will add Git mutation, shell invocation,
environment-variable semantics, or floating ref resolution.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, and `documents-and-selectors`; to
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` consumed directly from `@sothoth/core`; to
`CONTRACT/SOTHOTH/SCHEMAS@1` consumed directly from `@sothoth/contracts`; and to the catalog
candidate `@sothoth/git` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-GIT-DOSSIER@1` bound to
`DOC-SOTHOTH-GIT-DOSSIER@1`, providing `CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1` and requiring
`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1` and `CONTRACT/SOTHOTH/SCHEMAS@1`. Every reference
uses the exact grammar `<identity>@<positive integer revision>`; paths, bare names, and `latest`
are forbidden.

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
inherited exactly from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` section
`authority-boundary` with applicability `adopts`; the read-only repository observation boundary
is declared in that section.
