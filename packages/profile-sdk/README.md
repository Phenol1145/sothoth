# @sothoth/profile-sdk

Consumer-neutral Consumer Profile contract, loading, and conformance for Sothoth: load caller-supplied values, validate closed structure and exact references, compile versioned relation-role mappings, and return non-authoritative conformance projections. Profiles are never modified; recommended skills are curated and exact-only.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./load` | `dist/profile.js` | `dist/profile.d.ts` |
| `./contract-composition` | `dist/profile.js` | `dist/profile.d.ts` |
| `./relation-roles` | `dist/profile.js` | `dist/profile.d.ts` |
| `./conformance` | `dist/conformance.js` | `dist/conformance.d.ts` |
| `./recommendations` | `dist/conformance.js` | `dist/conformance.d.ts` |

There is no root export: the bare specifier `@sothoth/profile-sdk` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { defineProfileV1 } from "@sothoth/profile-sdk/load";

const profile = defineProfileV1({ /* Consumer Profile candidate */ });
```

Invalid profiles fail closed with structured diagnostics. Full reference documentation lives at `docs/packages/profile-sdk.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/profile-sdk`.