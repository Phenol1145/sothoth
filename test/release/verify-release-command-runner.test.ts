// Task 12 — release-verification runner remediation (Event 42 pin).
//
// These tests pin the two tracked remediation contracts of
// `scripts/verify-release.mjs`:
//
//   A. A diagnosable bounded command runner: `commandStep` failures must
//      surface the command identity, the exit code or signal, and bounded,
//      secret-redacted child stdout/stderr with explicit truncation markers —
//      instead of the previous `stdio: "ignore"` blackout that discarded the
//      failing test's identity (CI run 33956033927, check 3).
//
//   B. A hermetic offline CLI smoke: a network-allowed cache-preparation
//      phase over the REAL packed tarballs, followed by an `--offline`
//      install against that dedicated cache with the network provably
//      sabotaged in the child environment — instead of depending on ambient
//      npm-cache warmth that GitHub-hosted runners do not have (CI run
//      33956033927, check 15).
//
// The suite is hermetic by construction: no network, no real npm, no
// `dist/release` dependency (release:verify runs `npm test` before it packs),
// and every child process is a throwaway fake executable in a temp dir.
// Child-process faking follows the repository's existing fake-npm harness
// pattern (test/release/package-contents.test.ts, "standby publisher").

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PACKAGE_ORDER } from "../../scripts/pack-all.mjs";

type VerifyReleaseModule = {
  runBoundedCommand?: unknown;
  commandStep?: unknown;
  redactSecrets?: unknown;
  BOUNDED_CAPTURE_LIMIT?: unknown;
  prepareOfflineCache?: unknown;
  runOfflineCliSmoke?: unknown;
  normalizeSbom?: unknown;
};

type BoundedCommandResult = {
  ok: boolean;
  status: number | null;
  signal: string | null;
  command: string;
  stdout: string;
  stderr: string;
  stdoutOmittedBytes: number;
  stderrOmittedBytes: number;
};

type CommandStepFn = (name: string, command: string, args: string[]) => Promise<boolean>;

type RunBoundedCommandFn = (
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; captureLimit?: number },
) => Promise<BoundedCommandResult>;

type RedactSecretsFn = (text: string) => string;

type RunOfflineCliSmokeOptions = {
  releaseDir: string;
  npmBin?: string;
  env?: NodeJS.ProcessEnv;
  tmpDir?: string;
};

type RunOfflineCliSmokeFn = (options: RunOfflineCliSmokeOptions) => Promise<{ ok: boolean }>;

async function loadVerifyRelease(): Promise<VerifyReleaseModule> {
  return (await import("../../scripts/verify-release.mjs")) as VerifyReleaseModule;
}

const SABOTAGE_PROXY = "http://127.0.0.1:9";

const SOTHOTH_PACKAGES = [
  "cli",
  "contracts",
  "core",
  "document-index",
  "git",
  "governance",
  "graph",
  "planning",
  "profile-sdk",
  "sdk",
  "selectors",
] as const;

interface FakeNpmInvocation {
  offline: boolean;
  cacheDir: string | null;
  tarballCount: number;
  tarballs: string[];
  proxyEnv: Record<string, string | undefined>;
}

/**
 * Writes a fake `npm` executable that emulates the cold-cache red gate:
 * a non-offline (network-allowed) install warms the cache directory given
 * via `--cache` (marker file, unless FAKE_NPM_NEVER_WARM is set); an
 * `--offline` install fails with the ENOTCACHED shape unless the marker
 * exists. Installs fabricate a minimal consumer layout (11 @project-sothoth
 * dirs, a `.bin/sothoth` speaking the CLI contract, and a 36-key contracts
 * module) so the smoke's own assertions run end-to-end without real npm.
 * Every invocation is appended to FAKE_NPM_LOG as one JSON line.
 */
function writeFakeNpm(dir: string): string {
  const binPath = join(dir, "npm");
  const lines = [
    "#!/usr/bin/env node",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const argv = process.argv.slice(2);",
    "const offline = argv.includes('--offline');",
    "const cacheIdx = argv.indexOf('--cache');",
    "const cacheDir = cacheIdx >= 0 ? argv[cacheIdx + 1] : null;",
    "const tarballs = argv.filter((a) => a.endsWith('.tgz'));",
    "const invocation = {",
    "  offline,",
    "  cacheDir,",
    "  tarballCount: tarballs.length,",
    "  tarballs,",
    "  proxyEnv: {",
    "    npm_config_https_proxy: process.env.npm_config_https_proxy,",
    "    npm_config_proxy: process.env.npm_config_proxy,",
    "    https_proxy: process.env.https_proxy,",
    "    HTTPS_PROXY: process.env.HTTPS_PROXY,",
    "    http_proxy: process.env.http_proxy,",
    "    HTTP_PROXY: process.env.HTTP_PROXY,",
    "    all_proxy: process.env.all_proxy,",
    "    ALL_PROXY: process.env.ALL_PROXY,",
    "  },",
    "};",
    "if (process.env.FAKE_NPM_LOG) {",
    "  fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify(invocation) + '\\n');",
    "}",
    "function install() {",
    "  const nm = path.join(process.cwd(), 'node_modules');",
    "  const scope = path.join(nm, '@project-sothoth');",
    "  fs.mkdirSync(scope, { recursive: true });",
    `  for (const name of ${JSON.stringify(SOTHOTH_PACKAGES)}) {`,
    "    fs.mkdirSync(path.join(scope, name), { recursive: true });",
    "  }",
    "  const binDir = path.join(nm, '.bin');",
    "  fs.mkdirSync(binDir, { recursive: true });",
    "  const sothoth = [",
    "    '#!/usr/bin/env node',",
    "    'const argv = process.argv.slice(2);',",
    "    \"if (argv.includes('--help')) { console.log('sothoth 0.1.0 — explicit command surface (CONTRACT/SOTHOTH/CLI-IO@1)'); process.exit(0); }\",",
    `    "if (argv.includes('--bogus')) { console.log('{\\"error\\":{\\"code\\":\\"sothoth.input/unknown-option\\",\\"schema\\": \\"sothoth.cli/cli-invocation-result@1\\"}}'); process.exit(2); }",`,
    "    'process.exit(1);',",
    "  ].join('\\n');",
    "  fs.writeFileSync(path.join(binDir, 'sothoth'), sothoth);",
    "  fs.chmodSync(path.join(binDir, 'sothoth'), 0o755);",
    "  const contractsDir = path.join(scope, 'contracts');",
    "  fs.mkdirSync(contractsDir, { recursive: true });",
    "  const named = Array.from({ length: 36 }, (_, i) => `export const e${i} = ${i};`).join('\\n');",
    "  fs.writeFileSync(path.join(contractsDir, 'index.mjs'), named);",
    "  fs.writeFileSync(",
    "    path.join(contractsDir, 'package.json'),",
    "    JSON.stringify({ name: '@project-sothoth/contracts', type: 'module', main: 'index.mjs' }),",
    "  );",
    "}",
    "if (!offline) {",
    "  if (cacheDir === null) { console.error('fake npm: preparation install requires --cache'); process.exit(1); }",
    "  if (!process.env.FAKE_NPM_NEVER_WARM) {",
    "    fs.writeFileSync(path.join(cacheDir, 'WARMED'), 'warmed-by-preparation\\n');",
    "  }",
    "  install();",
    "  process.exit(0);",
    "}",
    "if (cacheDir === null || !fs.existsSync(path.join(cacheDir, 'WARMED'))) {",
    "  console.error('npm error code ENOTCACHED');",
    "  console.error(\"npm error request to https://registry.npmjs.org/mdast-util-from-markdown failed: cache mode is 'only-if-cached' but no cached response is available.\");",
    "  process.exit(1);",
    "}",
    "install();",
    "process.exit(0);",
  ];
  writeFileSync(binPath, `${lines.join("\n")}\n`, "utf8");
  chmodSync(binPath, 0o755);
  return binPath;
}

/** Writes a fake executable that prints `output` on stdout and exits. */
function writeFakeEcho(dir: string, name: string, output: string, exitCode: number): string {
  const binPath = join(dir, name);
  const script = [
    "#!/usr/bin/env node",
    `const out = ${JSON.stringify(output)};`,
    "if (out) { console.log(out); }",
    `process.exit(${exitCode});`,
  ].join("\n");
  writeFileSync(binPath, `${script}\n`, "utf8");
  chmodSync(binPath, 0o755);
  return binPath;
}

/** Builds a fixture releaseDir holding `count` zero-byte pack-1 tarballs. */
function writeFixtureReleaseDir(dir: string, count: number): string {
  const releaseDir = join(dir, "release");
  const packDir = join(releaseDir, "pack-1");
  mkdirSync(packDir, { recursive: true });
  for (const name of PACKAGE_ORDER.slice(0, count)) {
    writeFileSync(join(packDir, `project-sothoth-${name}-0.1.0.tgz`), "");
  }
  return releaseDir;
}

function readInvocations(logPath: string): FakeNpmInvocation[] {
  if (!existsSync(logPath)) {
    return [];
  }
  return readFileSync(logPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FakeNpmInvocation);
}

function smokeEnv(logPath?: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: tmpRoot(),
    ...(logPath ? { FAKE_NPM_LOG: logPath } : {}),
  };
}

describe("Task 12 bounded command runner (diagnosable commandStep)", () => {
  test("exports the bounded runner, step wrapper, redaction helper, and capture limit", async () => {
    const vr = await loadVerifyRelease();
    expect(vr.runBoundedCommand, "runBoundedCommand must be exported").toBeInstanceOf(Function);
    expect(vr.commandStep, "commandStep must be exported").toBeInstanceOf(Function);
    expect(vr.redactSecrets, "redactSecrets must be exported").toBeInstanceOf(Function);
    expect(vr.BOUNDED_CAPTURE_LIMIT, "BOUNDED_CAPTURE_LIMIT must be exported").toBeTypeOf("number");
  });

  test("a failing command surfaces its identity, exit code, and bounded streams", async () => {
    const { runBoundedCommand } = (await loadVerifyRelease()) as {
      runBoundedCommand: RunBoundedCommandFn;
    };
    const bin = writeFakeEcho(tmpRoot(), "failing-probe", "", 3);
    const result = await runBoundedCommand(bin, ["--mode", "suite"], { cwd: tmpRoot() });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(3);
    expect(result.signal).toBeNull();
    expect(result.command).toContain("failing-probe");
    expect(result.command).toContain("--mode");
    expect(result.command).toContain("suite");
  });

  test("a signal-terminated command surfaces the signal instead of an exit code", async () => {
    const { runBoundedCommand } = (await loadVerifyRelease()) as {
      runBoundedCommand: RunBoundedCommandFn;
    };
    const binPath = join(tmpRoot(), "self-terminating-probe");
    writeFileSync(
      binPath,
      "#!/usr/bin/env node\nprocess.kill(process.pid, 'SIGTERM');\n",
      "utf8",
    );
    chmodSync(binPath, 0o755);
    const result = await runBoundedCommand(binPath, []);
    expect(result.ok).toBe(false);
    expect(result.status).toBeNull();
    expect(result.signal).toBe("SIGTERM");
  });

  test("captured output is bounded at the deterministic limit with an explicit truncation marker", async () => {
    const { runBoundedCommand } = (await loadVerifyRelease()) as {
      runBoundedCommand: RunBoundedCommandFn;
    };
    const dir = tmpRoot();
    const noisy = join(dir, "noisy-probe");
    writeFileSync(
      noisy,
      [
        "#!/usr/bin/env node",
        "process.stdout.write('x'.repeat(1000));",
        "process.stderr.write('y'.repeat(1000));",
        "process.exit(0);",
      ].join("\n"),
      "utf8",
    );
    chmodSync(noisy, 0o755);
    const result = await runBoundedCommand(noisy, [], { cwd: dir, captureLimit: 200 });
    expect(result.stdoutOmittedBytes).toBe(800);
    expect(result.stderrOmittedBytes).toBe(800);
    expect(result.stdout).toMatch(/truncated 800 of 1000 bytes/);
    expect(result.stderr).toMatch(/truncated 800 of 1000 bytes/);
    // The kept tail preserves the END of the stream (where failure summaries live).
    expect(result.stdout.endsWith("x".repeat(200))).toBe(true);
    expect(result.stderr.endsWith("y".repeat(200))).toBe(true);
  });

  test("npm and GitHub credential shapes are redacted from captured streams", async () => {
    const { runBoundedCommand, redactSecrets } = (await loadVerifyRelease()) as {
      runBoundedCommand: RunBoundedCommandFn;
      redactSecrets: RedactSecretsFn;
    };
    const tokens = [
      "npm_qR7xK2mP9wLzT5yU8aB3cD1e", // npm granular token
      "ghp_Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk2Ll", // GitHub classic PAT
      "gho_Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk2Ll", // GitHub OAuth token
      "ghu_Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk2Ll", // GitHub user-to-server token
      "ghs_Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk2Ll", // GitHub server-to-server token
      "ghr_Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk2Ll", // GitHub refresh token
      "github_pat_Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0", // GitHub fine-grained PAT
      "Authorization: Basic dXNlcjpwYXNzd29yZA==",
      "authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
      "Basic dXNlclBhc3N3b3JkMTIzNDU2Nzg=",
      "Bearer refresh-token-abcd1234EFGH5678",
    ];
    // Fix-round-1 (F1) strengthening: redaction must remove the credential
    // PAYLOAD, not merely break the full literal string. Each value here is
    // the secret material inside a fixture above (Authorization payloads) and
    // must be absent from redacted output on its own.
    const credentialPayloads = [
      "dXNlcjpwYXNzd29yZA==", // payload of "Authorization: Basic …"
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig", // payload of "authorization: Bearer …"
      "dXNlclBhc3N3b3JkMTIzNDU2Nzg=", // payload of standalone "Basic …"
      "refresh-token-abcd1234EFGH5678", // payload of standalone "Bearer …"
    ];
    // Fix-round-1 (M1): npm's canonical auth-token configuration key, in bare
    // and npmrc URI-scoped form; the value must never survive redaction.
    const authTokenValue = "7fKq9ZtR2wMx5bN8vC1jH4gD";
    const authTokenFixtures = [
      `_authToken=${authTokenValue}`,
      `//registry.npmjs.org/:_authToken=${authTokenValue}`,
    ];
    const dir = tmpRoot();
    const leaker = writeFakeEcho(dir, "leaking-probe", [...tokens, ...authTokenFixtures].join("\n"), 0);
    const result = await runBoundedCommand(leaker, [], { cwd: dir });
    for (const stream of [result.stdout, result.stderr]) {
      for (const token of tokens) {
        expect(stream, `stream must not leak ${token.slice(0, 12)}…`).not.toContain(token);
      }
      // F1: the payload values themselves must be gone.
      for (const payload of credentialPayloads) {
        expect(stream, `stream must not leak credential payload ${payload.slice(0, 8)}…`).not.toContain(payload);
      }
      // M1: _authToken values must be gone.
      expect(stream, "stream must not leak the _authToken value").not.toContain(authTokenValue);
    }
    expect(result.stdout).toContain("[REDACTED:");
    // The pure helper matches the streams' behavior.
    const redacted = redactSecrets([...tokens, ...authTokenFixtures].join("\n"));
    for (const token of tokens) {
      expect(redacted).not.toContain(token);
    }
    for (const payload of credentialPayloads) {
      expect(redacted, `redacted text must not keep credential payload ${payload.slice(0, 8)}…`).not.toContain(payload);
    }
    expect(redacted, "redacted text must not keep the _authToken value").not.toContain(authTokenValue);
    // Ordinary text and short non-token words survive redaction untouched.
    expect(redactSecrets("npm_config_cache and npm run typecheck stay intact")).toBe(
      "npm_config_cache and npm run typecheck stay intact",
    );
  });

  test("commandStep keeps the success-path record format unchanged (exit 0)", async () => {
    const { commandStep } = (await loadVerifyRelease()) as { commandStep: CommandStepFn };
    const bin = writeFakeEcho(tmpRoot(), "ok-probe", "all good", 0);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ok = await commandStep("probe: success path", bin, ["run", "typecheck"]);
      expect(ok).toBe(true);
      expect(logSpy.mock.calls.map((call) => call.join(" "))).toContain(
        "[ok  ] probe: success path — exit 0",
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  test("commandStep failure surfaces the failing child's identity in a bounded diagnostic block", async () => {
    const { commandStep } = (await loadVerifyRelease()) as { commandStep: CommandStepFn };
    const dir = tmpRoot();
    const failingSuite = join(dir, "npm");
    writeFileSync(
      failingSuite,
      [
        "#!/usr/bin/env node",
        "console.log('FAIL  test/really-failing.test.ts > boundary > refuses cross-package import');",
        "console.error('AssertionError: expected import to throw, got value');",
        "console.error('Tests  1 failed | 943 passed (944)');",
        "process.exit(1);",
      ].join("\n"),
      "utf8",
    );
    chmodSync(failingSuite, 0o755);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ok = await commandStep("probe: full test suite", failingSuite, ["test"]);
      expect(ok).toBe(false);
      const printed = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(printed).toContain("[FAIL] probe: full test suite");
      expect(printed).toContain("exit 1");
      expect(printed).toContain(
        "test/really-failing.test.ts > boundary > refuses cross-package import",
      );
      expect(printed).toContain("AssertionError: expected import to throw, got value");
      expect(printed).toContain("Tests  1 failed | 943 passed (944)");
    } finally {
      logSpy.mockRestore();
    }
  });

  test("a failing child never throws out of commandStep; the original cause is preserved verbatim", async () => {
    const { commandStep } = (await loadVerifyRelease()) as { commandStep: CommandStepFn };
    const bin = writeFakeEcho(tmpRoot(), "cause-probe", "CAUSE_SENTINEL_XY7 original failure text", 7);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(commandStep("probe: original cause", bin, [])).resolves.toBe(false);
      const printed = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(printed).toContain("CAUSE_SENTINEL_XY7 original failure text");
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("Task 12 hermetic offline CLI smoke (check 15)", () => {
  test("exports the preparation and smoke entries", async () => {
    const vr = await loadVerifyRelease();
    expect(vr.prepareOfflineCache, "prepareOfflineCache must be exported").toBeInstanceOf(Function);
    expect(vr.runOfflineCliSmoke, "runOfflineCliSmoke must be exported").toBeInstanceOf(Function);
  });

  test("cold-cache fake npm: preparation runs before the offline install against one shared dedicated cache, and only the offline phase is network-sabotaged", async () => {
    const { runOfflineCliSmoke } = (await loadVerifyRelease()) as {
      runOfflineCliSmoke: RunOfflineCliSmokeFn;
    };
    const dir = tmpRoot();
    const fakeNpm = writeFakeNpm(dir);
    const releaseDir = writeFixtureReleaseDir(dir, 11);
    const logPath = join(dir, "invocations.jsonl");
    const result = await runOfflineCliSmoke({
      releaseDir,
      npmBin: fakeNpm,
      env: smokeEnv(logPath),
      tmpDir: dir,
    });
    expect(result.ok).toBe(true);

    const invocations = readInvocations(logPath);
    expect(invocations.length).toBe(2);
    const [prep, offline] = invocations;
    // Preparation phase: network-allowed (no proxy sabotage), warms a dedicated cache.
    expect(prep.offline).toBe(false);
    expect(prep.cacheDir).not.toBeNull();
    expect(prep.tarballCount).toBe(11);
    for (const [key, value] of Object.entries(prep.proxyEnv)) {
      expect(value, `preparation env must not set ${key}`).toBeUndefined();
    }
    // Offline phase: same dedicated cache, network provably sabotaged in env.
    expect(offline.offline).toBe(true);
    expect(offline.cacheDir).toBe(prep.cacheDir);
    expect(offline.tarballCount).toBe(11);
    for (const [key, value] of Object.entries(offline.proxyEnv)) {
      expect(value, `${key} must sabotage the offline phase's network`).toBe(SABOTAGE_PROXY);
    }
  });

  test("both install phases receive exactly the 11 real pack-1 tarball names in PACKAGE_ORDER", async () => {
    const { runOfflineCliSmoke } = (await loadVerifyRelease()) as {
      runOfflineCliSmoke: RunOfflineCliSmokeFn;
    };
    const dir = tmpRoot();
    const fakeNpm = writeFakeNpm(dir);
    const releaseDir = writeFixtureReleaseDir(dir, 11);
    const logPath = join(dir, "invocations.jsonl");
    await runOfflineCliSmoke({
      releaseDir,
      npmBin: fakeNpm,
      env: smokeEnv(logPath),
      tmpDir: dir,
    });
    const invocations = readInvocations(logPath);
    expect(invocations.length).toBe(2);
    const expected = PACKAGE_ORDER.map(
      (p) => join(releaseDir, "pack-1", `project-sothoth-${p}-0.1.0.tgz`),
    );
    for (const invocation of invocations) {
      expect(invocation.tarballs).toEqual(expected);
    }
  });

  test("a missing pack tarball fails fast before any npm invocation", async () => {
    const { runOfflineCliSmoke } = (await loadVerifyRelease()) as {
      runOfflineCliSmoke: RunOfflineCliSmokeFn;
    };
    const dir = tmpRoot();
    const fakeNpm = writeFakeNpm(dir);
    const releaseDir = writeFixtureReleaseDir(dir, 10); // one tarball short
    const logPath = join(dir, "invocations.jsonl");
    await expect(
      runOfflineCliSmoke({
        releaseDir,
        npmBin: fakeNpm,
        env: smokeEnv(logPath),
        tmpDir: dir,
      }),
    ).rejects.toThrow(/missing local tarball/);
    expect(readInvocations(logPath), "no npm invocation may happen on fail-fast").toEqual([]);
  });

  test("an offline install that still fails surfaces the bounded npm error detail", async () => {
    const { runOfflineCliSmoke } = (await loadVerifyRelease()) as {
      runOfflineCliSmoke: RunOfflineCliSmokeFn;
    };
    const dir = tmpRoot();
    const fakeNpm = writeFakeNpm(dir);
    const releaseDir = writeFixtureReleaseDir(dir, 11);
    const logPath = join(dir, "invocations.jsonl");
    // FAKE_NPM_NEVER_WARM models a preparation that completes without
    // actually warming the cache: the offline install must fail with the
    // ENOTCACHED detail, bounded, never swallowed.
    const env = smokeEnv(logPath);
    env.FAKE_NPM_NEVER_WARM = "1";
    await expect(
      runOfflineCliSmoke({ releaseDir, npmBin: fakeNpm, env, tmpDir: dir }),
    ).rejects.toThrow(/offline install failed:[\s\S]*ENOTCACHED/);
  });

  test("preparation and offline caches are removed after the smoke (cleanable temp dirs)", async () => {
    const { runOfflineCliSmoke } = (await loadVerifyRelease()) as {
      runOfflineCliSmoke: RunOfflineCliSmokeFn;
    };
    const dir = tmpRoot();
    const fakeNpm = writeFakeNpm(dir);
    const releaseDir = writeFixtureReleaseDir(dir, 11);
    const smokeTmp = join(dir, "smoke-tmp");
    mkdirSync(smokeTmp, { recursive: true });
    await runOfflineCliSmoke({
      releaseDir,
      npmBin: fakeNpm,
      env: smokeEnv(),
      tmpDir: smokeTmp,
    });
    const residue = readdirSync(smokeTmp).filter((name) => name.startsWith("sothoth-release-"));
    expect(residue).toEqual([]);
    expect(existsSync(join(releaseDir, "cli-smoke", "package.json"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shared scratch helpers (Task 12 Ruling T12-R5: all scratch under os.tmpdir()).
// ---------------------------------------------------------------------------

let scratchDir: string | null = null;

function tmpRoot(): string {
  if (scratchDir === null) {
    scratchDir = mkdtempSync(join(tmpdir(), "t12-runner-probe-"));
  }
  return scratchDir;
}

beforeEach(() => {
  scratchDir = null;
});

afterEach(() => {
  if (scratchDir !== null) {
    rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = null;
  }
});
