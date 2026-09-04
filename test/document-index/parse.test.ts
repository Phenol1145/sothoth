// §11 conformance rows routed to P: T4, T5, T6, T7, T8, T43.
// Expected constants come from authoritative owners: digests are recomputed
// with Core (`sha256Digest`, itself conformance-tested), never through the
// function under test.

import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  parseDocumentV1,
  type DocumentIndexBudgetsV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/parse.js";
import { bindStableSectionsV1 } from "../../packages/document-index/src/sections.js";
import { deriveHeadingAnchorsV1 } from "../../packages/document-index/src/anchors.js";
import { resolveDocumentRelationsV1 } from "../../packages/document-index/src/references.js";
import { buildDocumentIndexV1 } from "../../packages/document-index/src/index.js";
import type { CompilerIdentityV1 } from "../../packages/document-index/src/index.js";

const BUDGETS = DEFAULT_DOCUMENT_INDEX_BUDGETS_V1;
const COMPILER: CompilerIdentityV1 = { compilerId: "test-compiler", compilerRevision: 1 };

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

describe("parseDocumentV1 (T4, T5, T6, T8, T43)", () => {
  test("T4: minimal ATX parse yields one exact heading node", () => {
    const result = parseDocumentV1(sourceWith("# Hello World\n"), BUDGETS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.artifactId).toBe("A");
    expect(result.parsed.nodes).toEqual([
      {
        type: "heading",
        depth: 1,
        text: "Hello World",
        span: {
          startLine: 1,
          startColumn: 1,
          startOffset: 0,
          endLine: 1,
          endColumn: 14,
          endOffset: 13,
        },
      },
    ]);
    expect(result.source.contentDigest).toBe(digestOf("# Hello World\n"));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.parsed.nodes)).toBe(true);
    expect(Object.isFrozen(result.parsed.nodes[0])).toBe(true);
  });

  test("T5: verified digest succeeds; wrong digest fails with one exact issue", () => {
    const ok = parseDocumentV1(sourceWith("## Purpose"), BUDGETS);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.source.contentDigest).toBe(
        "sha256:b8abb0502b2e5eabf3d1897be030442198f634793c1d63b5ce6b1cc1b4005f34",
      );
    }
    const bad = parseDocumentV1(
      sourceWith("## Purpose", {
        contentDigest: digestOf("## Other"),
      }),
      BUDGETS,
    );
    expect(bad).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/content-digest-mismatch",
          subject: "sources[0].contentDigest",
          location: null,
        },
      ],
    });
  });

  test("T6: empty document parses to zero nodes and every later stage is empty", () => {
    const parsed = parseDocumentV1(sourceWith(""), BUDGETS);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parsed.nodes).toEqual([]);
    const sections = bindStableSectionsV1(parsed);
    expect(sections).toEqual({ ok: true, sections: [] });
    const anchors = deriveHeadingAnchorsV1(parsed);
    expect(anchors).toEqual({ ok: true, headings: [] });
    const references = resolveDocumentRelationsV1([parsed]);
    expect(references).toEqual({ ok: true, relations: [], graph: { relationOrder: [] } });
    const index = buildDocumentIndexV1({
      sources: [sourceWith("")],
      budgets: BUDGETS,
      compiler: COMPILER,
    });
    expect(index.ok).toBe(true);
    if (index.ok) {
      expect(index.projection.documents).toHaveLength(1);
      const entry = index.projection.documents[0]!;
      expect(entry.artifactId).toBe("A");
      expect(entry.headings).toEqual([]);
      expect(entry.sections).toEqual([]);
      expect(entry.relations).toEqual([]);
    }
  });

  test("T7: empty input set succeeds with the exact schema-inclusive indexDigest", () => {
    const result = buildDocumentIndexV1({
      sources: [],
      budgets: BUDGETS,
      compiler: COMPILER,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection.documents).toEqual([]);
    expect(result.projection.schema).toBe("sothoth.document-index/document-index@1");
    const { indexDigest, ...rest } = result.projection;
    expect(sha256Digest(canonicalJson(rest))).toBe(indexDigest);
    // Independently recompute the exact digest input: the schema literal is part of it.
    expect(
      sha256Digest(
        canonicalJson({
          schema: "sothoth.document-index/document-index@1",
          documents: [],
          provenance: result.projection.provenance,
        }),
      ),
    ).toBe(indexDigest);
  });

  test("T8: content budget exhaustion precedes digest and parse with one exact issue", () => {
    const tight: DocumentIndexBudgetsV1 = { ...BUDGETS, maxContentCodeUnits: 2 };
    const result = parseDocumentV1(
      sourceWith("abc", { contentDigest: digestOf("different content") }),
      tight,
    );
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/budget-exhausted",
          subject: "sources[0].content",
          location: null,
        },
      ],
    });
  });

  test("T43: a CommonMark definition projects as one exact block node", () => {
    const result = parseDocumentV1(sourceWith("[id]: https://example.com\n"), BUDGETS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.nodes).toEqual([
      {
        type: "block",
        blockKind: "definition",
        span: {
          startLine: 1,
          startColumn: 1,
          startOffset: 0,
          endLine: 1,
          endColumn: 26,
          endOffset: 25,
        },
      },
    ]);
  });
});
