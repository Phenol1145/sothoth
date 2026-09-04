// Task 9 / Read-Only Git Source Adapter — snapshot contract conformance.
// Covers the three provenance modes and their non-confusable bindings, the
// four workspace byte classes, the closed five-subcommand process allowlist
// (mutation subcommands rejected before process creation), every path and
// ref fail-closed class, missing objects, submodule contents, all four
// budgets failing closed without truncation, canonical code-point ordering,
// byte-stable repeat outputs, and immutability. No-mutation proofs around
// every adapter call live in no-mutation.test.ts.
//
// Every fixture is a real temporary Git repository under the OS temp
// directory, created and mutated by these tests through their own direct
// git calls; the adapter itself only ever reads.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

/** The byte-exact file-content digest the adapter derives through the
 *  shared core vocabulary: sha256 over the canonical form of the byte
 *  array, so binary and text content bind identically. */
function digestBytes(content: string): string {
  return sha256Digest(Array.from(Buffer.from(content, "utf8")));
}
import {
  GIT_ADAPTER_DIAGNOSTIC_IDENTITY_V1,
  GitSourceAdapterError,
  createGitSourceAdapterV1,
} from "../../packages/git/src/index.js";
import {
  normalizeGitPathV1,
  symlinkTargetEscapesRepositoryV1,
} from "../../packages/git/src/paths.js";
import {
  GIT_EXECUTABLE_SUBCOMMANDS_V1,
  GIT_MUTATION_SUBCOMMANDS_V1,
  runGitReadV1,
} from "../../packages/git/src/runner.js";

const repoRoots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function makeRepo(): string {
  const path = mkdtempSync(join(tmpdir(), "sothoth-git-snapshot-"));
  repoRoots.push(path);
  git(path, "init", "-q");
  git(path, "config", "user.email", "sothoth@example.invalid");
  git(path, "config", "user.name", "Sothoth Test");
  return path;
}

function commitAll(cwd: string, message: string): string {
  git(cwd, "add", "-A");
  git(cwd, "commit", "-qm", message);
  return git(cwd, "rev-parse", "HEAD").trim();
}

/** The plan's Step 1 fixture: one committed base, then one staged edit, one
 *  unstaged edit, and one untracked file. */
function makeDirtyWorkspaceRepo(): string {
  const path = makeRepo();
  writeFileSync(join(path, "committed.md"), "committed\n");
  writeFileSync(join(path, "staged.md"), "first\n");
  writeFileSync(join(path, "dirty.md"), "clean\n");
  commitAll(path, "base");
  writeFileSync(join(path, "staged.md"), "second\n");
  git(path, "add", "staged.md");
  writeFileSync(join(path, "dirty.md"), "dirty\n");
  writeFileSync(join(path, "new.md"), "new\n");
  return path;
}

afterAll(() => {
  for (const path of repoRoots) {
    rmSync(path, { recursive: true, force: true });
  }
});

async function expectFail(promise: Promise<unknown>): Promise<GitSourceAdapterError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GitSourceAdapterError);
    return error as GitSourceAdapterError;
  }
  throw new Error("expected the adapter call to fail closed, but it resolved");
}

function captureConstruction(construct: () => unknown): GitSourceAdapterError {
  let thrown: unknown;
  try {
    construct();
  } catch (error) {
    expect(error).toBeInstanceOf(GitSourceAdapterError);
    return error as GitSourceAdapterError;
  }
  throw new Error("expected adapter construction with malformed budgets to fail closed");
}

function firstDiagnostic(error: GitSourceAdapterError): { code: string; parameters: Record<string, unknown> } {
  const diagnostic = error.diagnostics[0];
  expect(diagnostic).toBeDefined();
  return { code: diagnostic!.code, parameters: diagnostic!.parameters as Record<string, unknown> };
}

describe("workspace provenance", () => {
  test("separates committed, staged, unstaged, and untracked workspace bytes", async () => {
    const path = makeDirtyWorkspaceRepo();
    const adapter = createGitSourceAdapterV1();
    const snapshot = await adapter.snapshotWorkspace(path);
    expect(snapshot.workspace).toEqual({ staged: ["staged.md"], unstaged: ["dirty.md"], untracked: ["new.md"] });
    expect(snapshot.binding.mode).toBe("workspace");
  });

  test("binds a dirty workspace to every participating byte class under its own identity", async () => {
    const path = makeDirtyWorkspaceRepo();
    const adapter = createGitSourceAdapterV1();
    const snapshot = await adapter.snapshotWorkspace(path);
    expect(snapshot.schema).toBe("sothoth.git/source-snapshot@1");
    expect(snapshot.binding).toEqual({
      kind: "sothoth.git/workspace-snapshot@1",
      mode: "workspace",
      headCommit: git(path, "rev-parse", "HEAD").trim(),
      headTree: git(path, "rev-parse", "HEAD^{tree}").trim(),
      byteClasses: ["head", "index", "unstaged", "untracked"],
    });
    expect(snapshot.files).toEqual([
      {
        path: "committed.md",
        byteClass: "head",
        blob: git(path, "rev-parse", "HEAD:committed.md").trim(),
        byteCount: null,
        digest: null,
      },
      {
        path: "dirty.md",
        byteClass: "head",
        blob: git(path, "rev-parse", "HEAD:dirty.md").trim(),
        byteCount: null,
        digest: null,
      },
      { path: "dirty.md", byteClass: "unstaged", blob: null, byteCount: null, digest: null },
      { path: "new.md", byteClass: "untracked", blob: null, byteCount: null, digest: null },
      {
        path: "staged.md",
        byteClass: "head",
        blob: git(path, "rev-parse", "HEAD:staged.md").trim(),
        byteCount: null,
        digest: null,
      },
      {
        path: "staged.md",
        byteClass: "index",
        blob: git(path, "rev-parse", ":staged.md").trim(),
        byteCount: "second\n".length,
        digest: digestBytes("second\n"),
      },
    ]);
  });

  test("a clean workspace participates through the head byte class only", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "only");
    const snapshot = await createGitSourceAdapterV1().snapshotWorkspace(path);
    expect(snapshot.binding.byteClasses).toEqual(["head"]);
    expect(snapshot.workspace).toEqual({ staged: [], unstaged: [], untracked: [] });
    expect(snapshot.files.map((file) => `${file.path}:${file.byteClass}`)).toEqual(["a.txt:head"]);
  });

  test("an empty repository without HEAD fails closed", async () => {
    const path = makeRepo();
    const error = await expectFail(createGitSourceAdapterV1().snapshotWorkspace(path));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/unknown-ref");
  });

  test("a directory outside any repository fails closed", async () => {
    const path = mkdtempSync(join(tmpdir(), "sothoth-git-norepo-"));
    repoRoots.push(path);
    const error = await expectFail(createGitSourceAdapterV1().snapshotWorkspace(path));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/repository-unreachable");
  });
});

describe("commit provenance", () => {
  test("binds every tracked file to its exact blob, byte count, and digest", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    writeFileSync(join(path, "empty.txt"), "");
    commitAll(path, "one");
    const adapter = createGitSourceAdapterV1();
    const snapshot = await adapter.snapshotCommit(path, "HEAD");
    expect(snapshot.binding).toEqual({
      kind: "sothoth.git/commit-snapshot@1",
      mode: "commit",
      commit: git(path, "rev-parse", "HEAD").trim(),
      tree: git(path, "rev-parse", "HEAD^{tree}").trim(),
    });
    expect(snapshot.workspace).toBeNull();
    expect(snapshot.files).toEqual([
      {
        path: "a.txt",
        blob: git(path, "rev-parse", "HEAD:a.txt").trim(),
        byteCount: "alpha\n".length,
        digest: digestBytes("alpha\n"),
      },
      {
        path: "empty.txt",
        blob: git(path, "rev-parse", "HEAD:empty.txt").trim(),
        byteCount: 0,
        digest: digestBytes(""),
      },
    ]);
  });

  test("accepts an exact hexadecimal commit identity, not floating syntax", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    const head = commitAll(path, "one");
    const snapshot = await createGitSourceAdapterV1().snapshotCommit(path, head);
    expect(snapshot.binding.commit).toBe(head);
    const error = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, "HEAD~1"));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/invalid-ref");
  });
});

describe("compare provenance", () => {
  test("binds exact base and head sides of every changed path", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "one\n");
    writeFileSync(join(path, "keep.txt"), "kept\n");
    writeFileSync(join(path, "del.txt"), "gone\n");
    const base = commitAll(path, "base");
    writeFileSync(join(path, "a.txt"), "two\n");
    unlinkSync(join(path, "del.txt"));
    writeFileSync(join(path, "added.txt"), "fresh\n");
    const head = commitAll(path, "head");
    const snapshot = await createGitSourceAdapterV1().snapshotCompare(path, base, head);
    expect(snapshot.binding).toEqual({
      kind: "sothoth.git/compare-snapshot@1",
      mode: "compare",
      baseCommit: base,
      baseTree: git(path, "rev-parse", `${base}^{tree}`).trim(),
      headCommit: head,
      headTree: git(path, "rev-parse", `${head}^{tree}`).trim(),
    });
    expect(snapshot.workspace).toBeNull();
    expect(snapshot.files).toEqual([
      {
        path: "a.txt",
        base: { path: "a.txt", blob: git(path, "rev-parse", `${base}:a.txt`).trim(), byteCount: "one\n".length, digest: digestBytes("one\n") },
        head: { path: "a.txt", blob: git(path, "rev-parse", `${head}:a.txt`).trim(), byteCount: "two\n".length, digest: digestBytes("two\n") },
      },
      {
        path: "added.txt",
        base: null,
        head: { path: "added.txt", blob: git(path, "rev-parse", `${head}:added.txt`).trim(), byteCount: "fresh\n".length, digest: digestBytes("fresh\n") },
      },
      {
        path: "del.txt",
        base: { path: "del.txt", blob: git(path, "rev-parse", `${base}:del.txt`).trim(), byteCount: "gone\n".length, digest: digestBytes("gone\n") },
        head: null,
      },
    ]);
  });
});

describe("provenance identity separation", () => {
  test("commit, compare, and workspace identities never confusable", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    const base = commitAll(path, "base");
    writeFileSync(join(path, "a.txt"), "beta\n");
    const head = commitAll(path, "head");
    const adapter = createGitSourceAdapterV1();
    const commit = await adapter.snapshotCommit(path, head);
    const compare = await adapter.snapshotCompare(path, base, head);
    const workspace = await adapter.snapshotWorkspace(path);
    const kinds = [commit.binding.kind, compare.binding.kind, workspace.binding.kind];
    expect(new Set(kinds).size).toBe(3);
    expect(kinds).toEqual([
      "sothoth.git/commit-snapshot@1",
      "sothoth.git/compare-snapshot@1",
      "sothoth.git/workspace-snapshot@1",
    ]);
    // A workspace snapshot can never present itself as commit-bound evidence:
    // no commit-snapshot identity appears anywhere in its canonical bytes.
    expect(canonicalJson(workspace)).not.toContain("commit-snapshot@1");
    expect(canonicalJson(commit)).not.toContain("workspace-snapshot@1");
  });
});

describe("determinism and ordering", () => {
  test("repeat requests produce byte-identical snapshots", async () => {
    const path = makeDirtyWorkspaceRepo();
    const adapter = createGitSourceAdapterV1();
    const first = await adapter.snapshotWorkspace(path);
    const second = await adapter.snapshotWorkspace(path);
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(first.digest).toBe(second.digest);
  });

  test("files order by path in Unicode code-point order, not creation or locale order", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "apple.md"), "apple\n");
    writeFileSync(join(path, "Zed.md"), "zed\n");
    commitAll(path, "order");
    const snapshot = await createGitSourceAdapterV1().snapshotCommit(path, "HEAD");
    expect(snapshot.files.map((file) => file.path)).toEqual(["Zed.md", "apple.md"]);
  });

  test("the snapshot digest is the sha256 of the canonical record without the digest field", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "one");
    const snapshot = await createGitSourceAdapterV1().snapshotCommit(path, "HEAD");
    const { digest: _digest, ...record } = snapshot;
    expect(snapshot.digest).toBe(sha256Digest(canonicalJson(record)));
    expect(snapshot.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("snapshot values are deeply frozen", async () => {
    const path = makeDirtyWorkspaceRepo();
    const snapshot = await createGitSourceAdapterV1().snapshotWorkspace(path);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.files)).toBe(true);
    expect(Object.isFrozen(snapshot.files[0])).toBe(true);
    expect(Object.isFrozen(snapshot.workspace)).toBe(true);
    expect(Object.isFrozen(snapshot.binding)).toBe(true);
  });
});

describe("path normalization and rejection", () => {
  test("normalizes repository-relative POSIX paths", () => {
    expect(normalizeGitPathV1("a/b.md")).toEqual({ ok: true, path: "a/b.md" });
    expect(normalizeGitPathV1("./a/./b.md")).toEqual({ ok: true, path: "a/b.md" });
    expect(normalizeGitPathV1("a//b.md")).toEqual({ ok: true, path: "a/b.md" });
  });

  test("rejects every closed path class", () => {
    expect(normalizeGitPathV1("/etc/passwd")).toMatchObject({ ok: false, rejectedClass: "absolute-path" });
    expect(normalizeGitPathV1("C:\\temp\\x")).toMatchObject({ ok: false, rejectedClass: "absolute-path" });
    expect(normalizeGitPathV1("../outside.md")).toMatchObject({ ok: false, rejectedClass: "parent-escape" });
    expect(normalizeGitPathV1("a/../../outside.md")).toMatchObject({ ok: false, rejectedClass: "parent-escape" });
    expect(normalizeGitPathV1("a\u0000b.md")).toMatchObject({ ok: false, rejectedClass: "nul-byte" });
    expect(normalizeGitPathV1("")).toMatchObject({ ok: false, rejectedClass: "unnormalizable-path" });
    expect(normalizeGitPathV1(".")).toMatchObject({ ok: false, rejectedClass: "unnormalizable-path" });
    expect(normalizeGitPathV1("dir/")).toMatchObject({ ok: false, rejectedClass: "unnormalizable-path" });
  });

  test("symlink targets that resolve outside the repository are escapes", () => {
    expect(symlinkTargetEscapesRepositoryV1("link", "../../outside")).toBe(true);
    expect(symlinkTargetEscapesRepositoryV1("a/link", "../../outside")).toBe(true);
    expect(symlinkTargetEscapesRepositoryV1("link", "/absolute/target")).toBe(true);
    expect(symlinkTargetEscapesRepositoryV1("link", "committed.md")).toBe(false);
    expect(symlinkTargetEscapesRepositoryV1("a/b/link", "../../x")).toBe(false);
    expect(symlinkTargetEscapesRepositoryV1("a/link", "../x")).toBe(false);
  });

  test("a committed escaping symlink fails the whole snapshot closed", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    execFileSync("ln", ["-s", "../../outside", "escape"], { cwd: path });
    commitAll(path, "symlink");
    const error = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, "HEAD"));
    const diagnostic = firstDiagnostic(error);
    expect(diagnostic.code).toBe("sothoth.git/unsafe-path");
    expect(diagnostic.parameters).toMatchObject({ class: "repository-escape" });
  });

  test("a committed in-repository symlink binds its target bytes", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "target.md"), "target\n");
    execFileSync("ln", ["-s", "target.md", "alias.md"], { cwd: path });
    commitAll(path, "symlink");
    const snapshot = await createGitSourceAdapterV1().snapshotCommit(path, "HEAD");
    const alias = snapshot.files.find((file) => file.path === "alias.md");
    expect(alias).toEqual({
      path: "alias.md",
      blob: git(path, "rev-parse", "HEAD:alias.md").trim(),
      byteCount: "target.md".length,
      digest: digestBytes("target.md"),
    });
  });
});

describe("ref fail-closed", () => {
  test("ambiguous refs are rejected", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "base");
    git(path, "branch", "amb");
    git(path, "tag", "amb");
    const error = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, "amb"));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/ambiguous-ref");
  });

  test("unknown refs are rejected", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "base");
    const named = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, "does-not-exist"));
    expect(firstDiagnostic(named).code).toBe("sothoth.git/unknown-ref");
    const hexadecimal = await expectFail(
      createGitSourceAdapterV1().snapshotCommit(path, "0".repeat(40)),
    );
    expect(firstDiagnostic(hexadecimal).code).toBe("sothoth.git/unknown-ref");
  });

  test("malformed refs are rejected before any process", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "base");
    for (const ref of ["", "-x", "HEAD^", "HEAD@{1}", "a b"]) {
      const error = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, ref));
      expect(firstDiagnostic(error).code).toBe("sothoth.git/invalid-ref");
    }
  });

  test("missing objects fail closed even when the tree still lists them", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "victim.txt"), "delete my blob\n");
    commitAll(path, "base");
    const blob = git(path, "rev-parse", "HEAD:victim.txt").trim();
    unlinkSync(join(path, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
    const error = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, "HEAD"));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/missing-object");
  });

  test("submodule contents are rejected", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    const nested = commitAll(path, "stage"); // first commit holds the blob
    git(path, "update-index", "--add", "--cacheinfo", `160000,${nested},inner`);
    git(path, "commit", "-qm", "gitlink");
    const error = await expectFail(createGitSourceAdapterV1().snapshotCommit(path, "HEAD"));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/submodule-contents");
  });

  test("relative repository roots are rejected as malformed requests", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "base");
    const error = await expectFail(createGitSourceAdapterV1().snapshotCommit("relative/repo", "HEAD"));
    expect(firstDiagnostic(error).code).toBe("sothoth.git/invalid-request");
    expect(error.diagnostics.every((diagnostic) => diagnostic.origin === GIT_ADAPTER_DIAGNOSTIC_IDENTITY_V1)).toBe(true);
  });
});

describe("process allowlist closure", () => {
  test("the allowlist is exactly the five executable subcommands", () => {
    expect(GIT_EXECUTABLE_SUBCOMMANDS_V1).toEqual(["diff", "ls-tree", "rev-parse", "show", "status"]);
  });

  test("the eighteen mutation subcommands are listed for rejection", () => {
    expect(GIT_MUTATION_SUBCOMMANDS_V1).toEqual([
      "add", "checkout", "cherry-pick", "clean", "clone", "commit", "config",
      "fetch", "merge", "pull", "push", "rebase", "reset", "rm", "stash",
      "switch", "tag", "worktree",
    ]);
  });

  test("every allowlisted subcommand executes with a fixed argument array", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    const first = commitAll(path, "one");
    writeFileSync(join(path, "a.txt"), "beta\n");
    const second = commitAll(path, "two");
    const outputs = await Promise.all([
      runGitReadV1({ repositoryRoot: path, arguments: ["rev-parse", "HEAD"], processOutputBudget: 4096 }),
      runGitReadV1({ repositoryRoot: path, arguments: ["ls-tree", "HEAD"], processOutputBudget: 4096 }),
      runGitReadV1({ repositoryRoot: path, arguments: ["show", "HEAD:a.txt"], processOutputBudget: 4096 }),
      runGitReadV1({ repositoryRoot: path, arguments: ["diff", "--raw", first, second], processOutputBudget: 4096 }),
      runGitReadV1({ repositoryRoot: path, arguments: ["status", "--porcelain=v2"], processOutputBudget: 4096 }),
    ]);
    expect(outputs.map((output) => output.subcommand)).toEqual([
      "rev-parse", "ls-tree", "show", "diff", "status",
    ]);
    expect(outputs[0]!.stdout.toString("utf8").trim()).toBe(second);
    expect(outputs[2]!.stdout.toString("utf8")).toBe("beta\n");
  });

  test("every mutation subcommand is rejected synchronously before process creation", () => {
    const path = makeRepo();
    for (const subcommand of GIT_MUTATION_SUBCOMMANDS_V1) {
      let thrown: unknown;
      try {
        runGitReadV1({ repositoryRoot: path, arguments: [subcommand], processOutputBudget: 4096 });
      } catch (error) {
        thrown = error;
      }
      // A synchronous throw is the proof no process was created: the runner
      // would otherwise have had to spawn before failing.
      expect(thrown, `subcommand ${subcommand} must be rejected synchronously`).toBeInstanceOf(
        GitSourceAdapterError,
      );
      expect(firstDiagnostic(thrown as GitSourceAdapterError).code).toBe("sothoth.git/disallowed-subcommand");
    }
  });

  test("unknown subcommands and option-shaped first arguments are rejected", () => {
    const path = makeRepo();
    for (const candidate of [["log"], ["hash-object", "-w", "x"], [], ["--global-flag"], ["-C", "/tmp"]]) {
      expect(() =>
        runGitReadV1({ repositoryRoot: path, arguments: candidate, processOutputBudget: 4096 }),
      ).toThrow(GitSourceAdapterError);
    }
  });
});

describe("budgets fail closed without truncation", () => {
  function budgetFixture(): string {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    writeFileSync(join(path, "b.txt"), "beta\n");
    commitAll(path, "budgets");
    return path;
  }

  test("file-count exhaustion rejects the whole snapshot", async () => {
    const path = budgetFixture();
    const error = await expectFail(
      createGitSourceAdapterV1({ budgets: { fileCount: 1, perFileByte: 1024, processOutput: 65536, totalByte: 65536 } })
        .snapshotCommit(path, "HEAD"),
    );
    const diagnostic = firstDiagnostic(error);
    expect(diagnostic.code).toBe("sothoth.git/budget-exceeded");
    expect(diagnostic.parameters).toMatchObject({ budget: "file-count" });
  });

  test("per-file-byte exhaustion rejects instead of truncating", async () => {
    const path = budgetFixture();
    const error = await expectFail(
      createGitSourceAdapterV1({ budgets: { fileCount: 10, perFileByte: 5, processOutput: 65536, totalByte: 65536 } })
        .snapshotCommit(path, "HEAD"),
    );
    expect(firstDiagnostic(error).parameters).toMatchObject({ budget: "per-file-byte" });
  });

  test("total-byte exhaustion rejects instead of truncating", async () => {
    const path = budgetFixture();
    const error = await expectFail(
      createGitSourceAdapterV1({ budgets: { fileCount: 10, perFileByte: 1024, processOutput: 65536, totalByte: 6 } })
        .snapshotCommit(path, "HEAD"),
    );
    expect(firstDiagnostic(error).parameters).toMatchObject({ budget: "total-byte" });
  });

  test("process-output exhaustion rejects instead of truncating", async () => {
    const path = budgetFixture();
    const error = await expectFail(
      createGitReadAdapterWithProcessBudget(path),
    );
    expect(firstDiagnostic(error).parameters).toMatchObject({ budget: "process-output" });
  });

  test("non-positive or non-integer budgets are malformed requests", () => {
    const zero = captureConstruction(() =>
      createGitSourceAdapterV1({ budgets: { fileCount: 0, perFileByte: 1, processOutput: 1, totalByte: 1 } }),
    );
    expect(firstDiagnostic(zero).code).toBe("sothoth.git/invalid-budgets");
    const fractional = captureConstruction(() =>
      createGitSourceAdapterV1({ budgets: { fileCount: 1.5, perFileByte: 1, processOutput: 1, totalByte: 1 } }),
    );
    expect(firstDiagnostic(fractional).code).toBe("sothoth.git/invalid-budgets");
  });
});

/** Drives a commit snapshot whose ls-tree listing exceeds the process-output
 *  budget, proving the runner fails closed rather than returning truncated
 *  bytes. */
async function createGitReadAdapterWithProcessBudget(path: string): Promise<unknown> {
  const adapter = createGitSourceAdapterV1({
    budgets: { fileCount: 10, perFileByte: 1024, processOutput: 24, totalByte: 65536 },
  });
  return adapter.snapshotCommit(path, "HEAD");
}

describe("digests use exact bytes", () => {
  test("commit digests match the sha256 of the file bytes git returns", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "bytes.bin"), "\u00ff\u00fe binary \u0000 safe\n");
    commitAll(path, "bytes");
    const snapshot = await createGitSourceAdapterV1().snapshotCommit(path, "HEAD");
    const entry = snapshot.files.find((file) => file.path === "bytes.bin");
    const raw = execFileSync("git", ["show", "HEAD:bytes.bin"], { cwd: path });
    expect(entry?.byteCount).toBe(raw.byteLength);
    expect(entry?.digest).toBe(sha256Digest(Array.from(raw)));
  });
});

describe("sothoth repository read", () => {
  test("reads the Sothoth repository itself as a plain read-only workspace", async () => {
    const sothothRoot = fileURLToPath(new URL("../../", import.meta.url));
    const snapshot = await createGitSourceAdapterV1({
      budgets: { fileCount: 100000, perFileByte: 1 << 30, processOutput: 1 << 30, totalByte: 2 ** 34 },
    }).snapshotWorkspace(sothothRoot);
    expect(snapshot.binding.mode).toBe("workspace");
    expect(snapshot.binding.headCommit).toBe(git(sothothRoot, "rev-parse", "HEAD").trim());
  });
});
