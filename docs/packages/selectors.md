# `@project-sothoth/selectors` package reference

| | |
|---|---|
| Package | `@project-sothoth/selectors` |
| Version | `0.1.0` |
| Layer | Selection algebra over indexed documents |
| License | Apache-2.0 |
| Source | `packages/selectors` |
| Dossier | [`docs/design/dossiers/selectors.md`](../design/dossiers/selectors.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4` |

## Responsibilities

One deterministic selection engine: parse a Selector into a canonical AST under a hostile-input budget, match that AST against document-index entries, enforce cardinality constraints, and return a selection result plus an explain trace — ordered by canonical identity regardless of arrival order, with zero matches producing a diagnostic by default rather than a silent empty set.

## Non-goals

The algebra is closed: no user-defined operators, no arbitrary expression evaluation, no script execution, no I/O, and no mutation of the index or the Selector. The package never decides what a match means outside its frozen grammar.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/selectors.md) (`surfaceKind: pure-functions-only`). No root export exists: the bare specifier `@project-sothoth/selectors` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./parse` | `dist/parser.js` | `dist/parser.d.ts` |
| `./ast` | `dist/index.js` | `dist/index.d.ts` |
| `./match` | `dist/evaluate.js` | `dist/evaluate.d.ts` |
| `./cardinality` | `dist/evaluate.js` | `dist/evaluate.d.ts` |
| `./explain` | `dist/evaluate.js` | `dist/evaluate.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0`, `@project-sothoth/core@0.1.0`, and `@project-sothoth/document-index@0.1.0`.

## Inputs and outputs

Inputs are Selector values (unknown candidates validated by the parser) and `DocumentIndexProjectionV1` values with optional budgets. Outputs are canonical ASTs, matched document identities, cardinality verdicts, and explain traces.

## Minimal usage

```ts
import { parseSelectorV1 } from "@project-sothoth/selectors/parse";
import { selectDocumentsV1 } from "@project-sothoth/selectors/match";

const parsed = parseSelectorV1({ /* Selector */ });
const selection = selectDocumentsV1(indexProjection, { /* Selector */ });
```

## Failure and fail-closed behavior

Hostile selectors are rejected by explicit budgets before evaluation; order-independent matching makes results independent of candidate order; zero matches produce `SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1` diagnostics by default.

## Limitations

`0.1.0` closes the selector algebra at Dossier revision 1 — no extension operators, no negation of cardinality rules, and no index mutation.

## Related documents

- [Selectors Dossier](../design/dossiers/selectors.md)
- [Architecture](../../ARCHITECTURE.md) — selection layer
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/document-index`](document-index.md), [`@project-sothoth/governance`](governance.md), [`@project-sothoth/planning`](planning.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/selectors

Closed declarative selector algebra with deterministic matching for Sothoth: parse Selectors into a canonical AST under hostile-input budgets, match them against document-index projections, enforce cardinality, and explain the selection. Results are ordered by canonical identity; zero matches produce a diagnostic by default rather than a silent empty set.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./parse` | `dist/parser.js` | `dist/parser.d.ts` |
| `./ast` | `dist/index.js` | `dist/index.d.ts` |
| `./match` | `dist/evaluate.js` | `dist/evaluate.d.ts` |
| `./cardinality` | `dist/evaluate.js` | `dist/evaluate.d.ts` |
| `./explain` | `dist/evaluate.js` | `dist/evaluate.d.ts` |

There is no root export: the bare specifier `@project-sothoth/selectors` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { parseSelectorV1 } from "@project-sothoth/selectors/parse";
import { selectDocumentsV1 } from "@project-sothoth/selectors/match";

const parsed = parseSelectorV1({ /* Selector */ });
const selection = selectDocumentsV1(indexProjection, { /* Selector */ });
```

Hostile selectors are rejected by budgets before evaluation. Full reference documentation lives at `docs/packages/selectors.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/selectors`.
<!-- sothoth-package-readme:end -->
