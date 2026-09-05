# `@project-sothoth/core` package reference

| | |
|---|---|
| Package | `@project-sothoth/core` |
| Version | `0.1.0` |
| Layer | Foundation — pure deterministic compilation kernel |
| License | Apache-2.0 |
| Source | `packages/core` |
| Dossier | [`docs/design/dossiers/core.md`](../design/dossiers/core.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@3` |

## Responsibilities

Make compilation reproducible and rejection structured: canonical JSON serialization, SHA-256 digesting over canonical bytes, code-point ordering primitives, diagnostic deduplication and ordering, severity aggregation into process outcomes, and the frozen outcome-to-exit-code mapping. Owning these here prevents any domain module from inventing a second serialization or a friendlier outcome.

## Non-goals

Everything environmental is excluded: no filesystem, Git, process, network, clock, random, or locale access; no domain semantics; no knowledge of what is being compiled. The only sanctioned non-package import is `node:crypto` for digesting.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/core.md) (`surfaceKind: pure-functions-only`); the root entry re-exports the family union.

| Subpath | Runtime | Types |
|---|---|---|
| `.` | `dist/index.js` | `dist/index.d.ts` |
| `./canonical-json` | `dist/canonical-json.js` | `dist/canonical-json.d.ts` |
| `./digest` | `dist/digests.js` | `dist/digests.d.ts` |
| `./compile` | `dist/compile.js` | `dist/compile.d.ts` |
| `./diagnostics` | `dist/diagnostics.js` | `dist/diagnostics.d.ts` |
| `./outcome` | `dist/outcome.js` | `dist/outcome.d.ts` |

Specifiers outside this map fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Dependency direction

Depends only on `@project-sothoth/contracts@0.1.0`. Production sources import nothing else besides `node:crypto`.

## Inputs and outputs

Inputs are plain JSON values and diagnostic records. Outputs are canonical bytes, SHA-256 digests, ordered deduplicated diagnostic lists, aggregated `CompilationOutcomeV1` values, and frozen exit codes. Projection bytes are deterministic for the same canonical input, version, profile, rule lock, and budget.

## Minimal usage

```ts
import { canonicalJson, SothothInputError } from "@project-sothoth/core/canonical-json";
import { sha256Digest } from "@project-sothoth/core/digest";

canonicalJson({ b: [1, 2], a: "x" }); // deterministic canonical bytes
sha256Digest(""); // "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
try {
  const cyclic: unknown = {};
  (cyclic as { self?: unknown }).self = cyclic;
  canonicalJson(cyclic); // throws SothothInputError (sothoth.input/invalid-json-value)
} catch (error) {
  error instanceof SothothInputError; // true
}
```

## Failure and fail-closed behavior

Non-canonicalizable input (cyclic structures, non-finite numbers, invalid JSON values) throws `SothothInputError` with a structured diagnostic code instead of producing bytes. There is no lenient mode and no environment-dependent fallback.

## Limitations

`0.1.0` provides SHA-256 digesting only, and the kernel accepts JSON-compatible values only.

## Related documents

- [Core Dossier](../design/dossiers/core.md)
- [Architecture](../../ARCHITECTURE.md) — foundation layer
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/contracts`](contracts.md), [`@project-sothoth/graph`](graph.md), [`@project-sothoth/governance`](governance.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/core

Pure deterministic compilation primitives for Sothoth: canonical JSON serialization, SHA-256 digesting over canonical bytes, code-point ordering, diagnostic deduplication and ordering, outcome aggregation, and the frozen outcome-to-exit mapping. No filesystem, Git, process, network, clock, random, or locale access — the only non-package import is `node:crypto`.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `.` | `dist/index.js` | `dist/index.d.ts` |
| `./canonical-json` | `dist/canonical-json.js` | `dist/canonical-json.d.ts` |
| `./digest` | `dist/digests.js` | `dist/digests.d.ts` |
| `./compile` | `dist/compile.js` | `dist/compile.d.ts` |
| `./diagnostics` | `dist/diagnostics.js` | `dist/diagnostics.d.ts` |
| `./outcome` | `dist/outcome.js` | `dist/outcome.d.ts` |

Specifiers outside this map fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Usage

```ts
import { canonicalJson } from "@project-sothoth/core/canonical-json";
import { sha256Digest } from "@project-sothoth/core/digest";

canonicalJson({ b: [1, 2], a: "x" }); // deterministic canonical bytes
sha256Digest(""); // sha256 of the empty string
```

Non-canonicalizable input throws `SothothInputError` with a structured code; there is no lenient mode. Full reference documentation lives at `docs/packages/core.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/core`.
<!-- sothoth-package-readme:end -->
