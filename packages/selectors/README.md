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