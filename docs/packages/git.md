# `@project-sothoth/git` package reference

| | |
|---|---|
| Package | `@project-sothoth/git` |
| Version | `0.1.0` |
| Layer | Read-only Git source adapter |
| License | Apache-2.0 |
| Source | `packages/git` |
| Dossier | [`docs/design/dossiers/git.md`](../design/dossiers/git.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4` |

## Responsibilities

One closed read boundary: bind exact commit/tree/blob bytes, exact base/head comparisons, and explicitly composed workspace bytes; normalize repository-relative POSIX paths; and return digest-bearing snapshots for downstream compilers. It is the only Sothoth package that executes Git, and only through the frozen read-only subcommand allowlist.

## Non-goals

The mutation and ambiguity fence: no Git mutation of any kind (add, commit, push, tag, and every other writing subcommand are rejected), no path ambiguity, no ref guessing, no network, and no writes to the repository or working tree.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/git.md) (`surfaceKind: pure-functions-only`). No root export exists: the bare specifier `@project-sothoth/git` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./commit` | `dist/index.js` | `dist/index.d.ts` |
| `./compare` | `dist/index.js` | `dist/index.d.ts` |
| `./path` | `dist/paths.js` | `dist/paths.d.ts` |
| `./process` | `dist/runner.js` | `dist/runner.d.ts` |
| `./snapshot` | `dist/snapshot.js` | `dist/snapshot.d.ts` |
| `./workspace` | `dist/index.js` | `dist/index.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0` and `@project-sothoth/core@0.1.0`.

## Inputs and outputs

Inputs are explicit commit refs, path compositions, and budgeted read requests. Outputs are digest-bearing source snapshots (`GIT_SOURCE_SNAPSHOT_SCHEMA_V1`), normalized paths, and structured findings. Provenance is separated: snapshot facts never masquerade as acceptance.

## Minimal usage

```ts
import { createGitSourceAdapterV1 } from "@project-sothoth/git/commit";

const adapter = createGitSourceAdapterV1({ /* GitSourceAdapterOptionsV1 */ });
```

## Failure and fail-closed behavior

Mutation subcommands are rejected outright; ambiguous paths, unknown refs, and budget overruns fail closed with structured diagnostics. Symlinks escaping the repository are refused.

## Limitations

`0.1.0` reads local repositories only; it never mutates, never contacts a remote, and never guesses a ref or path.

## Related documents

- [Git Dossier](../design/dossiers/git.md)
- [Architecture](../../ARCHITECTURE.md) — adapter boundary
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/contracts`](contracts.md), [`@project-sothoth/core`](core.md), [`@project-sothoth/sdk`](sdk.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/git

Read-only Git source adapter for Sothoth: bind exact commit, compare, and workspace snapshots through a frozen allowlist of read-only subcommands, normalize repository-relative POSIX paths, and return digest-bearing snapshots for downstream compilers. No Git mutation, no network, no path or ref ambiguity.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./commit` | `dist/index.js` | `dist/index.d.ts` |
| `./compare` | `dist/index.js` | `dist/index.d.ts` |
| `./path` | `dist/paths.js` | `dist/paths.d.ts` |
| `./process` | `dist/runner.js` | `dist/runner.d.ts` |
| `./snapshot` | `dist/snapshot.js` | `dist/snapshot.d.ts` |
| `./workspace` | `dist/index.js` | `dist/index.d.ts` |

There is no root export: the bare specifier `@project-sothoth/git` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { createGitSourceAdapterV1 } from "@project-sothoth/git/commit";

const adapter = createGitSourceAdapterV1({ /* GitSourceAdapterOptionsV1 */ });
```

Mutation subcommands and ambiguous paths fail closed. Full reference documentation lives at `docs/packages/git.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/git`.
<!-- sothoth-package-readme:end -->
