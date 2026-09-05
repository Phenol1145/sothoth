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
 *      evidence; only per-package publish success counts.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

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

function main() {
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

  // Execute mode is reserved for the Task 12 workflow. It refuses to run
  // without the explicit workflow opt-in and the bootstrap token, and it
  // first reruns full release verification so local evidence is fresh.
  if (process.env[EXECUTE_ENV] !== "1") {
    console.error(`refusing to publish: set ${EXECUTE_ENV}=1 in the publish workflow`);
    process.exit(1);
  }
  if (!process.env[TOKEN_ENV]) {
    console.error(`refusing to publish: bootstrap token ${TOKEN_ENV} is absent`);
    process.exit(1);
  }
  const verify = spawnSync("npm", ["run", "release:verify"], { cwd: rootDir, encoding: "utf8", stdio: "inherit" });
  if (verify.status !== 0) {
    console.error("refusing to publish: release verification failed");
    process.exit(1);
  }

  const published = [];
  for (const name of order) {
    // Workspace manifests carry no `directory` field; derive the package
    // directory from the scoped name (packages/<p>), as pack-all.mjs does.
    const packageDirectory = join(rootDir, "packages", name.replace("@sothoth/", ""));
    const run = spawnSync(
      "npm",
      ["publish", "--provenance", "--access", "public"],
      { cwd: packageDirectory, encoding: "utf8", stdio: "inherit" },
    );
    if (run.status !== 0) {
      // Single-package success never counts as overall success.
      console.error(`publish failed for ${name}; published so far: ${published.length}/${order.length}`);
      process.exit(1);
    }
    published.push(name);
  }
  if (published.length !== order.length) {
    console.error(`incomplete publication: ${published.length}/${order.length}`);
    process.exit(1);
  }
  console.log(`published ${published.length} packages; record per-package registry evidence in Task 12`);
  console.log("no FRACTA notification is sent from this repository");
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMainModule()) {
  main();
}
