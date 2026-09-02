# @sothoth/cli Artifact Design Dossier

Status: proposed design fact, pending external acceptance

Document identity: `DOC-SOTHOTH-CLI-DOSSIER` revision `1`

Design identity: `SOTHOTH-CLI-DOSSIER` revision `1`

Component: `@sothoth/cli`, candidate of `SOTHOTH-DESIGN-SCOPE-0.1` with `designRequirement: full`

This Dossier closes the pre-design facts for the command-line interface of Sothoth `0.1.0` under
the Dossier Document Contract `sothoth.design-dossier/full/v1`. It authorizes no implementation:
`packages/cli/src/**` stays empty until accepted Dossiers, an accepted Architecture Baseline, and a
mechanically admissible Scope BOM admit implementation at all.

<!-- sothoth:section id="decision-summary" -->

## Decision summary

`@sothoth/cli` is the operator-facing composition and I/O adapter. It parses explicit CLI input,
composes the public SDK facade, renders results, writes explicit output paths atomically, keeps
machine output and operational narration on separate streams, and maps public outcomes to process
exits `0`–`4`. It consumes only `@sothoth/sdk` and provides `CONTRACT/SOTHOTH/CLI-IO@1`.

The CLI owns no compilation semantics, no domain truth, and no acceptance. It performs no arbitrary
process execution, runs no Evidence checks, scans no repository or filesystem implicitly, consults
no environment-variable semantics, offers no hidden command, and imports no Core, contracts, or
domain package directly — the facade is its only internal dependency.

<!-- sothoth:section id="artifact-identity-and-classification" -->

## Artifact identity and classification

The artifact is the npm package `@sothoth/cli`, classified as a command-line composition and I/O
adapter. Its design identity is `SOTHOTH-CLI-DOSSIER@1`, its document identity is
`DOC-SOTHOTH-CLI-DOSSIER@1`, and it sits at the top of the internal dependency DAG with exactly one
internal dependency: `@sothoth/sdk`.

It ships a `sothoth` executable plus compiled ESM and declarations with an explicit exports map. It
owns no release membership and no domain content; it only adapts the facade to a terminal process.

<!-- sothoth:section id="purpose-and-non-goals" -->

## Purpose and non-goals

The purpose is one adapter: turn explicit command-line input into exactly one facade composition,
render the resulting machine document to stdout (or an explicitly named output path, written
atomically), narrate operationally to stderr, and exit `0`–`4` according to the frozen
outcome-to-exit mapping.

The non-goals are the adapter fence:

```json
{
  "kind": "sothoth-dossier/forbidden-capability-declaration@1",
  "packageId": "@sothoth/cli",
  "capabilityClasses": {
    "arbitrary-command-execution": "forbidden",
    "direct-domain-package-import": "forbidden",
    "environment-variable-semantics": "forbidden",
    "evidence-check-execution": "forbidden",
    "external-test-runner-invocation": "forbidden",
    "filesystem-scan": "forbidden",
    "git-mutation": "forbidden",
    "hidden-command": "forbidden",
    "implicit-default-profile": "forbidden",
    "implicit-repository-scan": "forbidden",
    "network-request": "forbidden",
    "private-core-escape-hatch": "forbidden",
    "shell-or-javascript-entrypoint": "forbidden",
    "staged-generated-files": "forbidden",
    "undocumented-command": "forbidden"
  }
}
```

In practice: the CLI never executes arbitrary commands or external test runners, never runs
Evidence checks itself, never scans a repository or filesystem to guess inputs, never reads
environment variables as semantics, never applies an implicit default profile, never performs
network requests, never offers a hidden or undocumented command, never exposes a shell or
JavaScript entrypoint that bypasses the declared command surface, never stages generated files into
the repository, and never imports Core, contracts, or a domain package directly.

<!-- sothoth:section id="responsibility-and-truth-ownership" -->

## Responsibility and truth ownership

The CLI owns the correctness of its adapter boundary: input parsing, facade composition, rendering,
atomic explicit writes, stream discipline, and exit mapping. It owns nothing the facade returns:

```json
{
  "kind": "sothoth-dossier/truth-ownership-declaration@1",
  "packageId": "@sothoth/cli",
  "producedStateRefs": [
    "sothoth.cli/cli-invocation-result@1"
  ],
  "issuedAuthorityRefs": [],
  "emittedObservationRefs": [],
  "ownsDomainTruth": false,
  "ownsCompilationSemantics": false,
  "ownsAcceptance": false,
  "effectOwnership": "composition-and-io-adapter"
}
```

`sothoth.cli/cli-invocation-result@1` is the invocation record — command, parsed explicit inputs,
rendered document, chosen streams, and exit code — and nothing else. Every domain truth inside it
belongs to the owning package through `sothoth.sdk/facade-result@1`; the CLI never re-issues,
reinterprets, or accepts it, and it issues no authority of any kind.

<!-- sothoth:section id="public-surface-and-consumers" -->

## Public surface and consumers

```json
{
  "kind": "sothoth-dossier/public-surface-declaration@1",
  "packageId": "@sothoth/cli",
  "publicModules": [
    "@sothoth/cli/commands",
    "@sothoth/cli/exit",
    "@sothoth/cli/input",
    "@sothoth/cli/render",
    "@sothoth/cli/write"
  ],
  "surfaceKind": "explicit-command-surface"
}
```

`input` parses explicit argv flags and path arguments; `commands` binds the eight documented
commands to facade compositions; `render` renders machine documents; `write` performs atomic
explicit output; `exit` applies the frozen outcome-to-exit mapping. The executable surface is the
closed command set:

```json
{
  "kind": "sothoth-dossier/cli-command-declaration@1",
  "packageId": "@sothoth/cli",
  "surfaceKind": "explicit-command-surface",
  "commands": [
    "change-plan",
    "check",
    "compile governance",
    "compile planning",
    "explain",
    "index",
    "select",
    "verify-projection"
  ],
  "hiddenCommands": [],
  "unknownCommandOutcome": "invalid-input"
}
```

The public surface is exactly these eight commands and nothing else: `check` runs pre-design
checks; `compile governance` and `compile planning` compile the respective projections;
`change-plan` projects a change plan; `index` compiles the document index; `select` resolves
selectors; `explain` explains selector evaluation; `verify-projection` verifies a projection.
`hiddenCommands` is empty — an undocumented or hidden command is a defect — and an unknown command
fails closed as `invalid-input`. Consumers are human operators and automation driving the
executable; programmatic consumers use `@sothoth/sdk` instead.

<!-- sothoth:section id="core-sdk-protocol-boundary" -->

## Core, SDK, and protocol boundary

The CLI consumes `CONTRACT/SOTHOTH/PUBLIC-SDK@1` and nothing else. Typed result and rendering
vocabulary reaches the CLI through the public facade rather than an internal package import, so no
separate `SCHEMAS@1` edge exists. Input is explicit and closed:

```json
{
  "kind": "sothoth-dossier/cli-input-declaration@1",
  "packageId": "@sothoth/cli",
  "explicitInputSources": [
    "argv-flags",
    "explicit-path-arguments"
  ],
  "implicitScanning": "forbidden",
  "environmentVariableSemantics": "forbidden",
  "implicitDefaultProfile": "forbidden"
}
```

Every input is an argv flag or an explicitly named path argument. The CLI never scans the
repository or filesystem for inputs, never reads environment variables as semantics, and never
applies an implicit default profile; anything not explicitly supplied is missing and fails closed.

The CLI is the sole owner of the outcome-to-exit mapping:

```json
{
  "kind": "sothoth-dossier/cli-exit-declaration@1",
  "packageId": "@sothoth/cli",
  "exitMap": {
    "0": "valid",
    "1": "invalid",
    "2": "invalid-input",
    "3": "extension-error",
    "4": "internal-error"
  },
  "ownsExitCodeMapping": true,
  "extensionExitOverride": "forbidden"
}
```

`valid` exits `0`; `invalid` exits `1`; `invalid-input` exits `2`; `extension-error` exits `3`;
`internal-error` exits `4`. The mapping is closed — no other exit code exists — and no extension
can override it, because the SDK never selects the exit and the CLI applies this table alone.

<!-- sothoth:section id="dependency-and-topology" -->

## Dependency and topology

`@sothoth/cli` may import exactly one internal package:

```json
{
  "kind": "sothoth-dossier/dependency-declaration@1",
  "packageId": "@sothoth/cli",
  "runtimeImportAllowlist": [
    "@sothoth/sdk"
  ],
  "providedContracts": [
    "CONTRACT/SOTHOTH/CLI-IO@1"
  ],
  "requiredContracts": [
    "CONTRACT/SOTHOTH/PUBLIC-SDK@1"
  ]
}
```

`runtimeImportAllowlist` is the closed runtime and type-level internal import boundary. The CLI
does not import `@sothoth/core`, `@sothoth/contracts`, or any domain package, and it obtains no
contract, type, or semantics through re-exports or transitive acquisition: everything flows through
`CONTRACT/SOTHOTH/PUBLIC-SDK@1`.

<!-- sothoth:section id="state-lifecycle-and-data-flow" -->

## State lifecycle and data flow

An invocation is the only lifecycle: parse explicit input, compose the facade once, render exactly
one machine document, write any explicit output path atomically, and exit. Nothing persists
between invocations — no cache, no daemon, no state files — and the working repository is never
staged or modified.

Explicit output is written atomically, and generated bytes are never staged:

```json
{
  "kind": "sothoth-dossier/cli-output-declaration@1",
  "packageId": "@sothoth/cli",
  "defaultOutput": "stdout",
  "writeStrategy": "same-directory-temp-then-replace",
  "atomicExplicitWrites": true,
  "partialTargetFiles": "forbidden",
  "unwritableDestinationOutcome": "invalid-input",
  "unwritableDestinationDiagnostic": "sothoth.pre-design/output-unwritable",
  "stagedGeneratedFiles": "forbidden"
}
```

Default output is stdout. An explicit output path is written by creating a temporary file in the
same directory and replacing the target in one step, so a failed write can never leave a partial
target. A destination that cannot be written is invalid configuration of the invocation itself: the
result is `invalid-input` carrying the established `sothoth.pre-design/output-unwritable`
diagnostic, exiting `2`, with no prior valid/invalid result emitted and no partial file left
behind.

<!-- sothoth:section id="authority-security-and-effects" -->

## Authority, security, and effects

This topic is inherited from the accepted governance control plane design and specialized for this
component: the diagnostics-and-process-outcome authority of the control plane is specialized into
the concrete terminal contract — the frozen exit table, the single-document stdout discipline, and
atomic explicit writes declared in this Dossier.

Inherited from `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2`, section `authority-boundary`,
applicability `specializes`.

The specialization adds no authority: the CLI issues none, accepts nothing, executes no evidence,
no arbitrary process, and no network request, and its only effects are writing explicitly named
output paths and emitting its two streams. Every semantic effect belongs to the facade-delegated
owner.

<!-- sothoth:section id="failure-recovery-and-consistency" -->

## Failure, recovery, and consistency

Unknown commands, malformed flags, and missing explicit values fail closed as `invalid-input`.
Facade-reported `invalid` results exit `1` with the diagnostics rendered in the failure envelope;
`extension-error` exits `3`; unexpected internal failures exit `4`. Recovery is always the operator
editing the explicit input and re-running; the CLI never retries, repairs, defaults, or guesses.

```json
{
  "kind": "sothoth-dossier/determinism-declaration@1",
  "packageId": "@sothoth/cli",
  "byteStableOutputs": true,
  "stringOrdering": "unicode-code-point",
  "tieBreaking": "canonical-identity-then-diagnostic-code"
}
```

Identical invocations over identical inputs produce byte-identical stdout documents, output files,
and exit codes, with string ordering by Unicode code point and tie-breaking by canonical identity
then diagnostic code. An interrupted atomic write leaves either the previous target or no target —
never a partial document. Concurrency is safe by construction: invocations share no mutable state.

<!-- sothoth:section id="observation-and-audit" -->

## Observation and audit

The machine result of an invocation is observed as exactly one document on stdout:

```json
{
  "kind": "sothoth-dossier/cli-stream-declaration@1",
  "packageId": "@sothoth/cli",
  "stdoutContract": "exactly-one-machine-document",
  "stdoutContamination": "forbidden",
  "operationalNarration": "stderr-only"
}
```

Machine JSON/SARIF output is the single, uncontaminated stdout document — no banners, progress
lines, warnings, or any other bytes precede or follow it. Operational narration belongs on stderr
only. Every invocation is reconstructible: the command, explicit inputs, and rendered document are
recorded in `sothoth.cli/cli-invocation-result@1`, so an auditor can re-run and diff bytes and exit
codes. The CLI keeps no logs, counters, or telemetry of its own.

<!-- sothoth:section id="deployment-configuration-and-operations" -->

## Deployment, configuration, and operations

Deployment is one reproducible npm package shipping the `sothoth` executable — compiled ESM,
declarations, explicit exports map, Apache-2.0 inclusion, clean CI publication — with the single
runtime dependency `@sothoth/sdk`.

Operation is the eight documented commands plus explicit flags and paths. No environment variable
or configuration file is consulted, no daemon exists, and no implicit scan runs at startup.
"Operations" means running a documented command against explicit inputs and reading one machine
document.

<!-- sothoth:section id="compatibility-and-migration" -->

## Compatibility and migration

Within `CONTRACT/SOTHOTH/CLI-IO@1`, identical invocations yield identical stdout documents, output
files, and exit codes. Adding a command or flag is additive; changing the command set, the exit
table, the stream contract, or the atomic-write semantics is a new CLI-IO contract revision that
callers reference explicitly.

Migration is re-reference: automation moves to a successor revision by updating its explicit
command invocation. No shims, deprecated aliases, or automatic rewrites are shipped, and no exit
code is ever repurposed.

<!-- sothoth:section id="developer-and-operator-experience" -->

## Developer and operator experience

An operator gets eight documented commands with strict flags, one predictable machine document per
run, narration kept out of the machine channel, and exit codes that always mean the same thing.
The deliberate sharp edges are that nothing is guessed — no implicit scan, no default profile, no
environment semantics — and that stdout must stay parseable, so operational detail is never mixed
into the machine document.

Automation authors consume `@sothoth/sdk` directly; the CLI is for terminals and shell
composition, and it refuses to become a scripting runtime, a shell, or a hidden-commands backdoor.

<!-- sothoth:section id="verification-and-acceptance-criteria" -->

## Verification and acceptance criteria

```json
{
  "kind": "sothoth-dossier/verification-criteria@1",
  "packageId": "@sothoth/cli",
  "criteria": [
    {
      "criterionId": "cli-atomic-explicit-output",
      "sectionId": "state-lifecycle-and-data-flow"
    },
    {
      "criterionId": "cli-command-surface-closure",
      "sectionId": "public-surface-and-consumers"
    },
    {
      "criterionId": "cli-exit-mapping-frozen",
      "sectionId": "core-sdk-protocol-boundary"
    },
    {
      "criterionId": "cli-sdk-only-import-boundary",
      "sectionId": "dependency-and-topology"
    },
    {
      "criterionId": "cli-stdout-single-document",
      "sectionId": "observation-and-audit"
    }
  ]
}
```

`cli-command-surface-closure` requires command-surface scans proving exactly the eight documented
commands with no hidden or undocumented command and unknown commands failing closed.
`cli-exit-mapping-frozen` requires fixtures driving all five outcomes and asserting exits
`0`–`4` exclusively, including that extensions cannot override the mapping. `cli-stdout-single-document`
requires stdout captures proving exactly one uncontaminated machine document with narration on
stderr. `cli-atomic-explicit-output` requires write-failure fixtures proving same-directory
temp-then-replace, no partial target, and the `invalid-input`/exit-2 unwritable-destination
behavior with the established output-unwritable diagnostic. `cli-sdk-only-import-boundary` requires
dependency scans proving the only internal import is `@sothoth/sdk`.

<!-- sothoth:section id="future-capability-compatibility" -->

## Future capability compatibility

Future CLI-IO revisions may add documented commands, flags, and rendering formats, always
preserving explicit input, atomic explicit writes, the single-document stdout contract, and the
frozen exit mapping. No future revision will acquire compilation semantics, domain truth,
acceptance authority, arbitrary process execution, Evidence execution, implicit scanning,
environment-variable semantics, hidden commands, direct Core/contracts/domain imports, or staged
generated files.

<!-- sothoth:section id="traceability-and-exact-references" -->

## Traceability and exact references

This Dossier traces to `DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN@2` sections `decision`,
`authority-boundary`, `package-architecture`, `diagnostics-and-process-outcomes`, and
`release-boundary`; to `CONTRACT/SOTHOTH/PUBLIC-SDK@1` consumed directly from `@sothoth/sdk`; and
to the catalog candidate `@sothoth/cli` in `SOTHOTH-DESIGN-SCOPE-0.1@1`.

The registration for this component is `SOTHOTH-CLI-DOSSIER@1` bound to
`DOC-SOTHOTH-CLI-DOSSIER@1`, providing `CONTRACT/SOTHOTH/CLI-IO@1` and requiring only
`CONTRACT/SOTHOTH/PUBLIC-SDK@1`. Every reference uses the exact grammar
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
applicability `specializes`; the terminal I/O specialization of the control-plane outcome
authority is declared in that section.
