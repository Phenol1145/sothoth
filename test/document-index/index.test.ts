// §11 conformance rows routed to I: T28, T29, T30, T31, T41, T44, T45, T46,
// T49. T38 (full regression) is the whole-suite command gate executed by the
// verification step. Cache witnesses are built only through
// `buildBlobCacheEntryV1`; forgery clones canonical bytes and recomputes the
// digest through Core, never through the function under test.

import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  type DeclaredRelationV1,
  type DocumentIndexBudgetsV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/parse.js";
import {
  buildDocumentIndexV1,
  type CompilerIdentityV1,
} from "../../packages/document-index/src/index.js";
import { buildBlobCacheEntryV1 } from "../../packages/document-index/src/cache.js";
import type { BlobCacheEntryV1 } from "../../packages/document-index/src/cache.js";

const BUDGETS = DEFAULT_DOCUMENT_INDEX_BUDGETS_V1;
const COMPILER: CompilerIdentityV1 = { compilerId: "test-compiler", compilerRevision: 1 };
const OTHER_COMPILER: CompilerIdentityV1 = { compilerId: "other-compiler", compilerRevision: 1 };

// Two headings ("Shared" ordinal 1, "Alpha" ordinal 2) and one marker binding
// the second, so witness fixtures exercise headings and sections alike.
const SHARED_CONTENT = '# Shared\n\n<!-- sothoth:section id="alpha" -->\n\n## Alpha\n';

function digestOf(content: string): string {
  return sha256Digest(content);
}

function sourceWith(content: string, overrides: Partial<DocumentSourceV1> = {}): DocumentSourceV1 {
  return {
    artifactId: "A",
    path: "docs/a.md",
    version: "1",
    content,
    contentDigest: digestOf(content),
    blobSha: null,
    kind: "doc",
    status: "active",
    owner: "team",
    tags: [],
    references: [],
    ...overrides,
  };
}

function build(
  sources: readonly DocumentSourceV1[],
  cache?: readonly BlobCacheEntryV1[],
  budgets: DocumentIndexBudgetsV1 = BUDGETS,
  compiler: CompilerIdentityV1 = COMPILER,
) {
  return buildDocumentIndexV1({ sources: [...sources], budgets, compiler, cache });
}

function canonicalBytes(projection: { readonly [key: string]: unknown }): string {
  return canonicalJson(projection);
}

function entryOf(
  source: DocumentSourceV1,
  compiler: CompilerIdentityV1 = COMPILER,
): BlobCacheEntryV1 {
  const built = buildBlobCacheEntryV1(source, BUDGETS, compiler);
  if (!built.ok) {
    throw new Error("cache fixture builder must succeed");
  }
  return built.entry;
}

/** Clones an entry, fabricates its headings, and recomputes its digest with Core. */
function forgedEntry(source: DocumentSourceV1, compiler: CompilerIdentityV1 = COMPILER): BlobCacheEntryV1 {
  const cloned = JSON.parse(canonicalJson(entryOf(source, compiler))) as BlobCacheEntryV1;
  const value = cloned.value as {
    headings: Array<{ ordinal: number; depth: number; text: string; anchor: string }>;
    derivationDigest: string;
  };
  for (const heading of value.headings) {
    heading.text = `Forged ${heading.ordinal}`;
    heading.anchor = `forged-${heading.ordinal}`;
  }
  const digestInput = { ...value } as Record<string, unknown>;
  delete digestInput.derivationDigest;
  value.derivationDigest = sha256Digest(canonicalJson(digestInput));
  return cloned;
}

describe("buildDocumentIndexV1 cache semantics (T28, T29, T44–T46, T49)", () => {
  test("T28: projection bytes are neutral across miss, verified hit, and deletion", () => {
    const source = sourceWith(SHARED_CONTENT);
    const witness = entryOf(source);
    const miss = build([source]);
    const hit = build([source], [witness]);
    const deleted = build([source], []);
    const crossCompiler = build([source], [entryOf(source, OTHER_COMPILER)]);
    expect(miss.ok && hit.ok && deleted.ok && crossCompiler.ok).toBe(true);
    if (!miss.ok || !hit.ok || !deleted.ok || !crossCompiler.ok) return;
    const missBytes = canonicalBytes(miss.projection);
    expect(canonicalBytes(hit.projection)).toBe(missBytes);
    expect(canonicalBytes(deleted.projection)).toBe(missBytes);
    expect(canonicalBytes(crossCompiler.projection)).toBe(missBytes);
    expect(hit.projection.indexDigest).toBe(miss.projection.indexDigest);

    // Phase 1–2 cache errors stay independent of any source's fresh outcome:
    // a corrupt entry fails the invocation even though the source derives fine.
    const corrupt = JSON.parse(canonicalJson(witness)) as BlobCacheEntryV1;
    const corruptValue = corrupt.value as { contentDigest: string; derivationDigest: string };
    corruptValue.contentDigest = "sha256:" + "0".repeat(64);
    const corruptInput = { ...corrupt.value } as Record<string, unknown>;
    delete corruptInput.derivationDigest;
    corruptValue.derivationDigest = sha256Digest(canonicalJson(corruptInput));
    expect(build([source], [corrupt])).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/cache-entry-corrupt",
          subject: "cache[0]",
          location: null,
        },
      ],
    });
  });

  test("T29: tampered payloads, malformed keys, and hostile accessors fail typed", () => {
    const source = sourceWith(SHARED_CONTENT);
    const witness = entryOf(source);

    const tampered = JSON.parse(canonicalJson(witness)) as BlobCacheEntryV1;
    (tampered.value as { headings: Array<{ text: string }> }).headings[0]!.text = "Tampered";
    expect(build([source], [tampered])).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/cache-entry-corrupt",
          subject: "cache[0]",
          location: null,
        },
      ],
    });

    const malformedKey = {
      key: { contentDigest: "not-a-digest" },
      value: witness.value,
    } as unknown as BlobCacheEntryV1;
    expect(build([source], [malformedKey])).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/invalid-cache-key",
          subject: "cache[0].key",
          location: null,
        },
      ],
    });

    expect(build([source], [witness, witness])).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/invalid-cache-key",
          subject: "cache[1].key",
          location: null,
        },
      ],
    });

    let keyGetterRuns = 0;
    const hostileKey: Record<string, unknown> = {};
    Object.defineProperty(hostileKey, "key", {
      enumerable: true,
      get() {
        keyGetterRuns += 1;
        throw new Error("getter must never run");
      },
    });
    const hostileKeyResult = build([source], [hostileKey as unknown as BlobCacheEntryV1]);
    expect(keyGetterRuns).toBe(0);
    expect(hostileKeyResult).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/invalid-cache-key",
          subject: "cache[0].key",
          location: null,
        },
      ],
    });

    let valueGetterRuns = 0;
    const hostileValue = { key: witness.key, value: {} };
    Object.defineProperty(hostileValue, "value", {
      enumerable: true,
      get() {
        valueGetterRuns += 1;
        throw new Error("getter must never run");
      },
    });
    const hostileValueResult = build([source], [hostileValue as unknown as BlobCacheEntryV1]);
    expect(valueGetterRuns).toBe(0);
    expect(hostileValueResult).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/cache-entry-corrupt",
          subject: "cache[0]",
          location: null,
        },
      ],
    });
  });

  test("T30: shuffled sources, tags, and key order yield byte-identical projections", () => {
    const first = sourceWith("# One\n", { artifactId: "B", path: "docs/b.md", tags: ["b", "á", "A"] });
    const second = sourceWith("# Two\n", { artifactId: "A", tags: ["b", "á", "A"] });
    const forward = build([first, second]);
    const backward = build([second, first]);
    expect(forward.ok && backward.ok).toBe(true);
    if (!forward.ok || !backward.ok) return;
    expect(canonicalBytes(backward.projection)).toBe(canonicalBytes(forward.projection));
    expect(backward.projection.indexDigest).toBe(forward.projection.indexDigest);
    for (const projection of [forward.projection, backward.projection]) {
      for (const entry of projection.documents) {
        expect([...entry.tags]).toEqual(["A", "b", "á"]);
      }
    }
    // Reordered object keys are the same JSON value.
    const reordered = JSON.parse(canonicalJson(forward.projection)) as unknown;
    expect(canonicalJson(reordered)).toBe(canonicalJson(forward.projection));
  });

  test("T31: every digest is independently recomputable over its exact input", () => {
    const alpha = sourceWith(SHARED_CONTENT, { artifactId: "A" });
    const beta = sourceWith("# Beta\n", {
      artifactId: "B",
      path: "docs/b.md",
      references: [
        {
          kind: "reference",
          role: "dep",
          target: { artifactId: "A", revision: null, external: false },
        } satisfies DeclaredRelationV1,
      ],
    });
    const result = build([alpha, beta]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { projection } = result;
    for (const document of projection.documents) {
      const { entryDigest, ...entryRest } = document;
      expect(entryRest).toHaveProperty("schema", "sothoth.document-index/document-index@1");
      expect(sha256Digest(canonicalJson(entryRest))).toBe(entryDigest);
    }
    const { indexDigest, ...projectionRest } = projection;
    expect(Object.keys(projectionRest).sort()).toEqual(["documents", "provenance", "schema"]);
    expect(sha256Digest(canonicalJson(projectionRest))).toBe(indexDigest);
    expect(digestOf("## Purpose")).toBe(
      "sha256:b8abb0502b2e5eabf3d1897be030442198f634793c1d63b5ce6b1cc1b4005f34",
    );
    expect(projection.provenance.compiler).toEqual(COMPILER);
    expect(projection.provenance.budgets).toEqual(BUDGETS);
    expect(projection.provenance.inputs.map((input) => input.artifactId)).toEqual(["A", "B"]);
  });

  test("T41: located issues never coalesce across documents", () => {
    const dupContent =
      '<!-- sothoth:section id="dup" -->\n\n## One\n\n<!-- sothoth:section id="dup" -->\n\n## Two';
    const laterSpan = {
      startLine: 5,
      startColumn: 1,
      startOffset: 43,
      endLine: 5,
      endColumn: 34,
      endOffset: 76,
    };
    const both = build([
      sourceWith(dupContent, { artifactId: "A" }),
      sourceWith(dupContent, { artifactId: "B", path: "docs/b.md" }),
    ]);
    expect(both.ok).toBe(false);
    if (both.ok) return;
    expect(both.issues).toEqual([
      {
        code: "sothoth.document-index/duplicate-section-id",
        subject: "dup",
        location: { artifactId: "A", span: laterSpan },
      },
      {
        code: "sothoth.document-index/duplicate-section-id",
        subject: "dup",
        location: { artifactId: "B", span: laterSpan },
      },
    ]);
    const fixedA = build([
      sourceWith('<!-- sothoth:section id="dup" -->\n\n## One', { artifactId: "A" }),
      sourceWith(dupContent, { artifactId: "B", path: "docs/b.md" }),
    ]);
    expect(fixedA.ok).toBe(false);
    if (fixedA.ok) return;
    expect(fixedA.issues).toEqual([
      {
        code: "sothoth.document-index/duplicate-section-id",
        subject: "dup",
        location: { artifactId: "B", span: laterSpan },
      },
    ]);
  });

  test("T44: one witness serves two same-content documents without leaking identity", () => {
    const sourceA = sourceWith(SHARED_CONTENT, { artifactId: "A" });
    const sourceB = sourceWith(SHARED_CONTENT, { artifactId: "B", path: "docs/b.md" });
    const fromA = entryOf(sourceA);
    const fromB = entryOf(sourceB);
    expect(canonicalJson(fromB.value)).toBe(canonicalJson(fromA.value));
    expect(canonicalJson(fromA.value)).not.toContain('"A"');
    expect(canonicalJson(fromA.value)).not.toContain('"B"');
    const withCacheA = build([sourceA], [fromA]);
    const withCacheB = build([sourceB], [fromA]);
    const noCacheA = build([sourceA]);
    const noCacheB = build([sourceB]);
    expect(withCacheA.ok && withCacheB.ok && noCacheA.ok && noCacheB.ok).toBe(true);
    if (!withCacheA.ok || !withCacheB.ok || !noCacheA.ok || !noCacheB.ok) return;
    expect(canonicalBytes(withCacheA.projection)).toBe(canonicalBytes(noCacheA.projection));
    expect(canonicalBytes(withCacheB.projection)).toBe(canonicalBytes(noCacheB.projection));
    expect(withCacheA.projection.documents[0]!.artifactId).toBe("A");
    expect(withCacheA.projection.documents[0]!.headings[0]!.headingId).toBe("A#h1");
    expect(withCacheB.projection.documents[0]!.artifactId).toBe("B");
    expect(withCacheB.projection.documents[0]!.headings[0]!.headingId).toBe("B#h1");
    expect(withCacheA.projection.documents[0]!.sections[0]!.headingId).toBe("A#h2");
    expect(withCacheB.projection.documents[0]!.sections[0]!.headingId).toBe("B#h2");
  });

  test("T45: a forged but self-consistent witness is rejected by fresh comparison", () => {
    const source = sourceWith(SHARED_CONTENT);
    expect(build([source], [forgedEntry(source)])).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/cache-entry-corrupt",
          subject: "cache[0]",
          location: null,
        },
      ],
    });
  });

  test("T46: a tight current budget fails identically with and without a matching hit", () => {
    const source = sourceWith(SHARED_CONTENT);
    const witness = entryOf(source);
    const tight: DocumentIndexBudgetsV1 = { ...BUDGETS, maxAstNodes: 1 };
    const withoutCache = build([source], undefined, tight);
    const withCache = build([source], [witness], tight);
    expect(withoutCache).toEqual(withCache);
    expect(withoutCache).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/budget-exhausted",
          subject: "sources[0]",
          location: null,
        },
      ],
    });
  });

  test("T49a: a fresh structural failure skips its cache comparison entirely", () => {
    const lost = '<!-- sothoth:section id="lost" -->\n\nplain paragraph text';
    const source = sourceWith(lost);
    const result = build([source], [forgedEntry(source)]);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/marker-not-followed-by-heading",
          subject: "lost",
          location: {
            artifactId: "A",
            span: { startLine: 1, startColumn: 1, startOffset: 0, endLine: 1, endColumn: 35, endOffset: 34 },
          },
        },
      ],
    });
  });

  test("T49b: the per-source skip leaves other sources' cache comparisons active", () => {
    const lost = '<!-- sothoth:section id="lost" -->\n\nplain paragraph text';
    const failedSource = sourceWith(lost, { artifactId: "A" });
    const cleanSource = sourceWith("# Clean\n", { artifactId: "B", path: "docs/b.md" });
    const result = build([failedSource, cleanSource], [
      forgedEntry(failedSource),
      forgedEntry(cleanSource),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Total §9 order: cache-entry-corrupt sorts before marker-not-followed…
    expect(result.issues).toEqual([
      {
        code: "sothoth.document-index/cache-entry-corrupt",
        subject: "cache[1]",
        location: null,
      },
      {
        code: "sothoth.document-index/marker-not-followed-by-heading",
        subject: "lost",
        location: {
          artifactId: "A",
          span: { startLine: 1, startColumn: 1, startOffset: 0, endLine: 1, endColumn: 35, endOffset: 34 },
        },
      },
    ]);
  });
});
