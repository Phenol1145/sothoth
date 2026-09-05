# `@sothoth/contracts` package reference

| | |
|---|---|
| Package | `@sothoth/contracts` |
| Version | `0.1.0` |
| Layer | Foundation — closed public contracts |
| License | Apache-2.0 |
| Source | `packages/contracts` |
| Dossier | [`docs/design/dossiers/contracts.md`](../design/dossiers/contracts.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@3` |

## Responsibilities

One closed vocabulary for the Sothoth governance control plane: exact design references, canonical JSON record schemas, Structured Diagnostics, projection contracts, pre-design dossier declarations, and extension contracts (gate macros, evidence check references, trusted rule modules). Defining the vocabulary in one place is what lets every other package stay small and mutually consistent.

## Non-goals

No executable capability beyond shape validation. The package owns no compilation, no I/O, no environment access, and no domain semantics; it declares zero runtime dependencies and everything it exports is types, constants, predicates, and structural validators.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/contracts.md) (`surfaceKind: types-and-validation-only`); the root entry re-exports the family union.

| Subpath | Runtime | Types |
|---|---|---|
| `.` | `dist/index.js` | `dist/index.d.ts` |
| `./identity` | `dist/identity.js` | `dist/identity.d.ts` |
| `./schema` | `dist/schema.js` | `dist/schema.d.ts` |
| `./diagnostic` | `dist/diagnostics.js` | `dist/diagnostics.d.ts` |
| `./projection` | `dist/projection.js` | `dist/projection.d.ts` |
| `./pre-design` | `dist/pre-design.js` | `dist/pre-design.d.ts` |
| `./extension` | `dist/extensions.js` | `dist/extensions.d.ts` |

Specifiers outside this map fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Dependency direction

Depends on nothing at runtime. Every other Sothoth package may depend on this one; it depends on none.

## Inputs and outputs

Inputs are candidate JSON values and unknown values offered as contracts data. Outputs are TypeScript types, frozen constants (for example `EXACT_REFERENCE_PATTERN`, `DIAGNOSTIC_VERDICTS_V1`, `PRE_DESIGN_PHASES_V1`), type predicates, and structural validation issues.

## Minimal usage

```ts
import { EXACT_REFERENCE_PATTERN, DIGEST_PATTERN } from "@sothoth/contracts/identity";
import { isDiagnosticCodeV1 } from "@sothoth/contracts/diagnostic";

EXACT_REFERENCE_PATTERN.test("SOTHOTH-CORE-DOSSIER@1"); // true
DIGEST_PATTERN.test("sha256:" + "0".repeat(64)); // true
isDiagnosticCodeV1("sothoth.input/invalid-json-value"); // true
```

## Failure and fail-closed behavior

Invalid shapes produce structured `ContractIssueV1` records from the validators; the package does not guess, repair, or accept unknown fields. There is no fallback interpretation of a malformed contract.

## Limitations

`0.1.0` closes the vocabulary at Dossier revision 1: no additional schemas, families, or convenience re-exports exist in this version.

## Related documents

- [Contracts Dossier](../design/dossiers/contracts.md)
- [Architecture](../../ARCHITECTURE.md) — foundation layer
- [Repository README](../../README.md)
- Adjacent references: [`@sothoth/core`](core.md), [`@sothoth/governance`](governance.md), [`@sothoth/sdk`](sdk.md)

<!-- sothoth-package-readme:start -->
# @sothoth/contracts

Closed public contracts for the Sothoth governance control plane: one authoritative vocabulary for exact design references, record schemas, Structured Diagnostics, projections, pre-design declarations, and extension contracts. Types, constants, predicates, and structural validators only — no executable capability beyond shape validation, and zero runtime dependencies.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `.` | `dist/index.js` | `dist/index.d.ts` |
| `./identity` | `dist/identity.js` | `dist/identity.d.ts` |
| `./schema` | `dist/schema.js` | `dist/schema.d.ts` |
| `./diagnostic` | `dist/diagnostics.js` | `dist/diagnostics.d.ts` |
| `./projection` | `dist/projection.js` | `dist/projection.d.ts` |
| `./pre-design` | `dist/pre-design.js` | `dist/pre-design.d.ts` |
| `./extension` | `dist/extensions.js` | `dist/extensions.d.ts` |

Specifiers outside this map fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Usage

```ts
import { EXACT_REFERENCE_PATTERN, DIGEST_PATTERN } from "@sothoth/contracts/identity";
import { isDiagnosticCodeV1 } from "@sothoth/contracts/diagnostic";

EXACT_REFERENCE_PATTERN.test("SOTHOTH-CORE-DOSSIER@1"); // true
DIGEST_PATTERN.test("sha256:" + "0".repeat(64)); // true
isDiagnosticCodeV1("sothoth.input/invalid-json-value"); // true
```

Invalid shapes produce structured contract issues; there is no fallback interpretation. Full reference documentation lives at `docs/packages/contracts.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/contracts`.
<!-- sothoth-package-readme:end -->
