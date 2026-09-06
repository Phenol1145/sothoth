# Sothoth command guide for agents

Read this reference when selecting a Sothoth 0.1.0 CLI command, assembling its JSON request, chaining a projection into another command, or deciding what an outcome proves.

## Invocation contract

The CLI exposes exactly eight commands:

```text
change-plan
check
compile governance
compile planning
explain
index
select
verify-projection
```

Every invocation requires `--format <json|sarif|terminal>`. `--input <path>` and `--output <path>` are optional only because stdin and stdout are explicit alternatives. Unknown commands, options, formats, or stray positional paths fail closed.

Do not run `npx sothoth` unless dependency installation or registry resolution is already authorized: `npx` may contact npm when a local executable is absent. Prefer an existing `node_modules/.bin/sothoth`. Inside a built Sothoth checkout, use `node packages/cli/dist/main.js`.

## Command routing

| Question to answer | Command | Exact request shape |
|---|---|---|
| Do these design facts close? | `check` | `{ contract, catalog, registry, registrations, documents, documentIndex }` |
| Is this formal release scope admissible? | `compile governance` | Every `check` field plus `{ architectureBaseline, scopeBom }` |
| What dependency waves satisfy these tasks? | `compile planning` | `{ tasks, activeDimensions?, budgets? }` |
| What must be revised, rebuilt, revalidated, or reviewed after a change? | `change-plan` | `{ documentIndex, roleMapping, changedArtifactIds? | selector?, evidenceBindings? }` with exactly one change source |
| What structure and relations do these exact Markdown bytes contain? | `index` | `{ sources, budgets, compiler, cache? }` |
| Which indexed documents match? | `select` | `{ documentIndex, selector, budgets? }` |
| Why did each indexed document match or fail? | `explain` | `{ documentIndex, selector, budgets? }` |
| Does this projection's self-digest match its bytes? | `verify-projection` | `{ document, digestField }` |

Run only the command needed for the human's question. Chaining is justified only when a downstream request explicitly requires an upstream projection.

## Planning request

This is a complete minimal `compile planning` request:

```json
{
  "tasks": [
    { "taskId": "design", "dependsOn": [] },
    { "taskId": "implement", "dependsOn": ["design"] },
    { "taskId": "verify", "dependsOn": ["implement"] }
  ]
}
```

Optional budgets are positive integers:

```json
{
  "maxTasks": 10000,
  "maxDependencies": 100000
}
```

Sothoth 0.1.0 implements only the `dependency` dimension. Do not silently drop `assignment`, `gate`, `placement`, `release-train`, `resource`, or `time` when a human requests them; they are unsupported and fail closed.

## Document Index request

`index` requires exact content bytes and their digest. The agent may compute a digest from human-authorized bytes, but may not treat a discovered file as authoritative merely because it exists.

```json
{
  "sources": [
    {
      "artifactId": "DOC-EXAMPLE",
      "path": "docs/example.md",
      "version": "1",
      "content": "# Example\n",
      "contentDigest": "sha256:<digest-of-the-exact-content>",
      "blobSha": null,
      "kind": "dossier",
      "status": "proposed",
      "owner": "example-owner",
      "tags": [],
      "references": []
    }
  ],
  "budgets": {
    "maxContentCodeUnits": 2000000,
    "maxDocuments": 10000,
    "maxAstNodes": 500000,
    "maxRelationsPerDocument": 1000,
    "maxHeadingTextCodeUnits": 2000
  },
  "compiler": {
    "compilerId": "project-defined-compiler",
    "compilerRevision": 1
  }
}
```

Replace the digest placeholder before execution. Cache entries are optional acceleration witnesses and must not change projected bytes.

The CLI output is an outer `sothoth.cli/cli-invocation-result@1`. The SDK envelope is under `result`; the raw Document Index projection for downstream requests is under `result.result.projection`.

## Design Closure and Scope BOM Admissibility

`check` consumes:

- the exact Document Contract Source Fact;
- the Design Scope Catalog Source Fact;
- the Design Document Registry Source Fact;
- the Artifact Design Registrations Source Fact;
- exact registered document bytes keyed by document identity, using `null` only where the contract permits unavailable bytes;
- the raw Document Index projection built from those same authorized document bytes.

`compile governance` adds the exact accepted Architecture Baseline and the formal Scope BOM. Do not choose a “latest” revision. Bind every object to the identities and revisions named by the human task or accepted governing fact.

`check` returning a projection with `readyForAcceptance: true` is not acceptance. `compile governance` returning `admissible: true` is not release authorization.

## Change-plan request

A change plan requires a raw Document Index projection and an externally owned, explicit mapping:

```json
{
  "documentIndex": {},
  "roleMapping": {
    "schema": "sothoth.governance/relation-role-mapping@1",
    "mappingId": "PROJECT-MAPPING",
    "mappingRevision": 1,
    "entries": [
      {
        "relationRole": "requires",
        "edgeRole": "normative-dependency"
      }
    ]
  },
  "changedArtifactIds": ["DOC-EXAMPLE"]
}
```

Supply exactly one of `changedArtifactIds` or `selector`. Do not invent a relation-role mapping from relation names. The projection applies no edits; `impact` expands review scope but does not create ordering.

## Select and explain requests

Both commands require a raw Document Index projection and a selector:

```json
{
  "documentIndex": {},
  "selector": {
    "kind": { "any": ["dossier"] }
  }
}
```

Replace the empty projection with `index` output at `result.result.projection`. `select` is for the match set; `explain` uses the same evaluation and exposes the trace for agent reporting. Neither command searches files outside the supplied projection.

## Projection digest verification

```json
{
  "document": {},
  "digestField": "indexDigest"
}
```

Replace `document` with the complete projection. `digestField` names that projection's self-digest. Do not assume every field ending in `Digest` is a whole-document self-digest: for example, `sourceFactsDigest` binds source inputs and is not necessarily verified by removing that field and hashing the remaining projection.

A matching digest proves byte integrity for the supplied document only. It does not establish provenance, source authority, acceptance, freshness, registry publication, or release eligibility.

## Output and reporting

For `json`, inspect:

- outer `schema`, `command`, `outcome`, `exitCode`, and `diagnostics`;
- SDK `result.capability`, `result.operation`, and `result.contractRefs`;
- owner result or projection under `result.result`.

Exit `1`, `2`, or `3` is a completed fail-closed result, not automatically a crashed command. Exit `4` is the internal failure class. In every case, preserve the complete output and report the exact diagnostic codes and subjects before proposing an authorized next action.
