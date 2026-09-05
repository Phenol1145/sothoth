import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

const PACKAGES = [
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

interface PackManifestEntry {
  name: string;
  version: string;
  directory: string;
  filename: string;
  sizeBytes: number;
  unpackedSize: number;
  npmShasum: string;
  npmIntegrity: string;
  sha512: { hex: string; sri: string };
  entryCount: number;
}

let dirA: string | null = null;
let dirB: string | null = null;

function runPackAll(outDir: string): void {
  const run = spawnSync(
    process.execPath,
    [join(root, "scripts", "pack-all.mjs"), "--out", outDir],
    { cwd: root, encoding: "utf8" },
  );
  expect(
    run.status,
    `Task 11 pack script failed (missing or erroring: scripts/pack-all.mjs): ${run.stderr.slice(0, 400)}`,
  ).toBe(0);
}

async function readPackManifest(outDir: string): Promise<PackManifestEntry[]> {
  const text = await readFile(join(outDir, "pack-manifest.json"), "utf8").catch(() => null);
  if (text === null) {
    throw new Error(`missing pack manifest: ${join(outDir, "pack-manifest.json")}`);
  }
  return JSON.parse(text) as PackManifestEntry[];
}

beforeAll(async () => {
  dirA = await mkdtemp(join(tmpdir(), "t11-pack-a-"));
  dirB = await mkdtemp(join(tmpdir(), "t11-pack-b-"));
  runPackAll(dirA);
  runPackAll(dirB);
}, 300_000);

afterAll(async () => {
  await rm(dirA ?? "", { recursive: true, force: true });
  await rm(dirB ?? "", { recursive: true, force: true });
});

describe("Task 11 reproducible pack", () => {
  test("pack manifests record exactly the eleven @sothoth packages at 0.1.0 in canonical order", async () => {
    for (const dir of [dirA!, dirB!]) {
      const entries = await readPackManifest(dir);
      expect(
        entries.map((entry) => entry.name),
        `pack order in ${dir}`,
      ).toEqual(PACKAGES.map((p) => `@sothoth/${p}`));
      for (const entry of entries) {
        expect(entry.version).toBe("0.1.0");
        expect(entry.directory).toBe(entry.name.replace("@sothoth/", "packages/"));
        expect(entry.filename).toBe(
          `sothoth-${entry.name.replace("@sothoth/", "")}-0.1.0.tgz`,
        );
        expect(entry.sizeBytes).toBeGreaterThan(0);
        expect(entry.entryCount).toBeGreaterThan(0);
      }
    }
  });

  test("both packs wrote exactly eleven tarballs per directory", async () => {
    for (const dir of [dirA!, dirB!]) {
      const files = (await readdir(dir)).filter((file) => file.endsWith(".tgz")).sort();
      expect(files).toEqual(
        PACKAGES.map((p) => `sothoth-${p}-0.1.0.tgz`).sort(),
      );
    }
  });

  test("paired tarballs are byte-identical across the two isolated pack runs", async () => {
    const manifestA = await readPackManifest(dirA!);
    for (const entry of manifestA) {
      const bytesA = await readFile(join(dirA!, entry.filename));
      const bytesB = await readFile(join(dirB!, entry.filename));
      expect(
        bytesA.equals(bytesB),
        `tarball bytes differ between the two packs for ${entry.name}`,
      ).toBe(true);
    }
  });

  test("SHA-512 digests match across packs and raw/hex/SRI representations stay distinct", async () => {
    const manifestA = await readPackManifest(dirA!);
    const manifestB = await readPackManifest(dirB!);
    const byNameB = new Map(manifestB.map((entry) => [entry.name, entry]));

    for (const entry of manifestA) {
      const other = byNameB.get(entry.name);
      expect(other, `pack-2 manifest entry for ${entry.name}`).toBeDefined();

      // Recompute independently from the raw tarball bytes of each pack.
      for (const [label, dir] of [
        ["pack-1", dirA!],
        ["pack-2", dirB!],
      ] as const) {
        const bytes = await readFile(join(dir, entry.filename));
        const raw = createHash("sha512").update(bytes).digest();
        const hex = raw.toString("hex");
        const sri = `sha512-${raw.toString("base64")}`;
        expect(hex, `${entry.name} ${label} recomputed hex`).toBe(entry.sha512.hex);
        expect(sri, `${entry.name} ${label} recomputed SRI`).toBe(entry.sha512.sri);
        // The encoding carry-in (F-1): hex and the base64 SRI payload are
        // different representations and must never be compared to each other.
        expect(hex).toMatch(/^[0-9a-f]{128}$/);
        expect(entry.sha512.sri).toMatch(/^sha512-[A-Za-z0-9+/]{86}==$/);
        expect(entry.sha512.sri.slice("sha512-".length)).not.toBe(hex);
      }

      expect(other!.sha512.hex, `${entry.name} digest equality across packs`).toBe(
        entry.sha512.hex,
      );
      expect(other!.sha512.sri).toBe(entry.sha512.sri);
      // npm's own dist.integrity-style value must equal the independently
      // computed SRI over the same tarball bytes.
      expect(entry.npmIntegrity).toBe(entry.sha512.sri);
      expect(entry.npmShasum).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});
