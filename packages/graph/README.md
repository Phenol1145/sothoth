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