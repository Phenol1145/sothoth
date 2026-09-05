import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

describe("Task 11 publish workflow release artifact (PRE-1/PRE-3 static gates)", () => {
  test("publish.yml generates the release lock and uploads the sothoth-v0.1.0-release artifact", async () => {
    const publishYml = await readFile(join(root, ".github", "workflows", "publish.yml"), "utf8");
    expect(
      publishYml.includes("node scripts/create-release-lock.mjs"),
      "publish.yml must generate v0.1.0-release-lock.json via scripts/create-release-lock.mjs",
    ).toBe(true);
    expect(publishYml.includes("upload-artifact")).toBe(true);
    expect(
      publishYml.includes("sothoth-v0.1.0-release"),
      "publish.yml must upload an artifact named sothoth-v0.1.0-release",
    ).toBe(true);
    for (const artifactMember of [
      "dist/release/v0.1.0-candidate-bom.json",
      "dist/release/v0.1.0-release-lock.json",
      "dist/release/sbom.cdx.json",
      "dist/release/v0.1.0-verification-report.md",
      "dist/release/pack-1/*.tgz",
    ]) {
      expect(
        publishYml.includes(artifactMember),
        `artifact must include ${artifactMember}`,
      ).toBe(true);
    }
  });

  test("publish.yml runs a clean npm ci without a package-manager cache; ci.yml keeps its own policy", async () => {
    const publishYml = await readFile(join(root, ".github", "workflows", "publish.yml"), "utf8");
    expect(publishYml.includes("npm ci"), "publish.yml must install via npm ci").toBe(true);
    expect(
      publishYml.includes("cache: npm"),
      "publish.yml must NOT enable the npm cache (clean publish build)",
    ).toBe(false);
    const ciYml = await readFile(join(root, ".github", "workflows", "ci.yml"), "utf8");
    expect(ciYml.includes("cache: npm"), "ci.yml keeps its own cache policy").toBe(true);
  });
});

describe("Task 11 release lock generation (PRE-1)", () => {
  interface Fixture {
    releaseDir: string;
    candidateBomPath: string;
    head: string;
    packages: Array<{ name: string; version: string; filename: string; sha512: { hex: string; sri: string } }>;
    candidateSha512: { hex: string; sri: string };
    sbomSha512: { hex: string; sri: string };
  }

  function digestOf(bytes: Buffer): { hex: string; sri: string } {
    const raw = createHash("sha512").update(bytes).digest();
    return { hex: raw.toString("hex"), sri: `sha512-${raw.toString("base64")}` };
  }

  async function buildFixture(tamperPackageSri = false): Promise<Fixture> {
    const releaseDir = await mkdtemp(join(tmpdir(), "t11-lock-"));
    const packDir = join(releaseDir, "pack-1");
    await mkdir(packDir, { recursive: true });
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(head.status).toBe(0);

    const packages: Fixture["packages"] = [];
    for (const p of PACKAGES) {
      const filename = `sothoth-${p}-0.1.0.tgz`;
      const bytes = Buffer.from(`release-lock fixture tarball for @sothoth/${p}\n`, "utf8");
      await writeFile(join(packDir, filename), bytes);
      packages.push({
        name: `@sothoth/${p}`,
        version: "0.1.0",
        filename,
        sha512: digestOf(bytes),
      });
    }
    if (tamperPackageSri) {
      packages[0]!.sha512.sri = "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
    }

    const sbomBytes = Buffer.from('{"bomFormat":"CycloneDX","specVersion":"1.5","components":[]}\n', "utf8");
    await writeFile(join(releaseDir, "sbom.cdx.json"), sbomBytes);
    const sbomSha512 = digestOf(sbomBytes);

    const candidate = {
      schema: "sothoth.release-candidate-bom/v1",
      sourceCommit: head.stdout.trim(),
      sourceTreeClean: true,
      scopeBom: {
        path: "docs/release/v0.1.0-scope-bom.json",
        bomId: "SOTHOTH-RELEASE-SCOPE-BOM-0.1",
        revision: 3,
        memberCount: 11,
      },
      sbom: { path: "dist/release/sbom.cdx.json", format: "cyclonedx-1.5", sha512: sbomSha512 },
      packages: packages.map((entry) => ({
        name: entry.name,
        version: entry.version,
        tarball: { path: `dist/release/pack-1/${entry.filename}`, sha512: entry.sha512 },
      })),
    };
    const candidateBytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    const candidateBomPath = join(releaseDir, "v0.1.0-candidate-bom.json");
    await writeFile(candidateBomPath, candidateBytes);

    return {
      releaseDir,
      candidateBomPath,
      head: head.stdout.trim(),
      packages,
      candidateSha512: digestOf(candidateBytes),
      sbomSha512,
    };
  }

  test("generates a lock bound to commit, scope BOM, digests, and real workflow context only", async () => {
    const fixture = await buildFixture();
    const run = spawnSync(
      process.execPath,
      [join(root, "scripts", "create-release-lock.mjs"), "--release-dir", fixture.releaseDir],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_RUN_ID: "9876543210",
          GITHUB_RUN_ATTEMPT: "2",
          GITHUB_WORKFLOW_REF:
            "Phenol1145/sothoth/.github/workflows/publish.yml@refs/tags/v0.1.0",
        },
      },
    );
    expect(
      run.status,
      `create-release-lock failed: ${run.stderr.slice(0, 400)}`,
    ).toBe(0);

    const lockPath = join(fixture.releaseDir, "v0.1.0-release-lock.json");
    expect(existsSync(lockPath), "lock file must be written").toBe(true);
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown> & {
      schema?: string;
      repository?: string;
      releaseTag?: string;
      packageVersion?: string;
      sourceCommit?: string;
      workflow?: { fileName?: string | null; runId?: string | null; runAttempt?: string | null; insideGitHubActions?: boolean };
      scopeBom?: { bomId?: string; revision?: number };
      candidateBom?: { sha512?: { hex?: string; sri?: string } };
      sbom?: { sha512?: { hex?: string; sri?: string } };
      packages?: Array<{ name: string; version: string; filename: string; sha512: { hex: string; sri: string } }>;
    };
    expect(lock.schema).toBe("sothoth.release-lock/v1");
    expect(lock.repository).toBe("Phenol1145/sothoth");
    expect(lock.releaseTag).toBe("v0.1.0");
    expect(lock.packageVersion).toBe("0.1.0");
    expect(lock.sourceCommit).toBe(fixture.head);
    expect(lock.workflow?.fileName).toBe("publish.yml");
    expect(lock.workflow?.runId).toBe("9876543210");
    expect(lock.workflow?.runAttempt).toBe("2");
    expect(lock.workflow?.insideGitHubActions).toBe(true);
    expect(lock.scopeBom?.bomId).toBe("SOTHOTH-RELEASE-SCOPE-BOM-0.1");
    expect(lock.scopeBom?.revision).toBe(3);
    expect(lock.candidateBom?.sha512).toEqual(fixture.candidateSha512);
    expect(lock.sbom?.sha512).toEqual(fixture.sbomSha512);
    expect(lock.packages?.map((entry) => entry.name)).toEqual(
      PACKAGES.map((p) => `@sothoth/${p}`),
    );
    for (const entry of lock.packages ?? []) {
      const expected = fixture.packages.find((candidate) => candidate.name === entry.name);
      expect(entry.version).toBe("0.1.0");
      expect(entry.filename).toBe(expected!.filename);
      expect(entry.sha512).toEqual(expected!.sha512);
    }

    // No wall-clock anywhere: no timestamp-like keys, no ISO-8601 strings.
    const lockText = await readFile(lockPath, "utf8");
    expect(/timestamp/i.test(lockText)).toBe(false);
    expect(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(lockText)).toBe(false);
    await rm(fixture.releaseDir, { recursive: true, force: true });
  }, 60_000);

  test("outside GitHub Actions the lock records absent workflow context instead of fabricating it", async () => {
    const fixture = await buildFixture();
    const envWithoutGithub = { ...process.env };
    delete envWithoutGithub.GITHUB_RUN_ID;
    delete envWithoutGithub.GITHUB_RUN_ATTEMPT;
    delete envWithoutGithub.GITHUB_WORKFLOW_REF;
    const run = spawnSync(
      process.execPath,
      [join(root, "scripts", "create-release-lock.mjs"), "--release-dir", fixture.releaseDir],
      { cwd: root, encoding: "utf8", env: envWithoutGithub },
    );
    expect(run.status, `create-release-lock failed: ${run.stderr.slice(0, 300)}`).toBe(0);
    const lock = JSON.parse(
      await readFile(join(fixture.releaseDir, "v0.1.0-release-lock.json"), "utf8"),
    ) as { workflow?: { fileName?: string | null; runId?: string | null; runAttempt?: string | null; insideGitHubActions?: boolean } };
    expect(lock.workflow?.insideGitHubActions).toBe(false);
    expect(lock.workflow?.fileName).toBeNull();
    expect(lock.workflow?.runId).toBeNull();
    expect(lock.workflow?.runAttempt).toBeNull();
    await rm(fixture.releaseDir, { recursive: true, force: true });
  }, 60_000);

  test("fails closed and writes no lock when a tarball digest disagrees with the candidate BOM", async () => {
    const fixture = await buildFixture(true);
    const run = spawnSync(
      process.execPath,
      [join(root, "scripts", "create-release-lock.mjs"), "--release-dir", fixture.releaseDir],
      { cwd: root, encoding: "utf8" },
    );
    expect(run.status, "tampered digest must fail the lock generation").not.toBe(0);
    expect(
      existsSync(join(fixture.releaseDir, "v0.1.0-release-lock.json")),
      "no lock may be written on failure",
    ).toBe(false);
    await rm(fixture.releaseDir, { recursive: true, force: true });
  }, 60_000);
});
