// Task 10 / CLI — spawned-command conformance against the real compiled
// entrypoint `node packages/cli/dist/main.js`, plus in-process checks of the
// pure input/write modules. Criteria owned here: cli-command-surface-closure,
// cli-stdout-single-document, cli-atomic-explicit-output, and the explicit-
// input fence (no environment-variable semantics, no implicit scanning).
//
// Every file or repository this suite touches lives under the OS temp
// directory; the Sothoth and FRACTA repositories are never mutated.

import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

import { CLI_COMMANDS_V1, parseCliArgumentsV1 } from "../../packages/cli/src/args.js";
import { CLI_EXIT_CODES_V1, writeAtomicV1 } from "../../packages/cli/src/io.js";
import { buildDocumentIndexV1 } from "../../packages/document-index/src/index.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const CLI_ENTRY = fileURLToPath(new URL("../../packages/cli/dist/main.js", import.meta.url));
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

interface CliRun {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Runs the real compiled entrypoint. (The plan's Step 1 example awaits the
 *  result; awaiting this synchronous value is a no-op, so both styles work.) */
function runCli(args: string[], stdin: string, env: Record<string, string> = {}): CliRun {
  const spawned = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return {
    stdout: spawned.stdout ?? "",
    stderr: spawned.stderr ?? "",
    exitCode: spawned.status ?? -1,
  };
}

// ---------------------------------------------------------------------------
// Fixtures: a real markdown document-index input and downstream requests
// ---------------------------------------------------------------------------

const REAL_MARKDOWN = `<!-- sothoth:section id="alpha" -->\n# Alpha\nprose\n<!-- sothoth:section id="beta" -->\n# Beta\nprose\n`;

const INDEX_REQUEST = {
  sources: [
    {
      artifactId: "DOC-A",
      path: "docs/DOC-A.md",
      version: "1",
      content: REAL_MARKDOWN,
      contentDigest: sha256Digest(REAL_MARKDOWN),
      blobSha: null,
      kind: "dossier",
      status: "accepted",
      owner: "sothoth",
      tags: [],
      references: [],
    },
  ],
  budgets: {
    maxContentCodeUnits: 100_000,
    maxDocuments: 100,
    maxAstNodes: 100_000,
    maxRelationsPerDocument: 100,
    maxHeadingTextCodeUnits: 2_000,
  },
  compiler: { compilerId: "sothoth-cli-test", compilerRevision: 1 },
};

const SCHEDULING_REQUEST = {
  tasks: [
    { taskId: "build", dependsOn: [] },
    { taskId: "test", dependsOn: ["build"] },
    { taskId: "publish", dependsOn: ["test"] },
  ],
};

function realProjection(): Record<string, unknown> {
  const direct = buildDocumentIndexV1(INDEX_REQUEST);
  expect(direct.ok).toBe(true);
  return (direct as { projection: Record<string, unknown> }).projection;
}

const tempRoots: string[] = [];

function tempDir(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), `sothoth-cli-${prefix}-`));
  tempRoots.push(path);
  return path;
}

afterAll(() => {
  for (const path of tempRoots) {
    rmSync(path, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The plan's Step 1 example, verbatim shape
// ---------------------------------------------------------------------------

describe("malformed input (plan Step 1)", () => {
  test("returns exit 2 and JSON diagnostics for malformed input", async () => {
    const result = await runCli(["check", "--format", "json"], "{");
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).diagnostics[0].code).toBe("sothoth.input/invalid-json");
    expect(result.stderr).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Command surface closure
// ---------------------------------------------------------------------------

describe("cli-command-surface-closure", () => {
  test("the command table is exactly the eight documented commands, frozen", () => {
    expect([...CLI_COMMANDS_V1]).toEqual([
      "change-plan",
      "check",
      "compile governance",
      "compile planning",
      "explain",
      "index",
      "select",
      "verify-projection",
    ]);
    expect(Object.isFrozen(CLI_COMMANDS_V1)).toBe(true);
  });

  test("--help exits 0 and lists exactly the eight capability commands", () => {
    const result = runCli(["--help"], "");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const lines = result.stdout.split("\n");
    const block = lines.slice(lines.indexOf("commands (exactly eight):") + 1);
    const commands = block
      .slice(0, block.indexOf(""))
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => (line.startsWith("compile ") ? line.split(/\s+/).slice(0, 2).join(" ") : line.split(/\s+/)[0]!));
    expect(commands.sort()).toEqual(
      [
        "change-plan",
        "check",
        "compile governance",
        "compile planning",
        "explain",
        "index",
        "select",
        "verify-projection",
      ].sort(),
    );
    // No undocumented ninth command appears anywhere in the help text.
    expect(result.stdout).not.toContain("profiles");
    expect(result.stdout).not.toContain("snapshot");
  });

  test("unknown commands and hidden-command attempts fail closed as invalid input", () => {
    for (const argv of [["frobnicate"], ["compile"], ["compile", "nonsense"], ["status"], ["git"], ["profiles"]]) {
      const result = runCli([...argv, "--format", "json"], "{}");
      expect(result.exitCode, argv.join(" ")).toBe(2);
      const document = JSON.parse(result.stdout);
      expect(document.outcome, argv.join(" ")).toBe("invalid-input");
      expect(document.diagnostics[0].code, argv.join(" ")).toBe("sothoth.input/unknown-command");
      expect(result.stderr, argv.join(" ")).toBe("");
    }
  });

  test("unknown options, missing --format, and bad format values are invalid input", () => {
    const unknownOption = runCli(["index", "--format", "json", "--verbose"], "{}");
    expect(unknownOption.exitCode).toBe(2);
    expect(JSON.parse(unknownOption.stdout).diagnostics[0].code).toBe("sothoth.input/unknown-option");

    const missingFormat = runCli(["index"], "{}");
    expect(missingFormat.exitCode).toBe(2);
    expect(JSON.parse(missingFormat.stdout).diagnostics[0].code).toBe("sothoth.input/missing-option");

    const badFormat = runCli(["index", "--format", "xml"], "{}");
    expect(badFormat.exitCode).toBe(2);
    expect(JSON.parse(badFormat.stdout).diagnostics[0].code).toBe("sothoth.input/invalid-option-value");

    const bareFormat = runCli(["index", "--format"], "{}");
    expect(bareFormat.exitCode).toBe(2);
    expect(JSON.parse(bareFormat.stdout).diagnostics[0].code).toBe("sothoth.input/invalid-option");
  });

  test("stray positional arguments are rejected — the CLI never treats a bare path as an input root", () => {
    const result = runCli(["index", "docs/", "--format", "json"], "");
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).diagnostics[0].code).toBe("sothoth.input/unexpected-argument");
    // A directory positional is never implicitly scanned: nothing but the
    // rejection document is emitted.
    expect(result.stdout.startsWith("{")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Explicit-input fence: no environment-variable semantics, no implicit scan
// ---------------------------------------------------------------------------

describe("cli-input-declaration (explicit input only)", () => {
  test("environment variables carry no semantics", () => {
    // A poisoned environment cannot supply the missing format...
    const missing = runCli(["index"], "{}", { SOTHOTH_FORMAT: "json", SO_FORMAT: "json", FORMAT: "json" });
    expect(missing.exitCode).toBe(2);
    expect(JSON.parse(missing.stdout).diagnostics[0].code).toBe("sothoth.input/missing-option");
    // ...and cannot override an explicit format.
    const explicit = runCli(["index", "--format", "json"], JSON.stringify(INDEX_REQUEST), {
      SOTHOTH_FORMAT: "sarif",
    });
    expect(explicit.exitCode).toBe(0);
    expect(JSON.parse(explicit.stdout).schema).toBe("sothoth.cli/cli-invocation-result@1");
  });

  test("--input reads an explicit path and an unreadable explicit path fails closed", () => {
    const dir = tempDir("input");
    const requestPath = join(dir, "request.json");
    writeFileSync(requestPath, JSON.stringify(SCHEDULING_REQUEST));
    const viaPath = runCli(["compile", "planning", "--format", "json", "--input", requestPath], "");
    expect(viaPath.exitCode).toBe(0);
    expect(JSON.parse(viaPath.stdout).result.result.outcome).toBe("valid");

    const missing = runCli(["compile", "planning", "--format", "json", "--input", join(dir, "absent.json")], "");
    expect(missing.exitCode).toBe(2);
    expect(JSON.parse(missing.stdout).diagnostics[0].code).toBe("sothoth.input/input-unreadable");

    const directory = runCli(["compile", "planning", "--format", "json", "--input", dir], "");
    expect(directory.exitCode).toBe(2);
    expect(JSON.parse(directory.stdout).diagnostics[0].code).toBe("sothoth.input/input-unreadable");
  });
});

// ---------------------------------------------------------------------------
// The eight commands over real inputs
// ---------------------------------------------------------------------------

describe("the eight documented commands", () => {
  test("index compiles the document index over real markdown", () => {
    const result = runCli(["index", "--format", "json"], JSON.stringify(INDEX_REQUEST));
    expect(result.exitCode).toBe(0);
    const document = JSON.parse(result.stdout);
    expect(document.schema).toBe("sothoth.cli/cli-invocation-result@1");
    expect(document.command).toBe("index");
    expect(document.outcome).toBe("valid");
    expect(document.result.schema).toBe("sothoth.sdk/facade-result@1");
    expect(document.result.capability).toBe("documents/index");
    expect(document.result.result.projection.indexDigest).toMatch(DIGEST_PATTERN);
    expect(document.result.result.projection.documents[0].artifactId).toBe("DOC-A");
  });

  test("compile planning compiles a digest-bearing schedule", () => {
    const result = runCli(["compile", "planning", "--format", "json"], JSON.stringify(SCHEDULING_REQUEST));
    expect(result.exitCode).toBe(0);
    const solution = JSON.parse(result.stdout).result.result;
    expect(solution.outcome).toBe("valid");
    expect(solution.digest).toMatch(DIGEST_PATTERN);
    expect(solution.waves.length).toBe(3);
  });

  test("select resolves a selector and explain returns the trace", () => {
    const projection = realProjection();
    const select = runCli(
      ["select", "--format", "json"],
      JSON.stringify({ documentIndex: projection, selector: { kind: { any: ["dossier"] } } }),
    );
    expect(select.exitCode).toBe(0);
    const selected = JSON.parse(select.stdout).result.result;
    expect(selected.ok).toBe(true);
    expect(selected.matches).toEqual([{ artifactId: "DOC-A" }]);

    const explain = runCli(
      ["explain", "--format", "json"],
      JSON.stringify({ documentIndex: projection, selector: { kind: { any: ["dossier"] } } }),
    );
    expect(explain.exitCode).toBe(0);
    const trace = JSON.parse(explain.stdout).result.result.trace;
    expect(trace).toEqual([
      { artifactId: "DOC-A", matched: true, terms: [expect.objectContaining({ outcome: "admitted" })] },
    ]);
  });

  test("verify-projection verifies a real digest and rejects a tampered one", () => {
    const projection = realProjection();
    const ok = runCli(
      ["verify-projection", "--format", "json"],
      JSON.stringify({ document: projection, digestField: "indexDigest" }),
    );
    expect(ok.exitCode).toBe(0);
    expect(JSON.parse(ok.stdout).result.result).toEqual({
      verified: true,
      digestField: "indexDigest",
      claimedDigest: projection.indexDigest,
      recomputedDigest: projection.indexDigest,
    });

    const tampered = { ...projection, indexDigest: `sha256:${"0".repeat(64)}` };
    const bad = runCli(
      ["verify-projection", "--format", "json"],
      JSON.stringify({ document: tampered, digestField: "indexDigest" }),
    );
    expect(bad.exitCode).toBe(1);
    expect(JSON.parse(bad.stdout).outcome).toBe("invalid");
    expect(JSON.parse(bad.stdout).result.result.verified).toBe(false);
  });

  test("check, compile governance, and change-plan compose their governance projections", () => {
    // check with shape-invalid facts still composes and reports the owner's
    // folded invalid-input outcome through the facade.
    const check = runCli(["check", "--format", "json"], JSON.stringify({ contract: {}, catalog: {}, registry: {}, registrations: {}, documents: {}, documentIndex: {} }));
    expect(check.exitCode).toBe(2);
    expect(JSON.parse(check.stdout).result.result.outcome).toBe("invalid-input");

    const governance = runCli(
      ["compile", "governance", "--format", "json"],
      JSON.stringify({ nope: true }),
    );
    expect(governance.exitCode).toBe(2);
    expect(JSON.parse(governance.stdout).result.capability).toBe("compile/governance");

    const projection = realProjection();
    const changePlan = runCli(
      ["change-plan", "--format", "json"],
      JSON.stringify({
        documentIndex: projection,
        roleMapping: {
          schema: "sothoth.governance/relation-role-mapping@1",
          mappingId: "TEST-MAPPING",
          mappingRevision: 2,
          entries: [],
        },
        changedArtifactIds: ["DOC-A"],
      }),
    );
    expect(changePlan.exitCode).toBe(0);
    const plan = JSON.parse(changePlan.stdout).result.result;
    expect(plan.schema).toBe("sothoth.governance/change-plan-projection@1");
    expect(plan.outcome).toBe("valid");
    expect(plan.changedArtifactIds).toEqual(["DOC-A"]);
  });
});

// ---------------------------------------------------------------------------
// Stream discipline: exactly one machine document on stdout
// ---------------------------------------------------------------------------

describe("cli-stdout-single-document", () => {
  test("machine output is exactly one parseable JSON document with empty stderr", () => {
    const result = runCli(["index", "--format", "json"], JSON.stringify(INDEX_REQUEST));
    expect(result.stderr).toBe("");
    expect(result.stdout.startsWith("{")).toBe(true);
    expect(result.stdout.endsWith("}\n")).toBe(true);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    // No banners, progress lines, or warnings contaminate the channel.
    expect(result.stdout.match(/\n/g)?.length).toBeGreaterThan(3);
  });

  test("identical invocations produce byte-identical stdout and exit codes", () => {
    const first = runCli(["compile", "planning", "--format", "json"], JSON.stringify(SCHEDULING_REQUEST));
    const second = runCli(["compile", "planning", "--format", "json"], JSON.stringify(SCHEDULING_REQUEST));
    expect(first.stdout).toBe(second.stdout);
    expect(first.exitCode).toBe(second.exitCode);
  });

  test("SARIF output is one SARIF 2.1.0 document carrying the diagnostics", () => {
    const result = runCli(["check", "--format", "sarif"], "{");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    const sarif = JSON.parse(result.stdout);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs.length).toBe(1);
    expect(sarif.runs[0].tool.driver.name).toBe("sothoth");
    expect(sarif.runs[0].results[0].ruleId).toBe("sothoth.input/invalid-json");
    expect(sarif.runs[0].results[0].level).toBe("error");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  test("terminal mode keeps stdout human and puts diagnostics on stderr only", () => {
    const result = runCli(["check", "--format", "terminal"], "{");
    expect(result.exitCode).toBe(2);
    expect(result.stdout.startsWith("{")).toBe(false);
    expect(result.stdout).toContain("invalid-input");
    expect(result.stderr).toContain("sothoth.input/invalid-json");

    const quiet = runCli(["compile", "planning", "--format", "terminal"], JSON.stringify(SCHEDULING_REQUEST));
    expect(quiet.exitCode).toBe(0);
    expect(quiet.stderr).toBe("");
    expect(quiet.stdout).toContain("valid");
  });

  test("machine modes never write diagnostics to stderr, even on failure", () => {
    for (const format of ["json", "sarif"]) {
      const result = runCli(["verify-projection", "--format", format], JSON.stringify({ document: {}, digestField: "x" }));
      expect(result.exitCode, format).toBe(2);
      expect(result.stderr, format).toBe("");
      expect(result.stdout, format).not.toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// Atomic explicit output
// ---------------------------------------------------------------------------

describe("cli-atomic-explicit-output", () => {
  test("an explicit --output path receives the whole document and stdout stays empty", () => {
    const dir = tempDir("output");
    const target = join(dir, "result.json");
    const result = runCli(
      ["index", "--format", "json", "--output", target],
      JSON.stringify(INDEX_REQUEST),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    const written = readFileSync(target, "utf8");
    const toStdout = runCli(["index", "--format", "json"], JSON.stringify(INDEX_REQUEST));
    expect(written).toBe(toStdout.stdout);
  });

  test("an existing longer target is replaced wholesale — never appended or partial", () => {
    const dir = tempDir("replace");
    const target = join(dir, "result.json");
    writeFileSync(target, `${"stale".repeat(500)}\n`);
    const result = runCli(
      ["compile", "planning", "--format", "json", "--output", target],
      JSON.stringify(SCHEDULING_REQUEST),
    );
    expect(result.exitCode).toBe(0);
    const written = readFileSync(target, "utf8");
    expect(JSON.parse(written).schema).toBe("sothoth.cli/cli-invocation-result@1");
    expect(written).not.toContain("stale");
  });

  test("an unwritable destination is invalid input: exit 2, the established diagnostic, no partial file", () => {
    const dir = tempDir("unwritable");
    const locked = join(dir, "locked");
    mkdirSyncSafe(locked);
    const target = join(locked, "result.json");
    const result = runCli(
      ["index", "--format", "json", "--output", target],
      JSON.stringify(INDEX_REQUEST),
    );
    expect(result.exitCode).toBe(2);
    const document = JSON.parse(result.stdout);
    expect(document.outcome).toBe("invalid-input");
    expect(document.diagnostics[0].code).toBe("sothoth.pre-design/output-unwritable");
    expect(document.diagnostics[0].subjects).toEqual([target]);
    expect(document.result).toBeNull();
    // No partial target and no leftover temp file: the directory stays empty.
    expect(readdirSync(locked)).toEqual([]);
  });

  test("an unwritable existing target file is still replaced via same-dir temp-then-rename", () => {
    const dir = tempDir("unwritable-file");
    const target = join(dir, "result.json");
    writeFileSync(target, "previous\n");
    chmodSync(target, 0o400);
    const result = runCli(
      ["index", "--format", "json", "--output", target],
      JSON.stringify(INDEX_REQUEST),
    );
    chmodSync(target, 0o600);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(target, "utf8")).schema).toBe("sothoth.cli/cli-invocation-result@1");
  });

  test("in-process writeAtomicV1 writes bytes and leaves no temp file behind", () => {
    const dir = tempDir("atomic");
    const target = join(dir, "out.json");
    writeAtomicV1(target, "{\"ok\":true}\n");
    expect(readFileSync(target, "utf8")).toBe("{\"ok\":true}\n");
    expect(readdirSync(dir)).toEqual(["out.json"]);
    // The frozen exit table lives at the io boundary and cannot be extended.
    expect(Object.isFrozen(CLI_EXIT_CODES_V1)).toBe(true);
  });
});

function mkdirSyncSafe(path: string): void {
  // A read-only directory (mode 0o500) still allows listing, so the suite can
  // verify emptiness, while writes inside fail with EACCES.
  mkdirSync(path);
  chmodSync(path, 0o500);
}

// ---------------------------------------------------------------------------
// In-process input parsing (pure module)
// ---------------------------------------------------------------------------

describe("input module (parseCliArgumentsV1)", () => {
  test("parses the two-word compile commands and every single-word command", () => {
    expect(parseCliArgumentsV1(["check", "--format", "json"])).toMatchObject({
      ok: true,
      invocation: { command: "check", format: "json", inputPath: null, outputPath: null },
    });
    expect(parseCliArgumentsV1(["compile", "governance", "--format", "terminal"])).toMatchObject({
      ok: true,
      invocation: { command: "compile governance" },
    });
    expect(parseCliArgumentsV1(["verify-projection", "--format", "json", "--input", "a", "--output", "b"])).toMatchObject({
      ok: true,
      invocation: { inputPath: "a", outputPath: "b" },
    });
  });

  test("rejects unknown commands and options deterministically", () => {
    const unknownCommand = parseCliArgumentsV1(["wat", "--format", "json"]);
    expect(unknownCommand).toMatchObject({ ok: false });
    expect(!unknownCommand.ok && unknownCommand.issues[0].code).toBe("sothoth.input/unknown-command");

    const unknownOption = parseCliArgumentsV1(["index", "--format", "json", "--wat"]);
    expect(!unknownOption.ok && unknownOption.issues[0].code).toBe("sothoth.input/unknown-option");

    const stray = parseCliArgumentsV1(["index", "docs/", "--format", "json"]);
    expect(!stray.ok && stray.issues[0].code).toBe("sothoth.input/unexpected-argument");
  });

  test("--help short-circuits before command validation", () => {
    const result = parseCliArgumentsV1(["--help"]);
    expect(result).toMatchObject({ ok: true, help: true });
  });
});
