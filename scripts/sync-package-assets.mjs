#!/usr/bin/env node
/**
 * Task 11 — deterministic package-asset synchronization.
 *
 * For each of the eleven release packages this script:
 *   1. extracts the `sothoth-package-readme` block from `docs/packages/<p>.md`
 *      and writes it, byte-for-byte, to `packages/<p>/README.md`;
 *   2. byte-copies the root Apache-2.0 `LICENSE` to `packages/<p>/LICENSE`.
 *
 * The generated README is therefore mechanically traceable to its reference
 * documentation source, and running the script twice is byte-idempotent.
 * This is repository evidence generation, not publication: nothing here
 * publishes, tags, or contacts a registry.
 */

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

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

export const README_BEGIN = "<!-- sothoth-package-readme:start -->";
export const README_END = "<!-- sothoth-package-readme:end -->";

/**
 * Extracts the package README payload embedded in `docs/packages/<p>.md`.
 * The payload between the two markers is returned verbatim (with the single
 * leading and trailing newline trimmed deterministically).
 */
export function extractReadmeBlock(docSource) {
  const begin = docSource.indexOf(README_BEGIN);
  const end = docSource.indexOf(README_END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error("reference doc is missing the sothoth-package-readme block markers");
  }
  return docSource.slice(begin + README_BEGIN.length, end).replace(/^\n/, "").replace(/\n$/, "");
}

/** Synchronizes all package-local assets; returns the written path list. */
export function syncPackageAssets(rootDir) {
  const written = [];
  const rootLicense = join(rootDir, "LICENSE");
  for (const p of PACKAGE_ORDER) {
    const doc = readFileSync(join(rootDir, "docs", "packages", `${p}.md`), "utf8");
    const readme = extractReadmeBlock(doc);
    const readmePath = join(rootDir, "packages", p, "README.md");
    writeFileSync(readmePath, readme, "utf8");
    const licensePath = join(rootDir, "packages", p, "LICENSE");
    copyFileSync(rootLicense, licensePath);
    written.push(readmePath, licensePath);
  }
  return written;
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMainModule()) {
  const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
  const written = syncPackageAssets(rootDir);
  for (const path of written) {
    console.log(`synced: ${path.slice(rootDir.length + 1)}`);
  }
  console.log(`package assets synchronized for ${PACKAGE_ORDER.length} packages`);
}
