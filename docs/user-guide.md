# Sothoth User Guide

Sothoth is a deterministic governance control plane that a human can place inside an agent workflow. The human owns intent, Source Facts, acceptance, and external authority. The agent prepares explicit requests and reports evidence. Sothoth validates or compiles without inventing facts or making decisions on the human's behalf.

Start with the [Quick Start](quick-start.md) if you have not yet run the CLI.

## The collaboration contract

| Participant | Owns | Must not be treated as owning |
|---|---|---|
| Human | Objective, scope, authoritative inputs, acceptance metadata, edit/commit/release authorization | Mechanical validation or deterministic projection generation |
| Agent | Input assembly, command selection, bounded execution, evidence reporting | Acceptance, unstated paths, hidden defaults, credentials, release authority |
| Sothoth | Contract validation, deterministic compilation, Structured Diagnostics, digest-bearing projections | Source Fact repair, approval, implicit discovery, repository mutation |

A green result means the supplied facts satisfy the selected contract. It is not approval to change those facts or to move into another lifecycle phase.

## Install and choose an interface

For agent-operated command-line use:

```sh
npm install --save-dev @project-sothoth/cli@0.1.0
npx sothoth --help
```

For TypeScript integration:

```sh
npm install @project-sothoth/sdk@0.1.0
```

Both commands contact npm and change local dependency state. An agent needs the human's authorization before running them. In a Sothoth repository checkout with dependencies already present, build once and invoke `node packages/cli/dist/main.js`; do not install a second copy merely for convenience.

## Define the task before invoking an agent

A useful request names:

1. **Objective:** what should be checked or compiled.
2. **Version:** use `0.1.0` unless the project has deliberately selected another version.
3. **Inputs:** exact files or exact JSON values; do not say “find the relevant files.”
4. **Outputs:** stdout or an exact writable path.
5. **Allowed mutations:** usually none for validation; list exact paths if edits are allowed.
6. **Stop conditions:** missing facts, mismatched identities, invalid input, or a request for human acceptance.
7. **Report shape:** command, inputs, output, outcome, exit code, diagnostic codes, and unresolved decisions.

Reusable prompt:

> Use Sothoth 0.1.0 to `<operation>` using only `<input paths>`. Write `<format>` to `<output path or stdout>`. You may modify only `<authorized paths or none>`. Do not infer missing Source Facts, acceptance, credentials, or release authority. Stop on identity or revision mismatches. Report the exact command, inputs, outcome, exit code, diagnostics, output location, and decisions that still belong to me.

## Choose one CLI command

Every invocation selects exactly one command and requires `--format json`, `--format sarif`, or `--format terminal`.

| Command | Use it for | Required request values |
|---|---|---|
| `check` | Design Closure validation | `contract`, `catalog`, `registry`, `registrations`, exact document bytes in `documents`, and `documentIndex` |
| `compile governance` | Scope BOM Admissibility | Every `check` value plus `architectureBaseline` and `scopeBom` |
| `compile planning` | Dependency-wave scheduling | `tasks`; optional `activeDimensions` and `budgets` |
| `change-plan` | Non-authoritative impact and ordering plan | `documentIndex`, `roleMapping`, exactly one of `changedArtifactIds` or `selector`; optional `evidenceBindings` |
| `index` | Deterministic CommonMark structural index | `sources`, `budgets`, and `compiler`; optional `cache` |
| `select` | Resolve a selector over an index | `documentIndex`, `selector`; optional `budgets` |
| `explain` | Resolve the same selector and retain its evaluation trace | `documentIndex`, `selector`; optional `budgets` |
| `verify-projection` | Recompute a projection's self-digest | `document` and the string name `digestField` |

The detailed request field guide and working examples are in the [agent command guide](../skills/using-sothoth/references/command-guide.md). The authoritative public surfaces remain the [package references](packages/contracts.md).

## CLI input and output

Use a named input when reproducibility matters:

```sh
npx sothoth check --format json --input ./sothoth-input/closure.json
```

Use an explicit output path when another tool will consume the result:

```sh
npx sothoth check \
  --format json \
  --input ./sothoth-input/closure.json \
  --output ./sothoth-output/closure.json
```

The CLI never treats a positional path as an input root, scans a directory, or reads semantic settings from environment variables. A missing `--input` means “read exactly one JSON request from stdin.” A missing `--output` means “write exactly one complete result document to stdout.” Named output is written atomically.

Choose formats by consumer:

- `json`: machine-readable result envelope and the default for agent reasoning.
- `sarif`: diagnostics for SARIF-compatible review and CI systems.
- `terminal`: short human summary on stdout and diagnostics on stderr.

## Interpret outcomes and exit codes

| Outcome | Exit | Meaning | Human–agent response |
|---|---:|---|---|
| `valid` | 0 | Supplied facts satisfy the selected operation | Preserve the output as evidence; ask the human before any new phase or mutation |
| `invalid` | 1 | Facts are well-formed but violate a rule or digest | Report diagnostics and the exact failing facts; do not weaken the rule |
| `invalid-input` | 2 | Request, path, JSON, or fact shape is invalid | Correct only authorized inputs; do not invent missing values |
| `extension-error` | 3 | An explicitly selected extension failed | Stop and report the extension evidence; do not substitute another extension |
| `internal-error` | 4 | Sothoth could not complete the operation safely | Preserve inputs and stderr, stop, and diagnose before retrying |

Machine formats keep diagnostics inside the single output document. An agent should report diagnostic `code`, `subjects`, `causes`, and `help` without translating them into a different verdict.

## Common collaboration workflows

### Validate a design change

1. The human identifies the exact proposed documents and the accepted contract, catalog, registry, and registrations they must be checked against.
2. The agent builds a document index from those exact bytes with `index`.
3. The agent assembles the full Design Closure request and runs `check`.
4. The agent reports the projection and diagnostics. It does not write `acceptedBy`, `acceptedAt`, or a replacement Source Fact.
5. If the human accepts a revision and authorizes the exact edits, the agent may perform that separate task and rerun the affected checks.

### Check release-scope admissibility

Run `compile governance` only after the human identifies the exact accepted Architecture Baseline and formal Scope BOM. A valid result means the supplied release membership resolves against the supplied accepted facts. It is neither publication authorization nor live registry evidence.

### Plan implementation order

Use `compile planning` for dependency constraints. Sothoth 0.1.0 implements the `dependency` dimension only. Unsupported dimensions fail closed rather than being ignored.

### Analyze document impact

Build or receive a Document Index, supply a versioned relation-role mapping, and run `change-plan`. The result is non-authoritative: `impact` expands review scope but does not create ordering, and the compiler applies no edits.

### Find and explain documents

Use `select` when only matches are needed and `explain` when the agent must show why each document was admitted or rejected. Selectors operate only on the supplied Document Index; they do not search the filesystem.

### Verify a projection digest

Use `verify-projection` with the complete projection and its self-digest field, such as `indexDigest`. Verification proves only that the digest matches the supplied projection bytes; it does not prove provenance, acceptance, freshness, or publication.

## Use the TypeScript SDK

There is no bare `@project-sothoth/sdk` export. Import from an accepted subpath:

```ts
import { createSothothV1 } from "@project-sothoth/sdk/compile";

const sothoth = createSothothV1();
const result = sothoth.compile.planning({
  tasks: [
    { taskId: "design", dependsOn: [] },
    { taskId: "implement", dependsOn: ["design"] },
    { taskId: "verify", dependsOn: ["implement"] },
  ],
});

if (result.outcome !== "valid") {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic.code, diagnostic.subjects);
  }
}
```

The SDK returns `sothoth.sdk/facade-result@1` envelopes and never selects a process exit code. Use the CLI when you need the frozen exit mapping or atomic file output. See the [SDK package reference](packages/sdk.md) for all eight public subpaths.

## Evidence and authority boundaries

Keep these distinctions explicit in every agent report:

- A Dossier, registry, registration, Architecture Baseline, or Scope BOM is a Source Fact; a checker does not repair or accept it.
- A closure, schedule, index, change plan, or admissibility result is a projection; it is evidence, not authority.
- A clean test run proves the tested checkout, not a live registry, remote branch, deployment, or release.
- Readiness for acceptance is not acceptance. Admissibility is not release approval. A matching digest is not provenance.
- Credentials and human authentication remain human-only. Never paste tokens, OTPs, recovery codes, or replacement credentials into an agent conversation.

## Troubleshooting

**The agent cannot find `sothoth`.** Decide whether dependency installation is authorized. If not, provide an existing executable or stop. Do not silently use a different version.

**The CLI reports an unknown command or option.** Run `sothoth --help` and use the exact eight-command surface. There are no hidden discovery, status, profile, Git, or release commands.

**Input is rejected.** Check that the request is one JSON object with the exact closed field set. Use diagnostics to locate the field; do not add fallback fields or coerce unknown values.

**Output cannot be written.** Create or authorize the parent directory and retry the same operation. Sothoth leaves no partial target when atomic output fails.

**A valid result conflicts with the expected decision.** Recheck that the exact intended Source Facts, revisions, document bytes, and rule mapping were supplied. Do not reinterpret `valid` as permission to change the governing facts.

**A run asks for network access or credentials.** Core Sothoth operations need neither. Stop and separate dependency installation, registry verification, publication, or another external workflow into its own explicitly authorized task.

## Reference map

- [Quick Start](quick-start.md)
- [`using-sothoth` agent skill](../skills/using-sothoth/SKILL.md)
- [Architecture](../ARCHITECTURE.md)
- [CLI package reference](packages/cli.md)
- [SDK package reference](packages/sdk.md)
- [0.1.0 release notes](release/v0.1.0-release-notes.md)
