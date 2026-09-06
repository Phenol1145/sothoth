# @project-sothoth/planning

Pure scheduling compilation for Sothoth: validate dependency constraints, build the ordering graph, and assign deterministic topological waves in a single Schedule Solution. Inputs are never mutated; every scheduling axis is a projection of the one solution.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./constraints` | `dist/plan-graph.js` | `dist/plan-graph.d.ts` |
| `./schedule` | `dist/schedule.js` | `dist/schedule.d.ts` |
| `./solution` | `dist/schedule.js` | `dist/schedule.d.ts` |
| `./waves` | `dist/schedule.js` | `dist/schedule.d.ts` |

There is no root export: the bare specifier `@project-sothoth/planning` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { compileDependencyScheduleV1 } from "@project-sothoth/planning/schedule";

const solution = compileDependencyScheduleV1({ /* SchedulingProblemV1 */ });
```

Unsatisfiable constraints fail closed with structured findings. Full reference documentation lives at `docs/packages/planning.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/planning`.