# `@project-sothoth/graph` package reference

| | |
|---|---|
| Package | `@project-sothoth/graph` |
| Version | `0.1.0` |
| Layer | Meaning-free graph algorithms |
| License | Apache-2.0 |
| Source | `packages/graph` |
| Dossier | [`docs/design/dossiers/graph.md`](../design/dossiers/graph.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@3` |

## Responsibilities

One deterministic graph toolkit: build a directed multigraph from explicit node, edge, weight, and sort-key declarations; traverse it; split it into strongly connected components; condense it into a DAG of components; order it into topological waves; and compute deterministic longest paths on the condensation. Every operation accepts the caller's stable ordering keys and returns results ordered by them.

## Non-goals

The package must not know what it is ordering: no domain semantics, no node or edge meanings, no I/O, no clock, no randomness, no filesystem, Git, process, or network access.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/graph.md) (`surfaceKind: pure-functions-only`). There is deliberately no root (`.`) export: the bare specifier `@project-sothoth/graph` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./digraph` | `dist/digraph.js` | `dist/digraph.d.ts` |
| `./traversal` | `dist/traversal.js` | `dist/traversal.d.ts` |
| `./scc` | `dist/scc.js` | `dist/scc.d.ts` |
| `./condensation` | `dist/condensation.js` | `dist/condensation.d.ts` |
| `./waves` | `dist/waves.js` | `dist/waves.d.ts` |
| `./longest-paths` | `dist/longest-paths.js` | `dist/longest-paths.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0` and `@project-sothoth/core@0.1.0`; nothing else.

## Inputs and outputs

Inputs are explicit multigraph declarations with caller-provided stable sort keys. Outputs are canonical graph objects, traversals, component decompositions, condensations, wave assignments, and longest-path results — all deterministically ordered by the caller's keys.

## Minimal usage

```ts
import { createCanonicalGraphV1 } from "@project-sothoth/graph/digraph";
import { topologicalWavesV1 } from "@project-sothoth/graph/waves";

const graph = createCanonicalGraphV1({
  /* DirectedMultigraphDeclarationV1: explicit nodes and edges
     (each entry carries its own sort key; weight is an optional per-edge field) */
});
const waves = topologicalWavesV1(graph);
```

## Failure and fail-closed behavior

Malformed declarations are rejected with structured diagnostics before any algorithm runs; ordering never depends on input iteration order or environment state.

## Limitations

`0.1.0` ships the six algorithm modules above only; no root export and no graph rendering, persistence, or I/O of any kind.

## Related documents

- [Graph Dossier](../design/dossiers/graph.md)
- [Architecture](../../ARCHITECTURE.md) — algorithm layer
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/core`](core.md), [`@project-sothoth/document-index`](document-index.md), [`@project-sothoth/planning`](planning.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/graph

Deterministic, meaning-free directed multigraph algorithms for Sothoth: canonical graph construction, traversal, strongly connected components, condensation, topological waves, and deterministic longest paths. Results are always ordered by the caller's stable keys. The package has no domain semantics and no I/O of any kind.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./digraph` | `dist/digraph.js` | `dist/digraph.d.ts` |
| `./traversal` | `dist/traversal.js` | `dist/traversal.d.ts` |
| `./scc` | `dist/scc.js` | `dist/scc.d.ts` |
| `./condensation` | `dist/condensation.js` | `dist/condensation.d.ts` |
| `./waves` | `dist/waves.js` | `dist/waves.d.ts` |
| `./longest-paths` | `dist/longest-paths.js` | `dist/longest-paths.d.ts` |

There is no root export: the bare specifier `@project-sothoth/graph` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { createCanonicalGraphV1 } from "@project-sothoth/graph/digraph";
import { topologicalWavesV1 } from "@project-sothoth/graph/waves";

const graph = createCanonicalGraphV1({ /* DirectedMultigraphDeclarationV1 */ });
const waves = topologicalWavesV1(graph);
```

Malformed declarations are rejected with structured diagnostics. Full reference documentation lives at `docs/packages/graph.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/graph`.
<!-- sothoth-package-readme:end -->
