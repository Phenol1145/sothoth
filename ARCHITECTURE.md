# Sothoth Architecture

This document records the `0.1.0` architecture of the Sothoth governance control plane as implemented in this repository. It is derived from the workspace manifests, the accepted Architecture Baseline (`SOTHOTH-ARCHITECTURE-BASELINE-0.1@3`, `docs/design/v0.1.0-architecture-baseline.json`), the formal Scope BOM (`SOTHOTH-RELEASE-SCOPE-BOM-0.1@3`, `docs/release/v0.1.0-scope-bom.json`), and each package's accepted Dossier under `docs/design/dossiers/`. Where this document and an accepted design fact disagree, the design fact governs.

## System boundary

Sothoth compiles exact design facts — accepted documentation, registries, ledgers, registrations, and Git source snapshots — into deterministic, digest-bearing projections, and rejects everything it cannot prove. It never creates, modifies, stages, commits, tags, pushes, or dispatches consumer Source Facts, and it owns no human acceptance: validators read and reject; they never write back.

## Dependency DAG (manifest-verified)

Every edge below is a runtime dependency declared in the corresponding `packages/<p>/package.json` at version `0.1.0`. There are no other Sothoth-internal edges and no cycles.

| Package | Declared runtime dependencies |
|---|---|
| `@sothoth/contracts` | — (none; zero-dependency floor) |
| `@sothoth/core` | `@sothoth/contracts` |
| `@sothoth/graph` | `@sothoth/contracts`, `@sothoth/core` |
| `@sothoth/document-index` | `@sothoth/contracts`, `@sothoth/core`, `@sothoth/graph`, `mdast-util-from-markdown@2.0.2` (external, exact pin) |
| `@sothoth/selectors` | `@sothoth/contracts`, `@sothoth/core`, `@sothoth/document-index` |
| `@sothoth/governance` | `@sothoth/contracts`, `@sothoth/core`, `@sothoth/document-index`, `@sothoth/graph`, `@sothoth/selectors` |
| `@sothoth/planning` | `@sothoth/contracts`, `@sothoth/core`, `@sothoth/graph`, `@sothoth/selectors` |
| `@sothoth/profile-sdk` | `@sothoth/contracts`, `@sothoth/core` |
| `@sothoth/git` | `@sothoth/contracts`, `@sothoth/core` |
| `@sothoth/sdk` | `@sothoth/contracts`, `@sothoth/core`, `@sothoth/document-index`, `@sothoth/git`, `@sothoth/governance`, `@sothoth/planning`, `@sothoth/profile-sdk`, `@sothoth/selectors` |
| `@sothoth/cli` | `@sothoth/sdk` |

Notes verified from the manifests:

- `@sothoth/planning` does **not** depend on `@sothoth/document-index`; its inputs arrive as values.
- `@sothoth/document-index` carries the workspace's only external runtime dependency, the CommonMark parser `mdast-util-from-markdown@2.0.2` (no range), whose pinned `micromark@4.0.2` subtree (MIT) is a release consequence recorded in the CycloneDX SBOM. All parser packages are pinned at the root dev-dependency level.
- `@sothoth/contracts` declares zero runtime dependencies (the dependency floor).
- Topological publication order derived from this DAG: `contracts`, `core`, `git`, `graph`, `profile-sdk`, `document-index`, `selectors`, `governance`, `planning`, `sdk`, `cli`.

## Layers

1. **Foundation** — [`@sothoth/contracts`](docs/packages/contracts.md) owns the closed vocabulary; [`@sothoth/core`](docs/packages/core.md) owns canonical bytes, digests, and outcome aggregation. Nothing in the workspace may bypass them.
2. **Algorithms** — [`@sothoth/graph`](docs/packages/graph.md) provides meaning-free multigraph algorithms ordered by caller keys.
3. **Documents** — [`@sothoth/document-index`](docs/packages/document-index.md) projects CommonMark structure deterministically.
4. **Selection / compilation** — [`@sothoth/selectors`](docs/packages/selectors.md) (closed selector algebra), [`@sothoth/governance`](docs/packages/governance.md) (closure, admissibility, change plans, gate macros), [`@sothoth/planning`](docs/packages/planning.md) (dependency-wave schedules).
5. **Boundaries** — [`@sothoth/profile-sdk`](docs/packages/profile-sdk.md) (consumer-neutral profiles) and [`@sothoth/git`](docs/packages/git.md) (read-only source adapter) each sit on an explicit edge of the trust boundary.
6. **Facade** — [`@sothoth/sdk`](docs/packages/sdk.md) is the sole aggregate public library surface; it delegates every semantic operation and owns no domain truth.
7. **Operator adapter** — [`@sothoth/cli`](docs/packages/cli.md) composes the facade into eight explicit commands and owns process I/O and the frozen exit mapping.

## Boundary obligations

- **Purity:** `@sothoth/core` and `@sothoth/graph` import no filesystem, Git, process, network, consumer paths, FRACTA names, or external executables. `@sothoth/core`'s only sanctioned non-package import is `node:crypto`.
- **Closed surfaces:** every package's exports map equals its accepted Dossier `public-surface-declaration@1` exactly; unauthorized specifiers fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Nine packages (`graph`, `document-index`, `selectors`, `governance`, `planning`, `profile-sdk`, `git`, `sdk`, `cli`) have no root export by design.
- **Determinism:** projection bytes are deterministic for the same canonical input, version, profile, rule lock, and budget; ordering never depends on arrival order or environment state.
- **Adapter confinement:** all Git execution lives in `@sothoth/git` behind a frozen read-only subcommand allowlist; all process I/O and exit-code choice live in `@sothoth/cli`; the SDK and every library package never exit the process.
- **No authority in code:** no package synthesizes acceptance, approval, release membership, or publication state from a clock, environment, checker, test, or prior revision.

## Release packaging

- All eleven packages are `0.1.0`, Apache-2.0, published from `packages/<p>` with `files: ["dist", "README.md", "LICENSE"]`, `publishConfig.access: public`, and provenance enabled; tarballs contain declarations and JavaScript only — no tests, sources, source maps, secrets, or repository-internal design files.
- Release verification (`npm run release:verify`) proves the local pack surface: two reproducible packs, byte-identical tarballs, SHA-512 digests in distinct hex/SRI representations, a CycloneDX SBOM including the MIT parser subtree, the pre-publication Candidate BOM bound to the clean source commit and Scope BOM `@3`, and an offline CLI install smoke from the local tarballs. All of it is repository evidence, not registry evidence; per-package publication evidence is recorded from the live npm registry by the release task that actually publishes.

## Pointers

- Accepted Dossiers: `docs/design/dossiers/<package>.md` (one per package, each carrying its `public-surface-declaration@1`).
- Governance control plane design: `docs/design/governance-control-plane.md`.
- Formal release scope: `docs/release/v0.1.0-scope-bom.json` (`SOTHOTH-RELEASE-SCOPE-BOM-0.1@3`).
- Release-candidate notes: `docs/release/v0.1.0-release-notes.md`.
- Package references: `docs/packages/`.
