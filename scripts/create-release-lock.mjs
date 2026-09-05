#!/usr/bin/env node
/**
 * Task 11 — release lock generator (controller ruling PRE-1).
 *
 * Generates `v0.1.0-release-lock.json` inside a release directory that was
 * produced by `npm run release:verify`. The lock binds, fail-closed:
 *   - schema/classification, repository `Phenol1145/sothoth`, release `v0.1.0`;
 *   - the exact source commit (must equal the Candidate BOM's commit and HEAD);
 *   - the workflow filename / run id / run attempt, taken verbatim from the
 *     real GitHub Actions environment — never fabricated (recorded as null
 *     with an explicit marker when absent);
 *   - Scope BOM `SOTHOTH-RELEASE-SCOPE-BOM-0.1@4`;
 *   - the Candidate BOM and SBOM SHA-512 digests (recomputed from bytes);
 *   - all eleven tarballs' name/version/filename/SHA-512, each recomputed
 *     from `pack-1/<filename>` and required to equal the Candidate BOM value.
 *
 * No wall-clock time, no registry identity, no fabricated provenance, and no
 * publication-success claim is written. The workflow uploads this lock with
 * the release artifact `sothoth-v0.1.0-release`.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isAbsolute, join } from "node:path";

export const RELEASE_TAG = "v0.1.0";
export const PACKAGE_VERSION = "0.1.0";
export const REPOSITORY = "Phenol1145/sothoth";
export const SCOPE_BOM_ID = "SOTHOTH-RELEASE-SCOPE-BOM-0.1";
export const SCOPE_BOM_REVISION = 4;

function sha512Of(bytes) {
  const raw = createHash("sha512").update(bytes).digest();
  return { hex: raw.toString("hex"), sri: `sha512-${raw.toString("base64")}` };
}

/**
 * Workflow context, verbatim from the environment. Nothing is invented:
 * absent fields are recorded as null with an explicit marker.
 */
export function readWorkflowContext(env) {
  const runId = typeof env.GITHUB_RUN_ID === "string" && env.GITHUB_RUN_ID.length > 0 ? env.GITHUB_RUN_ID : null;
  const runAttempt =
    typeof env.GITHUB_RUN_ATTEMPT === "string" && env.GITHUB_RUN_ATTEMPT.length > 0
      ? env.GITHUB_RUN_ATTEMPT
      : null;
  let fileName = null;
  if (typeof env.GITHUB_WORKFLOW_REF === "string" && env.GITHUB_WORKFLOW_REF.length > 0) {
    // Shape: <owner>/<repo>/.github/workflows/<file>.yml@<ref>; the ref may
    // itself contain slashes, so split at "@" first, then take the basename.
    const workflowPath = env.GITHUB_WORKFLOW_REF.split("@")[0] ?? "";
    const name = workflowPath.slice(workflowPath.lastIndexOf("/") + 1);
    fileName = name.length > 0 ? name : null;
  }
  const inside = runId !== null && runAttempt !== null && fileName !== null;
  return {
    fileName,
    runId,
    runAttempt,
    contextSource: "GITHUB_WORKFLOW_REF / GITHUB_RUN_ID / GITHUB_RUN_ATTEMPT environment",
    insideGitHubActions: inside,
    absentFieldsNote: inside
      ? null
      : "workflow context absent: not running under GitHub Actions; no value fabricated",
  };
}

/**
 * Generates the lock. Throws (fail-closed) on any inconsistency; writes
 * nothing unless every binding verifies. `repoDir` is where the source
 * commit is resolved from (the repository, not the release directory).
 */
export function createReleaseLock({ releaseDir, env = process.env, repoDir = defaultRepoDir() }) {
  const candidatePath = join(releaseDir, "v0.1.0-candidate-bom.json");
  const sbomPath = join(releaseDir, "sbom.cdx.json");
  for (const required of [candidatePath, sbomPath]) {
    if (!existsSync(required)) {
      throw new Error(`missing release artifact: ${required} (run npm run release:verify first)`);
    }
  }
  const candidateBytes = readFileSync(candidatePath);
  const candidate = JSON.parse(candidateBytes.toString("utf8"));
  const sbomDigest = sha512Of(readFileSync(sbomPath));

  if (candidate.schema !== "sothoth.release-candidate-bom/v1") {
    throw new Error(`unexpected candidate BOM schema: ${String(candidate.schema)}`);
  }
  if (candidate.scopeBom?.bomId !== SCOPE_BOM_ID || candidate.scopeBom?.revision !== SCOPE_BOM_REVISION) {
    throw new Error("candidate BOM is not bound to Scope BOM " + `${SCOPE_BOM_ID}@${SCOPE_BOM_REVISION}`);
  }

  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" });
  if (head.status !== 0) {
    throw new Error("fail-closed: source commit could not be resolved");
  }
  const sourceCommit = head.stdout.trim();
  if (candidate.sourceCommit !== sourceCommit) {
    throw new Error(
      `fail-closed: candidate BOM commit ${String(candidate.sourceCommit)} does not equal HEAD ${sourceCommit}`,
    );
  }

  const packages = [];
  for (const entry of candidate.packages ?? []) {
    // The candidate BOM records `tarball.path` (repo-relative, under
    // dist/release/pack-1/); the tarball filename is its basename.
    const pathValue = entry.tarball?.path ?? entry.tarball?.filename;
    if (typeof pathValue !== "string" || pathValue.length === 0) {
      throw new Error(`fail-closed: candidate BOM entry for ${String(entry.name)} has no tarball path`);
    }
    const filename = pathValue.replace(/^.*\//, "");
    const tarballPath = join(releaseDir, "pack-1", filename);
    if (!existsSync(tarballPath)) {
      throw new Error(`fail-closed: tarball missing for ${String(entry.name)}: ${tarballPath}`);
    }
    const digest = sha512Of(readFileSync(tarballPath));
    if (digest.sri !== entry.tarball?.sha512?.sri || digest.hex !== entry.tarball?.sha512?.hex) {
      throw new Error(
        `fail-closed: tarball digest for ${String(entry.name)} does not equal the candidate BOM digest`,
      );
    }
    packages.push({
      name: entry.name,
      version: entry.version,
      filename,
      sha512: digest,
    });
  }
  if (packages.length !== 11) {
    throw new Error(`fail-closed: expected exactly 11 packages, found ${packages.length}`);
  }

  const lock = {
    schema: "sothoth.release-lock/v1",
    classification: "pre-publication release lock generated inside the publish workflow",
    repository: REPOSITORY,
    releaseTag: RELEASE_TAG,
    packageVersion: PACKAGE_VERSION,
    sourceCommit,
    workflow: readWorkflowContext(env),
    scopeBom: {
      bomId: candidate.scopeBom.bomId,
      revision: candidate.scopeBom.revision,
      path: "docs/release/v0.1.0-scope-bom.json",
    },
    candidateBom: { path: "dist/release/v0.1.0-candidate-bom.json", sha512: sha512Of(candidateBytes) },
    sbom: { path: "dist/release/sbom.cdx.json", sha512: sbomDigest },
    packages,
    publicationEvidence:
      "pending — recorded per package from the live registry in Task 12; this lock binds local pre-publication artifacts only",
    provenance: "not fabricated here; npm provenance statements attach at publish time",
  };

  const lockPath = join(releaseDir, "v0.1.0-release-lock.json");
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return lockPath;
}

function defaultRepoDir() {
  return fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
}

function parseReleaseDir(argv) {
  const index = argv.indexOf("--release-dir");
  const value = index !== -1 ? argv[index + 1] : join("dist", "release");
  if (value === undefined) {
    throw new Error("usage: node scripts/create-release-lock.mjs [--release-dir <directory>]");
  }
  return isAbsolute(value) ? value : join(process.cwd(), value);
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMainModule()) {
  const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
  try {
    const lockPath = createReleaseLock({ releaseDir: parseReleaseDir(process.argv) });
    console.log(`release lock written: ${lockPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
