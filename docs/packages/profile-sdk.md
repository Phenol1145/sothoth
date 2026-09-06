# `@project-sothoth/profile-sdk` package reference

| | |
|---|---|
| Package | `@project-sothoth/profile-sdk` |
| Version | `0.1.0` |
| Layer | Consumer boundary — Consumer Profile contract, loading, conformance |
| License | Apache-2.0 |
| Source | `packages/profile-sdk` |
| Dossier | [`docs/design/dossiers/profile-sdk.md`](../design/dossiers/profile-sdk.md) |
| Scope BOM | Member of `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4` |

## Responsibilities

One neutral boundary: load caller-supplied Consumer Profile values; validate closed structure, exact references, revision compatibility, and conformance; compile explicit, versioned relation-role mappings; and return a non-authoritative conformance Projection or Structured Diagnostic without modifying the Profile.

## Non-goals

The policy-engine fence: this package never evaluates consumer policy, never decides integration readiness, never mutates a Consumer Profile, and never contacts a consumer system. Recommended skills are curated and exact-only — nothing is inferred.

## Public exports

Exactly the accepted `public-surface-declaration@1` modules of the [Dossier](../design/dossiers/profile-sdk.md) (`surfaceKind: pure-functions-only`). No root export exists: the bare specifier `@project-sothoth/profile-sdk` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

| Subpath | Runtime | Types |
|---|---|---|
| `./load` | `dist/profile.js` | `dist/profile.d.ts` |
| `./contract-composition` | `dist/profile.js` | `dist/profile.d.ts` |
| `./relation-roles` | `dist/profile.js` | `dist/profile.d.ts` |
| `./conformance` | `dist/conformance.js` | `dist/conformance.d.ts` |
| `./recommendations` | `dist/conformance.js` | `dist/conformance.d.ts` |

## Dependency direction

Depends on `@project-sothoth/contracts@0.1.0` and `@project-sothoth/core@0.1.0`.

## Inputs and outputs

Inputs are candidate Consumer Profile values (`unknown`) and versioned relation-role mappings. Outputs are canonicalized `ProfileDefinitionV1` values, frozen role catalogs (`PROFILE_RELATION_ROLES_V1`), and non-authoritative conformance projections with structured diagnostics.

## Minimal usage

```ts
import { defineProfileV1 } from "@project-sothoth/profile-sdk/load";

const profile = defineProfileV1({ /* Consumer Profile candidate */ });
```

## Failure and fail-closed behavior

Conformance fails closed: unknown fields, inexact references, revision incompatibility, and non-curated skills are rejected with structured diagnostics. Impact never implies ordering. The loaded Profile is never modified.

## Limitations

`0.1.0` ships the exact contract at Dossier revision 1 — no negotiation, no partial acceptance, and no consumer-side execution.

## Related documents

- [Profile SDK Dossier](../design/dossiers/profile-sdk.md)
- [Architecture](../../ARCHITECTURE.md) — consumer boundary
- [Repository README](../../README.md)
- Adjacent references: [`@project-sothoth/contracts`](contracts.md), [`@project-sothoth/core`](core.md), [`@project-sothoth/sdk`](sdk.md)

<!-- sothoth-package-readme:start -->
# @project-sothoth/profile-sdk

Consumer-neutral Consumer Profile contract, loading, and conformance for Sothoth: load caller-supplied values, validate closed structure and exact references, compile versioned relation-role mappings, and return non-authoritative conformance projections. Profiles are never modified; recommended skills are curated and exact-only.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./load` | `dist/profile.js` | `dist/profile.d.ts` |
| `./contract-composition` | `dist/profile.js` | `dist/profile.d.ts` |
| `./relation-roles` | `dist/profile.js` | `dist/profile.d.ts` |
| `./conformance` | `dist/conformance.js` | `dist/conformance.d.ts` |
| `./recommendations` | `dist/conformance.js` | `dist/conformance.d.ts` |

There is no root export: the bare specifier `@project-sothoth/profile-sdk` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { defineProfileV1 } from "@project-sothoth/profile-sdk/load";

const profile = defineProfileV1({ /* Consumer Profile candidate */ });
```

Invalid profiles fail closed with structured diagnostics. Full reference documentation lives at `docs/packages/profile-sdk.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/profile-sdk`.
<!-- sothoth-package-readme:end -->
