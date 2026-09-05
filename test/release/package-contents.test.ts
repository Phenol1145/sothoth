import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

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

const EXPECTED_REPOSITORY_URL = "git+https://github.com/Phenol1145/sothoth.git";

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const text = await readText(path);
  if (text === null) {
    throw new Error(`missing file: ${path.slice(root.length + 1)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

interface ManifestShape {
  name?: string;
  version?: string;
  license?: string;
  exports?: Record<string, { types?: string; import?: string }>;
  files?: string[];
  repository?: { type?: string; url?: string; directory?: string };
  publishConfig?: { access?: string; provenance?: boolean };
  bin?: Record<string, string>;
}

async function readManifest(packageDir: string): Promise<ManifestShape> {
  return (await readJson(`${root}/packages/${packageDir}/package.json`)) as ManifestShape;
}

/** Extracts the accepted `public-surface-declaration@1` block from a dossier. */
async function readDossierSurface(
  packageDir: string,
): Promise<{ packageId: string; publicModules: string[]; surfaceKind: string } | null> {
  const text = await readText(`${root}/docs/design/dossiers/${packageDir}.md`);
  if (text === null) {
    return null;
  }
  const fence = text.match(
    /```json\s*(\{[^`]*?"kind":\s*"sothoth-dossier\/public-surface-declaration@1"[^`]*?\})\s*```/s,
  );
  if (!fence || !fence[1]) {
    return null;
  }
  return JSON.parse(fence[1]) as {
    packageId: string;
    publicModules: string[];
    surfaceKind: string;
  };
}

describe("Task 11 package-local assets", () => {
  test("every package carries the generated README and byte-copied LICENSE", async () => {
    const rootLicense = await readFile(`${root}/LICENSE`);
    for (const p of PACKAGES) {
      const readme = `${root}/packages/${p}/README.md`;
      const license = `${root}/packages/${p}/LICENSE`;
      if (!existsSync(readme)) {
        throw new Error(
          `missing Task 11 sync output: packages/${p}/README.md (produce it with scripts/sync-package-assets.mjs)`,
        );
      }
      if (!existsSync(license)) {
        throw new Error(
          `missing Task 11 sync output: packages/${p}/LICENSE (produce it with scripts/sync-package-assets.mjs)`,
        );
      }
      expect(await readFile(license)).toEqual(rootLicense);
    }
  });

  test("package READMEs are mechanically traceable to docs/packages/<p>.md", async () => {
    const sync = (await import("../../scripts/sync-package-assets.mjs").catch(() => null)) as
      | { extractReadmeBlock: (doc: string) => string }
      | null;
    expect(
      sync,
      "missing Task 11 script: scripts/sync-package-assets.mjs",
    ).toBeTruthy();
    for (const p of PACKAGES) {
      const doc = await readText(`${root}/docs/packages/${p}.md`);
      expect(doc, `missing Task 11 reference doc: docs/packages/${p}.md`).toBeTruthy();
      const readme = await readFile(`${root}/packages/${p}/README.md`, "utf8");
      expect(
        readme,
        `packages/${p}/README.md must equal the package-readme block of docs/packages/${p}.md`,
      ).toBe(sync!.extractReadmeBlock(doc!));
    }
  });
});

describe("Task 11 manifest identity", () => {
  test("manifests declare scoped identity, 0.1.0, Apache-2.0, repository, files allowlist, publishConfig", async () => {
    for (const p of PACKAGES) {
      const manifest = await readManifest(p);
      expect(manifest.name, `${p} name`).toBe(`@sothoth/${p}`);
      expect(manifest.version, `${p} version`).toBe("0.1.0");
      expect(manifest.license, `${p} license`).toBe("Apache-2.0");
      expect(manifest.repository?.type).toBe("git");
      expect(manifest.repository?.url, `${p} repository url`).toBe(EXPECTED_REPOSITORY_URL);
      expect(manifest.repository?.directory).toBe(`packages/${p}`);
      expect(manifest.files, `${p} files allowlist`).toEqual(["dist", "README.md", "LICENSE"]);
      expect(manifest.publishConfig?.access).toBe("public");
      expect(manifest.publishConfig?.provenance).toBe(true);
    }
  });

  test("@sothoth/cli declares the sothoth bin over the built entry", async () => {
    const manifest = await readManifest("cli");
    expect(manifest.bin).toEqual({ sothoth: "./dist/main.js" });
    expect(existsSync(`${root}/packages/cli/dist/main.js`), "built bin target dist/main.js").toBe(
      true,
    );
  });
});

describe("Task 11 exports binding (manifest + Dossier)", () => {
  test("exports maps equal the accepted Dossier public-surface-declaration@1 modules", async () => {
    for (const p of PACKAGES) {
      const manifest = await readManifest(p);
      const surface = await readDossierSurface(p);
      expect(
        surface,
        `missing accepted public-surface-declaration@1 in docs/design/dossiers/${p}.md`,
      ).toBeTruthy();
      expect(surface!.packageId).toBe(`@sothoth/${p}`);

      const manifestSubpaths = Object.keys(manifest.exports ?? {})
        .filter((key) => key !== ".")
        .map((key) => `@sothoth/${p}${key.slice(1)}`)
        .sort();
      const dossierModules = [...surface!.publicModules].sort();
      expect(
        manifestSubpaths,
        `packages/${p} exports must bind exactly to the Dossier public modules`,
      ).toEqual(dossierModules);

      const rootEntry = (manifest.exports ?? {})["."];
      if (rootEntry !== undefined) {
        expect(
          dossierModules.length,
          `${p} root export exists only when the Dossier declares the family union`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test("every exports entry resolves to built runtime and .d.ts files under dist/", async () => {
    for (const p of PACKAGES) {
      const manifest = await readManifest(p);
      const entries = Object.entries(manifest.exports ?? {});
      expect(entries.length, `${p} exports`).toBeGreaterThan(0);
      for (const [subpath, entry] of entries) {
        expect(entry?.import, `${p}${subpath} runtime target`).toMatch(/^\.\/dist\/.+\.js$/);
        expect(entry?.types, `${p}${subpath} types target`).toMatch(/^\.\/dist\/.+\.d\.ts$/);
        const runtimePath = `${root}/packages/${p}/${entry!.import!.replace(/^\.\//, "")}`;
        const typesPath = `${root}/packages/${p}/${entry!.types!.replace(/^\.\//, "")}`;
        if (!existsSync(runtimePath)) {
          throw new Error(
            `missing built runtime file for @sothoth/${p}${subpath === "." ? "" : subpath}: ${entry!.import} (run npm run build)`,
          );
        }
        if (!existsSync(typesPath)) {
          throw new Error(
            `missing built type declaration for @sothoth/${p}${subpath === "." ? "" : subpath}: ${entry!.types} (run npm run build)`,
          );
        }
      }
    }
  });
});

describe("Task 11 built package-resolution smoke (Task 2 Minor M-3)", () => {
  const ACCEPTED_COUNTS: Record<string, number> = {
    "@sothoth/contracts": 36,
    "@sothoth/contracts/identity": 3,
    "@sothoth/contracts/schema": 10,
    "@sothoth/contracts/diagnostic": 9,
    "@sothoth/contracts/projection": 4,
    "@sothoth/contracts/pre-design": 9,
    "@sothoth/contracts/extension": 1,
    "@sothoth/core": 5,
    "@sothoth/core/canonical-json": 2,
    "@sothoth/core/digest": 1,
    "@sothoth/core/compile": 5,
    "@sothoth/core/diagnostics": 1,
    "@sothoth/core/outcome": 1,
  };

  function runChildSpecifiers(specifiers: string[]): Record<string, { ok: boolean; resolved?: string; keys?: number; code?: string }> {
    const code = `
const specifiers = ${JSON.stringify(specifiers)};
const out = {};
for (const s of specifiers) {
  try {
    const resolved = import.meta.resolve(s);
    const mod = await import(s);
    out[s] = { ok: true, resolved, keys: Object.keys(mod).length };
  } catch (error) {
    out[s] = { ok: false, code: error?.code ?? String(error) };
  }
}
console.log(JSON.stringify(out));
`;
    const run = spawnSync(process.execPath, ["--input-type=module", "--eval", code], {
      cwd: root,
      encoding: "utf8",
    });
    expect(
      run.status,
      `built-specifier child process failed: ${run.stderr.slice(0, 400)}`,
    ).toBe(0);
    return JSON.parse(run.stdout.trim().split("\n").at(-1)!) as Record<
      string,
      { ok: boolean; resolved?: string; keys?: number; code?: string }
    >;
  }

  test("all thirteen accepted contracts/core specifiers resolve from BUILT dist output", () => {
    const results = runChildSpecifiers(Object.keys(ACCEPTED_COUNTS));
    for (const [specifier, expectedKeys] of Object.entries(ACCEPTED_COUNTS)) {
      const result = results[specifier];
      expect(result, `${specifier} resolved`).toBeDefined();
      expect(result.ok, `${specifier} import from built output`).toBe(true);
      expect(result.resolved, `${specifier} must resolve into the built package dist`).toContain(
        `/packages/${specifier.split("/")[1]}/dist/`,
      );
      expect(result.keys, `${specifier} export count`).toBe(expectedKeys);
    }
  });

  test("unauthorized specifiers fail closed with ERR_PACKAGE_PATH_NOT_EXPORTED", () => {
    const bare = PACKAGES.filter((p) => p !== "contracts" && p !== "core").map((p) => `@sothoth/${p}`);
    const unlisted = PACKAGES.map((p) => `@sothoth/${p}/not-a-public-subpath`);
    const results = runChildSpecifiers([...bare, ...unlisted]);
    for (const specifier of [...bare, ...unlisted]) {
      const result = results[specifier];
      expect(result, `${specifier} result`).toBeDefined();
      expect(result.ok, `${specifier} must not resolve`).toBe(false);
      expect(result.code, `${specifier} rejection code`).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
    }
  });
});

describe("Task 11 tarball contents (npm pack dry run)", () => {
  test("tarballs honor the files allowlist and exclude tests, sources, maps, secrets, and design files", async () => {
    const run = spawnSync("npm", ["pack", "--dry-run", "--json", "--workspaces"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(run.status, `npm pack --dry-run --workspaces failed: ${run.stderr.slice(0, 300)}`).toBe(0);
    const packed = JSON.parse(run.stdout) as Array<{
      name?: string;
      files?: Array<{ path: string }>;
    }>;
    const byName = new Map(packed.map((entry) => [entry.name, entry]));
    for (const p of PACKAGES) {
      const entry = byName.get(`@sothoth/${p}`);
      expect(entry, `dry-run pack entry for @sothoth/${p}`).toBeDefined();
      const paths = (entry?.files ?? []).map((file) => file.path);
      expect(paths.length, `${p} packed entries`).toBeGreaterThan(0);

      // The built runtime and declaration surface must actually be inside
      // the tarball: every exports target of the manifest must appear.
      const manifest = await readManifest(p);
      for (const [subpath, exportEntry] of Object.entries(manifest.exports ?? {})) {
        const runtime = exportEntry?.import?.replace(/^\.\//, "");
        const types = exportEntry?.types?.replace(/^\.\//, "");
        expect(
          runtime && paths.includes(runtime),
          `@sothoth/${p}${subpath === "." ? "" : subpath} runtime target ${runtime} must be packed`,
        ).toBe(true);
        expect(
          types && paths.includes(types),
          `@sothoth/${p}${subpath === "." ? "" : subpath} types target ${types} must be packed`,
        ).toBe(true);
      }
      expect(
        paths.some((path) => path.startsWith("dist/") && path.endsWith(".js")),
        `${p} tarball must contain built JavaScript`,
      ).toBe(true);
      expect(
        paths.some((path) => path.startsWith("dist/") && path.endsWith(".d.ts")),
        `${p} tarball must contain built declarations`,
      ).toBe(true);

      for (const required of ["package.json", "README.md", "LICENSE"]) {
        expect(
          paths,
          `${p} tarball must contain ${required} (Task 11 sync assets)`,
        ).toContain(required);
      }
      for (const path of paths) {
        const allowed =
          path === "package.json" ||
          path === "README.md" ||
          path === "LICENSE" ||
          path.startsWith("dist/");
        expect(
          allowed,
          `${p} tarball entry outside the files allowlist: ${path}`,
        ).toBe(true);
        expect(path.includes(".test."), `${p} tarball must not contain tests: ${path}`).toBe(false);
        expect(path.startsWith("src/"), `${p} tarball must not contain sources: ${path}`).toBe(false);
        expect(path.endsWith(".map"), `${p} tarball must not contain source maps: ${path}`).toBe(false);
        if (path.endsWith(".ts")) {
          expect(
            path.endsWith(".d.ts"),
            `${p} tarball must not contain TypeScript sources: ${path}`,
          ).toBe(true);
        }
        expect(
          /\.(npmrc|env|pem|key)$/.test(path) || path.includes("secret"),
          `${p} tarball must not contain secrets: ${path}`,
        ).toBe(false);
        expect(
          /^(docs|test|catalog|scripts|fixtures)\//.test(path),
          `${p} tarball must not contain repository-internal files: ${path}`,
        ).toBe(false);
      }
    }
  }, 120_000);
});
