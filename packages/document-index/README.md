# @project-sothoth/document-index

Deterministic CommonMark structural document indexing for Sothoth: parse exact document content through the pinned `mdast-util-from-markdown@2.0.2` parser (with its `micromark@4.0.2` tree), project headings, anchors, stable sections, explicit references, and provenance, and produce the deterministic index projection consumed downstream. Cache entries are byte-neutral; hostile input fails closed within explicit budgets.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./parse` | `dist/parse.js` | `dist/parse.d.ts` |
| `./sections` | `dist/sections.js` | `dist/sections.d.ts` |
| `./anchors` | `dist/anchors.js` | `dist/anchors.d.ts` |
| `./references` | `dist/references.js` | `dist/references.d.ts` |
| `./index` | `dist/index.js` | `dist/index.d.ts` |
| `./cache` | `dist/cache.js` | `dist/cache.d.ts` |

There is no root export: the bare specifier `@project-sothoth/document-index` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { parseDocumentV1 } from "@project-sothoth/document-index/parse";

const parsed = parseDocumentV1({ /* DocumentSourceV1 */ }, { /* budgets */ });
```

Malformed or oversize input is rejected with structured diagnostics. Full reference documentation lives at `docs/packages/document-index.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/document-index`.