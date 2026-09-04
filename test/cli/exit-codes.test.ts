// Task 10 / CLI exit mapping — the frozen outcome-to-exit table is the
// CLI's alone: valid exits 0, invalid 1, invalid-input 2, extension-error 3,
// internal-error 4; no other exit code exists and nothing may override the
// table. The reachable outcome kinds are driven end-to-end through the real
// compiled entrypoint; the full closed set — including the kinds no upstream
// owner can yet produce from caller data — is driven exhaustively through the
// frozen table in-process. Criteria owned here: cli-exit-mapping-frozen.

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

import { CLI_EXIT_CODES_V1, exitCodeOfOutcomeV1 } from "../../packages/cli/src/io.js";
import { COMPILATION_OUTCOMES_V1 } from "../../packages/sdk/src/index.js";
import { buildDocumentIndexV1 } from "../../packages/document-index/src/index.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const CLI_ENTRY = fileURLToPath(new URL("../../packages/cli/dist/main.js", import.meta.url));

interface CliRun {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCli(args: string[], stdin: string): CliRun {
  const spawned = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    input: stdin,
    encoding: "utf8",
  });
  return { stdout: spawned.stdout ?? "", stderr: spawned.stderr ?? "", exitCode: spawned.status ?? -1 };
}

const REAL_MARKDOWN = `<!-- sothoth:section id="alpha" -->\n# Alpha\nprose\n`;

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
  compiler: { compilerId: "sothoth-exit-test", compilerRevision: 1 },
};

const CLOSED_EXIT_SET = [0, 1, 2, 3, 4];

const tempRoots: string[] = [];

afterAll(() => {
  for (const path of tempRoots) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("cli-exit-mapping-frozen: the table itself", () => {
  test("the frozen table is exactly the five documented outcome→exit pairs", () => {
    expect({ ...CLI_EXIT_CODES_V1 }).toEqual({
      valid: 0,
      invalid: 1,
      "invalid-input": 2,
      "extension-error": 3,
      "internal-error": 4,
    });
  });

  test("the table is frozen: no extension or caller can override, add, or repurpose an exit", () => {
    expect(Object.isFrozen(CLI_EXIT_CODES_V1)).toBe(true);
    expect(Object.keys(CLI_EXIT_CODES_V1).sort()).toEqual([...COMPILATION_OUTCOMES_V1].sort());
    expect(() => {
      (CLI_EXIT_CODES_V1 as unknown as Record<string, number>).valid = 9;
    }).toThrow();
    expect(() => {
      (CLI_EXIT_CODES_V1 as unknown as Record<string, number>)["extension-error"] = 0;
    }).toThrow();
    expect(CLI_EXIT_CODES_V1.valid).toBe(0);
  });

  test("exitCodeOfOutcomeV1 drives every member of the closed outcome set, and only 0–4 exist", () => {
    for (const outcome of COMPILATION_OUTCOMES_V1) {
      const code = exitCodeOfOutcomeV1(outcome);
      expect(CLOSED_EXIT_SET).toContain(code);
      expect(code).toBe(CLI_EXIT_CODES_V1[outcome]);
    }
    expect(exitCodeOfOutcomeV1("valid")).toBe(0);
    expect(exitCodeOfOutcomeV1("invalid")).toBe(1);
    expect(exitCodeOfOutcomeV1("invalid-input")).toBe(2);
    expect(exitCodeOfOutcomeV1("extension-error")).toBe(3);
    expect(exitCodeOfOutcomeV1("internal-error")).toBe(4);
    // An unknown outcome kind fails closed onto internal-error, never a new code.
    expect(exitCodeOfOutcomeV1("nonsense" as never)).toBe(4);
  });
});

describe("cli-exit-mapping-frozen: reachable outcomes end-to-end", () => {
  test("valid exits 0", () => {
    const result = runCli(["index", "--format", "json"], JSON.stringify(INDEX_REQUEST));
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).outcome).toBe("valid");
  });

  test("invalid exits 1", () => {
    const direct = buildDocumentIndexV1(INDEX_REQUEST);
    expect(direct.ok).toBe(true);
    const projection = (direct as { projection: Record<string, unknown> }).projection;
    const tampered = { ...projection, indexDigest: `sha256:${"0".repeat(64)}` };
    const result = runCli(
      ["verify-projection", "--format", "json"],
      JSON.stringify({ document: tampered, digestField: "indexDigest" }),
    );
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).outcome).toBe("invalid");
  });

  test("invalid-input exits 2: malformed stdin, unknown command, missing option, unreadable input, unwritable output", () => {
    const malformed = runCli(["check", "--format", "json"], "{");
    expect(malformed.exitCode).toBe(2);

    const unknownCommand = runCli(["secret-command", "--format", "json"], "{}");
    expect(unknownCommand.exitCode).toBe(2);

    const missingOption = runCli(["index"], "{}");
    expect(missingOption.exitCode).toBe(2);

    const unreadable = runCli(["index", "--format", "json", "--input", "/nonexistent/absent.json"], "");
    expect(unreadable.exitCode).toBe(2);

    const dir = mkdtempSync(join(tmpdir(), "sothoth-exit-"));
    tempRoots.push(dir);
    const target = join(dir, "no", "such", "dir", "out.json");
    const unwritable = runCli(["index", "--format", "json", "--output", target], JSON.stringify(INDEX_REQUEST));
    expect(unwritable.exitCode).toBe(2);
    expect(JSON.parse(unwritable.stdout).diagnostics[0].code).toBe("sothoth.pre-design/output-unwritable");
  });

  test("an owner-reported invalid-input outcome also exits 2", () => {
    // Shape-invalid governance facts make the owner itself fold invalid-input.
    const result = runCli(
      ["check", "--format", "json"],
      JSON.stringify({ contract: {}, catalog: {}, registry: {}, registrations: {}, documents: {}, documentIndex: {} }),
    );
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).result.result.outcome).toBe("invalid-input");
  });

  test("every invocation exits only within the closed 0–4 set", () => {
    const runs = [
      runCli(["index", "--format", "json"], JSON.stringify(INDEX_REQUEST)),
      runCli(["check", "--format", "json"], "{"),
      runCli(["verify-projection", "--format", "sarif"], "not json"),
      runCli(["--help"], ""),
      runCli(["compile", "planning", "--format", "terminal"], JSON.stringify({ tasks: [] })),
      runCli(["select", "--format", "json"], JSON.stringify({ documentIndex: null, selector: null })),
      runCli(["explain", "--format", "json"], JSON.stringify({ documentIndex: null, selector: null })),
      runCli(["change-plan", "--format", "json"], JSON.stringify({ documentIndex: null, roleMapping: null })),
    ];
    for (const run of runs) {
      expect(CLOSED_EXIT_SET).toContain(run.exitCode);
    }
  });

  test("byte-stable: identical invocations repeat their exit code and stdout bytes", () => {
    const first = runCli(["check", "--format", "json"], "{");
    const second = runCli(["check", "--format", "json"], "{");
    expect(first.exitCode).toBe(second.exitCode);
    expect(first.stdout).toBe(second.stdout);
  });
});

// ---------------------------------------------------------------------------
// Unexpected internal failures land inside the frozen map — fix round 1,
// finding F-2. A broken stdout pipe (shell composition, e.g. `| head`) must
// exit internal-error (4) — never the invalid code 1 — and must never leak a
// nondeterministic stack trace onto stderr.
// ---------------------------------------------------------------------------

describe("cli-exit-mapping-frozen: unexpected internal failures (F-2)", () => {
  test("a broken stdout pipe fails deterministically: exit 4, one fixed stderr line, no stack", async () => {
    // One large valid request (600 documents) so the rendered machine
    // document far exceeds the pipe buffer: the consumer closes after the
    // first bytes while the CLI is still writing.
    const markdown = `<!-- sothoth:section id="alpha" -->\n# Alpha\nprose\n`;
    const digest = sha256Digest(markdown);
    const request = {
      sources: Array.from({ length: 600 }, (_, index) => ({
        artifactId: `DOC-${index}`,
        path: `docs/doc-${index}.md`,
        version: "1",
        content: markdown,
        contentDigest: digest,
        blobSha: null,
        kind: "dossier",
        status: "accepted",
        owner: "sothoth",
        tags: [],
        references: [],
      })),
      budgets: {
        maxContentCodeUnits: 2_000_000,
        maxDocuments: 1_000,
        maxAstNodes: 2_000_000,
        maxRelationsPerDocument: 100,
        maxHeadingTextCodeUnits: 2_000,
      },
      compiler: { compilerId: "sothoth-f2-test", compilerRevision: 1 },
    };

    const child = spawn(process.execPath, [CLI_ENTRY, "index", "--format", "json"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(JSON.stringify(request));
    let seen = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      seen += chunk.length;
      if (seen >= 50 && !child.stdout.destroyed) {
        child.stdout.destroy();
      }
    });
    // Swallow the reader-side close error in the test process itself.
    child.stdout.on("error", () => {});
    const stderrChunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    const closed = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.on("close", (code, signal) => resolve({ code, signal }));
      },
    );

    expect(closed.signal).toBeNull();
    // The frozen map's internal-error exit — never the invalid code 1.
    expect(closed.code).toBe(4);
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    // Deterministic containment: exactly one fixed line, no stack bytes.
    expect(stderr).toBe("sothoth: internal-error (exit 4)\n");
    expect(stderr).not.toContain("EPIPE");
    expect(stderr).not.toContain("at ");
    expect(seen).toBeGreaterThan(0);
  });
});
