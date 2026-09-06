# @project-sothoth/contracts

Closed public contracts for the Sothoth governance control plane: one authoritative vocabulary for exact design references, record schemas, Structured Diagnostics, projections, pre-design declarations, and extension contracts. Types, constants, predicates, and structural validators only — no executable capability beyond shape validation, and zero runtime dependencies.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

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
import { EXACT_REFERENCE_PATTERN, DIGEST_PATTERN } from "@project-sothoth/contracts/identity";
import { isDiagnosticCodeV1 } from "@project-sothoth/contracts/diagnostic";

EXACT_REFERENCE_PATTERN.test("SOTHOTH-CORE-DOSSIER@1"); // true
DIGEST_PATTERN.test("sha256:" + "0".repeat(64)); // true
isDiagnosticCodeV1("sothoth.input/invalid-json-value"); // true
```

Invalid shapes produce structured contract issues; there is no fallback interpretation. Full reference documentation lives at `docs/packages/contracts.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/contracts`.