# @project-sothoth/governance

Pure document-governance compilation for Sothoth: registry and append-only ledger validation, traceability and manifest consistency, pre-design closure projections, Scope BOM Admissibility, non-authoritative change-plan projections, and gate macro expansion into acyclic check graphs. Source Facts are read and validated, never accepted, repaired, or written back.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

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