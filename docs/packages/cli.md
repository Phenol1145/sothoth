# `@project-sothoth/cli` package reference

| | |
|---|---|
| Package | `@project-sothoth/cli` |
| Version | `0.1.0` |
| Layer | Operator command-line adapter |
| License | Apache-2.0 |
| Source | `packages/cli` |
| Dossier | [`docs/design/dossiers/cli.md`](../design/dossiers/cli.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4` |

## Responsibilities

One adapter: turn explicit command-line input into exactly one facade composition, render the resulting machine document to stdout (or an explicitly named output path, written atomically), narrate operationally to stderr, and exit `0`–`4` according to the frozen outcome-to-exit mapping. It owns process I/O so no library package has to.

## Non-goals

The adapter fence: no domain semantics, no second implementation of any operation (everything composes `@project-sothoth/sdk`), no implicit output, no ambient configuration, and no interpretation of results beyond the frozen exit mapping.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/cli.md) (`surfaceKind: explicit-command-surface`). No root export exists: the bare specifier `@project-sothoth/cli` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./commands` | `dist/main.js` | `dist/main.d.ts` |
| `./exit` | `dist/io.js` | `dist/io.d.ts` |
| `./input` | `dist/args.js` | `dist/args.d.ts` |
| `./render` | `dist/render-json.js` | `dist/render-json.d.ts` |
| `./write` | `dist/io.js` | `dist/io.d.ts` |

## Dependency direction

Depends only on `@project-sothoth/sdk@0.1.0` (which transitively provides the whole workspace). The CLI imports no other Sothoth package directly.

## Inputs and outputs

Inputs are explicit argv: exactly one of the eight commands (`check`, `compile governance`, `compile planning`, `change-plan`, `index`, `select`, `explain`, `verify-projection`), a required `--format <json|sarif|terminal>`, an optional `--input <path>` (default stdin), and an optional `--output <path>` (default stdout, written atomically). Outputs are one machine document per invocation (`sothoth.cli/cli-invocation-result@1`) plus terminal narration on stderr.

## Minimal usage

```ts
import { parseCliArgumentsV1, CLI_HELP_TEXT_V1 } from "@project-sothoth/cli/input";

const input = parseCliArgumentsV1(["check", "--format", "json"]);
```

From the repository (before publication):

```sh
node packages/cli/dist/main.js --help
```

## Failure and fail-closed behavior

Every failure to name a command or a format is reported as the `input` command in JSON on stdout — the only fail-closed reporting default — with exit code `2`. Unknown options produce `sothoth.input/unknown-option`. Output written to a path is atomic; stdout carries exactly one document. The outcome-to-exit mapping (`CLI_EXIT_CODES_V1`) is frozen at `0`–`4`.

## Limitations

`0.1.0` ships the eight commands above only; there is no interactive mode and no plugin surface.

## Related documents

- [CLI Dossier](../design/dossiers/cli.md)
- [Architecture](../../ARCHITECTURE.md) — operator adapter
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/sdk`](sdk.md), [`@project-sothoth/governance`](governance.md), [`@project-sothoth/document-index`](document-index.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/cli

Operator-facing command-line composition and I/O adapter for Sothoth: eight explicit commands over the public SDK facade with a frozen exit mapping and atomic explicit output. One machine document per invocation (`sothoth.cli/cli-invocation-result@1`); every input failure is still a JSON document on stdout with exit code 2.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Commands (exactly eight)

`check` · `compile governance` · `compile planning` · `change-plan` · `index` · `select` · `explain` · `verify-projection`

Options: `--format <json|sarif|terminal>` (required), `--input <path>` (default stdin), `--output <path>` (default stdout; atomic).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./commands` | `dist/main.js` | `dist/main.d.ts` |
| `./exit` | `dist/io.js` | `dist/io.d.ts` |
| `./input` | `dist/args.js` | `dist/args.d.ts` |
| `./render` | `dist/render-json.js` | `dist/render-json.d.ts` |
| `./write` | `dist/io.js` | `dist/io.d.ts` |

There is no root export: the bare specifier `@project-sothoth/cli` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```sh
sothoth check --format json --input request.json
```

From this repository before publication: `node packages/cli/dist/main.js --help`. Full reference documentation lives at `docs/packages/cli.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/cli`.
<!-- sothoth-package-readme:end -->
