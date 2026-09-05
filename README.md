# Sothoth

**Sothoth** is a deterministic governance control plane for exact design facts: it compiles accepted design documentation, registries, and Git source snapshots into digest-bearing, reproducible projections — and rejects everything it cannot prove.

| | |
|---|---|
| Status | `0.1.0` release candidate — **not yet published on npm** |
| License | Apache-2.0 |
| Node | `>=22.14.0` |
| Scope | `@project-sothoth/*` — eleven packages, one release train (`SOTHOTH-RELEASE-SCOPE-BOM-0.1@4`) |
| Repository | `github.com/Phenol1145/sothoth` |

## Quick Start

Sothoth is not yet available from a registry; build and run it from this repository (Node `>=22.14.0`, npm workspaces):

```sh
git clone https://github.com/Phenol1145/sothoth.git
cd sothoth
npm ci
npm run build
npm test
```

Run the command-line surface from the repository:

```sh
node packages/cli/dist/main.js --help
node packages/cli/dist/main.js check --format json --input request.json
```

After publication (a later release step, not yet performed), installation is expected to be `npm install @project-sothoth/sdk` and `npm install @project-sothoth/cli`; until then those commands will not find the packages on the registry.

## Packages (11)

| Package | Layer | Responsibility |
|---|---|---|
| [`@project-sothoth/contracts`](docs/packages/contracts.md) | Foundation | Closed public contracts: identities, schemas, diagnostics, projections, extension contracts. Zero runtime dependencies. |
| [`@project-sothoth/core`](docs/packages/core.md) | Foundation | Pure deterministic kernel: canonical JSON, SHA-256 digests, code-point order, diagnostic and outcome aggregation, exit mapping. |
| [`@project-sothoth/graph`](docs/packages/graph.md) | Algorithms | Meaning-free directed multigraph toolkit: traversal, SCC, condensation, waves, longest paths. |
| [`@project-sothoth/document-index`](docs/packages/document-index.md) | Documents | Deterministic CommonMark structural indexing over the pinned `mdast-util-from-markdown@2.0.2` parser. |
| [`@project-sothoth/selectors`](docs/packages/selectors.md) | Selection | Closed declarative selector algebra with deterministic matching, cardinality, and explain. |
| [`@project-sothoth/governance`](docs/packages/governance.md) | Governance | Registry/ledger validation, pre-design closure, Scope BOM admissibility, change plans, gate macros. |
| [`@project-sothoth/planning`](docs/packages/planning.md) | Planning | Dependency-constraint validation and deterministic topological wave schedules. |
| [`@project-sothoth/profile-sdk`](docs/packages/profile-sdk.md) | Consumer boundary | Consumer-neutral Consumer Profile contract, loading, and conformance. |
| [`@project-sothoth/git`](docs/packages/git.md) | Source adapter | Read-only Git snapshots through a frozen subcommand allowlist; digest-bearing provenance. |
| [`@project-sothoth/sdk`](docs/packages/sdk.md) | Facade | The sole aggregate public library facade delegating to every owning package. |
| [`@project-sothoth/cli`](docs/packages/cli.md) | Operator adapter | Eight explicit commands, atomic explicit output, frozen exit mapping. |

All eleven are members of the formal release scope (`docs/release/v0.1.0-scope-bom.json`, `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4`), version exactly `0.1.0`, Apache-2.0.

## Architecture

Sothoth is a strict dependency DAG — lower layers never know higher layers exist (topological layers, manifest-verified):

```
L1  contracts
L2  core                 (→ contracts)
L3  graph                (→ contracts, core)
L4  document-index       (→ contracts, core, graph, mdast-util-from-markdown@2.0.2)
L5  selectors            (→ contracts, core, document-index)
L6  governance           (→ contracts, core, document-index, graph, selectors)
L6  planning             (→ contracts, core, graph, selectors)
L6  profile-sdk          (→ contracts, core)
L6  git                  (→ contracts, core)
L7  sdk                  (→ the eight non-graph packages above)
L8  cli                  (→ sdk)
```

The exact edges, layering rules, and boundary obligations are documented in [ARCHITECTURE.md](ARCHITECTURE.md); the authoritative design facts live in the accepted Dossiers under `docs/design/dossiers/` and the governance control plane design under `docs/design/`.

## Design principles

- **Determinism first** — same canonical input, version, profile, rule lock, and budget always produce the same projection bytes.
- **Closed surfaces** — every package exports exactly its accepted `public-surface-declaration@1`; unauthorized specifiers fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Fail closed with structure** — rejection is a Structured Diagnostic document, never an exception leak, silent empty set, or best-effort output.
- **Purity where it belongs** — `@project-sothoth/core` and `@project-sothoth/graph` touch no filesystem, Git, process, network, clock, or locale; all I/O lives behind the designed adapters (`@project-sothoth/git`, `@project-sothoth/cli`).
- **No authority in code** — validators read and reject Source Facts; they never accept, repair, or write them back. Human acceptance is never synthesized.

## Development

```sh
npm run build                          # compile all workspaces (tsc -b)
npm run typecheck                      # typecheck without emitting
npm test                               # full suite (vitest)
npm run check:design-scope             # design scope catalog check
npm run check:pre-design:dossiers      # pre-design phase checks
npm run check:pre-design:closure
npm run check:pre-design:scope
npm run release:sync                   # regenerate package README/LICENSE assets
npm run release:pack                   # pack all 11 packages into dist/release/pack
npm run release:verify                 # full release verification battery
```

`npm run release:verify` performs typecheck, a clean build, the full test suite, boundary scans, docs-link checks, deterministic asset sync, two reproducible packs of all eleven packages, tarball byte and SHA-512 comparison, a CycloneDX SBOM, the pre-publication Candidate BOM, and an offline local-tarball CLI install smoke. Its outputs are local repository evidence under gitignored `dist/release/` — they are not registry evidence.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — layering, dependency DAG, boundary obligations.
- [Package references](docs/packages/contracts.md) — one reference per package: `contracts`, `core`, `graph`, `document-index`, `selectors`, `governance`, `planning`, `profile-sdk`, `git`, `sdk`, `cli` (see `docs/packages/`).
- [0.1.0 release notes](docs/release/v0.1.0-release-notes.md) — release-candidate notes (pre-publication).
- `docs/design/` — accepted Dossiers, registrations, Architecture Baseline, and the governance control plane design.
- `docs/release/v0.1.0-scope-bom.json` — the formal Scope BOM (`SOTHOTH-RELEASE-SCOPE-BOM-0.1@4`).
- [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) — contribution and security policy.

## Roadmap and limitations

- `0.1.0` is the initial release candidate. It is **not yet published on npm**; publication evidence for `@project-sothoth/contracts`, `@project-sothoth/governance`, `@project-sothoth/profile-sdk`, and `@project-sothoth/sdk` is pending until it is recorded from the live registry.
- The CLI ships exactly eight commands; planning implements the dependency-wave dimension only; document indexing is CommonMark-structural only.
- `@fracta/sothoth-profile` is a companion FRACTA Release Train and is never published from this repository; this repository contains no FRACTA adapters, policies, or runtime integration.
- Toolchain drift note: the environment that produced this candidate ran npm `11.11.0` against a declared `packageManager` of `11.15.0`; the drift is recorded, not reconciled.

## License

Apache-2.0 — see [LICENSE](LICENSE). Each published package carries the same license text.
