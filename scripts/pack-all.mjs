#!/usr/bin/env node
/**
 * Task 11 — `npm pack --json` orchestration for the eleven release packages.
 *
 * Packs every `packages/<p>` into one output directory (`--out <dir>`),
 * records a deterministic `pack-manifest.json` next to the tarballs, and
 * independently computes each tarball's SHA-512 in two distinct
 * representations (hex and npm-SRI base64) so no digest is ever compared
 * across encodings. Local repository evidence only: nothing is published.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isAbsolute, join } from "node:path";

export const PACKAGE_ORDER = [
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

export const RELEASE_VERSION = "0.1.0";
export const REPOSITORY_URL = "git+https://github.com/Phenol1145/sothoth.git";

/** SHA-512 over raw bytes, returned as lowercase hex. */
export function sha512Hex(bytes) {
  return createHash("sha512").update(bytes).digest("hex");
}

/** SHA-512 over raw bytes, returned in npm SRI form `sha512-<base64-of-raw>`. */
export function sha512Sri(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

export function expectedTarballName(packageDir) {
  return `project-sothoth-${packageDir}-${RELEASE_VERSION}.tgz`;
}

/**
 * Packs all eleven packages into `outDir` and writes `pack-manifest.json`.
 * Fails (non-zero exit) on any pack error, identity mismatch, or integrity
 * disagreement between npm's own value and the independently computed SRI.
 */
export async function packAll(rootDir, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // Validate every manifest before packing anything.
  for (const p of PACKAGE_ORDER) {
    const manifest = JSON.parse(readFileSync(join(rootDir, "packages", p, "package.json"), "utf8"));
    if (manifest.name !== `@project-sothoth/${p}`) {
      throw new Error(`packages/${p}/package.json name is ${manifest.name}, expected @project-sothoth/${p}`);
    }
    if (manifest.version !== RELEASE_VERSION) {
      throw new Error(`packages/${p}/package.json version is ${manifest.version}, expected ${RELEASE_VERSION}`);
    }
    if (manifest.repository?.url !== REPOSITORY_URL) {
      throw new Error(`packages/${p}/package.json repository url does not match ${REPOSITORY_URL}`);
    }
  }

  // One invocation packs all workspaces; npm produces byte-identical
  // tarballs to per-directory packing (verified by the release suites).
  const run = spawnSync(
    "npm",
    ["pack", "--json", "--workspaces", "--pack-destination", outDir],
    { cwd: rootDir, encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(`npm pack --workspaces failed:\n${run.stderr}`);
  }
  const packed = JSON.parse(run.stdout);
  if (!Array.isArray(packed) || packed.length !== PACKAGE_ORDER.length) {
    throw new Error(
      `npm pack --workspaces produced ${Array.isArray(packed) ? packed.length : "non-array"} entries, expected ${PACKAGE_ORDER.length}`,
    );
  }

  const byName = new Map(packed.map((info) => [info.name, info]));
  const entries = [];
  for (const p of PACKAGE_ORDER) {
    const info = byName.get(`@project-sothoth/${p}`);
    if (info === undefined) {
      throw new Error(`npm pack --workspaces result is missing @project-sothoth/${p}`);
    }
    const filename = expectedTarballName(p);
    if (info.filename !== filename) {
      throw new Error(`npm pack filename for @project-sothoth/${p} is ${info.filename}, expected ${filename}`);
    }
    if (info.version !== RELEASE_VERSION) {
      throw new Error(`npm pack identity mismatch for @project-sothoth/${p}`);
    }

    const tarballBytes = readFileSync(join(outDir, filename));
    const hex = sha512Hex(tarballBytes);
    const sri = sha512Sri(tarballBytes);
    if (typeof info.integrity === "string" && info.integrity !== sri) {
      throw new Error(
        `npm-reported integrity for @project-sothoth/${p} (${info.integrity}) disagrees with the independently computed SRI (${sri})`,
      );
    }

    entries.push({
      name: `@project-sothoth/${p}`,
      version: RELEASE_VERSION,
      directory: `packages/${p}`,
      filename,
      sizeBytes: tarballBytes.length,
      unpackedSize: info.unpackedSize,
      npmShasum: info.shasum,
      npmIntegrity: info.integrity,
      sha512: { hex, sri },
      entryCount: info.entryCount,
    });
  }

  const manifestPath = join(outDir, "pack-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return { entries, manifestPath };
}

function parseOutFlag(argv) {
  const index = argv.indexOf("--out");
  if (index === -1 || index + 1 >= argv.length) {
    throw new Error("usage: node scripts/pack-all.mjs --out <directory>");
  }
  const out = argv[index + 1];
  return isAbsolute(out) ? out : join(process.cwd(), out);
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMainModule()) {
  const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
  packAll(rootDir, parseOutFlag(process.argv))
    .then(({ entries, manifestPath }) => {
      for (const entry of entries) {
        console.log(
          `packed ${entry.name}@${entry.version} -> ${entry.filename} (${entry.sizeBytes} bytes, sha512:${entry.sha512.hex.slice(0, 16)}…)`,
        );
      }
      console.log(`pack manifest: ${manifestPath}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exit(1);
    });
}
