# `@sothoth/document-index` package reference

| | |
|---|---|
| Package | `@sothoth/document-index` |
| Version | `0.1.0` |
| Layer | Document layer — deterministic CommonMark indexing |
| License | Apache-2.0 |
| Source | `packages/document-index` |
| Dossier | [`docs/design/dossiers/document-index.md`](../design/dossiers/document-index.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@3` |

## Responsibilities

One deterministic document index: given exact document content and its declared identity inputs — document/artifact identity, kind, lifecycle status, version, owner, tags, and a normalized path or Git blob identity with content digest — parse the content through the CommonMark AST (`mdast-util-from-markdown@2.0.2` with its pinned `micromark@4.0.2` tree) and project headings and anchors, stable section identity bound to the frozen marker grammar, precise source spans, explicit references, supersession and traceability relations, and the provenance needed to rebuild and explain the index later.

## Non-goals

No interpretation of document meaning beyond structure: no semantics for what documents say, no acceptance or authority over Source Facts, no mutation of indexed content, and no I/O beyond the explicitly designed pure parsing boundary (all bytes arrive as values).

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/document-index.md) (`surfaceKind: pure-functions-only`). No root export exists: the bare specifier `@sothoth/document-index` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./parse` | `dist/parse.js` | `dist/parse.d.ts` |
| `./sections` | `dist/sections.js` | `dist/sections.d.ts` |
| `./anchors` | `dist/anchors.js` | `dist/anchors.d.ts` |
| `./references` | `dist/references.js` | `dist/references.d.ts` |
| `./index` | `dist/index.js` | `dist/index.d.ts` |
| `./cache` | `dist/cache.js` | `dist/cache.d.ts` |

## Dependency direction

Depends on `@sothoth/contracts@0.1.0`, `@sothoth/core@0.1.0`, `@sothoth/graph@0.1.0`, and the external parser `mdast-util-from-markdown@2.0.2` (exact pin, no range; its `micromark@4.0.2` subtree is a release consequence recorded in the CycloneDX SBOM). The parser is the only non-Sothoth runtime dependency in the workspace.

## Inputs and outputs

Inputs are document sources (`DocumentSourceV1`) with declared identity and budgets. Outputs are structural parses, stable section identities, heading anchors, reference resolutions, and the deterministic `DocumentIndexProjectionV1` consumed by selectors and governance compilers. Blob-cache entries are byte-neutral: caching never changes index bytes.

## Minimal usage

```ts
import { parseDocumentV1 } from "@sothoth/document-index/parse";
import { buildDocumentIndexV1 } from "@sothoth/document-index/index";

const parsed = parseDocumentV1(
  { /* DocumentSourceV1: identity, kind, status, version, owner, content, … */ },
  { /* DocumentIndexBudgetsV1 */ },
);
const indexed = buildDocumentIndexV1({ /* DocumentIndexInputV1 */ });
```

## Failure and fail-closed behavior

Structural parse boundary: malformed or hostile input is rejected within explicit budgets rather than partially indexed; oversize or malformed inputs produce structured diagnostics, never best-effort output.

## Limitations

`0.1.0` indexes CommonMark structure only — no rendering, no front-matter semantics, no non-Markdown formats.

## Related documents

- [Document Index Dossier](../design/dossiers/document-index.md)
- [Architecture](../../ARCHITECTURE.md) — document layer
- [Repository README](../../README.md)
- Adjacent references: [`@sothoth/graph`](graph.md), [`@sothoth/selectors`](selectors.md), [`@sothoth/governance`](governance.md)

<!-- sothoth-package-readme:start -->
# @sothoth/document-index

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

There is no root export: the bare specifier `@sothoth/document-index` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { parseDocumentV1 } from "@sothoth/document-index/parse";

const parsed = parseDocumentV1({ /* DocumentSourceV1 */ }, { /* budgets */ });
```

Malformed or oversize input is rejected with structured diagnostics. Full reference documentation lives at `docs/packages/document-index.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/document-index`.
<!-- sothoth-package-readme:end -->
