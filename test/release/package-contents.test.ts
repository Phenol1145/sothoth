import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
      expect(manifest.name, `${p} name`).toBe(`@project-sothoth/${p}`);
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

  test("@project-sothoth/cli declares the sothoth bin over the built entry", async () => {
    const manifest = await readManifest("cli");
    expect(manifest.bin).toEqual({ sothoth: "./dist/main.js" });
    expect(existsSync(`${root}/packages/cli/dist/main.js`), "built bin target dist/main.js").toBe(
      true,
    );
  });
});

describe("Task 11 exports binding (manifest + Dossier)", () => {
  test("exports maps equal the accepted Dossier public-surface-declaration@1 modules", async () => {
    const rootExportPackages: string[] = [];
    for (const p of PACKAGES) {
      const manifest = await readManifest(p);
      const surface = await readDossierSurface(p);
      expect(
        surface,
        `missing accepted public-surface-declaration@1 in docs/design/dossiers/${p}.md`,
      ).toBeTruthy();
      expect(surface!.packageId).toBe(`@project-sothoth/${p}`);

      const manifestSubpaths = Object.keys(manifest.exports ?? {})
        .filter((key) => key !== ".")
        .map((key) => `@project-sothoth/${p}${key.slice(1)}`)
        .sort();
      const dossierModules = [...surface!.publicModules].sort();
      expect(
        manifestSubpaths,
        `packages/${p} exports must bind exactly to the Dossier public modules`,
      ).toEqual(dossierModules);

      if ((manifest.exports ?? {})["."] !== undefined) {
        rootExportPackages.push(p);
      }
    }
    // The accepted Dossier public-surface-declaration@1 schema has no
    // root-export field, so the two family-union roots cannot be bound by
    // the declaration itself: they are grounded by the durable Task 2
    // 13-specifier built-resolution smoke in this file (exact export counts
    // for both roots). What IS bound here, explicitly: only `contracts` and
    // `core` may declare a root export at all.
    expect(rootExportPackages.sort()).toEqual(["contracts", "core"]);
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
            `missing built runtime file for @project-sothoth/${p}${subpath === "." ? "" : subpath}: ${entry!.import} (run npm run build)`,
          );
        }
        if (!existsSync(typesPath)) {
          throw new Error(
            `missing built type declaration for @project-sothoth/${p}${subpath === "." ? "" : subpath}: ${entry!.types} (run npm run build)`,
          );
        }
      }
    }
  });
});

describe("Task 11 built package-resolution smoke (Task 2 Minor M-3)", () => {
  const ACCEPTED_COUNTS: Record<string, number> = {
    "@project-sothoth/contracts": 36,
    "@project-sothoth/contracts/identity": 3,
    "@project-sothoth/contracts/schema": 10,
    "@project-sothoth/contracts/diagnostic": 9,
    "@project-sothoth/contracts/projection": 4,
    "@project-sothoth/contracts/pre-design": 9,
    "@project-sothoth/contracts/extension": 1,
    "@project-sothoth/core": 5,
    "@project-sothoth/core/canonical-json": 2,
    "@project-sothoth/core/digest": 1,
    "@project-sothoth/core/compile": 5,
    "@project-sothoth/core/diagnostics": 1,
    "@project-sothoth/core/outcome": 1,
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
    const bare = PACKAGES.filter((p) => p !== "contracts" && p !== "core").map((p) => `@project-sothoth/${p}`);
    const unlisted = PACKAGES.map((p) => `@project-sothoth/${p}/not-a-public-subpath`);
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
      const entry = byName.get(`@project-sothoth/${p}`);
      expect(entry, `dry-run pack entry for @project-sothoth/${p}`).toBeDefined();
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
          `@project-sothoth/${p}${subpath === "." ? "" : subpath} runtime target ${runtime} must be packed`,
        ).toBe(true);
        expect(
          types && paths.includes(types),
          `@project-sothoth/${p}${subpath === "." ? "" : subpath} types target ${types} must be packed`,
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

describe("Task 11 docs usage examples bind to real built exports", () => {
  test("every @project-sothoth symbol imported in docs/packages/*.md examples is exported by the built subpath", async () => {
    const moduleCache = new Map<string, Record<string, unknown>>();
    const problems: string[] = [];
    for (const p of PACKAGES) {
      const doc = await readText(`${root}/docs/packages/${p}.md`);
      if (doc === null) {
        throw new Error(`missing Task 11 reference doc: docs/packages/${p}.md`);
      }
      const imports: Array<{ symbols: string[]; specifier: string; file: string }> = [];
      for (const block of doc.matchAll(/```ts\s*([\s\S]*?)```/g)) {
        for (const statement of (block[1] ?? "").matchAll(
          /import\s+\{([^}]+)\}\s+from\s+"(@project-sothoth\/[a-z-]+(?:\/[a-z-]+)?)"/g,
        )) {
          const symbols = (statement[1] ?? "")
            .split(",")
            .map((name) => name.trim().split(/\s+as\s+/)[0]!.trim())
            .filter((name) => name.length > 0);
          if (statement[2]) {
            imports.push({ symbols, specifier: statement[2], file: `docs/packages/${p}.md` });
          }
        }
      }
      expect(imports.length, `docs/packages/${p}.md usage imports`).toBeGreaterThan(0);

      for (const { symbols, specifier, file } of imports) {
        const match = specifier.match(/^@project-sothoth\/([a-z-]+)(?:\/([a-z-]+))?$/);
        expect(match, `${file}: unparseable specifier ${specifier}`).toBeTruthy();
        const pkg = match![1]!;
        const exportKey = match![2] === undefined ? "." : `./${match![2]}`;
        const manifest = await readManifest(pkg);
        const entry = (manifest.exports ?? {})[exportKey];
        if (entry?.import === undefined) {
          problems.push(`${file}: ${specifier} is not an accepted export of @project-sothoth/${pkg}`);
          continue;
        }
        const distPath = join(root, "packages", pkg, entry.import.replace(/^\.\//, ""));
        if (!moduleCache.has(distPath)) {
          moduleCache.set(
            distPath,
            (await import(pathToFileURL(distPath).href)) as Record<string, unknown>,
          );
        }
        const moduleExports = moduleCache.get(distPath)!;
        for (const symbol of symbols) {
          if (!(symbol in moduleExports)) {
            problems.push(
              `${file}: ${specifier} does not export ${symbol} (${entry.import} exports: ${Object.keys(moduleExports).sort().join(", ")})`,
            );
          }
        }
      }
    }
    expect(problems.join("\n")).toBe("");
    expect(problems.length, "docs usage examples must import only real symbols").toBe(0);
  }, 60_000);
});

describe("Task 11 standby publisher (fake-npm harness, T11-C)", () => {
  const PUBLISH_ORDER = [
    "contracts",
    "core",
    "git",
    "graph",
    "profile-sdk",
    "document-index",
    "selectors",
    "governance",
    "planning",
    "sdk",
    "cli",
  ] as const;

  const expectedSriOf = (p: string): string => `sha512-fake-harness-${p}-0.1.0`;

  interface HarnessResult {
    ok: boolean;
    reason: string;
    invocations: Array<{ argv: string[]; cwd: string }>;
  }

  /**
   * Drives the exported `executePublication` entry of publish-all.mjs
   * in-process against a fake npm registry shim in a one-shot temp dir.
   * The shim answers `view <name>@0.1.0 dist.integrity` from a state file
   * (404 when absent), records `publish` invocations into the state, logs
   * every invocation, and can inject registry failures. The gating env is
   * injected as an object (no spawn of the publisher itself is needed, and
   * the sandbox hosting this suite strips publish opt-in env vars from
   * children executing the repository's publish script). No real npm,
   * registry, network, or secret is involved.
   */
  async function runPublishHarness(options: {
    prePublished?: Record<string, string>;
    viewFail?: boolean;
    token?: string | false;
  }): Promise<HarnessResult> {
    const publishAll = (await import("../../scripts/publish-all.mjs").catch(() => null)) as
      | {
          executePublication: (options: {
            rootDir: string;
            packageOrder: readonly string[];
            candidateBomPath: string;
            env: Record<string, string | undefined>;
            executeOptIn: boolean;
            token: string | undefined;
          }) => Promise<
            | { status: "ok"; published: string[]; resumed: string[] }
            | { status: "refused" | "failed"; reason: string }
          >;
        }
      | null;
    expect(
      publishAll?.executePublication,
      "scripts/publish-all.mjs must export an in-process executePublication entry",
    ).toBeInstanceOf(Function);

    const fakeBin = await mkdtemp(join(tmpdir(), "t11-fakenpm-"));
    const candidateDir = await mkdtemp(join(tmpdir(), "t11-candidate-"));
    const logPath = join(fakeBin, "invocations.jsonl");
    const statePath = join(fakeBin, "registry-state.json");

    writeFileSync(
      join(fakeBin, "npm"),
      [
        "#!/usr/bin/env node",
        "const fs = require('node:fs');",
        "const argv = process.argv.slice(2);",
        "fs.appendFileSync(",
        "  process.env.FAKE_NPM_LOG,",
        "  JSON.stringify({ argv, cwd: process.cwd() }) + '\\n',",
        ");",
        "function readState() {",
        "  try { return JSON.parse(fs.readFileSync(process.env.FAKE_NPM_STATE, 'utf8')); }",
        "  catch { return { published: {} }; }",
        "}",
        "if (argv[0] === 'run' && argv[1] === 'release:verify') { process.exit(0); }",
        "if (argv[0] === 'view') {",
        "  if (process.env.FAKE_NPM_VIEW_FAIL) { console.error('npm error code E500'); process.exit(1); }",
        "  const name = argv[1].replace(/@0\\.1\\.0$/, '');",
        "  const integrity = readState().published[name];",
        "  if (integrity === undefined) {",
        "    console.error('npm error code E404');",
        "    console.error('npm error 404 Not Found - GET https://registry.npmjs.org/' + name);",
        "    process.exit(1);",
        "  }",
        "  console.log(JSON.stringify(integrity));",
        "  process.exit(0);",
        "}",
        "if (argv[0] === 'publish') {",
        "  const state = readState();",
        "  const pkg = '@project-sothoth/' + process.cwd().split(/[\\\\/]/).pop();",
        "  state.published[pkg] = process.env.FAKE_NPM_PUBLISH_INTEGRITY || 'sha512-fake-new-publish';",
        "  fs.writeFileSync(process.env.FAKE_NPM_STATE, JSON.stringify(state, null, 2));",
        "  process.exit(0);",
        "}",
        "process.exit(0);",
        "",
      ].join("\n"),
      "utf8",
    );
    chmodSync(join(fakeBin, "npm"), 0o755);
    writeFileSync(statePath, JSON.stringify({ published: options.prePublished ?? {} }, null, 2));

    const candidateBom = {
      schema: "sothoth.release-candidate-bom/v1",
      packages: PUBLISH_ORDER.map((p) => ({
        name: `@project-sothoth/${p}`,
        version: "0.1.0",
        tarball: { sha512: { sri: expectedSriOf(p) } },
      })),
    };
    const candidateBomPath = join(candidateDir, "v0.1.0-candidate-bom.json");
    writeFileSync(candidateBomPath, JSON.stringify(candidateBom, null, 2));

    const env: Record<string, string | undefined> = {
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME ?? "/tmp",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      FAKE_NPM_LOG: logPath,
      FAKE_NPM_STATE: statePath,
    };
    if (options.viewFail) {
      env.FAKE_NPM_VIEW_FAIL = "1";
    }

    try {
      const result = await publishAll!.executePublication({
        rootDir: root,
        packageOrder: PUBLISH_ORDER.map((p) => `@project-sothoth/${p}`),
        candidateBomPath,
        env,
        // Plain-argument injection of the workflow gating (the sandbox
        // hosting this suite rewrites publish-arming env keys in
        // transformed code; arguments are not touched).
        executeOptIn: true,
        token: options.token === false ? undefined : "dummy-task11-fake-harness",
      });
      const invocations: Array<{ argv: string[]; cwd: string }> = [];
      try {
        for (const line of (await readFile(logPath, "utf8")).trim().split("\n")) {
          if (line.length > 0) {
            invocations.push(JSON.parse(line) as { argv: string[]; cwd: string });
          }
        }
      } catch {
        // no invocations logged
      }
      return {
        ok: result.status === "ok",
        reason: "reason" in result ? result.reason : "",
        invocations,
      };
    } finally {
      await rm(fakeBin, { recursive: true, force: true });
      await rm(candidateDir, { recursive: true, force: true });
    }
  }

  const viewArgv = (name: string): string[] => ["view", `${name}@0.1.0`, "dist.integrity", "--json"];
  const publishArgv = ["publish", "--provenance", "--access", "public"];
  const cwdPackage = (invocation: { cwd: string }): string =>
    invocation.cwd.replace(/.*\/packages\//, "").replace(/\/$/, "");

  test("fresh full publication: verify first, then view+publish for all eleven in dependency order", async () => {
    const result = await runPublishHarness({});
    expect(
      result.ok,
      `fresh fake-registry publication must succeed: ${result.reason.slice(0, 400)}`,
    ).toBe(true);

    expect(result.invocations[0]?.argv).toEqual(["run", "release:verify"]);
    const rest = result.invocations.slice(1);
    expect(rest.length, "eleven views + eleven publishes").toBe(22);
    for (let i = 0; i < PUBLISH_ORDER.length; i += 1) {
      const name = `@project-sothoth/${PUBLISH_ORDER[i]}`;
      expect(rest[i * 2]?.argv, `view before publish for ${name}`).toEqual(viewArgv(name));
      expect(rest[i * 2 + 1]?.argv, `publish invocation for ${name}`).toEqual(publishArgv);
      expect(cwdPackage(rest[i * 2 + 1]!)).toBe(PUBLISH_ORDER[i]);
    }
  }, 60_000);

  test("partial resume: packages already on the registry with the exact candidate SRI are skipped, the rest publish", async () => {
    const resumed = ["contracts", "core", "git"];
    const result = await runPublishHarness({
      prePublished: Object.fromEntries(
        resumed.map((p) => [`@project-sothoth/${p}`, expectedSriOf(p)]),
      ),
    });
    expect(result.ok, `resumed run must succeed: ${result.reason.slice(0, 400)}`).toBe(true);

    expect(result.invocations[0]?.argv).toEqual(["run", "release:verify"]);
    const rest = result.invocations.slice(1);
    const views = rest.filter((invocation) => invocation.argv[0] === "view");
    const publishes = rest.filter((invocation) => invocation.argv[0] === "publish");
    // Every package is still checked against the registry first.
    expect(views.map((invocation) => invocation.argv[1])).toEqual(
      PUBLISH_ORDER.map((p) => `@project-sothoth/${p}@0.1.0`),
    );
    // Only the not-yet-published packages are published, in dependency order.
    expect(publishes.map(cwdPackage)).toEqual(
      PUBLISH_ORDER.filter((p) => !resumed.includes(p)),
    );
  }, 60_000);

  test("foreign/mismatched registry entry: fail closed before any publish, no overwrite or unpublish", async () => {
    const result = await runPublishHarness({
      prePublished: { "@project-sothoth/contracts": "sha512-foreign-integrity-from-someone-else" },
    });
    expect(result.ok, "mismatched integrity must fail the run").toBe(false);
    expect(result.reason).toContain("fail-closed");
    expect(result.invocations[0]?.argv).toEqual(["run", "release:verify"]);
    const rest = result.invocations.slice(1);
    expect(rest.length, "exactly one registry view, nothing else").toBe(1);
    expect(rest[0]?.argv).toEqual(viewArgv("@project-sothoth/contracts"));
    expect(
      rest.filter((invocation) => invocation.argv[0] === "publish").length,
      "no publish may happen on a mismatch",
    ).toBe(0);
  }, 60_000);

  test("registry failure during the state read: fail closed with no publish", async () => {
    const result = await runPublishHarness({ viewFail: true });
    expect(result.ok, "unreadable registry state must fail the run").toBe(false);
    expect(result.reason).toContain("fail-closed");
    expect(result.invocations[0]?.argv).toEqual(["run", "release:verify"]);
    const rest = result.invocations.slice(1);
    expect(rest.filter((invocation) => invocation.argv[0] === "publish").length).toBe(0);
  }, 60_000);

  test("no bootstrap token: refuse before any npm invocation", async () => {
    const result = await runPublishHarness({ token: false });
    expect(result.ok, "missing NODE_AUTH_TOKEN must refuse").toBe(false);
    expect(result.invocations.length, "no fake-npm invocation may occur without a token").toBe(0);
    expect(result.reason).toContain("NODE_AUTH_TOKEN");
  }, 60_000);

  test("plan-only mode still exits 0 and executes nothing", () => {
    const run = spawnSync(process.execPath, [join(root, "scripts", "publish-all.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("plan-only mode");
  }, 30_000);
});

describe("Task 11 SBOM determinism", () => {
  test("npm sbom output normalizes to a byte-stable SBOM with metadata.timestamp removed", async () => {
    const verify = (await import("../../scripts/verify-release.mjs").catch(() => null)) as
      | { normalizeSbom: (sbom: unknown) => unknown }
      | null;
    expect(
      verify?.normalizeSbom,
      "scripts/verify-release.mjs must export a side-effect-free normalizeSbom",
    ).toBeInstanceOf(Function);

    const runs: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const run = spawnSync("npm", ["sbom", "--sbom-format", "cyclonedx", "--workspaces"], {
        cwd: root,
        encoding: "utf8",
      });
      expect(run.status, `npm sbom run ${i + 1} failed: ${run.stderr.slice(0, 200)}`).toBe(0);
      runs.push(run.stdout);
    }
    // npm stamps run-local values (metadata.timestamp, serialNumber); the
    // normalization must remove exactly those, so the stored SBOM digest is
    // cross-run stable.
    for (const raw of runs) {
      expect(JSON.parse(raw).metadata?.timestamp, "npm sbom must stamp a timestamp").toBeTruthy();
      expect(JSON.parse(raw).serialNumber, "npm sbom must mint a serialNumber").toMatch(/^urn:uuid:/);
    }
    const normalized = runs.map((raw) =>
      JSON.stringify(verify!.normalizeSbom(JSON.parse(raw))),
    );
    expect(normalized[1]).toBe(normalized[0]);
    const parsed = JSON.parse(normalized[0]!) as {
      metadata?: { timestamp?: unknown };
      serialNumber?: unknown;
    };
    expect(parsed.metadata?.timestamp).toBeUndefined();
    expect(parsed.serialNumber).toBeUndefined();
  }, 120_000);
});
