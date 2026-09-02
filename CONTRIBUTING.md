# Contributing

Sothoth accepts changes that preserve deterministic compilation, Source Fact ownership, projection non-authority, and
dependency-inward package boundaries.

## Development

```bash
npm ci
npm run check
```

Write one failing behavioral test before production code. Derive expected values independently, exercise real components,
and keep external I/O behind adapters. A pull request must state which public contract changes, which diagnostic codes can
be emitted, and why repeated compilation remains byte-identical.

## Commits

Use focused conventional commits. Do not combine generated release artifacts with semantic source changes. Candidate BOM,
SBOM, provenance, and Release Lock are produced only from a clean CI candidate.
