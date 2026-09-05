# @project-sothoth/cli

Operator-facing command-line composition and I/O adapter for Sothoth: eight explicit commands over the public SDK facade with a frozen exit mapping and atomic explicit output. One machine document per invocation (`sothoth.cli/cli-invocation-result@1`); every input failure is still a JSON document on stdout with exit code 2.

Version `0.1.0` — release candidate, not yet published on npm (see the repository release notes).

## Commands (exactly eight)

`check` · `compile governance` · `compile planning` · `change-plan` · `index` · `select` · `explain` · `verify-projection`

Options: `--format <json|sarif|terminal>` (required), `--input <path>` (default stdin), `--output <path>` (default stdout; atomic).

## Public exports

| Subpath | Runtime | Types |
|---|---|---|
| `./commands` | `dist/main.js` | `dist/main.d.ts` |
| `./exit` | `dist/io.js` | `dist/io.d.ts` |
| `./input` | `dist/args.js` | `dist/args.d.ts` |
| `./render` | `dist/render-json.js` | `dist/render-json.d.ts` |
| `./write` | `dist/io.js` | `dist/io.d.ts` |

There is no root export: the bare specifier `@project-sothoth/cli` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, as do all unlisted subpaths.

## Usage

```sh
sothoth check --format json --input request.json
```

From this repository before publication: `node packages/cli/dist/main.js --help`. Full reference documentation lives at `docs/packages/cli.md` in the repository.

## License

Apache-2.0. Repository: `git+https://github.com/Phenol1145/sothoth.git`, directory `packages/cli`.