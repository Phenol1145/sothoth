/**
 * Internal shared unit of `@sothoth/git` and the public home of the three
 * provenance modes (`@sothoth/git/commit`, `/compare`, and `/workspace`).
 *
 * The accepted Dossier's public-surface declaration lists exactly six public
 * modules — `@sothoth/git/commit`, `/compare`, `/path`, `/process`,
 * `/snapshot`, and `/workspace` — and no root `.` or `./index` entry, so the
 * exports map routes the three mode subpaths here while `/path`, `/process`,
 * and `/snapshot` own their own modules. This unit builds
 * `createGitSourceAdapterV1`, the plan-pinned callable whose
 * `snapshotCommit`, `snapshotCompare`, and `snapshotWorkspace` methods bind
 * exact commit/tree/blob bytes, exact base/head sides, and the explicit
 * head/index/unstaged/untracked composition through the closed process
 * boundary of `src/runner.ts`. Everything here is read-only: the adapter
 * never checks out, stages, commits, tags, or pushes, and every input that
 * cannot be normalized, resolved, or bounded fails closed with one
 * structured diagnostic under `sothoth.git/git-adapter-diagnostic@1`.
 *
 * Ordering is Unicode code point throughout, tie-breaking by canonical
 * identity (path, then byte class); identical requests yield identical
 * bytes. Canonicalization, digesting, and outcome folding are owned by
 * `@sothoth/core` and `@sothoth/contracts` and are consumed directly.
 */

import { canonicalJson } from "@sothoth/core/canonical-json";
import { sha256Digest } from "@sothoth/core/digest";
import type { JsonValue } from "@sothoth/contracts";
import { normalizeGitPathV1, symlinkTargetEscapesRepositoryV1 } from "./paths.js";
import type { GitPathRejectionClassV1 } from "./paths.js";
import { runGitReadV1 } from "./runner.js";
import {
  DEFAULT_GIT_BUDGETS_V1,
  GIT_SOURCE_SNAPSHOT_SCHEMA_V1,
  GitSourceAdapterError,
  gitFindingDraftV1,
} from "./snapshot.js";
import type {
  GitBoundFileV1,
  GitBudgetsV1,
  GitByteClassV1,
  GitCommitSnapshotV1,
  GitCompareFileV1,
  GitCompareSnapshotV1,
  GitWorkspaceSnapshotV1,
} from "./snapshot.js";

export * from "./snapshot.js";

/** Matches the closed exact-ref grammar: an alphanumeric first character and
 *  then alphanumerics, dots, slashes, underscores, and hyphens. Floating
 *  suffixes (`~`, `^`, `@{}`), options, and whitespace are inexpressible. */
const EXACT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Full lowercase hex object identities (SHA-1 and SHA-256 lengths). */
const HEX_OBJECT_PATTERN = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;

/** Matches the all-zero placeholder porcelain and raw diff use for a side
 *  that does not exist (40 zeros under SHA-1, 64 under SHA-256). */
const NULL_OBJECT_PATTERN = /^0+$/;

/** The plan-pinned callable's options: exact budgets, or the defaults. */
export interface GitSourceAdapterOptionsV1 {
  readonly budgets?: GitBudgetsV1 | undefined;
}

/** The read-only Git source adapter surface. */
export interface GitSourceAdapterV1 {
  snapshotCommit(repositoryRoot: string, ref: string): Promise<GitCommitSnapshotV1>;
  snapshotCompare(repositoryRoot: string, baseRef: string, headRef: string): Promise<GitCompareSnapshotV1>;
  snapshotWorkspace(repositoryRoot: string): Promise<GitWorkspaceSnapshotV1>;
}

interface BudgetStateV1 {
  readonly budgets: GitBudgetsV1;
  totalRead: number;
}

function failClosed(
  code: string,
  subject: string,
  parameters: Readonly<Record<string, JsonValue>>,
  causes: readonly string[],
  help: readonly string[],
): never {
  throw new GitSourceAdapterError(
    [gitFindingDraftV1({ code, category: "input", subject, parameters, causes, help })],
    `${code}: ${causes.join("; ")}`,
  );
}

/** Compares two strings by Unicode code point (never UTF-16 unit order). */
function compareCodePointOrder(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const limit = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < limit; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!;
    if (difference !== 0) {
      return difference;
    }
  }
  return leftPoints.length - rightPoints.length;
}

const BYTE_CLASS_ORDER: Readonly<Record<GitByteClassV1, number>> = {
  head: 0,
  index: 1,
  unstaged: 2,
  untracked: 3,
};

/** Freezes an adapter-built value tree in place; caller input is never frozen. */
function deepFreezeInPlace<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreezeInPlace((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function validateBudgetsV1(budgets: GitBudgetsV1): void {
  for (const key of ["fileCount", "perFileByte", "processOutput", "totalByte"] as const) {
    const value = budgets[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      failClosed(
        "sothoth.git/invalid-budgets",
        `budgets.${key}`,
        { key },
        [`${key} must be a positive integer`],
        ["Pass positive integers for fileCount, perFileByte, processOutput, and totalByte."],
      );
    }
  }
}

function validateRepositoryRootV1(repositoryRoot: string): void {
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0 || !repositoryRoot.startsWith("/")) {
    failClosed(
      "sothoth.git/invalid-request",
      "repositoryRoot",
      {},
      ["repositoryRoot must be a non-empty absolute path"],
      ["Pass the absolute path of the local repository root."],
    );
  }
}

function validateExactRefV1(ref: string): void {
  if (
    typeof ref !== "string" ||
    ref.length === 0 ||
    !EXACT_REF_PATTERN.test(ref) ||
    ref.includes("..") ||
    ref.includes("//") ||
    ref.endsWith("/") ||
    ref.endsWith(".lock")
  ) {
    failClosed(
      "sothoth.git/invalid-ref",
      typeof ref === "string" && ref.length > 0 ? ref : "<empty>",
      {},
      ["only exact refs resolve: no floating suffixes, options, or empty names"],
      ["Pass an exact ref such as HEAD, refs/heads/main, or a full hexadecimal identity."],
    );
  }
}

/** Runs one allowlisted read through the closed process boundary. */
function readText(
  repositoryRoot: string,
  arguments_: readonly string[],
  budgets: GitBudgetsV1,
): Promise<string> {
  return runGitReadV1({
    repositoryRoot,
    arguments: arguments_,
    processOutputBudget: budgets.processOutput,
  }).then((output) => output.stdout.toString("utf8"));
}

function resolveExactObjectV1(repositoryRoot: string, ref: string, budgets: GitBudgetsV1): Promise<string> {
  return readText(repositoryRoot, ["rev-parse", "--verify", "--end-of-options", ref], budgets).then(
    (output) => {
      const resolved = output.trim();
      if (!HEX_OBJECT_PATTERN.test(resolved)) {
        failClosed(
          "sothoth.git/unknown-ref",
          ref,
          {},
          [`ref "${ref}" did not resolve to a full object identity`],
          ["Pass an exact ref that resolves to exactly one full hexadecimal identity."],
        );
      }
      return resolved;
    },
  );
}

interface TreeEntryV1 {
  readonly mode: string;
  readonly type: string;
  readonly object: string;
  readonly path: string;
}

function rejectUnexpectedOutputV1(subject: string, cause: string): never {
  failClosed(
    "sothoth.git/unexpected-git-output",
    subject,
    {},
    [cause],
    ["This repository state is outside the supported output shape."],
  );
}

function rejectUnsafePathV1(path: string, rejectedClass: GitPathRejectionClassV1, reason: string): never {
  failClosed(
    "sothoth.git/unsafe-path",
    path,
    { class: rejectedClass },
    [reason],
    ["The repository must present only normalizable repository-relative POSIX paths."],
  );
}

function normalizeListedPathV1(path: string): string {
  const normalized = normalizeGitPathV1(path);
  if (!normalized.ok) {
    rejectUnsafePathV1(path, normalized.rejectedClass, normalized.reason);
  }
  return normalized.path;
}

function rejectSubmoduleContentsV1(path: string, where: string): never {
  failClosed(
    "sothoth.git/submodule-contents",
    path,
    { path },
    [`"${path}" is a gitlink at ${where}; submodule contents live in another repository`],
    ["Remove the gitlink, or request a repository without submodule entries."],
  );
}

/** Lists one tree recursively; gitlinks fail closed as submodule contents. */
async function listTreeV1(
  repositoryRoot: string,
  treeIsh: string,
  budgets: GitBudgetsV1,
): Promise<readonly TreeEntryV1[]> {
  const output = await readText(repositoryRoot, ["ls-tree", "-r", "-z", treeIsh], budgets);
  const entries: TreeEntryV1[] = [];
  for (const record of output.split("\0")) {
    if (record.length === 0) {
      continue;
    }
    const separator = record.indexOf("\t");
    if (separator < 0) {
      rejectUnexpectedOutputV1("ls-tree", "ls-tree emitted a record without a path separator");
    }
    const meta = record.slice(0, separator).split(" ");
    const path = record.slice(separator + 1);
    if (meta.length !== 3 || !/^[0-9]{6}$/.test(meta[0]!) || !HEX_OBJECT_PATTERN.test(meta[2]!)) {
      rejectUnexpectedOutputV1("ls-tree", "ls-tree emitted a record outside the closed shape");
    }
    const mode = meta[0]!;
    const normalized = normalizeListedPathV1(path);
    if (mode === "160000") {
      rejectSubmoduleContentsV1(normalized, "HEAD");
    }
    entries.push({ mode, type: meta[1]!, object: meta[2]!, path: normalized });
  }
  return entries;
}

interface BudgetedReadV1 {
  readonly bytes: Buffer;
  readonly byteCount: number;
  readonly digest: string;
}

/** Reads one exact byte source, enforcing both byte budgets fail-closed. */
async function readBytesV1(
  repositoryRoot: string,
  revisionExpression: string,
  path: string,
  state: BudgetStateV1,
): Promise<BudgetedReadV1> {
  const output = await runGitReadV1({
    repositoryRoot,
    arguments: ["show", revisionExpression],
    processOutputBudget: state.budgets.processOutput,
  });
  const byteCount = output.stdout.byteLength;
  if (byteCount > state.budgets.perFileByte) {
    failClosed(
      "sothoth.git/budget-exceeded",
      path,
      { budget: "per-file-byte", limit: state.budgets.perFileByte, actual: byteCount },
      [`bytes of "${path}" exceed the per-file budget`],
      ["Raise the perFileByte budget; bytes are never truncated."],
    );
  }
  state.totalRead += byteCount;
  if (state.totalRead > state.budgets.totalByte) {
    failClosed(
      "sothoth.git/budget-exceeded",
      path,
      { budget: "total-byte", limit: state.budgets.totalByte, actual: state.totalRead },
      [`total bytes read exceed the total budget at "${path}"`],
      ["Raise the totalByte budget; bytes are never truncated."],
    );
  }
  return { bytes: output.stdout, byteCount, digest: sha256Digest(Array.from(output.stdout)) };
}

/** Reads and returns one object-bound file, checking a symlink's committed
 *  target lexically against the repository boundary. */
async function readBoundFileV1(
  repositoryRoot: string,
  revisionExpression: string,
  path: string,
  blob: string,
  isSymlink: boolean,
  state: BudgetStateV1,
): Promise<GitBoundFileV1> {
  const read = await readBytesV1(repositoryRoot, revisionExpression, path, state);
  if (isSymlink) {
    const target = read.bytes.toString("utf8");
    if (symlinkTargetEscapesRepositoryV1(path, target)) {
      failClosed(
        "sothoth.git/unsafe-path",
        path,
        { class: "repository-escape" },
        [`symlink "${path}" targets "${target}", which resolves outside the repository`],
        ["Remove the escaping symlink; repository escape is rejected."],
      );
    }
  }
  return { path, blob, byteCount: read.byteCount, digest: read.digest };
}

function enforceFileCountV1(count: number, state: BudgetStateV1): void {
  if (count > state.budgets.fileCount) {
    failClosed(
      "sothoth.git/budget-exceeded",
      "files",
      { budget: "file-count", limit: state.budgets.fileCount, actual: count },
      [`${count} participating files exceed the file-count budget`],
      ["Raise the fileCount budget; listings are never truncated."],
    );
  }
}

interface StatusChangeV1 {
  readonly path: string;
  readonly indexStatus: string;
  readonly worktreeStatus: string;
  readonly indexMode: string;
  readonly indexBlob: string;
}

interface WorkspaceStatusV1 {
  readonly changes: readonly StatusChangeV1[];
  readonly untracked: readonly string[];
}

/** Parses the closed porcelain-v2 entry set; anything else fails closed. */
async function readWorkspaceStatusV1(
  repositoryRoot: string,
  budgets: GitBudgetsV1,
): Promise<WorkspaceStatusV1> {
  const output = await readText(
    repositoryRoot,
    ["status", "--porcelain=v2", "-z", "--no-renames", "--untracked-files=all"],
    budgets,
  );
  const changes: StatusChangeV1[] = [];
  const untracked: string[] = [];
  for (const entry of output.split("\0")) {
    if (entry.length === 0) {
      continue;
    }
    if (entry.startsWith("? ")) {
      untracked.push(normalizeListedPathV1(entry.slice(2)));
      continue;
    }
    const fields = entry.split(" ");
    const kind = fields[0];
    if (kind === "u") {
      failClosed(
        "sothoth.git/unmerged-path",
        fields.slice(9).join(" ") || entry,
        {},
        ["the workspace carries an unmerged path"],
        ["Resolve the merge outside Sothoth; unmerged paths fail closed."],
      );
    }
    if (kind !== "1" || fields.length < 9 || fields[1]!.length !== 2) {
      rejectUnexpectedOutputV1("status", "status emitted an entry outside the closed ordinary-change shape");
    }
    if (fields[2]!.startsWith("S")) {
      rejectSubmoduleContentsV1(normalizeListedPathV1(fields.slice(8).join(" ")), "index");
    }
    if (fields[2] !== "N...") {
      rejectUnexpectedOutputV1("status", "status emitted an entry outside the closed ordinary-change shape");
    }
    changes.push({
      path: normalizeListedPathV1(fields.slice(8).join(" ")),
      indexStatus: fields[1]![0]!,
      worktreeStatus: fields[1]![1]!,
      indexMode: fields[4]!,
      indexBlob: fields[7]!,
    });
  }
  return { changes, untracked };
}

interface RawDiffRecordV1 {
  readonly oldMode: string;
  readonly newMode: string;
  readonly oldBlob: string;
  readonly newBlob: string;
  readonly path: string;
}

/** Parses `diff --raw -z --no-renames` between two exact trees. */
async function readRawDiffV1(
  repositoryRoot: string,
  base: string,
  head: string,
  budgets: GitBudgetsV1,
): Promise<readonly RawDiffRecordV1[]> {
  const output = await readText(
    repositoryRoot,
    ["diff", "--raw", "-z", "--no-renames", "--no-abbrev", base, head],
    budgets,
  );
  const records: RawDiffRecordV1[] = [];
  const parts = output.split("\0");
  for (let index = 0; index < parts.length; index += 2) {
    const meta = parts[index];
    if (meta === undefined || meta.length === 0) {
      continue;
    }
    const path = parts[index + 1];
    if (path === undefined || path.length === 0) {
      rejectUnexpectedOutputV1("diff", "diff --raw emitted a record without a path");
    }
    const fields = meta.split(" ");
    if (
      fields.length !== 5 ||
      !fields[0]!.startsWith(":") ||
      !/^[0-9]{6}$/.test(fields[0]!.slice(1)) ||
      !/^[0-9]{6}$/.test(fields[1]!) ||
      !/^[0-9a-f]+$/.test(fields[2]!) ||
      !/^[0-9a-f]+$/.test(fields[3]!) ||
      !/^[ADMT]$/.test(fields[4]!)
    ) {
      rejectUnexpectedOutputV1("diff", "diff --raw emitted a record outside the closed shape");
    }
    records.push({
      oldMode: fields[0]!.slice(1),
      newMode: fields[1]!,
      oldBlob: fields[2]!,
      newBlob: fields[3]!,
      path: normalizeListedPathV1(path),
    });
  }
  return records;
}

function sortStringsV1(values: readonly string[]): readonly string[] {
  return [...values].sort(compareCodePointOrder);
}

/** Builds the plan-pinned read-only Git source adapter. */
export function createGitSourceAdapterV1(options?: GitSourceAdapterOptionsV1): GitSourceAdapterV1 {
  const budgets = options?.budgets ?? DEFAULT_GIT_BUDGETS_V1;
  if (options !== undefined) {
    validateBudgetsV1(budgets);
  }

  const commitMode = async (repositoryRoot: string, ref: string): Promise<GitCommitSnapshotV1> => {
    validateRepositoryRootV1(repositoryRoot);
    validateExactRefV1(ref);
    const state: BudgetStateV1 = { budgets, totalRead: 0 };
    const commit = await resolveExactObjectV1(repositoryRoot, ref, budgets);
    const tree = await resolveExactObjectV1(repositoryRoot, `${commit}^{tree}`, budgets);
    const entries = await listTreeV1(repositoryRoot, commit, budgets);
    enforceFileCountV1(entries.length, state);
    const files: GitBoundFileV1[] = [];
    for (const entry of entries) {
      files.push(
        await readBoundFileV1(
          repositoryRoot,
          `${commit}:${entry.path}`,
          entry.path,
          entry.object,
          entry.mode === "120000",
          state,
        ),
      );
    }
    files.sort((left, right) => compareCodePointOrder(left.path, right.path));
    const record: Omit<GitCommitSnapshotV1, "digest"> = {
      schema: GIT_SOURCE_SNAPSHOT_SCHEMA_V1,
      binding: { kind: "sothoth.git/commit-snapshot@1", mode: "commit", commit, tree },
      files,
      workspace: null,
    };
    return deepFreezeInPlace({ ...record, digest: sha256Digest(canonicalJson(record)) });
  };

  const compareMode = async (
    repositoryRoot: string,
    baseRef: string,
    headRef: string,
  ): Promise<GitCompareSnapshotV1> => {
    validateRepositoryRootV1(repositoryRoot);
    validateExactRefV1(baseRef);
    validateExactRefV1(headRef);
    const state: BudgetStateV1 = { budgets, totalRead: 0 };
    const baseCommit = await resolveExactObjectV1(repositoryRoot, baseRef, budgets);
    const headCommit = await resolveExactObjectV1(repositoryRoot, headRef, budgets);
    const baseTree = await resolveExactObjectV1(repositoryRoot, `${baseCommit}^{tree}`, budgets);
    const headTree = await resolveExactObjectV1(repositoryRoot, `${headCommit}^{tree}`, budgets);
    const records = await readRawDiffV1(repositoryRoot, baseCommit, headCommit, budgets);
    enforceFileCountV1(records.length, state);
    const files: GitCompareFileV1[] = [];
    for (const record of records) {
      if (record.oldMode === "160000" || record.newMode === "160000") {
        rejectSubmoduleContentsV1(record.path, "compare");
      }
      const base =
        NULL_OBJECT_PATTERN.test(record.oldBlob)
          ? null
          : await readBoundFileV1(
              repositoryRoot,
              `${baseCommit}:${record.path}`,
              record.path,
              record.oldBlob,
              record.oldMode === "120000",
              state,
            );
      const head =
        NULL_OBJECT_PATTERN.test(record.newBlob)
          ? null
          : await readBoundFileV1(
              repositoryRoot,
              `${headCommit}:${record.path}`,
              record.path,
              record.newBlob,
              record.newMode === "120000",
              state,
            );
      files.push({ path: record.path, base, head });
    }
    files.sort((left, right) => compareCodePointOrder(left.path, right.path));
    const record: Omit<GitCompareSnapshotV1, "digest"> = {
      schema: GIT_SOURCE_SNAPSHOT_SCHEMA_V1,
      binding: {
        kind: "sothoth.git/compare-snapshot@1",
        mode: "compare",
        baseCommit,
        baseTree,
        headCommit,
        headTree,
      },
      files,
      workspace: null,
    };
    return deepFreezeInPlace({ ...record, digest: sha256Digest(canonicalJson(record)) });
  };

  const workspaceMode = async (repositoryRoot: string): Promise<GitWorkspaceSnapshotV1> => {
    validateRepositoryRootV1(repositoryRoot);
    const state: BudgetStateV1 = { budgets, totalRead: 0 };
    const headCommit = await resolveExactObjectV1(repositoryRoot, "HEAD", budgets);
    const headTree = await resolveExactObjectV1(repositoryRoot, `${headCommit}^{tree}`, budgets);
    const headEntries = await listTreeV1(repositoryRoot, headCommit, budgets);
    const status = await readWorkspaceStatusV1(repositoryRoot, budgets);
    const staged = status.changes.filter((change) => change.indexStatus !== ".");
    const unstaged = status.changes.filter((change) => change.worktreeStatus !== ".");
    enforceFileCountV1(
      headEntries.length + staged.length + unstaged.length + status.untracked.length,
      state,
    );

    const files: {
      path: string;
      byteClass: GitByteClassV1;
      blob: string | null;
      byteCount: number | null;
      digest: string | null;
    }[] = [];
    for (const entry of headEntries) {
      if (entry.mode === "120000") {
        const bound = await readBoundFileV1(
          repositoryRoot,
          `${headCommit}:${entry.path}`,
          entry.path,
          entry.object,
          true,
          state,
        );
        files.push({ ...bound, byteClass: "head" });
        continue;
      }
      files.push({
        path: entry.path,
        byteClass: "head",
        blob: entry.object,
        byteCount: null,
        digest: null,
      });
    }
    for (const change of staged) {
      if (change.indexMode === "160000") {
        rejectSubmoduleContentsV1(change.path, "index");
      }
      if (NULL_OBJECT_PATTERN.test(change.indexBlob)) {
        files.push({ path: change.path, byteClass: "index", blob: null, byteCount: null, digest: null });
        continue;
      }
      const bound = await readBoundFileV1(
        repositoryRoot,
        `:0:${change.path}`,
        change.path,
        change.indexBlob,
        change.indexMode === "120000",
        state,
      );
      files.push({ ...bound, byteClass: "index" });
    }
    for (const change of unstaged) {
      files.push({ path: change.path, byteClass: "unstaged", blob: null, byteCount: null, digest: null });
    }
    for (const path of status.untracked) {
      files.push({ path, byteClass: "untracked", blob: null, byteCount: null, digest: null });
    }
    files.sort(
      (left, right) =>
        compareCodePointOrder(left.path, right.path) ||
        BYTE_CLASS_ORDER[left.byteClass] - BYTE_CLASS_ORDER[right.byteClass],
    );

    const byteClasses: GitByteClassV1[] = ["head"];
    if (staged.length > 0) {
      byteClasses.push("index");
    }
    if (unstaged.length > 0) {
      byteClasses.push("unstaged");
    }
    if (status.untracked.length > 0) {
      byteClasses.push("untracked");
    }

    const record: Omit<GitWorkspaceSnapshotV1, "digest"> = {
      schema: GIT_SOURCE_SNAPSHOT_SCHEMA_V1,
      binding: {
        kind: "sothoth.git/workspace-snapshot@1",
        mode: "workspace",
        headCommit,
        headTree,
        byteClasses,
      },
      files,
      workspace: {
        staged: sortStringsV1(staged.map((change) => change.path)),
        unstaged: sortStringsV1(unstaged.map((change) => change.path)),
        untracked: sortStringsV1(status.untracked),
      },
    };
    return deepFreezeInPlace({ ...record, digest: sha256Digest(canonicalJson(record)) });
  };

  return {
    snapshotCommit: commitMode,
    snapshotCompare: compareMode,
    snapshotWorkspace: workspaceMode,
  };
}
