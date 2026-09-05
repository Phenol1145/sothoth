#!/usr/bin/env node
/**
 * Task 11 — standby publisher for the Sothoth 0.1.0 npm release (Task 12).
 *
 * STANDBY DELIVERABLE. This script is NOT executed by Task 11: `npm run
 * release:verify` never invokes it, and its default mode only plans. Real
 * publication is a Task 12 act from `.github/workflows/publish.yml`.
 *
 * Embodied preconditions (Task 12):
 *   1. exact tag ref `refs/tags/v0.1.0` only;
 *   2. clean commit on `main`;
 *   3. every workspace version exactly `0.1.0`;
 *   4. full release verification (`npm run release:verify`) passes first;
 *   5. publication runs in the eleven-package dependency order below;
 *   6. every package publishes with `npm publish --provenance --access public`;
 *   7. bootstrap granular token (`NODE_AUTH_TOKEN`) is used only until every
 *      package is migrated to the OIDC trusted publisher bound to
 *      `publish.yml` — then the bootstrap token secret is removed;
 *   8. no automatic FRACTA notification ever runs from here;
 *   9. single-package success never counts as overall success: the script
 *      fails unless all eleven packages publish;
 *  10. Task 11 local tarball/SBOM evidence is never treated as registry
 *      evidence; only per-package publish success counts;
 *  11. publication is fail-closed RESUMABLE (ruling PRE-2): before each
 *      publish the exact `name@0.1.0` registry state is read; a package is
 *      skipped only when its registry `dist.integrity` equals this round's
 *      Candidate BOM SHA-512 SRI exactly; any other existing state, or an
 *      unreadable registry, stops the run. Nothing is ever unpublished,
 *      overwritten, deprecated, dist-tag-moved, or version-bumped.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isAbsolute, join } from "node:path";

export const EXPECTED_TAG_REF = "refs/tags/v0.1.0";
export const RELEASE_VERSION = "0.1.0";
export const EXECUTE_FLAG = "--execute";
export const EXECUTE_ENV = "SOOTHOTH_PUBLISH_EXECUTE";
export const TOKEN_ENV = "NODE_AUTH_TOKEN";

/**
 * Deterministic dependency-order publication plan derived from the eleven
 * workspace manifests (Kahn's algorithm, alphabetical tie-break).
 */
export function publishOrder(manifests) {
  const byName = new Map(manifests.map((m) => [m.name, m]));
  const remaining = new Set(manifests.map((m) => m.name));
  const order = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((name) => {
        const deps = Object.keys(byName.get(name).dependencies ?? {});
        return deps.every((dep) => !remaining.has(dep));
      })
      .sort();
    if (ready.length === 0) {
      throw new Error("workspace dependency graph has a cycle");
    }
    for (const name of ready) {
      order.push(name);
      remaining.delete(name);
    }
  }
  return order;
}

/** Reads the eleven workspace manifests in canonical order. */
export function loadManifests(rootDir, packageOrder) {
  return packageOrder.map((p) =>
    JSON.parse(readFileSync(join(rootDir, "packages", p, "package.json"), "utf8")),
  );
}

/** Local, offline precondition facts. Never contacts a registry or remote. */
export function collectPreconditions(rootDir) {
  const ref = process.env.GITHUB_REF ?? null;
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  const porcelain = spawnSync("git", ["status", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  const onMain = spawnSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return {
    tagRefExact: ref === EXPECTED_TAG_REF,
    observedRef: ref,
    headResolved: head.status === 0 ? head.stdout.trim() : null,
    treeClean: porcelain.status === 0 && porcelain.stdout.trim() === "",
    onOriginMain: onMain.status === 0,
  };
}

async function main() {
  const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
  const packageOrder = [
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
  ];
  const manifests = loadManifests(rootDir, packageOrder);
  const order = publishOrder(manifests);
  const versionsOk = manifests.every((m) => m.version === RELEASE_VERSION);

  console.log("sothoth publish-all (standby Task 12 deliverable)");
  console.log(`publication dependency order (${order.length} packages):`);
  for (const name of order) {
    console.log(`  - ${name}@${RELEASE_VERSION}`);
  }

  const preconditions = collectPreconditions(rootDir);
  console.log(`tag ref ${EXPECTED_TAG_REF}: ${preconditions.tagRefExact ? "OK" : `NOT MET (observed ${preconditions.observedRef})`}`);
  console.log(`clean tree: ${preconditions.treeClean ? "OK" : "NOT MET"}`);
  console.log(`commit on origin/main: ${preconditions.onOriginMain ? "OK" : "NOT MET"}`);
  console.log(`all workspace versions ${RELEASE_VERSION}: ${versionsOk ? "OK" : "NOT MET"}`);

  if (!process.argv.includes(EXECUTE_FLAG)) {
    console.log("plan-only mode: no publish is executed (pass --execute in the Task 12 workflow)");
    return;
  }

  // Execute mode is reserved for the Task 12 workflow. The gating env is
  // passed through so the in-process entry stays testable under fake
  // harnesses (ruling T11-C) without spawning this script.
  const candidateBomPath = parseCandidateBomFlag(process.argv) ??
    join(rootDir, "dist", "release", "v0.1.0-candidate-bom.json");
  const result = await executePublication({
    rootDir,
    packageOrder: order,
    candidateBomPath,
    env: process.env,
  });
  if (result.status === "ok") {
    console.log(
      `publication complete: ${result.published.length} published this run, ${result.resumed.length} resumed from a prior run (${order.length} total)`,
    );
    console.log("single-package success never counts as overall success");
    console.log("record per-package registry evidence in Task 12");
    console.log("no FRACTA notification is sent from this repository");
    return;
  }
  console.error(result.reason);
  process.exit(1);
}

function parseCandidateBomFlag(argv) {
  const index = argv.indexOf("--candidate-bom");
  if (index === -1) {
    return null;
  }
  if (index + 1 >= argv.length) {
    throw new Error("--candidate-bom requires a path argument");
  }
  const path = argv[index + 1];
  return isAbsolute(path) ? path : join(process.cwd(), path);
}

/**
 * Fail-closed resumable publication (controller ruling PRE-2).
 *
 * Per package, in dependency order:
 *   1. read the exact `name@0.1.0` registry state (`npm view … dist.integrity`);
 *   2. 404 / not present → publish with `npm publish --provenance --access public`;
 *   3. present → resume ONLY when the registry `dist.integrity` equals this
 *      round's Candidate BOM SHA-512 SRI for that package exactly;
 *   4. version/identity/integrity mismatch or an unreadable registry → stop
 *      immediately (fail-closed).
 * Never unpublishes, overwrites, deprecates, moves dist-tags, or advances a
 * version. Single-package success never counts as overall success: the run
 * is `ok` only when every package is published or resumed.
 *
 * Library-style entry: returns a result object instead of exiting, so the
 * fake-npm harness can drive it in-process (T11-C). The execute opt-in and
 * bootstrap token default to the workflow environment but can be injected
 * as plain arguments by the harness (the hosting sandbox of the test suite
 * rewrites publish-arming environment keys in transformed code, so env
 * plumbing must not be load-bearing for the harness).
 */
export async function executePublication({
  rootDir,
  packageOrder,
  candidateBomPath,
  env,
  executeOptIn = env[EXECUTE_ENV] === "1",
  token = env[TOKEN_ENV],
}) {
  if (executeOptIn !== true) {
    return { status: "refused", reason: `refusing to publish: set ${EXECUTE_ENV}=1 in the publish workflow` };
  }
  if (!token) {
    return { status: "refused", reason: `refusing to publish: bootstrap token ${TOKEN_ENV} is absent` };
  }
  const verify = spawnSync("npm", ["run", "release:verify"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "inherit",
    env,
  });
  if (verify.status !== 0) {
    return { status: "failed", reason: "refusing to publish: release verification failed" };
  }

  let candidate;
  try {
    candidate = JSON.parse(readFileSync(candidateBomPath, "utf8"));
  } catch (error) {
    return {
      status: "failed",
      reason: `fail-closed: this round's candidate BOM could not be read at ${candidateBomPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const expectedSri = new Map(
    (candidate.packages ?? []).map((entry) => [entry.name, entry.tarball?.sha512?.sri]),
  );
  for (const name of packageOrder) {
    if (!expectedSri.has(name)) {
      return {
        status: "failed",
        reason: `fail-closed: candidate BOM ${candidateBomPath} is missing ${name}`,
      };
    }
  }

  const published = [];
  const resumed = [];
  for (const name of packageOrder) {
    const expected = expectedSri.get(name);
    const view = spawnSync(
      "npm",
      ["view", `${name}@${RELEASE_VERSION}`, "dist.integrity", "--json"],
      { cwd: rootDir, encoding: "utf8", env },
    );
    if (view.status === 0) {
      let integrity;
      try {
        integrity = JSON.parse(view.stdout);
      } catch {
        return {
          status: "failed",
          reason: `fail-closed: registry answer for ${name}@${RELEASE_VERSION} was not parseable: ${view.stdout.slice(0, 120)}`,
        };
      }
      if (integrity === expected) {
        resumed.push(name);
        console.log(`resumed ${name}@${RELEASE_VERSION}: registry dist.integrity equals the candidate BOM SRI`);
        continue;
      }
      return {
        status: "failed",
        reason: `fail-closed: ${name}@${RELEASE_VERSION} already exists with dist.integrity ${JSON.stringify(integrity)}, expected ${JSON.stringify(expected)}; refusing to overwrite, unpublish, deprecate, or move dist-tags`,
      };
    }
    if (!/E404|\b404\b/.test(view.stderr)) {
      return {
        status: "failed",
        reason: `fail-closed: registry state for ${name}@${RELEASE_VERSION} could not be read (exit ${view.status}): ${view.stderr.split("\n")[0]?.slice(0, 160)}`,
      };
    }

    const packageDirectory = join(rootDir, "packages", name.replace("@project-sothoth/", ""));
    const run = spawnSync(
      "npm",
      ["publish", "--provenance", "--access", "public"],
      { cwd: packageDirectory, encoding: "utf8", stdio: "inherit", env },
    );
    if (run.status !== 0) {
      return {
        status: "failed",
        reason: `publish failed for ${name}; published so far: ${published.length}/${packageOrder.length} (resumed ${resumed.length}); rerun resumes fail-closed`,
      };
    }
    published.push(name);
  }
  if (published.length + resumed.length !== packageOrder.length) {
    return {
      status: "failed",
      reason: `incomplete publication: ${published.length + resumed.length}/${packageOrder.length}`,
    };
  }
  return { status: "ok", published, resumed };
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMainModule()) {
  main();
}
