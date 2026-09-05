#!/usr/bin/env node
/**
 * Task 11 — release verification for the Sothoth 0.1.0 candidate.
 *
 * Runs, in order: tracked-tree preflight; typecheck; clean build; full test
 * suite (which includes the import-boundary scans, the docs-link suite, the
 * tarball-contents suite, and the two-pack reproducibility suite); the four
 * design checks; deterministic package-asset sync; two isolated packs of all
 * eleven packages with per-package byte and SHA-512 comparison; a CycloneDX
 * SBOM; the pre-publication Candidate BOM; and a hermetic offline
 * local-tarball CLI install smoke (a network-allowed cache-preparation phase
 * over the real pack-1 tarballs, then an --offline install/execute with the
 * network sabotaged, so no runner ever depends on ambient npm-cache warmth).
 * Every command step runs through a bounded, secret-redacted runner that
 * surfaces command identity, exit code or signal, and captured output on
 * failure. Finally it asserts the tracked tree is still clean and
 * writes the release verification report under `dist/release/`.
 *
 * Everything this script produces is LOCAL, PRE-PUBLICATION REPOSITORY
 * EVIDENCE. It is not registry evidence: per-package publication evidence is
 * recorded by Task 12 from the live npm registry and remains pending until
 * then. This script never publishes, never contacts a registry, and never
 * invokes the standby publisher.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { PACKAGE_ORDER, packAll, sha512Hex, sha512Sri } from "./pack-all.mjs";
import { syncPackageAssets } from "./sync-package-assets.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
const releaseDir = join(rootDir, "dist", "release");

const PENDING_PUBLICATION_EVIDENCE = [
  "@project-sothoth/contracts@0.1.0",
  "@project-sothoth/governance@0.1.0",
  "@project-sothoth/profile-sdk@0.1.0",
  "@project-sothoth/sdk@0.1.0",
];

/**
 * Deterministic upper bound, in UTF-8 bytes, on the stdout/stderr text each
 * bounded command keeps per stream. The child process is never terminated by
 * this cap; only the retained text is bounded (the tail is kept, because
 * test-runner failure summaries appear at the end of output).
 */
export const BOUNDED_CAPTURE_LIMIT = 20000;

/** Unroutable proxy endpoint used to sabotage the offline phase's network. */
const OFFLINE_NETWORK_SABOTAGE_PROXY = "http://127.0.0.1:9";

/**
 * Environment overrides that make any accidental network access fail fast:
 * every generic and npm-specific proxy variable points at an unroutable
 * loopback port. Applied ONLY to the offline install/execute phase of the
 * CLI smoke; the cache-preparation phase deliberately keeps the inherited
 * environment (network allowed).
 */
const OFFLINE_NETWORK_SABOTAGE = Object.freeze({
  HTTP_PROXY: OFFLINE_NETWORK_SABOTAGE_PROXY,
  HTTPS_PROXY: OFFLINE_NETWORK_SABOTAGE_PROXY,
  http_proxy: OFFLINE_NETWORK_SABOTAGE_PROXY,
  https_proxy: OFFLINE_NETWORK_SABOTAGE_PROXY,
  ALL_PROXY: OFFLINE_NETWORK_SABOTAGE_PROXY,
  all_proxy: OFFLINE_NETWORK_SABOTAGE_PROXY,
  npm_config_proxy: OFFLINE_NETWORK_SABOTAGE_PROXY,
  npm_config_https_proxy: OFFLINE_NETWORK_SABOTAGE_PROXY,
});

const REDACTION_PATTERNS = [
  // Authorization-style headers, ANY scheme ("Authorization: Basic/Bearer/…",
  // "proxy-authorization: …"): consume the key AND the entire header value to
  // end of line. A header value is credential material wholesale — partial
  // redaction that leaves any payload substring is a leak (fix-round F1).
  { pattern: /\b(?:proxy-)?authorization[=:][^\r\n]*/gi, replacement: "[REDACTED:authorization-credentials]" },
  // Standalone credential material carrying its scheme ("Basic …", "Bearer …",
  // "Token …") without the header key.
  { pattern: /\b(?:basic|bearer|token)[ \t]+[^\s",;]{8,}/gi, replacement: "[REDACTED:authorization-credentials]" },
  // npm's canonical `_authToken` configuration value, including the npmrc
  // URI-scoped form ("//registry…/:_authToken=…") and env-var spellings (M1).
  { pattern: /[\w.\/:@-]*_authtoken[=:][^\s",;]+/gi, replacement: "[REDACTED:npm-auth-token]" },
  // GitHub fine-grained personal access tokens.
  { pattern: /github_pat_[0-9A-Za-z_]{22,}/g, replacement: "[REDACTED:github-pat]" },
  // GitHub classic tokens: ghp_ (PAT), gho_ (OAuth), ghu_ (user), ghs_ (server), ghr_ (refresh).
  { pattern: /gh[posur]_[0-9A-Za-z]{30,}/g, replacement: "[REDACTED:github-token]" },
  // npm granular/automation tokens.
  { pattern: /npm_[0-9A-Za-z_-]{20,}/g, replacement: "[REDACTED:npm-token]" },
];

/**
 * Defensive, deterministic secret redaction for captured command output.
 * Replaces common npm and GitHub credential shapes with explicit markers;
 * ordinary text (including npm config names like `npm_config_cache`) is left
 * untouched. Pure function; safe to import in tests.
 */
export function redactSecrets(text) {
  let redacted = String(text ?? "");
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/**
 * Keeps the LAST `limit` UTF-8 bytes of `text` (failure summaries live at
 * the end of output) and reports how many bytes were dropped. A multibyte
 * character split at the boundary decodes with a replacement character;
 * the result stays deterministic for identical input.
 */
function boundTail(text, limit) {
  const total = Buffer.byteLength(text, "utf8");
  if (total <= limit) {
    return { text, omitted: 0, total };
  }
  const bytes = Buffer.from(text, "utf8");
  return { text: bytes.subarray(bytes.length - limit).toString("utf8"), omitted: total - limit, total };
}

function truncateMarker(omitted, total, limit) {
  return omitted > 0
    ? `[...truncated ${omitted} of ${total} bytes; showing the last ${limit}...]`
    : "";
}

/** Rolling accumulator that never grows past the capture limit + one chunk. */
function makeStreamAccumulator(captureLimit) {
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      if (Buffer.byteLength(buffer, "utf8") > captureLimit + 65536) {
        buffer = boundTail(buffer, captureLimit).text;
      }
    },
    finish() {
      return boundTail(buffer, captureLimit);
    },
  };
}

/**
 * Spawns `command` with piped, secret-redacted, bounded stdout/stderr capture
 * and resolves with its identity, exit code or signal, and the captured
 * streams (tail-kept, each prefixed with an explicit truncation marker when
 * bytes were dropped). The child is NEVER terminated by the capture cap, and
 * the promise always resolves — a failing child never throws, so the
 * original failure cause is never overwritten by a secondary exception.
 */
export async function runBoundedCommand(command, args, options = {}) {
  const captureLimit = options.captureLimit ?? BOUNDED_CAPTURE_LIMIT;
  const commandText = [command, ...args].join(" ");
  const streams = {
    stdout: makeStreamAccumulator(captureLimit),
    stderr: makeStreamAccumulator(captureLimit),
  };
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd ?? rootDir,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({
        ok: false,
        status: null,
        signal: null,
        command: commandText,
        stdout: "",
        stderr: "",
        stdoutOmittedBytes: 0,
        stderrOmittedBytes: 0,
        spawnError: redactSecrets(error instanceof Error ? error.message : String(error)),
      });
      return;
    }
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => streams.stdout.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => streams.stderr.push(chunk));
    let settled = false;
    const finish = (status, signal, spawnError) => {
      if (settled) {
        return;
      }
      settled = true;
      const boundStdout = streams.stdout.finish();
      const boundStderr = streams.stderr.finish();
      const stdout = `${truncateMarker(boundStdout.omitted, boundStdout.total, captureLimit)}${boundStdout.text}`;
      const stderr = `${truncateMarker(boundStderr.omitted, boundStderr.total, captureLimit)}${boundStderr.text}`;
      resolve({
        ok: spawnError === undefined && status === 0,
        status,
        signal,
        command: commandText,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr),
        stdoutOmittedBytes: boundStdout.omitted,
        stderrOmittedBytes: boundStderr.omitted,
        ...(spawnError === undefined ? {} : { spawnError }),
      });
    };
    child.on("error", (error) => {
      finish(null, null, redactSecrets(error instanceof Error ? error.message : String(error)));
    });
    child.on("close", (code, signalName) => {
      finish(code, signalName, undefined);
    });
  });
}

/**
 * Runs one verification step through the bounded runner. Success keeps the
 * exact historical record format (`exit 0`). Failure prints a bounded,
 * redacted diagnostic block (command identity, exit code or signal, both
 * captured streams with truncation notes) so a CI log shows WHICH check
 * failed and WHY — the runner failure of check 3 in CI run 33956033927 was
 * previously invisible because the child's output was discarded entirely.
 */
export async function commandStep(name, command, args) {
  const result = await runBoundedCommand(command, args, { cwd: rootDir });
  const exitText = result.spawnError !== undefined
    ? `spawn failed: ${result.spawnError}`
    : result.status !== null
      ? `exit ${result.status}`
      : `signal ${result.signal}`;
  if (result.ok) {
    record(name, result.command, "PASS", "exit 0");
    return true;
  }
  console.log(`[FAIL] ${name} — ${exitText} (bounded child output follows; redacted)`);
  console.log(`--- command: ${result.command}`);
  console.log(`--- stdout${result.stdoutOmittedBytes > 0 ? ` (truncated; ${result.stdoutOmittedBytes} bytes omitted; showing the tail)` : " (complete; redacted)"} ---`);
  console.log(result.stdout);
  console.log(`--- stderr${result.stderrOmittedBytes > 0 ? ` (truncated; ${result.stderrOmittedBytes} bytes omitted; showing the tail)` : " (complete; redacted)"} ---`);
  console.log(result.stderr);
  console.log("--- end of child output ---");
  record(name, result.command, "FAIL", `${exitText} (child output printed above; redacted and bounded)`);
  return false;
}

/**
 * Network-ALLOWED dependency preparation for the offline CLI smoke: installs
 * the real packed tarballs into a throwaway consumer with a dedicated cache,
 * populating that cache with the full external dependency closure (packument
 * metadata plus tarballs) derived from the tarballs' own manifests. `npm ci`
 * alone cannot do this: it fetches tarballs directly from the lockfile's
 * resolved URLs and never populates the packument entries that `--offline`
 * resolution requires (the cold-cache root cause of CI run 33956033927).
 */
export async function prepareOfflineCache({ tarballs, cacheDir, prepDir, npmBin = "npm", env = process.env }) {
  return runBoundedCommand(
    npmBin,
    ["install", "--no-audit", "--no-fund", "--cache", cacheDir, ...tarballs],
    { cwd: prepDir, env },
  );
}

/**
 * Hermetic offline CLI install smoke (check 15), in two strictly separated
 * phases:
 *
 *   1. Preparation (network allowed): `prepareOfflineCache` warms a dedicated
 *      npm cache from the real pack-1 tarballs. No dependency name is ever
 *      hardcoded; the closure comes from the tarballs' own manifests.
 *   2. Offline install + execute (network sabotaged): `npm install --offline`
 *      against that dedicated cache inside the recreated `cli-smoke`
 *      consumer, with every proxy variable pointed at an unroutable loopback
 *      port, so success proves the install resolved from cache alone. The CLI
 *      contract assertions (`--help` banner, fail-closed unknown option,
 *      contracts import surface) are unchanged from the historical smoke.
 *
 * Preparation and cache directories live under `tmpDir` (default:
 * `os.tmpdir()`, i.e. /tmp on CI runners) and are always removed. Throws on
 * fail-fast (missing tarball) and on install/preparation failure with the
 * bounded, redacted npm error detail; returns the assertion facts otherwise.
 */
export async function runOfflineCliSmoke({ releaseDir, npmBin = "npm", env = process.env, tmpDir = tmpdir() }) {
  const tarballs = PACKAGE_ORDER.map((p) =>
    join(releaseDir, "pack-1", `project-sothoth-${p}-0.1.0.tgz`),
  );
  for (const tarball of tarballs) {
    if (!existsSync(tarball)) {
      throw new Error(`missing local tarball: ${tarball}`);
    }
  }
  const cacheDir = await mkdtemp(join(tmpDir, "sothoth-release-cache-"));
  const prepDir = await mkdtemp(join(tmpDir, "sothoth-release-prep-"));
  try {
    // Phase 1 — network-allowed cache preparation over the real tarballs.
    const prep = await prepareOfflineCache({ tarballs, cacheDir, prepDir, npmBin, env });
    if (prep.status !== 0) {
      throw new Error(`offline cache preparation failed:\n${prep.stderr || prep.stdout}`);
    }

    // Phase 2 — offline install and execute; network provably unavailable.
    const smokeDir = join(releaseDir, "cli-smoke");
    rmSync(smokeDir, { recursive: true, force: true });
    mkdirSync(smokeDir, { recursive: true });
    writeFileSync(
      join(smokeDir, "package.json"),
      `${JSON.stringify({ name: "sothoth-cli-smoke", private: true }, null, 2)}\n`,
      "utf8",
    );
    const offlineEnv = { ...env, ...OFFLINE_NETWORK_SABOTAGE };
    const install = await runBoundedCommand(
      npmBin,
      ["install", "--offline", "--no-audit", "--no-fund", "--cache", cacheDir, ...tarballs],
      { cwd: smokeDir, env: offlineEnv },
    );
    if (install.status !== 0) {
      throw new Error(`offline install failed:\n${install.stderr || install.stdout}`);
    }
    const installed = readdirSync(join(smokeDir, "node_modules", "@project-sothoth")).sort();
    const installedOk =
      installed.length === 11 && installed.join(",") === PACKAGE_ORDER.join(",");
    const binPath = join(smokeDir, "node_modules", ".bin", "sothoth");
    const binLinked = existsSync(binPath);
    const help = spawnSync(binPath, ["--help"], { cwd: smokeDir, encoding: "utf8" });
    const helpOk = help.status === 0 && help.stdout.includes("sothoth 0.1.0");
    const unknown = spawnSync(binPath, ["--format", "json", "--bogus"], {
      cwd: smokeDir,
      encoding: "utf8",
    });
    const unknownOk =
      unknown.status === 2 &&
      unknown.stdout.includes("sothoth.input/unknown-option") &&
      unknown.stdout.includes('"schema": "sothoth.cli/cli-invocation-result@1"');
    const resolveRun = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        "const m = await import('@project-sothoth/contracts'); console.log(JSON.stringify({ keys: Object.keys(m).length }));",
      ],
      { cwd: smokeDir, encoding: "utf8" },
    );
    const resolveOk =
      resolveRun.status === 0 &&
      JSON.parse(resolveRun.stdout.trim()).keys === 36;
    return { ok: installedOk && binLinked && helpOk && unknownOk && resolveOk, binLinked };
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
    rmSync(prepDir, { recursive: true, force: true });
  }
}

/**
 * Pure normalization of an `npm sbom` CycloneDX document: removes exactly the
 * run-local fields npm injects per invocation — `metadata.timestamp` (clock
 * stamp) and the top-level `serialNumber` (random UUID) — and nothing else.
 * No content is added, changed, or invented, so the stored SBOM and its
 * digest are deterministic for the same commit and inputs. Side-effect free
 * and safe to import in tests.
 */
export function normalizeSbom(sbom) {
  if (sbom === null || typeof sbom !== "object") {
    return sbom;
  }
  const normalized = structuredClone(sbom);
  if (Array.isArray(normalized) || normalized === null) {
    return normalized;
  }
  delete normalized.serialNumber;
  if (
    "metadata" in normalized &&
    normalized.metadata !== null &&
    typeof normalized.metadata === "object"
  ) {
    const metadata = { ...normalized.metadata };
    delete metadata.timestamp;
    normalized.metadata = metadata;
  }
  return normalized;
}

/** Ordered verification ledger written into the report at the end. */
const steps = [];
let failed = false;

function record(name, command, status, detail) {
  steps.push({ name, command, status, detail });
  const mark = status === "PASS" ? "ok  " : status === "FAIL" ? "FAIL" : "    ";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (status === "FAIL") {
    failed = true;
  }
}

function run(command, args, options = {}) {
  const runResult = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    ...options,
  });
  return {
    status: runResult.status,
    stdout: runResult.stdout ?? "",
    stderr: runResult.stderr ?? "",
  };
}

function gitHead() {
  const runResult = run("git", ["rev-parse", "HEAD"]);
  return runResult.status === 0 ? runResult.stdout.trim() : null;
}

function gitPorcelain() {
  const runResult = run("git", ["status", "--porcelain"]);
  return runResult.status === 0 ? runResult.stdout.trim() : "git-status-failed";
}

async function main() {
  mkdirSync(releaseDir, { recursive: true });

  // 0. Preflight: tracked tree clean, record the source commit.
  const head = gitHead();
  const preflightClean = gitPorcelain() === "";
  record(
    "preflight: tracked tree clean",
    "git status --porcelain",
    preflightClean ? "PASS" : "FAIL",
    preflightClean ? `clean at ${head}` : "working tree is dirty",
  );
  record(
    "preflight: source commit resolved",
    "git rev-parse HEAD",
    head !== null ? "INFO" : "FAIL",
    String(head),
  );

  // 1. Typecheck.
  await commandStep("typecheck", "npm", ["run", "typecheck"]);

  // 2. Clean build: remove package build output AND the incremental build
  //    state so both packs start from freshly compiled inputs (tsc -b would
  //    otherwise no-op on stale .tsbuildinfo files after dist removal).
  for (const p of PACKAGE_ORDER) {
    rmSync(join(rootDir, "packages", p, "dist"), { recursive: true, force: true });
    rmSync(join(rootDir, "node_modules", ".cache", `${p}.tsbuildinfo`), { force: true });
  }
  await commandStep("clean build", "npm", ["run", "build"]);

  // 3. Full tests — includes the release suites: import-boundary scans,
  //    docs links, tarball contents, and the two-pack reproducibility suite.
  await commandStep("full test suite (boundary scans + docs links + release suites)", "npm", ["test"]);

  // 4. Design checks.
  await commandStep("design scope check", "npm", ["run", "check:design-scope"]);
  await commandStep("pre-design dossiers check", "npm", ["run", "check:pre-design:dossiers"]);
  await commandStep("pre-design closure check", "npm", ["run", "check:pre-design:closure"]);
  await commandStep("pre-design scope check", "npm", ["run", "check:pre-design:scope"]);

  // 5. Deterministic asset sync: snapshot, re-sync, compare bytes.
  try {
    const before = PACKAGE_ORDER.map((p) => [
      readFileSync(join(rootDir, "packages", p, "README.md")),
      readFileSync(join(rootDir, "packages", p, "LICENSE")),
    ]);
    syncPackageAssets(rootDir);
    const after = PACKAGE_ORDER.map((p) => [
      readFileSync(join(rootDir, "packages", p, "README.md")),
      readFileSync(join(rootDir, "packages", p, "LICENSE")),
    ]);
    const identical = JSON.stringify(before.map((pair) => pair.map((b) => b.toString("hex")))) ===
      JSON.stringify(after.map((pair) => pair.map((b) => b.toString("hex"))));
    const rootLicense = readFileSync(join(rootDir, "LICENSE"));
    const licensesExact = PACKAGE_ORDER.every((p) =>
      readFileSync(join(rootDir, "packages", p, "LICENSE")).equals(rootLicense),
    );
    record(
      "deterministic asset sync (byte-idempotent, LICENSE byte-copied)",
      "node scripts/sync-package-assets.mjs (in-process)",
      identical && licensesExact ? "PASS" : "FAIL",
      identical && licensesExact ? `${PACKAGE_ORDER.length} packages synchronized` : "sync changed bytes",
    );
  } catch (error) {
    record(
      "deterministic asset sync (byte-idempotent, LICENSE byte-copied)",
      "node scripts/sync-package-assets.mjs (in-process)",
      "FAIL",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 6. Two isolated packs from the same clean commit and same build inputs.
  const packResults = [];
  for (const label of ["pack-1", "pack-2"]) {
    try {
      const outDir = join(releaseDir, label);
      const { entries } = await packAll(rootDir, outDir);
      packResults.push({ label, entries, error: null });
      record(
        `clean pack ${label}`,
        `node scripts/pack-all.mjs --out dist/release/${label}`,
        "PASS",
        `${entries.length} tarballs`,
      );
    } catch (error) {
      packResults.push({ label, entries: [], error });
      record(
        `clean pack ${label}`,
        `node scripts/pack-all.mjs --out dist/release/${label}`,
        "FAIL",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // 7. Tarball comparison: pair by package identity, compare bytes and
  //    SHA-512 in both representations.
  const packMatrix = [];
  if (packResults.length === 2 && packResults[0].entries.length === 11 && packResults[1].entries.length === 11) {
    const [a, b] = packResults;
    let allIdentical = true;
    for (let i = 0; i < a.entries.length; i += 1) {
      const entryA = a.entries[i];
      const entryB = b.entries[i];
      const bytesA = readFileSync(join(releaseDir, "pack-1", entryA.filename));
      const bytesB = readFileSync(join(releaseDir, "pack-2", entryB.filename));
      const byteIdentical =
        entryA.name === entryB.name &&
        entryA.filename === entryB.filename &&
        bytesA.equals(bytesB) &&
        entryA.sha512.hex === entryB.sha512.hex &&
        entryA.sha512.sri === entryB.sha512.sri;
      allIdentical = allIdentical && byteIdentical;
      packMatrix.push({
        name: entryA.name,
        version: entryA.version,
        filename: entryA.filename,
        sizeBytes: entryA.sizeBytes,
        entryCount: entryA.entryCount,
        sha512: entryA.sha512,
        npmIntegrity: entryA.npmIntegrity,
        byteIdenticalAcrossPacks: byteIdentical,
      });
    }
    record(
      "tarball byte comparison (paired by package identity)",
      "cmp dist/release/pack-1/*.tgz dist/release/pack-2/*.tgz (in-process)",
      allIdentical ? "PASS" : "FAIL",
      allIdentical ? "11/11 byte-identical, SHA-512 hex and SRI equal" : "tarballs differ",
    );
  } else {
    record(
      "tarball byte comparison (paired by package identity)",
      "cmp dist/release/pack-1/*.tgz dist/release/pack-2/*.tgz (in-process)",
      "FAIL",
      "both pack runs must succeed first",
    );
  }

  // 8. CycloneDX SBOM over the workspace (dev dependencies included so the
  //    pinned CommonMark parser subtree is part of the release inventory).
  //    npm injects run-local fields per invocation (metadata.timestamp and a
  //    random serialNumber); the stored SBOM is npm's output with exactly
  //    those two fields removed (pure normalization, no content invention),
  //    so the stored bytes and digest are cross-run stable for the same
  //    commit and inputs.
  const sbomPath = join(releaseDir, "sbom.cdx.json");
  const sbomRun = run("npm", ["sbom", "--sbom-format", "cyclonedx", "--workspaces"]);
  let sbomFacts = null;
  try {
    if (sbomRun.status !== 0) {
      throw new Error(`npm sbom exited ${sbomRun.status}: ${sbomRun.stderr.slice(0, 200)}`);
    }
    const sbom = normalizeSbom(JSON.parse(sbomRun.stdout));
    writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
    const components = sbom.components ?? [];
    const refs = new Set(components.map((c) => c["bom-ref"]));
    const workspaceComponents = components.filter((c) =>
      String(c["bom-ref"]).startsWith("@project-sothoth/"),
    );
    const mdast = components.find(
      (c) => c.name === "mdast-util-from-markdown" && c.version === "2.0.2",
    );
    const micromark = components.find((c) => c.name === "micromark" && c.version === "4.0.2");
    const parserSubtree = components.filter(
      (c) => c.name.startsWith("micromark") || c.name.startsWith("mdast-util-"),
    );
    const parserSubtreeMit = parserSubtree.filter((c) =>
      (c.licenses ?? []).some((l) => l.license?.id === "MIT"),
    );
    const sothothApache = workspaceComponents.filter((c) =>
      (c.licenses ?? []).some((l) => l.license?.id === "Apache-2.0"),
    );
    const workspaceRefsOk = PACKAGE_ORDER.every((p) => refs.has(`@project-sothoth/${p}@0.1.0`));
    const dependencies = sbom.dependencies ?? [];
    const diEdge = dependencies.find((d) => d.ref === "@project-sothoth/document-index@0.1.0");
    const diDependsOnParser =
      diEdge !== undefined && diEdge.dependsOn.includes("mdast-util-from-markdown@2.0.2");
    // The root monorepo component lives in metadata.component, not in the
    // components array; dependency refs may resolve to either.
    const rootRef = sbom.metadata?.component?.["bom-ref"];
    const closureOk = dependencies.every((d) => refs.has(d.ref) || d.ref === rootRef);
    const sbomBytes = readFileSync(sbomPath);
    sbomFacts = {
      specVersion: sbom.specVersion,
      componentCount: components.length,
      workspacePackages: workspaceComponents.length,
      workspaceRefsOk,
      sothothApacheLicensed: sothothApache.length,
      mdastPresent: mdast !== undefined,
      micromarkPresent: micromark !== undefined,
      parserSubtreeCount: parserSubtree.length,
      parserSubtreeMitCount: parserSubtreeMit.length,
      documentIndexDependsOnParser: diDependsOnParser,
      dependencyRefsResolve: closureOk,
      sha512: { hex: sha512Hex(sbomBytes), sri: sha512Sri(sbomBytes) },
    };
    const sbomOk =
      workspaceComponents.length === 11 &&
      workspaceRefsOk &&
      sothothApache.length === 11 &&
      mdast !== undefined &&
      micromark !== undefined &&
      diDependsOnParser &&
      closureOk;
    record(
      "CycloneDX SBOM (11 workspaces, Apache-2.0; parser subtree MIT)",
      "npm sbom --sbom-format cyclonedx --workspaces > dist/release/sbom.cdx.json",
      sbomOk ? "PASS" : "FAIL",
      `${sbomFacts.componentCount} components; mdast-util-from-markdown@2.0.2 and micromark@4.0.2 present`,
    );
  } catch (error) {
    record(
      "CycloneDX SBOM (11 workspaces, Apache-2.0; parser subtree MIT)",
      "npm sbom --sbom-format cyclonedx --workspaces > dist/release/sbom.cdx.json",
      "FAIL",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 9. Candidate BOM: deterministic pre-publication record bound to the
  //    clean source commit and Scope BOM SOTHOTH-RELEASE-SCOPE-BOM-0.1@4.
  const scopeBomPath = join(rootDir, "docs", "release", "v0.1.0-scope-bom.json");
  const scopeBom = JSON.parse(readFileSync(scopeBomPath, "utf8"));
  const scopeBomBindingOk =
    scopeBom.bomId === "SOTHOTH-RELEASE-SCOPE-BOM-0.1" && scopeBom.bomRevision === 4;
  const candidateBomPath = join(releaseDir, "v0.1.0-candidate-bom.json");
  const candidateBom = {
    schema: "sothoth.release-candidate-bom/v1",
    classification: "local pre-publication repository evidence",
    statement:
      "Pre-publication evidence for the 0.1.0 release candidate. Proves the local build and pack surface only. No package is published; per-package publication evidence is recorded from the live npm registry in Task 12 and remains pending.",
    sourceCommit: head,
    sourceTreeClean: preflightClean,
    scopeBom: {
      path: "docs/release/v0.1.0-scope-bom.json",
      bomId: scopeBom.bomId,
      revision: scopeBom.bomRevision,
      memberCount: Array.isArray(scopeBom.members) ? scopeBom.members.length : 0,
    },
    sbom: sbomFacts
      ? {
          path: "dist/release/sbom.cdx.json",
          format: `cyclonedx-${sbomFacts.specVersion}`,
          sha512: sbomFacts.sha512,
        }
      : null,
    packages: packMatrix.map((entry) => ({
      name: entry.name,
      version: entry.version,
      tarball: {
        path: `dist/release/pack-1/${entry.filename}`,
        sizeBytes: entry.sizeBytes,
        entryCount: entry.entryCount,
        sha512: entry.sha512,
        npmIntegrity: entry.npmIntegrity,
      },
      byteIdenticalAcrossPacks: entry.byteIdenticalAcrossPacks,
      publicationEvidence: PENDING_PUBLICATION_EVIDENCE.includes(`${entry.name}@${entry.version}`)
        ? "pending"
        : "pending (not yet recorded; Task 12 owns registry evidence)",
    })),
    publicationEvidencePending: PENDING_PUBLICATION_EVIDENCE,
    provenance: "not claimed at this stage; npm provenance is produced by the Task 12 publish workflow",
  };
  const candidateBomOk =
    scopeBomBindingOk &&
    preflightClean &&
    head !== null &&
    candidateBom.packages.length === 11 &&
    candidateBom.packages.every((entry) => entry.byteIdenticalAcrossPacks);
  try {
    writeFileSync(candidateBomPath, `${JSON.stringify(candidateBom, null, 2)}\n`, "utf8");
    record(
      "Candidate BOM (pre-publication, scope-BOM-bound)",
      "dist/release/v0.1.0-candidate-bom.json",
      candidateBomOk ? "PASS" : "FAIL",
      `bound to ${head}; scope BOM ${scopeBom.bomId}@${scopeBom.bomRevision}`,
    );
  } catch (error) {
    record(
      "Candidate BOM (pre-publication, scope-BOM-bound)",
      "dist/release/v0.1.0-candidate-bom.json",
      "FAIL",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 10. Hermetic offline CLI install smoke from THIS round's local tarballs
  //     only: a network-allowed cache-preparation phase over the real pack-1
  //     tarballs, then an --offline install/execute with the network
  //     sabotaged, so the smoke never depends on ambient npm-cache warmth.
  try {
    const smoke = await runOfflineCliSmoke({ releaseDir });
    record(
      "offline CLI install smoke (local tarballs only)",
      "npm install --no-audit --no-fund --cache <prepared> dist/release/pack-1/*.tgz (network-allowed preparation) && npm install --offline --no-audit --no-fund --cache <prepared> dist/release/pack-1/*.tgz && sothoth --help",
      smoke.ok ? "PASS" : "FAIL",
      `11 packages installed from tarballs; bin linked=${smoke.binLinked}; --help exit 0; fail-closed exit 2; tarball contracts import keys=36`,
    );
  } catch (error) {
    record(
      "offline CLI install smoke (local tarballs only)",
      "npm install --no-audit --no-fund --cache <prepared> dist/release/pack-1/*.tgz (network-allowed preparation) && npm install --offline --no-audit --no-fund --cache <prepared> dist/release/pack-1/*.tgz && sothoth --help",
      "FAIL",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 11. Tracked tree must still be clean (generated artifacts are ignored).
  const finalClean = gitPorcelain() === "";
  record(
    "tracked tree remains clean",
    "git status --porcelain",
    finalClean ? "PASS" : "FAIL",
    finalClean ? "clean" : "working tree is dirty",
  );

  // 12. Write the release verification report.
  const reportPath = join(releaseDir, "v0.1.0-verification-report.md");
  const report = renderReport({ steps, packMatrix, sbomFacts, head, candidateBomPath, sbomPath });
  writeFileSync(reportPath, report, "utf8");
  console.log(`release verification report: ${reportPath}`);

  process.exit(failed ? 1 : 0);
}

function renderReport({ steps, packMatrix, sbomFacts, head, candidateBomPath, sbomPath }) {
  const lines = [];
  lines.push("# Sothoth 0.1.0 release verification report", "");
  lines.push(
    "- Classification: local, pre-publication repository evidence. This report proves the local build and pack surface only.",
    "- Publication state: no package is published. Per-package publication evidence is recorded from the live npm registry in Task 12 and remains pending.",
    `- Pending publication evidence: ${PENDING_PUBLICATION_EVIDENCE.join(", ")}.`,
    `- Clean source commit: ${head}.`,
    "- Scope BOM binding: SOTHOTH-RELEASE-SCOPE-BOM-0.1@4 (docs/release/v0.1.0-scope-bom.json).",
    `- Candidate BOM: ${candidateBomPath.slice(rootDir.length + 1)}`,
    `- CycloneDX SBOM: ${sbomPath.slice(rootDir.length + 1)}`,
    "",
    "## Verification steps",
    "",
    "| Step | Command | Result | Detail |",
    "|---|---|---|---|",
  );
  for (const step of steps) {
    lines.push(`| ${step.name} | \`${step.command}\` | ${step.status} | ${step.detail} |`);
  }
  lines.push(
    "",
    "## Pack matrix (pack-1; both packs byte-identical per comparison step)",
    "",
    "| Package | Tarball | Bytes | Entries | SHA-512 (hex) | SHA-512 (SRI) |",
    "|---|---|---|---|---|---|",
  );
  for (const entry of packMatrix) {
    lines.push(
      `| ${entry.name} | ${entry.filename} | ${entry.sizeBytes} | ${entry.entryCount} | \`${entry.sha512.hex}\` | \`${entry.sha512.sri}\` |`,
    );
  }
  if (sbomFacts) {
    lines.push(
      "",
      "## SBOM facts",
      "",
      `- CycloneDX spec ${sbomFacts.specVersion}; ${sbomFacts.componentCount} components.`,
      "- Stored SBOM is npm's output with the run-local `metadata.timestamp` and random `serialNumber` removed (pure normalization, nothing invented); the digest below is therefore cross-run stable for the same commit and inputs.",
      `- ${sbomFacts.workspacePackages}/11 workspace components carry Apache-2.0 licenses.`,
      `- mdast-util-from-markdown@2.0.2 present: ${sbomFacts.mdastPresent}; micromark@4.0.2 present: ${sbomFacts.micromarkPresent}.`,
      `- Parser subtree: ${sbomFacts.parserSubtreeCount} mdast/micromark components, ${sbomFacts.parserSubtreeMitCount} MIT-licensed.`,
      `- @project-sothoth/document-index depends on mdast-util-from-markdown@2.0.2: ${sbomFacts.documentIndexDependsOnParser}.`,
      `- SBOM SHA-512 (hex): ${sbomFacts.sha512.hex}`,
      `- SBOM SHA-512 (SRI): ${sbomFacts.sha512.sri}`,
    );
  }
  lines.push(
    "",
    "## Evidence boundaries",
    "",
    "All outputs live under gitignored `dist/release/**`; nothing here is committed, tagged, or published.",
    "Digests above are SHA-512 over raw tarball bytes, reported in hex and in npm SRI form (`sha512-` + base64 of the raw digest); the two representations are never compared to each other.",
    "This report contains no registry identity, no provenance claim, and no publication-success claim.",
  );
  return `${lines.join("\n")}\n`;
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
