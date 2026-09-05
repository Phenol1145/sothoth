# @project-sothoth/sdk

Sole aggregate public library facade for Sothoth: one typed, versioned surface delegating every semantic operation to its owning package — governance, planning, document indexing, Git snapshots, profiles, and selectors over the contracts/core foundation. Returns closed typed outcomes with Structured Diagnostics; never chooses process exits.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./change-plan` | `dist/index.js` | `dist/index.d.ts` |
| `./check` | `dist/index.js` | `dist/index.d.ts` |
| `./compile` | `dist/index.js` | `dist/index.d.ts` |
| `./diagnostics` | `dist/index.js` | `dist/index.d.ts` |
| `./documents` | `dist/index.js` | `dist/index.d.ts` |
| `./git` | `dist/index.js` | `dist/index.d.ts` |
| `./profiles` | `dist/index.js` | `dist/index.d.ts` |
| `./verify` | `dist/index.js` | `dist/index.d.ts` |

There is no root export: the bare specifier `@project-sothoth/sdk` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { createSothothV1 } from "@project-sothoth/sdk/compile";
import { checkDesignClosure } from "@project-sothoth/sdk/check";

const sothoth = createSothothV1();
const closure = checkDesignClosure({ /* DesignClosureFactsV1 */ });
```

The facade never softens a rejection and never exits the process. Full reference documentation lives at `docs/packages/sdk.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/sdk`.