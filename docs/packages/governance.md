# `@project-sothoth/governance` package reference

| | |
|---|---|
| Package | `@project-sothoth/governance` |
| Version | `0.1.0` |
| Layer | Governance compiler |
| License | Apache-2.0 |
| Source | `packages/governance` |
| Dossier | [`docs/design/dossiers/governance.md`](../design/dossiers/governance.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4` |

## Responsibilities

One governance compiler: validate Registry lifecycle bindings and Ledger append-only lineage; verify Traceability and Manifest consistency; compile pre-design closure over a Design Scope Catalog, Dossiers, and registrations into a digest-bearing Design Closure Projection; compile Scope BOM Admissibility over an accepted Architecture Baseline and a candidate Scope BOM; compile change impact from a Git Source Snapshot or an explicit changed-artifact Selector into a non-authoritative change-plan projection; and expand and validate Gate Macros into acyclic gate graphs of Check References.

## Non-goals

The authority fence: this package never accepts, repairs, or writes Source Facts; it reads and validates them, and its projections are non-authoritative evidence. It owns no process exit codes, no I/O adapters, and no publication or release authority.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/governance.md) (`surfaceKind: pure-functions-only`). No root export exists: the bare specifier `@project-sothoth/governance` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./registry` | `dist/registry.js` | `dist/registry.d.ts` |
| `./ledger` | `dist/ledger.js` | `dist/ledger.d.ts` |
| `./traceability` | `dist/document-contract.js` | `dist/document-contract.d.ts` |
| `./manifest` | `dist/registry.js` | `dist/registry.d.ts` |
| `./pre-design` | `dist/pre-design.js` | `dist/pre-design.d.ts` |
| `./change-plan` | `dist/change-plan.js` | `dist/change-plan.d.ts` |
| `./gate-macros` | `dist/gates.js` | `dist/gates.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0`, `@project-sothoth/core@0.1.0`, `@project-sothoth/document-index@0.1.0`, `@project-sothoth/graph@0.1.0`, and `@project-sothoth/selectors@0.1.0`.

## Inputs and outputs

Inputs are Source Facts (registries, ledgers, dossiers, registrations, Architecture Baselines, candidate Scope BOMs) and Git source snapshots or selectors describing change. Outputs are digest-bearing projections (Design Closure, Scope BOM Admissibility, Change Plan) and validated gate graphs — deterministic for the same inputs and always rebuildable.

## Minimal usage

```ts
import {
  compileDesignClosureV1,
  compileScopeBomAdmissibilityV1,
} from "@project-sothoth/governance/pre-design";
import { compileChangePlanV1 } from "@project-sothoth/governance/change-plan";

const closure = compileDesignClosureV1({ /* DesignClosureFactsV1 */ });
const admissibility = compileScopeBomAdmissibilityV1({ /* ScopeBomAdmissibilityFactsV1 */ });
const changePlan = compileChangePlanV1({ /* ChangePlanFactsV1 */ });
```

## Failure and fail-closed behavior

Source Facts are never authoritative here: validators read and reject, they never write back or synthesize acceptance. Gate macro expansion stops at `MAX_GATE_MACRO_EXPANSION_STEPS_V1`; impact edges never imply ordering; projection rebuilds are byte-deterministic.

## Limitations

`0.1.0` compiles the pre-design phase families, admissibility, change plans, and gate macros only; it does not decide publication, releases, or acceptance.

## Related documents

- [Governance Dossier](../design/dossiers/governance.md)
- [Architecture](../../ARCHITECTURE.md) — governance layer
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/document-index`](document-index.md), [`@project-sothoth/selectors`](selectors.md), [`@project-sothoth/planning`](planning.md), [`@project-sothoth/sdk`](sdk.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/governance

Pure document-governance compilation for Sothoth: registry and append-only ledger validation, traceability and manifest consistency, pre-design closure projections, Scope BOM Admissibility, non-authoritative change-plan projections, and gate macro expansion into acyclic check graphs. Source Facts are read and validated, never accepted, repaired, or written back.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./registry` | `dist/registry.js` | `dist/registry.d.ts` |
| `./ledger` | `dist/ledger.js` | `dist/ledger.d.ts` |
| `./traceability` | `dist/document-contract.js` | `dist/document-contract.d.ts` |
| `./manifest` | `dist/registry.js` | `dist/registry.d.ts` |
| `./pre-design` | `dist/pre-design.js` | `dist/pre-design.d.ts` |
| `./change-plan` | `dist/change-plan.js` | `dist/change-plan.d.ts` |
| `./gate-macros` | `dist/gates.js` | `dist/gates.d.ts` |

There is no root export: the bare specifier `@project-sothoth/governance` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { compileDesignClosureV1 } from "@project-sothoth/governance/pre-design";

const closure = compileDesignClosureV1({ /* DesignClosureFactsV1 */ });
```

Gate macro expansion is budgeted; projections are byte-deterministic. Full reference documentation lives at `docs/packages/governance.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/governance`.
<!-- sothoth-package-readme:end -->
