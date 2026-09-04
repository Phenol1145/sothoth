// Task 9 / Read-Only Git Source Adapter — no-mutation boundary proofs.
//
// Around EVERY adapter call and every runner read, the full observable
// repository state — `git status --porcelain=v2`, every ref, HEAD, and the
// byte-level digest of the repository's git object database — must be
// byte-identical before and after. Mutation-subcommand attempts must be
// rejected before process creation and must not touch the repository
// either. The Sothoth repository itself is read once through the adapter to
// prove the real repository survives a workspace snapshot unchanged.
//
// All fixtures are real temporary Git repositories under the OS temp
// directory, mutated only by these tests' own direct git calls.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { createGitSourceAdapterV1, GitSourceAdapterError } from "../../packages/git/src/index.js";
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
  const path = mkdtempSync(join(tmpdir(), "sothoth-git-nomut-"));
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

/** Recursively digests every file under `root` (relative path + bytes). */
function digestTree(root: string): string {
  const hash = createHash("sha256");
  const walk = (relative: string): void => {
    const absolute = join(root, relative);
    const entries = readdirSync(absolute).sort();
    for (const entry of entries) {
      const entryRelative = relative === "" ? entry : `${relative}/${entry}`;
      if (statSync(join(absolute, entry)).isDirectory()) {
        walk(entryRelative);
      } else {
        hash.update(entryRelative);
        hash.update("\0");
        hash.update(readFileSync(join(absolute, entry)));
        hash.update("\0");
      }
    }
  };
  walk("");
  return `sha256:${hash.digest("hex")}`;
}

/**
 * The full observable repository fingerprint: porcelain-v2 status bytes,
 * every ref, HEAD, and the byte-level digest of the whole tree (including
 * .git, so even an index refresh or lockfile write would show).
 */
function repositoryFingerprint(repositoryRoot: string): string {
  const status = execFileSync("git", ["--no-optional-locks", "status", "--porcelain=v2"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  const refs = execFileSync("git", ["for-each-ref"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  return JSON.stringify({ status, refs, head, tree: digestTree(repositoryRoot) });
}

/** The Sothoth repository fingerprint without hashing the untracked working
 *  tree (node_modules churns during a test run); .git and all tracked state
 *  are still covered byte for byte. */
function sothothFingerprint(): string {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const status = git(root, "--no-optional-locks", "status", "--porcelain=v2");
  const refs = git(root, "for-each-ref");
  const head = git(root, "rev-parse", "HEAD");
  return JSON.stringify({ status, refs, head, gitDirectory: digestTree(join(root, ".git")) });
}

afterAll(() => {
  for (const path of repoRoots) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("adapter reads never mutate the repository", () => {
  test("workspace snapshots leave status, refs, HEAD, and .git bytes identical", async () => {
    const path = makeDirtyWorkspaceRepo();
    const adapter = createGitSourceAdapterV1();
    const before = repositoryFingerprint(path);
    const snapshot = await adapter.snapshotWorkspace(path);
    const after = repositoryFingerprint(path);
    expect(after).toBe(before);
    expect(snapshot.binding.mode).toBe("workspace");
  });

  test("commit snapshots leave the repository byte-identical", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    commitAll(path, "one");
    const adapter = createGitSourceAdapterV1();
    const before = repositoryFingerprint(path);
    const snapshot = await adapter.snapshotCommit(path, "HEAD");
    const after = repositoryFingerprint(path);
    expect(after).toBe(before);
    expect(snapshot.binding.mode).toBe("commit");
  });

  test("compare snapshots leave the repository byte-identical", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "one\n");
    const base = commitAll(path, "base");
    writeFileSync(join(path, "a.txt"), "two\n");
    const head = commitAll(path, "head");
    const adapter = createGitSourceAdapterV1();
    const before = repositoryFingerprint(path);
    const snapshot = await adapter.snapshotCompare(path, base, head);
    const after = repositoryFingerprint(path);
    expect(after).toBe(before);
    expect(snapshot.binding.mode).toBe("compare");
  });

  test("every allowlisted runner read leaves the repository byte-identical", async () => {
    const path = makeRepo();
    writeFileSync(join(path, "a.txt"), "alpha\n");
    const base = commitAll(path, "one");
    writeFileSync(join(path, "a.txt"), "beta\n");
    const head = commitAll(path, "two");
    const before = repositoryFingerprint(path);
    const requests: readonly (readonly string[])[] = [
      ["rev-parse", "HEAD"],
      ["ls-tree", "-r", "-z", "HEAD"],
      ["show", `${head}:a.txt`],
      ["diff", "--raw", "-z", "--no-renames", base, head],
      ["status", "--porcelain=v2", "-z", "--no-renames", "--untracked-files=all"],
    ];
    for (const request of requests) {
      await runGitReadV1({ repositoryRoot: path, arguments: request, processOutputBudget: 1 << 24 });
    }
    const after = repositoryFingerprint(path);
    expect(after).toBe(before);
    expect(GIT_EXECUTABLE_SUBCOMMANDS_V1).toEqual(["diff", "ls-tree", "rev-parse", "show", "status"]);
  });

  test("every mutation subcommand attempt leaves the repository byte-identical", () => {
    const path = makeDirtyWorkspaceRepo();
    const before = repositoryFingerprint(path);
    let rejected = 0;
    for (const subcommand of GIT_MUTATION_SUBCOMMANDS_V1) {
      let thrown: unknown;
      try {
        runGitReadV1({
          repositoryRoot: path,
          arguments: [subcommand],
          processOutputBudget: 4096,
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown, `subcommand ${subcommand} must be rejected before process creation`).toBeInstanceOf(
        GitSourceAdapterError,
      );
      rejected += 1;
    }
    const after = repositoryFingerprint(path);
    expect(rejected).toBe(18);
    expect(after).toBe(before);
  });

  test("the Sothoth repository itself survives a workspace snapshot unchanged", async () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const before = sothothFingerprint();
    const snapshot = await createGitSourceAdapterV1({
      budgets: { fileCount: 100000, perFileByte: 1 << 30, processOutput: 1 << 30, totalByte: 2 ** 34 },
    }).snapshotWorkspace(root);
    const after = sothothFingerprint();
    expect(after).toBe(before);
    expect(snapshot.binding.headCommit).toBe(git(root, "rev-parse", "HEAD").trim());
  });
});
