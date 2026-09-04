// §11 conformance rows routed to C: T47, plus the cache-side witnesses of
// T28/T44/T45/T49 whose fixtures live with the cache module under test.

import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  type DocumentIndexBudgetsV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/parse.js";
import { buildBlobCacheEntryV1 } from "../../packages/document-index/src/cache.js";
import type { CompilerIdentityV1 } from "../../packages/document-index/src/index.js";

const BUDGETS = DEFAULT_DOCUMENT_INDEX_BUDGETS_V1;
const COMPILER: CompilerIdentityV1 = { compilerId: "test-compiler", compilerRevision: 1 };

const CONTENT = '# Shared\n\n<!-- sothoth:section id="alpha" -->\n\n## Alpha\n';

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

describe("buildBlobCacheEntryV1 (T47)", () => {
  test("T47: derives directly from the source alone with an exact closed value", () => {
    const source = sourceWith(CONTENT);
    const result = buildBlobCacheEntryV1(source, BUDGETS, COMPILER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { entry } = result;
    // The key is exactly one blob identity and one compiler identity.
    expect(entry.key).toEqual({ contentDigest: digestOf(CONTENT), compiler: COMPILER });
    // The value is the exact content-neutral derivation: root nodes,
    // ordinal-keyed headings, ordinal-linked sections, digest.
    expect(Object.keys(entry.value)).toEqual([
      "schema",
      "contentDigest",
      "nodes",
      "headings",
      "sections",
      "derivationDigest",
    ]);
    expect(entry.value.schema).toBe("sothoth.document-index/blob-cache-entry@1");
    expect(entry.value.contentDigest).toBe(digestOf(CONTENT));
    expect(entry.value.nodes).toHaveLength(3);
    expect(entry.value.headings).toEqual([
      {
        ordinal: 1,
        depth: 1,
        text: "Shared",
        anchor: "shared",
        span: {
          startLine: 1,
          startColumn: 1,
          startOffset: 0,
          endLine: 1,
          endColumn: 9,
          endOffset: 8,
        },
      },
      {
        ordinal: 2,
        depth: 2,
        text: "Alpha",
        anchor: "alpha",
        span: {
          startLine: 5,
          startColumn: 1,
          startOffset: 47,
          endLine: 5,
          endColumn: 9,
          endOffset: 55,
        },
      },
    ]);
    expect(entry.value.sections).toEqual([
      {
        sectionId: "alpha",
        markerSpan: {
          startLine: 3,
          startColumn: 1,
          startOffset: 10,
          endLine: 3,
          endColumn: 36,
          endOffset: 45,
        },
        headingOrdinal: 2,
        headingSpan: {
          startLine: 5,
          startColumn: 1,
          startOffset: 47,
          endLine: 5,
          endColumn: 9,
          endOffset: 55,
        },
      },
    ]);
    // The derivation digest is integrity over the value minus its own field.
    const digestInput = { ...entry.value } as Record<string, unknown>;
    delete digestInput.derivationDigest;
    expect(sha256Digest(canonicalJson(digestInput))).toBe(entry.value.derivationDigest);
    // No artifact identity leaks anywhere in the value bytes.
    expect(canonicalJson(entry.value)).not.toContain('"A"');
    expect(canonicalJson(entry.value)).not.toContain("docs/a.md");
    // The result is deeply frozen.
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.key)).toBe(true);
    expect(Object.isFrozen(entry.value)).toBe(true);
    expect(Object.isFrozen(entry.value.nodes)).toBe(true);
    expect(Object.isFrozen(entry.value.headings)).toBe(true);
    expect(Object.isFrozen(entry.value.sections)).toBe(true);
  });

  test("T47: the builder validates and fails closed without any stage-result parameter", () => {
    // The public signature accepts exactly source, budgets, compiler.
    expect(buildBlobCacheEntryV1).toHaveLength(3);
    // Digest verification: wrong declared digest fails closed.
    expect(
      buildBlobCacheEntryV1(
        sourceWith(CONTENT, { contentDigest: digestOf("other") }),
        BUDGETS,
        COMPILER,
      ),
    ).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/content-digest-mismatch",
          subject: "sources[0].contentDigest",
          location: null,
        },
      ],
    });
    // Budget enforcement on the direct path.
    const tight: DocumentIndexBudgetsV1 = { ...BUDGETS, maxHeadingTextCodeUnits: 3 };
    expect(buildBlobCacheEntryV1(sourceWith("## Longer heading"), tight, COMPILER)).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/budget-exhausted",
          subject: "sources[0]",
          location: null,
        },
      ],
    });
    // Hostile compiler identity fails typed.
    expect(
      buildBlobCacheEntryV1(sourceWith(CONTENT), BUDGETS, { compilerId: "", compilerRevision: 1 }),
    ).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/invalid-field",
          subject: "input.compiler.compilerId",
          location: null,
        },
      ],
    });
    // Relation resolution is never cached: the value carries no relations.
    const withRelation = sourceWith(CONTENT, {
      references: [
        {
          kind: "reference",
          role: "dep",
          target: { artifactId: "A", revision: null, external: false },
        },
      ],
    });
    const built = buildBlobCacheEntryV1(withRelation, BUDGETS, COMPILER);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(Object.keys(built.entry.value)).not.toContain("relations");
    }
  });
});
