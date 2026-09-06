# @project-sothoth/core

Pure deterministic compilation primitives for Sothoth: canonical JSON serialization, SHA-256 digesting over canonical bytes, code-point ordering, diagnostic deduplication and ordering, outcome aggregation, and the frozen outcome-to-exit mapping. No filesystem, Git, process, network, clock, random, or locale access — the only non-package import is `node:crypto`.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

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