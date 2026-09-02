# Sothoth Governance Control Plane

Status: accepted design baseline

Version: `SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN-2`

Decision date: 2026-09-02

Implementation is gated by Dossier closure: no `@sothoth/*` package implementation is authorized until the retained
Design Scope Catalog candidates hold accepted Dossiers and an accepted Architecture Baseline.

<!-- sothoth:section id="decision" -->

## Decision

Sothoth is an independently maintained, stateless governance control plane. It reads exact, consumer-owned governance
and planning facts, validates closed constraints, and emits deterministic, digest-bearing projections. It is a compiler,
not an execution engine, final authority, database, daemon, forge, or free-text planner.

<!-- sothoth:section id="authority-boundary" -->

## Authority boundary

- Source Facts have one external accountable owner. Sothoth may read and reject them, never create or write them back.
- Projections are non-authoritative, disposable, and rebuildable from exact input identities.
- Git snapshots bind input bytes; the Git adapter never checks out, stages, commits, tags, or pushes.
- Rules can reject input but cannot grant business authority or choose top-level process outcomes.
- Consumer profiles assemble generic contracts without changing Core authority.

<!-- sothoth:section id="package-architecture" -->

## Package architecture

```text
@sothoth/cli -> @sothoth/sdk
@sothoth/sdk -> governance | planning | document-index | selectors | git | profile-sdk
governance | planning | document-index -> @sothoth/graph
all pure packages -> @sothoth/core -> @sothoth/contracts
```

`@sothoth/contracts` owns schemas and identities. `@sothoth/core` owns pure canonicalization, digesting, diagnostics, and
outcome aggregation. `@sothoth/graph` owns generic deterministic graph algorithms without relation meaning. Governance,
planning, document indexing, and selection remain independent domains. Git and CLI are I/O adapters. The public SDK is a
facade, not a second Core.

Core and Graph import no filesystem, Git, process, network, consumer path, FRACTA term, or executable API.

<!-- sothoth:section id="documents-and-selectors" -->

## Documents and selectors

The Document Index records exact artifact identity, normalized path, content digest, lifecycle metadata, parsed headings,
stable section identity, source spans, and explicit references. A stable section marker is an HTML comment of the exact
form `<!-- sothoth:section id="purpose" -->` immediately before a CommonMark heading.

A Document Contract constrains section identity, cardinality, order, depth, and explicit references. Heading wording may
change without changing a stable section identity. Contracts do not use prose substring assertions or rewrite documents.

Selectors use a closed canonical AST: boolean composition, exact identity, normalized path globs, kind/status/owner/tag,
explicit relation, diagnostic identity, and cardinality. They emit explain traces and never execute code or infer scope
from free text.

<!-- sothoth:section id="graphs-change-order-and-scheduling" -->

## Graphs, change order, and scheduling

Reference direction, authority dependency, and publication order are distinct. Only explicitly mapped
`normative-dependency` and `derivation` roles create `prerequisite -> dependent` ordering edges. Impact expands review
scope without creating order. Ordering cycles fail closed unless an externally declared Atomic Change Set is valid in one
final snapshot and contains no future commit identity.

The Change Plan Projection assigns `revise`, `revalidate`, `rebuild`, `invalidate-evidence`, `review-required`, or
`unchanged`, plus deterministic change waves and explain traces. It applies no edit.

Scheduling has one non-authoritative Schedule Solution across dependency, time, resource, assignment, placement, gate,
and release-train dimensions. Version 0.1 implements dependency and gate validation plus deterministic Waves. Other axes
remain explicit unsupported dimensions rather than silently ignored parallel truths.

<!-- sothoth:section id="pre-design-boundary" -->

## Pre-design boundary

The `0.1.0` candidate inventory is a revisable Design Scope Catalog, not a Scope BOM. It records provisional design
candidates and their design coverage only; it carries no release membership, completion gates, candidate digests, tarball
identities, or provenance claims. Before any formal Scope BOM may exist, every retained candidate requires one full
Dossier, one exact registration, a closed cross-artifact edge review, and an Architecture Baseline accepted by an
accountable human. A candidate inventory misnamed as a Scope BOM is downgraded to the catalog; implementation status can
never retroactively authorize it as release membership.

<!-- sothoth:section id="extensions-and-evidence" -->

## Extensions and evidence

Gate Macros are declarative templates that expand to acyclic exact Check References. Trusted Rule Modules are explicitly
installed, allowlisted, integrity-locked code running with Sothoth's process privilege; conformance is not a sandbox.
Evidence Checks run outside Sothoth. Sothoth validates the report's snapshot, check-definition, and result bindings.
Required unresolved evidence fails closed.

<!-- sothoth:section id="diagnostics-and-process-outcomes" -->

## Diagnostics and process outcomes

Diagnostic codes use `<owner>.<domain>/<condition>`. Structured diagnostics hold the origin, category, phase, verdict,
severity, rule, location, subjects, parameters, causes, help, and deterministic digest. CLI exits are `0 valid`, `1
invalid`, `2 invalid-input`, `3 extension-error`, and `4 internal-error`.

<!-- sothoth:section id="release-boundary" -->

## Release boundary

Sothoth 0.1.0 targets Apache-2.0 publication of eleven `@sothoth/*` packages from `Phenol1145/sothoth`. Until the
Pre-design boundary closes, those packages remain provisional Design Scope Catalog candidates and no formal Scope BOM
exists. Once Dossiers close and an Architecture Baseline is accepted, the formal Scope BOM becomes the release membership
authority. Candidate BOM, SBOM, provenance, and Release Lock bind the clean tagged commit and tarball bytes.
`@fracta/sothoth-profile` remains a companion FRACTA release, not a Sothoth package.
