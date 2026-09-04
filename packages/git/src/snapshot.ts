/**
 * Public module `@sothoth/git/snapshot`: the digest-bearing Git source
 * snapshot contract `CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1`.
 *
 * This module declares the closed snapshot vocabulary of the read-only Git
 * source adapter: the schema identity, the three provenance bindings
 * (`commit`, `compare`, `workspace`) with their non-confusable structured
 * identities `sothoth.git/commit-snapshot@1`, `sothoth.git/compare-snapshot@1`,
 * and `sothoth.git/workspace-snapshot@1`, the four workspace byte classes,
 * the enforced budget set, the single declared observation identity
 * `sothoth.git/git-adapter-diagnostic@1` under the Structured Diagnostic
 * vocabulary of `@sothoth/contracts`, and the error that every fail-closed
 * path raises. Diagnostic finalization and outcome folding are consumed
 * directly from `@sothoth/core` (`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`);
 * no parallel diagnostic, digest, or snapshot vocabulary is invented here.
 *
 * A workspace snapshot binds the explicit HEAD/index/unstaged/untracked
 * composition for local feedback only and can never be presented as
 * commit-bound evidence: its binding carries the workspace identity, lists
 * every participating byte class, and its canonical bytes never contain a
 * commit-snapshot identity. Over-budget requests fail closed; truncated
 * bytes are never returned with a success verdict.
 */

import type {
  CompilationOutcomeV1,
  DiagnosticCategoryV1,
  DiagnosticDraftV1,
  JsonValue,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
import { finalizeDiagnostics } from "@sothoth/core/diagnostics";
import { aggregateOutcome } from "@sothoth/core/outcome";

/** The schema identity every Git source snapshot carries. */
export const GIT_SOURCE_SNAPSHOT_SCHEMA_V1 = "sothoth.git/source-snapshot@1";

/**
 * The one observation identity every Git adapter diagnostic carries, exactly
 * as the Dossier declares it: `sothoth.git/git-adapter-diagnostic@1`.
 */
export const GIT_ADAPTER_DIAGNOSTIC_IDENTITY_V1 = "sothoth.git/git-adapter-diagnostic@1";

/** The closed byte-class set a workspace snapshot can participate through. */
export const GIT_BYTE_CLASSES_V1 = ["head", "index", "unstaged", "untracked"] as const;

/** A workspace byte class member of `GIT_BYTE_CLASSES_V1`. */
export type GitByteClassV1 = (typeof GIT_BYTE_CLASSES_V1)[number];

/**
 * One exact byte source bound to its normalized repository-relative POSIX
 * path, its Git object identity, its exact byte count, and the sha256 digest
 * of the exact bytes the adapter read.
 */
export interface GitBoundFileV1 {
  readonly path: string;
  readonly blob: string;
  readonly byteCount: number;
  readonly digest: string;
}

/** The exact-commit-tree-blob binding of `commit` mode. */
export interface GitCommitBindingV1 {
  readonly kind: "sothoth.git/commit-snapshot@1";
  readonly mode: "commit";
  readonly commit: string;
  readonly tree: string;
}

/** A commit snapshot: every tracked file bound to exact bytes. */
export interface GitCommitSnapshotV1 {
  readonly schema: typeof GIT_SOURCE_SNAPSHOT_SCHEMA_V1;
  readonly binding: GitCommitBindingV1;
  readonly files: readonly GitBoundFileV1[];
  readonly workspace: null;
  readonly digest: string;
}

/** One changed path between two exact trees, with both bound sides. */
export interface GitCompareFileV1 {
  readonly path: string;
  readonly base: GitBoundFileV1 | null;
  readonly head: GitBoundFileV1 | null;
}

/** The exact-base-head binding of `compare` mode. */
export interface GitCompareBindingV1 {
  readonly kind: "sothoth.git/compare-snapshot@1";
  readonly mode: "compare";
  readonly baseCommit: string;
  readonly baseTree: string;
  readonly headCommit: string;
  readonly headTree: string;
}

/** A compare snapshot: every path that differs between base and head. */
export interface GitCompareSnapshotV1 {
  readonly schema: typeof GIT_SOURCE_SNAPSHOT_SCHEMA_V1;
  readonly binding: GitCompareBindingV1;
  readonly files: readonly GitCompareFileV1[];
  readonly workspace: null;
  readonly digest: string;
}

/** The head-index-unstaged-untracked binding of `workspace` mode. */
export interface GitWorkspaceBindingV1 {
  readonly kind: "sothoth.git/workspace-snapshot@1";
  readonly mode: "workspace";
  readonly headCommit: string;
  readonly headTree: string;
  readonly byteClasses: readonly GitByteClassV1[];
}

/**
 * One workspace participation entry. `head` and `index` entries carry the Git
 * object identity of their side (and the index side its exact read bytes);
 * `unstaged` and `untracked` entries bind participation only, because the
 * closed subcommand allowlist exposes no byte source for worktree-only bytes.
 */
export interface GitWorkspaceFileV1 {
  readonly path: string;
  readonly byteClass: GitByteClassV1;
  readonly blob: string | null;
  readonly byteCount: number | null;
  readonly digest: string | null;
}

/** The explicit workspace composition: paths per changing byte class. */
export interface GitWorkspaceCompositionV1 {
  readonly staged: readonly string[];
  readonly unstaged: readonly string[];
  readonly untracked: readonly string[];
}

/** A workspace snapshot: the explicit local composition, never evidence. */
export interface GitWorkspaceSnapshotV1 {
  readonly schema: typeof GIT_SOURCE_SNAPSHOT_SCHEMA_V1;
  readonly binding: GitWorkspaceBindingV1;
  readonly files: readonly GitWorkspaceFileV1[];
  readonly workspace: GitWorkspaceCompositionV1;
  readonly digest: string;
}

/** The Git source snapshot contract, discriminated by its binding mode. */
export type GitSourceSnapshotV1 =
  | GitCommitSnapshotV1
  | GitCompareSnapshotV1
  | GitWorkspaceSnapshotV1;

/** The enforced budget set; every member is a positive integer byte or count bound. */
export interface GitBudgetsV1 {
  readonly fileCount: number;
  readonly perFileByte: number;
  readonly processOutput: number;
  readonly totalByte: number;
}

/** The default budgets applied when a caller supplies none. */
export const DEFAULT_GIT_BUDGETS_V1: GitBudgetsV1 = {
  fileCount: 5000,
  perFileByte: 1 << 20,
  processOutput: 1 << 24,
  totalByte: 1 << 28,
};

/** One fail-closed finding before it becomes a Structured Diagnostic draft. */
export interface GitFindingV1 {
  readonly code: string;
  readonly category: DiagnosticCategoryV1;
  readonly subject: string;
  readonly parameters?: Readonly<Record<string, JsonValue>> | undefined;
  readonly causes: readonly string[];
  readonly help: readonly string[];
}

/**
 * Builds one Structured Diagnostic draft under the declared single
 * observation identity. The rule identity is the code; the subject is the
 * exact ref, path, subcommand, or repository root the finding is about.
 */
export function gitFindingDraftV1(finding: GitFindingV1): DiagnosticDraftV1 {
  return {
    code: finding.code,
    origin: GIT_ADAPTER_DIAGNOSTIC_IDENTITY_V1,
    category: finding.category,
    phase: "read",
    verdict: "fail",
    severity: "error",
    ruleId: finding.code,
    location: null,
    subjects: [finding.subject],
    parameters: finding.parameters ?? {},
    causes: [...finding.causes],
    help: [...finding.help],
  };
}

/**
 * The error every fail-closed adapter and runner path raises: finalized,
 * ordered, deduplicated Structured Diagnostics under
 * `sothoth.git/git-adapter-diagnostic@1`, folded through Core's aggregation
 * into the single process outcome.
 */
export class GitSourceAdapterError extends Error {
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly outcome: CompilationOutcomeV1;

  constructor(drafts: readonly DiagnosticDraftV1[], message: string) {
    super(message);
    this.name = "GitSourceAdapterError";
    this.diagnostics = finalizeDiagnostics(drafts);
    this.outcome = aggregateOutcome(this.diagnostics);
  }
}
