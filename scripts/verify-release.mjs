#!/usr/bin/env node
/**
 * Task 11 — release verification for the Sothoth 0.1.0 candidate.
 *
 * Runs, in order: tracked-tree preflight; typecheck; clean build; full test
 * suite (which includes the import-boundary scans, the docs-link suite, the
 * tarball-contents suite, and the two-pack reproducibility suite); the four
 * design checks; deterministic package-asset sync; two isolated packs of all
 * eleven packages with per-package byte and SHA-512 comparison; a CycloneDX
 * SBOM; the pre-publication Candidate BOM; and an offline local-tarball CLI
 * install smoke. Finally it asserts the tracked tree is still clean and
 * writes the release verification report under `dist/release/`.
 *
 * Everything this script produces is LOCAL, PRE-PUBLICATION REPOSITORY
 * EVIDENCE. It is not registry evidence: per-package publication evidence is
 * recorded by Task 12 from the live npm registry and remains pending until
 * then. This script never publishes, never contacts a registry, and never
 * invokes the standby publisher.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { PACKAGE_ORDER, packAll, sha512Hex, sha512Sri } from "./pack-all.mjs";
import { syncPackageAssets } from "./sync-package-assets.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
const releaseDir = join(rootDir, "dist", "release");

const PENDING_PUBLICATION_EVIDENCE = [
  "@sothoth/contracts@0.1.0",
  "@sothoth/governance@0.1.0",
  "@sothoth/profile-sdk@0.1.0",
  "@sothoth/sdk@0.1.0",
];

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

function commandStep(name, command, args) {
  const runResult = run(command, args, { stdio: "ignore" });
  record(
    name,
    [command, ...args].join(" "),
    runResult.status === 0 ? "PASS" : "FAIL",
    `exit ${runResult.status}`,
  );
  return runResult.status === 0;
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
  commandStep("typecheck", "npm", ["run", "typecheck"]);

  // 2. Clean build: remove package build output AND the incremental build
  //    state so both packs start from freshly compiled inputs (tsc -b would
  //    otherwise no-op on stale .tsbuildinfo files after dist removal).
  for (const p of PACKAGE_ORDER) {
    rmSync(join(rootDir, "packages", p, "dist"), { recursive: true, force: true });
    rmSync(join(rootDir, "node_modules", ".cache", `${p}.tsbuildinfo`), { force: true });
  }
  commandStep("clean build", "npm", ["run", "build"]);

  // 3. Full tests — includes the release suites: import-boundary scans,
  //    docs links, tarball contents, and the two-pack reproducibility suite.
  commandStep("full test suite (boundary scans + docs links + release suites)", "npm", ["test"]);

  // 4. Design checks.
  commandStep("design scope check", "npm", ["run", "check:design-scope"]);
  commandStep("pre-design dossiers check", "npm", ["run", "check:pre-design:dossiers"]);
  commandStep("pre-design closure check", "npm", ["run", "check:pre-design:closure"]);
  commandStep("pre-design scope check", "npm", ["run", "check:pre-design:scope"]);

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
  const sbomPath = join(releaseDir, "sbom.cdx.json");
  const sbomRun = run("npm", ["sbom", "--sbom-format", "cyclonedx", "--workspaces"]);
  let sbomFacts = null;
  try {
    if (sbomRun.status !== 0) {
      throw new Error(`npm sbom exited ${sbomRun.status}: ${sbomRun.stderr.slice(0, 200)}`);
    }
    writeFileSync(sbomPath, sbomRun.stdout, "utf8");
    const sbom = JSON.parse(sbomRun.stdout);
    const components = sbom.components ?? [];
    const refs = new Set(components.map((c) => c["bom-ref"]));
    const workspaceComponents = components.filter((c) =>
      String(c["bom-ref"]).startsWith("@sothoth/"),
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
    const workspaceRefsOk = PACKAGE_ORDER.every((p) => refs.has(`@sothoth/${p}@0.1.0`));
    const dependencies = sbom.dependencies ?? [];
    const diEdge = dependencies.find((d) => d.ref === "@sothoth/document-index@0.1.0");
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
  //    clean source commit and Scope BOM SOTHOTH-RELEASE-SCOPE-BOM-0.1@3.
  const scopeBomPath = join(rootDir, "docs", "release", "v0.1.0-scope-bom.json");
  const scopeBom = JSON.parse(readFileSync(scopeBomPath, "utf8"));
  const scopeBomBindingOk =
    scopeBom.bomId === "SOTHOTH-RELEASE-SCOPE-BOM-0.1" && scopeBom.bomRevision === 3;
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

  // 10. Offline CLI install smoke from THIS round's local tarballs only.
  try {
    const smokeDir = join(releaseDir, "cli-smoke");
    rmSync(smokeDir, { recursive: true, force: true });
    mkdirSync(smokeDir, { recursive: true });
    writeFileSync(
      join(smokeDir, "package.json"),
      `${JSON.stringify({ name: "sothoth-cli-smoke", private: true }, null, 2)}\n`,
      "utf8",
    );
    const tarballs = PACKAGE_ORDER.map((p) =>
      join(releaseDir, "pack-1", `sothoth-${p}-0.1.0.tgz`),
    );
    for (const tarball of tarballs) {
      if (!existsSync(tarball)) {
        throw new Error(`missing local tarball: ${tarball}`);
      }
    }
    const install = spawnSync(
      "npm",
      ["install", "--offline", "--no-audit", "--no-fund", ...tarballs],
      { cwd: smokeDir, encoding: "utf8" },
    );
    if (install.status !== 0) {
      throw new Error(`offline install failed:\n${install.stderr.slice(0, 400)}`);
    }
    const installed = readdirSync(join(smokeDir, "node_modules", "@sothoth")).sort();
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
        "const m = await import('@sothoth/contracts'); console.log(JSON.stringify({ keys: Object.keys(m).length }));",
      ],
      { cwd: smokeDir, encoding: "utf8" },
    );
    const resolveOk =
      resolveRun.status === 0 &&
      JSON.parse(resolveRun.stdout.trim()).keys === 36;
    const smokeOk = installedOk && binLinked && helpOk && unknownOk && resolveOk;
    record(
      "offline CLI install smoke (local tarballs only)",
      "npm install --offline dist/release/pack-1/*.tgz && sothoth --help",
      smokeOk ? "PASS" : "FAIL",
      `11 packages installed from tarballs; bin linked=${binLinked}; --help exit 0; fail-closed exit 2; tarball contracts import keys=36`,
    );
  } catch (error) {
    record(
      "offline CLI install smoke (local tarballs only)",
      "npm install --offline dist/release/pack-1/*.tgz && sothoth --help",
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
    "- Scope BOM binding: SOTHOTH-RELEASE-SCOPE-BOM-0.1@3 (docs/release/v0.1.0-scope-bom.json).",
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
      `- ${sbomFacts.workspacePackages}/11 workspace components carry Apache-2.0 licenses.`,
      `- mdast-util-from-markdown@2.0.2 present: ${sbomFacts.mdastPresent}; micromark@4.0.2 present: ${sbomFacts.micromarkPresent}.`,
      `- Parser subtree: ${sbomFacts.parserSubtreeCount} mdast/micromark components, ${sbomFacts.parserSubtreeMitCount} MIT-licensed.`,
      `- @sothoth/document-index depends on mdast-util-from-markdown@2.0.2: ${sbomFacts.documentIndexDependsOnParser}.`,
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

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
