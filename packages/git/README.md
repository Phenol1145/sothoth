# @project-sothoth/git

Read-only Git source adapter for Sothoth: bind exact commit, compare, and workspace snapshots through a frozen allowlist of read-only subcommands, normalize repository-relative POSIX paths, and return digest-bearing snapshots for downstream compilers. No Git mutation, no network, no path or ref ambiguity.

Version `0.1.0` — published on npm. See the repository release notes for source and registry evidence.

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./commit` | `dist/index.js` | `dist/index.d.ts` |
| `./compare` | `dist/index.js` | `dist/index.d.ts` |
| `./path` | `dist/paths.js` | `dist/paths.d.ts` |
| `./process` | `dist/runner.js` | `dist/runner.d.ts` |
| `./snapshot` | `dist/snapshot.js` | `dist/snapshot.d.ts` |
| `./workspace` | `dist/index.js` | `dist/index.d.ts` |

There is no root export: the bare specifier `@project-sothoth/git` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```ts
import { createGitSourceAdapterV1 } from "@project-sothoth/git/commit";

const adapter = createGitSourceAdapterV1({ /* GitSourceAdapterOptionsV1 */ });
```

Mutation subcommands and ambiguous paths fail closed. Full reference documentation lives at `docs/packages/git.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/git`.