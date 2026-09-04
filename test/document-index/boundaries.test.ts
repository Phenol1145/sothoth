// §11 conformance rows routed to B: T1, T2, T3, T35, T36, T37, T39, T48.
// T35/T36/T39 pair these in-suite resolution/structure pins with the
// command-level clean-checkout run, the post-build physical Node smoke
// through the real exports map, and `npm run typecheck`/`npm run build`.

import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import * as diParse from "../../packages/document-index/src/parse.js";
import * as diSections from "../../packages/document-index/src/sections.js";
import * as diAnchors from "../../packages/document-index/src/anchors.js";
import * as diReferences from "../../packages/document-index/src/references.js";
import * as diIndex from "../../packages/document-index/src/index.js";
import * as diCache from "../../packages/document-index/src/cache.js";
import type * as ParseTypes from "../../packages/document-index/src/parse.js";
import type * as SectionsTypes from "../../packages/document-index/src/sections.js";
import type * as AnchorsTypes from "../../packages/document-index/src/anchors.js";
import type * as ReferencesTypes from "../../packages/document-index/src/references.js";
import type * as IndexTypes from "../../packages/document-index/src/index.js";
import type * as CacheTypes from "../../packages/document-index/src/cache.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

// §6.1 type-level export closure pins: each listed type is imported and used
// in a value-shaped position, so a missing or renamed export fails to compile.
const typePins: unknown[] = [
  ((): ParseTypes.SourceSpanV1 => ({
    startLine: 1,
    startColumn: 1,
    startOffset: 0,
    endLine: 1,
    endColumn: 1,
    endOffset: 0,
  }))(),
  ((): ParseTypes.StructuralIssueCodeV1 => "sothoth.document-index/invalid-input")(),
  ((): ParseTypes.LocatedStructuralIssueCodeV1 =>
    "sothoth.document-index/duplicate-section-id")(),
  ((): ParseTypes.StructuralIssueLocationV1 => ({
    artifactId: "A",
    span: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
  }))(),
  ((): ParseTypes.StructuralIssueV1 => ({
    code: "sothoth.document-index/invalid-input",
    subject: "input",
    location: null,
  }))(),
  ((): ParseTypes.DocumentIndexFailureV1 => ({ ok: false, issues: [] }))(),
  ((): ParseTypes.DocumentIndexBudgetsV1 => ({
    maxContentCodeUnits: 1,
    maxDocuments: 1,
    maxAstNodes: 1,
    maxRelationsPerDocument: 1,
    maxHeadingTextCodeUnits: 1,
  }))(),
  ((): ParseTypes.HeadingDepthV1 => 1)(),
  ((): ParseTypes.ParsedBlockNodeV1 => ({
    type: "block",
    blockKind: "paragraph",
    span: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
  }))(),
  ((): ParseTypes.ParsedDocumentV1 => ({ artifactId: "A", nodes: [] }))(),
  ((): ParseTypes.NormalizedSourceSnapshotV1 => ({
    artifactId: "A",
    path: "p",
    version: "1",
    contentDigest: "sha256:" + "0".repeat(64),
    blobSha: null,
    kind: "k",
    status: "s",
    owner: "o",
    tags: [],
    relations: [],
  }))(),
  ((): ParseTypes.RelationTargetV1 => ({ artifactId: "B", revision: null, external: false }))(),
  ((): ParseTypes.DeclaredRelationV1 => ({
    kind: "reference",
    role: "r",
    target: { artifactId: "B", revision: null, external: false },
  }))(),
  ((): ParseTypes.DocumentSourceV1 => ({
    artifactId: "A",
    path: "p",
    version: "1",
    content: "",
    contentDigest: "sha256:" + "0".repeat(64),
    blobSha: null,
    kind: "k",
    status: "s",
    owner: "o",
    tags: [],
    references: [],
  }))(),
  ((): ParseTypes.ParseDocumentSuccessV1 => ({
    ok: true,
    source: {
      artifactId: "A",
      path: "p",
      version: "1",
      contentDigest: "sha256:" + "0".repeat(64),
      blobSha: null,
      kind: "k",
      status: "s",
      owner: "o",
      tags: [],
      relations: [],
    },
    parsed: { artifactId: "A", nodes: [] },
  }))(),
  ((): ParseTypes.ParseDocumentResultV1 => ({ ok: false, issues: [] }))(),
  ((): SectionsTypes.StableSectionRecordV1 => ({
    sectionId: "s",
    markerSpan: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
    headingId: "A#h1",
    headingSpan: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
  }))(),
  ((): SectionsTypes.SectionsSuccessV1 => ({ ok: true, sections: [] }))(),
  ((): SectionsTypes.SectionsResultV1 => ({ ok: false, issues: [] }))(),
  ((): AnchorsTypes.HeadingRecordV1 => ({
    headingId: "A#h1",
    depth: 1,
    text: "t",
    anchor: "t",
    span: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
  }))(),
  ((): AnchorsTypes.AnchorsSuccessV1 => ({ ok: true, headings: [] }))(),
  ((): AnchorsTypes.AnchorsResultV1 => ({ ok: false, issues: [] }))(),
  ((): ReferencesTypes.ResolvedRelationRecordV1 => ({
    relationId: "{}",
    fromArtifactId: "A",
    kind: "reference",
    role: "r",
    target: { artifactId: "B", revision: null, external: false },
  }))(),
  ((): ReferencesTypes.RelationGraphSnapshotV1 => ({ relationOrder: [] }))(),
  ((): ReferencesTypes.ReferencesSuccessV1 => ({
    ok: true,
    relations: [],
    graph: { relationOrder: [] },
  }))(),
  ((): ReferencesTypes.ReferencesResultV1 => ({ ok: false, issues: [] }))(),
  ((): IndexTypes.CompilerIdentityV1 => ({ compilerId: "c", compilerRevision: 1 }))(),
  ((): IndexTypes.DocumentIndexInputV1 => ({
    sources: [],
    budgets: {
      maxContentCodeUnits: 1,
      maxDocuments: 1,
      maxAstNodes: 1,
      maxRelationsPerDocument: 1,
      maxHeadingTextCodeUnits: 1,
    },
    compiler: { compilerId: "c", compilerRevision: 1 },
  }))(),
  ((): IndexTypes.DocumentEntryV1 => ({
    schema: "sothoth.document-index/document-index@1",
    artifactId: "A",
    path: "p",
    version: "1",
    kind: "k",
    status: "s",
    owner: "o",
    tags: [],
    contentDigest: "sha256:" + "0".repeat(64),
    blobSha: null,
    headings: [],
    sections: [],
    relations: [],
    entryDigest: "sha256:" + "0".repeat(64),
  }))(),
  ((): IndexTypes.IndexProvenanceV1 => ({
    compiler: { compilerId: "c", compilerRevision: 1 },
    budgets: {
      maxContentCodeUnits: 1,
      maxDocuments: 1,
      maxAstNodes: 1,
      maxRelationsPerDocument: 1,
      maxHeadingTextCodeUnits: 1,
    },
    inputs: [],
  }))(),
  ((): IndexTypes.DocumentIndexProjectionV1 => ({
    schema: "sothoth.document-index/document-index@1",
    documents: [],
    provenance: {
      compiler: { compilerId: "c", compilerRevision: 1 },
      budgets: {
        maxContentCodeUnits: 1,
        maxDocuments: 1,
        maxAstNodes: 1,
        maxRelationsPerDocument: 1,
        maxHeadingTextCodeUnits: 1,
      },
      inputs: [],
    },
    indexDigest: "sha256:" + "0".repeat(64),
  }))(),
  ((): IndexTypes.DocumentIndexSuccessV1 => ({
    ok: true,
    projection: {
      schema: "sothoth.document-index/document-index@1",
      documents: [],
      provenance: {
        compiler: { compilerId: "c", compilerRevision: 1 },
        budgets: {
          maxContentCodeUnits: 1,
          maxDocuments: 1,
          maxAstNodes: 1,
          maxRelationsPerDocument: 1,
          maxHeadingTextCodeUnits: 1,
        },
        inputs: [],
      },
      indexDigest: "sha256:" + "0".repeat(64),
    },
  }))(),
  ((): IndexTypes.DocumentIndexResultV1 => ({ ok: false, issues: [] }))(),
  ((): CacheTypes.BlobCacheKeyV1 => ({
    contentDigest: "sha256:" + "0".repeat(64),
    compiler: { compilerId: "c", compilerRevision: 1 },
  }))(),
  ((): CacheTypes.CachedHeadingDerivationV1 => ({
    ordinal: 1,
    depth: 1,
    text: "t",
    anchor: "t",
    span: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
  }))(),
  ((): CacheTypes.CachedSectionDerivationV1 => ({
    sectionId: "s",
    markerSpan: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
    headingOrdinal: 1,
    headingSpan: {
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 1,
      endColumn: 1,
      endOffset: 0,
    },
  }))(),
  ((): CacheTypes.CachedDocumentDerivationV1 => ({
    schema: "sothoth.document-index/blob-cache-entry@1",
    contentDigest: "sha256:" + "0".repeat(64),
    nodes: [],
    headings: [],
    sections: [],
    derivationDigest: "sha256:" + "0".repeat(64),
  }))(),
  ((): CacheTypes.BlobCacheEntryV1 => ({
    key: { contentDigest: "sha256:" + "0".repeat(64), compiler: { compilerId: "c", compilerRevision: 1 } },
    value: {
      schema: "sothoth.document-index/blob-cache-entry@1",
      contentDigest: "sha256:" + "0".repeat(64),
      nodes: [],
      headings: [],
      sections: [],
      derivationDigest: "sha256:" + "0".repeat(64),
    },
  }))(),
  ((): CacheTypes.BlobCacheEntrySuccessV1 => ({
    ok: true,
    entry: {
      key: { contentDigest: "sha256:" + "0".repeat(64), compiler: { compilerId: "c", compilerRevision: 1 } },
      value: {
        schema: "sothoth.document-index/blob-cache-entry@1",
        contentDigest: "sha256:" + "0".repeat(64),
        nodes: [],
        headings: [],
        sections: [],
        derivationDigest: "sha256:" + "0".repeat(64),
      },
    },
  }))(),
  ((): CacheTypes.BlobCacheEntryResultV1 => ({ ok: false, issues: [] }))(),
];

async function collectSources(subdirectory: string): Promise<string[]> {
  const entries = await readdir(`${root}/packages/document-index/src/${subdirectory}`, {
    recursive: true,
  });
  return entries
    .map((entry) => String(entry))
    .filter((entry) => entry.endsWith(".ts"))
    .sort();
}

describe("package boundary (T1–T3, T35–T37, T39, T48)", () => {
  test("T1: the exports map resolves exactly the six accepted subpaths", () => {
    const probe = `
      const out = [];
      for (const sub of ["parse", "sections", "anchors", "references", "index", "cache"]) {
        out.push(import.meta.resolve("@sothoth/document-index/" + sub));
      }
      let bare = "";
      try { import.meta.resolve("@sothoth/document-index"); } catch (error) { bare = error.code; }
      console.log(JSON.stringify({ out, bare }));
    `;
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: `${root}/packages/document-index`,
      encoding: "utf8",
    });
    const resolution = JSON.parse(stdout) as { out: string[]; bare: string };
    const repo = root.endsWith("/") ? root.slice(0, -1) : root;
    expect(resolution.out).toEqual([
      `file://${repo}/packages/document-index/dist/parse.js`,
      `file://${repo}/packages/document-index/dist/sections.js`,
      `file://${repo}/packages/document-index/dist/anchors.js`,
      `file://${repo}/packages/document-index/dist/references.js`,
      `file://${repo}/packages/document-index/dist/index.js`,
      `file://${repo}/packages/document-index/dist/cache.js`,
    ]);
    expect(resolution.bare).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
  });

  test("T2: runtime and type export sets are exactly the §6.1 matrix", async () => {
    expect(Object.keys(diParse).sort()).toEqual([
      "DEFAULT_DOCUMENT_INDEX_BUDGETS_V1",
      "parseDocumentV1",
    ]);
    expect(Object.keys(diSections).sort()).toEqual(["bindStableSectionsV1"]);
    expect(Object.keys(diAnchors).sort()).toEqual(["deriveHeadingAnchorsV1"]);
    expect(Object.keys(diReferences).sort()).toEqual(["resolveDocumentRelationsV1"]);
    expect(Object.keys(diIndex).sort()).toEqual(["buildDocumentIndexV1"]);
    expect(Object.keys(diCache).sort()).toEqual(["buildBlobCacheEntryV1"]);
    expect(typePins).toHaveLength(40);
    // No obsolete sketch modules and no root barrel exist.
    const allTop = await readdir(`${root}/packages/document-index/src`);
    const topLevel = allTop.filter((entry) => entry.endsWith(".ts")).sort();
    expect(topLevel).toEqual(["anchors.ts", "cache.ts", "index.ts", "parse.ts", "references.ts", "sections.ts"]);
    const internal = await readdir(`${root}/packages/document-index/src/internal`).filter?.((entry) => entry.endsWith(".ts")).sort() ?? (await readdir(`${root}/packages/document-index/src/internal`)).sort();
    expect(internal).toEqual(["code-point.ts", "immutable.ts", "markdown.ts", "validation.ts"]);
  });

  test("T3: the import boundary and parser pin match §10.1 exactly", async () => {
    const manifest = JSON.parse(
      await readFile(`${root}/node_modules/mdast-util-from-markdown/package.json`, "utf8"),
    ) as { version: string };
    expect(manifest.version).toBe("2.0.2");

    const topLevel = await collectSources(".");
    const internal = await collectSources("internal");
    const files = [
      ...topLevel.map((entry) => `packages/document-index/src/${entry}`),
      ...internal.map((entry) => `packages/document-index/src/internal/${entry}`),
    ].sort();
    const externalImports = new Map<string, string[]>();
    for (const relativePath of files) {
      const text = await readFile(`${root}/${relativePath}`, "utf8");
      for (const match of text.matchAll(/import\s+(?:type\s+)?[^;]*?from\s+["']([^"']+)["']/g)) {
        const specifier = match[1]!;
        if (!specifier.startsWith(".")) {
          const seen = externalImports.get(specifier) ?? [];
          if (!seen.includes(relativePath)) {
            seen.push(relativePath);
          }
          externalImports.set(specifier, seen);
        }
      }
      const forbidden: Array<[RegExp, string]> = [
        [/from\s*"node:/, "node builtin import"],
        [/\bprocess\.\w/, "process reference"],
        [/\bDate\.\w/, "clock reference"],
        [/\bperformance\.\w/, "clock reference"],
        [/Math\.random/, "random reference"],
        [/localeCompare\(/, "locale collation"],
        [/\bIntl\./, "locale reference"],
        [/toLocale\w*\(/, "locale reference"],
        [/\btoLowerCase\(/, "locale-folded casing"],
        [/\btoUpperCase\(/, "locale-folded casing"],
        [/\bimport\s*\(\s*["'`A-Za-z_.]/, "dynamic import"],
      ];
      for (const [pattern, label] of forbidden) {
        expect(text.match(pattern), `${relativePath} must not contain ${label}`).toBeNull();
      }
    }
    expect([...externalImports.keys()].sort()).toEqual([
      "@sothoth/contracts",
      "@sothoth/core/canonical-json",
      "@sothoth/core/digest",
      "@sothoth/graph/digraph",
      "mdast-util-from-markdown",
    ]);
    expect(externalImports.get("@sothoth/contracts")).toEqual([
      "packages/document-index/src/internal/markdown.ts",
      "packages/document-index/src/internal/validation.ts",
    ]);
    expect(externalImports.get("@sothoth/core/canonical-json")).toEqual([
      "packages/document-index/src/internal/validation.ts",
    ]);
    expect(externalImports.get("@sothoth/core/digest")).toEqual([
      "packages/document-index/src/internal/validation.ts",
    ]);
    expect(externalImports.get("mdast-util-from-markdown")).toEqual([
      "packages/document-index/src/internal/markdown.ts",
    ]);
    // The package's single Graph value import is a runtime import of
    // createCanonicalGraphV1 inside the internal resolution unit (§6.1).
    const validationSource = await readFile(
      `${root}/packages/document-index/src/internal/validation.ts`,
      "utf8",
    );
    expect(validationSource).toMatch(
      /import\s*\{[^}]*createCanonicalGraphV1[^}]*\}\s*from\s*"@sothoth\/graph\/digraph"/,
    );
   });

  test("T35: test resolution loads package sources, never ignored build output", () => {
    // The imported module identities live under src/, so the suite passes on
    // a clean checkout with every dist/ tree absent (the command-level half
    // of T35 runs `npm test -- test/document-index` with dist/ absent).
    expect(diParse.parseDocumentV1).toBeTypeOf("function");
    expect(String(fileURLToPath(import.meta.url))).toContain(`${root}test/document-index/`);
  });

  test("T36 proxy: exports targets are the physical dist entrypoints", () => {
    // T1 resolved the six subpaths to dist/*.js through the real exports map;
    // the physical import smoke runs as a post-build Node command (T36).
    const exportsMap = JSON.parse(
      // Read through the manifest to keep the assertion independent of Node's cache.
      execFileSync(process.execPath, ["-e", "console.log(JSON.stringify(require('./package.json').exports))"], {
        cwd: `${root}/packages/document-index`,
        encoding: "utf8",
      }),
    ) as Record<string, { import: string }>;
    expect(Object.keys(exportsMap).sort()).toEqual([
      "./anchors",
      "./cache",
      "./index",
      "./parse",
      "./references",
      "./sections",
    ]);
    expect(exportsMap["./parse"]!.import).toBe("./dist/parse.js");
  });

  test("T37: no prose-substring shortcuts exist in the implementation", async () => {
    const topLevel = await collectSources(".");
    const internal = await collectSources("internal");
    const files = [
      ...topLevel.map((entry) => `packages/document-index/src/${entry}`),
      ...internal.map((entry) => `packages/document-index/src/internal/${entry}`),
    ].sort();
    for (const relativePath of files) {
      const text = await readFile(`${root}/${relativePath}`, "utf8");
      expect(text.match(/indexOf\(/), `${relativePath} uses indexOf`).toBeNull();
      expect(text.match(/includes\(/), `${relativePath} uses includes`).toBeNull();
      expect(text.match(/\.slice\(/), `${relativePath} uses slice`).toBeNull();
      expect(text.match(/sothoth:section/), `${relativePath} hardcodes the marker literal`).toBeNull();
    }
  });

  test("T48: relation revision is recorded verbatim and never compared", () => {
    const content = "# T\n";
    const source = {
      artifactId: "A",
      path: "docs/a.md",
      version: "anything",
      content,
      contentDigest: sha256Digest(content),
      blobSha: null,
      kind: "doc",
      status: "active",
      owner: "team",
      tags: [],
      references: [
        {
          kind: "supersession",
          target: { artifactId: "A", revision: 7, external: false },
        },
      ],
    } as const;
    const parsed = diParse.parseDocumentV1(source, diParse.DEFAULT_DOCUMENT_INDEX_BUDGETS_V1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const resolved = diReferences.resolveDocumentRelationsV1([parsed]);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.relations).toHaveLength(1);
    expect(JSON.parse(resolved.relations[0]!.relationId)).toEqual({
      from: "A",
      kind: "supersession",
      role: null,
      to: "A",
      revision: 7,
    });
  });
});
