# Repository Agent Protocol

This file governs automated contributors throughout the Sothoth repository. A more deeply nested `AGENTS.md`, if one is
introduced later, may narrow these rules for its subtree but may not silently broaden authority granted by the human task.

## Role and authority

- This is an execution protocol. It is not product design, a Source Fact, an acceptance act, or release authority.
- The direct human instruction and its task brief define the authorized objective, write paths, side effects, and stop
  conditions. A later human correction supersedes conflicting task text; ambiguity narrows authority rather than
  expanding it.
- Resolve product semantics from the exact accepted design facts under `docs/design/` and `docs/release/`, together with
  any specification or implementation plan named by the task. Never infer an implicit latest revision. An implementation
  plan may explain accepted design, but it may not override it.
- Agents may inspect, validate, implement, and report. They never manufacture human acceptance, business authority,
  release membership, or acceptance metadata.

## Design gate

Stop before implementation and return `NEEDS_CONTEXT` when a requested change lacks an accepted design decision and
would alter any of the following:

- a public package surface, contract, schema, diagnostic code, outcome, or compatibility promise;
- package ownership, dependency direction, Source Fact ownership, or projection authority;
- canonical bytes, deterministic ordering, purity, I/O, security, deployment, or trust boundaries;
- release membership, completion gates, acceptance state, provenance, or publication behavior.

Name the missing decision or revision precisely. Passing tests, existing code, projections, or implementation progress
cannot retroactively authorize a design change.

## Worktree and Git safety

- Before writing, inspect the current branch, HEAD, tracked and untracked changes, staged paths, and stashes. Preserve all
  pre-existing user work byte-for-byte unless the task explicitly places a path in scope.
- Never use destructive cleanup, broad checkout/reset, automatic stashing, history rewriting, or blanket staging. Stage
  only the exact authorized paths.
- Do not merge, push, tag, publish, create a release, or mutate a remote system unless the human task explicitly
  authorizes that side effect.
- Commit only when the task requests it. Use a focused conventional commit and verify the committed path set.
- Implementers do not dispatch subagents unless the task explicitly authorizes delegation. Reviewers are read-only except
  for an explicitly authorized report path and never repair the change they are reviewing.

## Dependencies and network

- Use the dependencies and tools already present in the workspace. Do not run installation, update, audit-fix, or network
  commands unless the task explicitly authorizes them.
- If a required dependency is absent, return `NEEDS_CONTEXT`; do not fetch it, substitute an unapproved library, or copy
  another installation tree.
- Change a manifest or lockfile only when it is an explicit task output. Mechanical lockfile maintenance must not admit a
  new dependency, change a version or integrity value, or reconcile unrelated toolchain drift.

## Implementation discipline

- Read this file, the complete task brief, and every authority-bearing file named by the task before editing. Convert the
  requirements into an exact path and verification checklist.
- For behavior changes, use test-driven development: demonstrate the intended RED failure, implement the smallest
  authorized change, then demonstrate focused GREEN and full regression GREEN. RED must fail for the intended missing
  behavior, not for an environment or suite-loading accident.
- Do not delete, skip, dilute, rewrite, or tautologically satisfy existing tests to manufacture GREEN. Test migration is
  allowed only when the task explicitly authorizes the changed contract or lifecycle fact.
- Keep deterministic and pure packages free of hidden I/O and environment dependence. Put I/O only behind an explicitly
  designed adapter boundary.
- Reuse the owning package's contracts and canonical primitives. Do not create a second truth source, parallel public
  identity, convenience export, wrapper, or fallback semantics without design authority.
- No placeholders, silent coercions, permissive unknown-field handling, undocumented fallback behavior, or speculative
  scope expansion.

## Source Facts and generated artifacts

- Treat accepted Dossiers, registrations, registries, Architecture Baselines, Scope BOMs, frozen fixtures, and acceptance
  records as immutable unless the task explicitly authorizes their exact paths and revisions.
- Validators and projections may read and reject Source Facts; they do not accept, repair, or write them back. Never
  synthesize `acceptedBy`, `acceptedAt`, approval, or release authority from a clock, environment, checker, test, model,
  or prior revision.
- Regenerate projections and fixtures only through the task-authorized deterministic procedure. Generated output is
  evidence, not authority, and must not be manually edited to match an assertion.
- Keep semantic source changes separate from candidate BOM, SBOM, provenance, Release Lock, and publication artifacts.

## Verification

- Run the task-focused tests and boundary checks named by the brief. For production-package changes, also run
  `npm run typecheck`, `npm test`, and `npm run build` before claiming completion.
- When design or release facts may be affected, also run `npm run check:design-scope`,
  `npm run check:pre-design:dossiers`, `npm run check:pre-design:closure`, and
  `npm run check:pre-design:scope`.
- Run `git diff --check`, inspect the final diff, verify the exact staged and committed path sets, and recheck that
  unrelated work and stashes are unchanged.
- Never report a check as passing without fresh command output. Distinguish verified results from execution history or
  facts that cannot be established from the final diff.

## Delivery report

Return one of `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`, followed by:

- the commit hash and exact subject, or an explicit statement that no commit was created;
- focused and full verification commands with exit codes and pass/fail counts;
- the final changed-path set and worktree/stash state;
- any remaining concern, design ambiguity, unverifiable execution-history claim, or authorization boundary;
- the absolute path of the detailed task report when the brief requires one.
