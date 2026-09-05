# `@project-sothoth/planning` package reference

| | |
|---|---|
| Package | `@project-sothoth/planning` |
| Version | `0.1.0` |
| Layer | Scheduling compiler |
| License | Apache-2.0 |
| Source | `packages/planning` |
| Dossier | [`docs/design/dossiers/planning.md`](../design/dossiers/planning.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4` |

## Responsibilities

One scheduling compilation: validate dependency constraints, build the ordering graph, assign deterministic topological waves, record the satisfied constraint identities, and return the resulting Schedule Solution without mutating any input. All scheduling axes — dependency, time, resource, assignment, placement, gate, and release-train — are projections of that one solution; none owns an independent truth.

## Non-goals

The scheduler authority fence: no mutation of Source Facts, no executable plans, no side effects, no calendar or clock access, and no second truth source for ordering — dependency waves are the only scheduling dimension implemented in `0.1.0`.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/planning.md) (`surfaceKind: pure-functions-only`). No root export exists: the bare specifier `@project-sothoth/planning` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./constraints` | `dist/plan-graph.js` | `dist/plan-graph.d.ts` |
| `./schedule` | `dist/schedule.js` | `dist/schedule.d.ts` |
| `./solution` | `dist/schedule.js` | `dist/schedule.d.ts` |
| `./waves` | `dist/schedule.js` | `dist/schedule.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0`, `@project-sothoth/core@0.1.0`, `@project-sothoth/graph@0.1.0`, and `@project-sothoth/selectors@0.1.0`.

## Inputs and outputs

Inputs are `SchedulingProblemV1` values (explicit dependency constraints with stable identities). Outputs are plan-graph validations and a single deterministic `ScheduleSolutionV1` — the same problem always yields the same wave assignment.

## Minimal usage

```ts
import { validatePlanGraphV1 } from "@project-sothoth/planning/constraints";
import { compileDependencyScheduleV1 } from "@project-sothoth/planning/schedule";

const problem = { /* SchedulingProblemV1 */ };
const validation = validatePlanGraphV1(problem);
const solution = compileDependencyScheduleV1(problem);
```

## Failure and fail-closed behavior

Unsatisfiable or malformed constraints produce an invalid outcome with structured findings — never a partial or best-effort schedule. Inputs are read-only; nothing is mutated or written back.

## Limitations

`0.1.0` implements the dependency-wave dimension only; the other scheduling axes are future projections of the same solution, not separate schedulers.

## Related documents

- [Planning Dossier](../design/dossiers/planning.md)
- [Architecture](../../ARCHITECTURE.md) — planning layer
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/graph`](graph.md), [`@project-sothoth/selectors`](selectors.md), [`@project-sothoth/governance`](governance.md), [`@project-sothoth/sdk`](sdk.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/planning

Pure scheduling compilation for Sothoth: validate dependency constraints, build the ordering graph, and assign deterministic topological waves in a single Schedule Solution. Inputs are never mutated; every scheduling axis is a projection of the one solution.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

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
<!-- sothoth-package-readme:end -->
