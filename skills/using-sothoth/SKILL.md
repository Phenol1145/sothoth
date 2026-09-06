---
name: using-sothoth
description: Use when an agent needs to validate Sothoth design Source Facts, compile governance or planning projections, index or select documents, build change plans, or verify projection digests with the Sothoth CLI or SDK.
---

# Using Sothoth

## Core boundary

Sothoth validates explicit facts and emits deterministic evidence. It does not discover authoritative inputs, repair Source Facts, accept revisions, or authorize Git, release, registry, or deployment actions. A `valid` result never broadens the human's authority grant.

## Before running

1. Read the project instructions and the human task. Record the allowed input paths, output paths, mutations, network use, and external side effects.
2. Resolve an already available executable and its version. Prefer `node_modules/.bin/sothoth`; inside a built Sothoth checkout use `node packages/cli/dist/main.js`. Do not install, update, or contact npm unless explicitly authorized.
3. Choose the smallest single command that answers the stated question. Do not run the entire command surface “for completeness.”
4. List every request field and its provenance. If an authoritative value, identity, revision, mapping, or exact document byte is missing, stop with `NEEDS_CONTEXT`; do not infer it from a filename, working tree, clock, or prior projection.
5. Use the human-named output path or stdout. Do not invent a persistent or temporary evidence location without authorization.

Read [references/command-guide.md](references/command-guide.md) before first use, when choosing a command, or when assembling its JSON request.

## Execute and interpret

Use one explicit request object and a required format:

```sh
node_modules/.bin/sothoth <command> --format json --input <request.json> --output <result.json>
```

The parent directory of an output must already exist. With no `--input`, the CLI reads stdin; with no `--output`, it emits exactly one document to stdout. Never pass a directory as an implicit input root.

Treat each exit as a completed Sothoth outcome, then decide whether the surrounding task must stop:

| Exit | Outcome | Agent response |
|---:|---|---|
| 0 | `valid` | Preserve evidence; request human authority before another lifecycle phase |
| 1 | `invalid` | Report rule or digest failure; do not weaken checks |
| 2 | `invalid-input` | Correct only authorized inputs; never invent missing facts |
| 3 | `extension-error` | Report the selected extension failure; do not substitute another |
| 4 | `internal-error` | Preserve inputs/output and diagnose before retrying |

Read downstream projections from `result.result`, not from the outer CLI envelope. Forward diagnostic codes, subjects, causes, and help without changing their verdict.

## Delivery report

Report the executable/version, exact command, input identities and paths, output path or stdout, outcome, exit code, diagnostic codes, changed paths, and unresolved human decisions. State explicitly that no acceptance or external authority was inferred.

For the human collaboration model, point the user to the repository [Quick Start](../../docs/quick-start.md) and [User Guide](../../docs/user-guide.md).
