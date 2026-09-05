# `@project-sothoth/sdk` package reference

| | |
|---|---|
| Package | `@project-sothoth/sdk` |
| Version | `0.1.0` |
| Layer | Aggregate public library facade |
| License | Apache-2.0 |
| Source | `packages/sdk` |
| Dossier | [`docs/design/dossiers/sdk.md`](../design/dossiers/sdk.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@3` |

## Responsibilities

One facade: give library consumers a single typed entry point that composes the public capabilities of `@project-sothoth/governance`, `@project-sothoth/planning`, `@project-sothoth/document-index`, `@project-sothoth/git`, `@project-sothoth/profile-sdk`, and `@project-sothoth/selectors` over the `@project-sothoth/contracts`/`@project-sothoth/core` foundation, returning closed typed outcomes with Structured Diagnostics and never choosing process exits.

## Non-goals

The facade fence: no domain truth of its own, no second implementation of anything, no generic graph wrapper, no exit-code authority, and no I/O beyond delegating to the owning packages. Every semantic operation delegates to exactly one owning package.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/sdk.md) (`surfaceKind: typed-outcome-library-facade`). No root export exists: the bare specifier `@project-sothoth/sdk` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./change-plan` | `dist/index.js` | `dist/index.d.ts` |
| `./check` | `dist/index.js` | `dist/index.d.ts` |
| `./compile` | `dist/index.js` | `dist/index.d.ts` |
| `./diagnostics` | `dist/index.js` | `dist/index.d.ts` |
| `./documents` | `dist/index.js` | `dist/index.d.ts` |
| `./git` | `dist/index.js` | `dist/index.d.ts` |
| `./profiles` | `dist/index.js` | `dist/index.d.ts` |
| `./verify` | `dist/index.js` | `dist/index.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0`, `@project-sothoth/core@0.1.0`, `@project-sothoth/document-index@0.1.0`, `@project-sothoth/git@0.1.0`, `@project-sothoth/governance@0.1.0`, `@project-sothoth/planning@0.1.0`, `@project-sothoth/profile-sdk@0.1.0`, and `@project-sothoth/selectors@0.1.0`.

## Inputs and outputs

Inputs are the same fact shapes the owning packages accept (`unknown` at the boundary, validated downstream). Outputs are `SothothFacadeResultV1<T>` documents: outcome, exit-code hint (never enforced here), diagnostics, and the delegated result.

## Minimal usage

```ts
import { createSothothV1 } from "@project-sothoth/sdk/compile";
import { checkDesignClosure } from "@project-sothoth/sdk/check";
import { buildDocumentIndex } from "@project-sothoth/sdk/documents";

const sothoth = createSothothV1();
const closure = checkDesignClosure({ /* DesignClosureFactsV1 */ });
const indexed = buildDocumentIndex({ /* DocumentIndexInputV1 */ });
```

## Failure and fail-closed behavior

The facade propagates owning-package outcomes verbatim; it never softens a rejection, never invents a fallback, and never exits the process. The CLI owns the outcome-to-exit mapping.

## Limitations

`0.1.0` exposes the eight facade subpaths above only; there is no root export and no convenience aggregator.

## Related documents

- [SDK Dossier](../design/dossiers/sdk.md)
- [Architecture](../../ARCHITECTURE.md) — facade layer
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/governance`](governance.md), [`@project-sothoth/planning`](planning.md), [`@project-sothoth/cli`](cli.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/sdk

Sole aggregate public library facade for Sothoth: one typed, versioned surface delegating every semantic operation to its owning package — governance, planning, document indexing, Git snapshots, profiles, and selectors over the contracts/core foundation. Returns closed typed outcomes with Structured Diagnostics; never chooses process exits.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./change-plan` | `dist/index.js` | `dist/index.d.ts` |
| `./check` | `dist/index.js` | `dist/index.d.ts` |
| `./compile` | `dist/index.js` | `dist/index.d.ts` |
| `./diagnostics` | `dist/index.js` | `dist/index.d.ts` |
| `./documents` | `dist/index.js` | `dist/index.d.ts` |
| `./git` | `dist/index.js` | `dist/index.d.ts` |
| `./profiles` | `dist/index.js` | `dist/index.d.ts` |
| `./verify` | `dist/index.js` | `dist/index.d.ts` |

There is no root export: the bare specifier `@project-sothoth/sdk` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { createSothothV1 } from "@project-sothoth/sdk/compile";
import { checkDesignClosure } from "@project-sothoth/sdk/check";

const sothoth = createSothothV1();
const closure = checkDesignClosure({ /* DesignClosureFactsV1 */ });
```

The facade never softens a rejection and never exits the process. Full reference documentation lives at `docs/packages/sdk.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/sdk`.
<!-- sothoth-package-readme:end -->
