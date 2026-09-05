import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as contractsIdentity from "../../packages/contracts/src/identity.js";
import * as contractsSchema from "../../packages/contracts/src/schema.js";
import * as contractsDiagnostic from "../../packages/contracts/src/diagnostics.js";
import * as contractsProjection from "../../packages/contracts/src/projection.js";
import * as contractsPreDesign from "../../packages/contracts/src/pre-design.js";
import * as contractsExtension from "../../packages/contracts/src/extensions.js";
import * as coreCanonicalJson from "../../packages/core/src/canonical-json.js";
import * as coreDigest from "../../packages/core/src/digests.js";
import * as coreDiagnostics from "../../packages/core/src/diagnostics.js";
import * as coreOutcome from "../../packages/core/src/outcome.js";
import * as coreCompile from "../../packages/core/src/compile.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function readJson(relativePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(`${root}/${relativePath}`, "utf8")) as Record<string, unknown>;
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(`${root}/${directory}`, { recursive: true });
  return entries
    .filter((entry) => String(entry).endsWith(".ts"))
    .map((entry) => `${directory}/${entry}`);
}

async function importSpecifiersOf(directory: string): Promise<string[]> {
  const specifiers: string[] = [];
  for (const file of await collectSourceFiles(directory)) {
    const source = await readFile(`${root}/${file}`, "utf8");
    for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier) specifiers.push(specifier);
    }
  }
  return specifiers;
}

describe("accepted public subpaths", () => {
  test("exposes the six accepted @project-sothoth/contracts families", () => {
    expect(contractsIdentity.EXACT_REFERENCE_PATTERN).toBeInstanceOf(RegExp);
    expect(contractsIdentity.DIGEST_PATTERN).toBeInstanceOf(RegExp);
    expect(typeof contractsSchema.validateExactRecordV1).toBe("function");
    expect(typeof contractsDiagnostic.isDiagnosticCodeV1).toBe("function");
    expect(Array.isArray(contractsDiagnostic.DIAGNOSTIC_VERDICTS_V1)).toBe(true);
    expect(Array.isArray(contractsProjection.PRE_DESIGN_PHASES_V1)).toBe(true);
    expect(typeof contractsPreDesign.validateDossierDeclarationV1).toBe("function");
    expect(Array.isArray(contractsPreDesign.DOSSIER_DECLARATION_KINDS_V1)).toBe(true);
    expect(Array.isArray(contractsExtension.CHECK_VERDICTS_V1)).toBe(true);
  });

  test("exposes the five accepted @project-sothoth/core modules", () => {
    expect(typeof coreCanonicalJson.canonicalJson).toBe("function");
    expect(typeof coreCanonicalJson.SothothInputError).toBe("function");
    expect(typeof coreDigest.sha256Digest).toBe("function");
    expect(typeof coreDiagnostics.finalizeDiagnostics).toBe("function");
    expect(typeof coreOutcome.aggregateOutcome).toBe("function");
  });

  test("compile re-exports the authorized compilation primitives without inventing callables", () => {
    expect(typeof coreCompile.canonicalJson).toBe("function");
    expect(typeof coreCompile.sha256Digest).toBe("function");
    expect(typeof coreCompile.finalizeDiagnostics).toBe("function");
    expect(typeof coreCompile.aggregateOutcome).toBe("function");
    expect(coreCompile.canonicalJson).toBe(coreCanonicalJson.canonicalJson);
    expect(coreCompile.sha256Digest).toBe(coreDigest.sha256Digest);
    expect(coreCompile.finalizeDiagnostics).toBe(coreDiagnostics.finalizeDiagnostics);
    expect(coreCompile.aggregateOutcome).toBe(coreOutcome.aggregateOutcome);

    const invented = Object.keys(coreCompile).filter((name) =>
      name.toLowerCase().startsWith("compile"),
    );
    expect(invented).toEqual([]);
  });

  test("package manifests export exactly the accepted subpaths", async () => {
    const contractsManifest = await readJson("packages/contracts/package.json");
    const coreManifest = await readJson("packages/core/package.json");

    expect(Object.keys(contractsManifest.exports ?? {}).sort()).toEqual(
      [
        ".",
        "./identity",
        "./schema",
        "./diagnostic",
        "./projection",
        "./pre-design",
        "./extension",
      ].sort(),
    );
    expect(Object.keys(coreManifest.exports ?? {}).sort()).toEqual(
      [".", "./canonical-json", "./digest", "./compile", "./diagnostics", "./outcome"].sort(),
    );
  });
});

describe("dependency floor and pinned direction", () => {
  test("@project-sothoth/contracts declares zero runtime dependencies", async () => {
    const manifest = await readJson("packages/contracts/package.json");
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
  });

  test("@project-sothoth/core depends only on @project-sothoth/contracts", async () => {
    const manifest = await readJson("packages/core/package.json");
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["@project-sothoth/contracts"]);
  });

  test("@project-sothoth/contracts production sources import nothing outside the package", async () => {
    const specifiers = await importSpecifiersOf("packages/contracts/src");
    const bare = specifiers.filter((specifier) => !specifier.startsWith("."));
    expect(bare).toEqual([]);
  });

  test("@project-sothoth/core production sources import only @project-sothoth/contracts and node:crypto", async () => {
    const specifiers = await importSpecifiersOf("packages/core/src");
    const bare = specifiers.filter((specifier) => !specifier.startsWith("."));
    expect(
      bare.every(
        (specifier) =>
          specifier === "@project-sothoth/contracts" ||
          specifier.startsWith("@project-sothoth/contracts/") ||
          specifier === "node:crypto",
      ),
    ).toBe(true);
    // Node standard-library cryptography is the one sanctioned non-package
    // import; filesystem, process, and network modules are forbidden.
    expect(new Set(bare)).toEqual(new Set(["@project-sothoth/contracts", "node:crypto"]));
  });
});
