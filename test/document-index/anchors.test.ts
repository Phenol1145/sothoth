// §11 conformance rows routed to A: T22, T23, T24. Anchor literals are the
// hand-derived §8.4 values, including the `what-yes--no-v2` double-hyphen
// contract value (no post-normalization trim or hyphen collapse exists).

import { describe, expect, test } from "vitest";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  parseDocumentV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/parse.js";
import { deriveHeadingAnchorsV1 } from "../../packages/document-index/src/anchors.js";

const BUDGETS = DEFAULT_DOCUMENT_INDEX_BUDGETS_V1;

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

function anchorsOf(content: string): { ok: true; anchors: string[]; texts: string[] } | { ok: false } {
  const parsed = parseDocumentV1(sourceWith(content), BUDGETS);
  if (!parsed.ok) return { ok: false };
  const result = deriveHeadingAnchorsV1(parsed);
  if (!result.ok) return { ok: false };
  return {
    ok: true,
    anchors: result.headings.map((heading) => heading.anchor),
    texts: result.headings.map((heading) => heading.text),
  };
}

describe("deriveHeadingAnchorsV1 (T22–T24)", () => {
  test("T22: the exact §8.4 anchor normalization table", () => {
    expect(anchorsOf("# Hello World\n")).toEqual({
      ok: true,
      anchors: ["hello-world"],
      texts: ["Hello World"],
    });
    expect(anchorsOf("## Purpose")).toEqual({
      ok: true,
      anchors: ["purpose"],
      texts: ["Purpose"],
    });
    expect(anchorsOf("## Café Ünicode 🎉 heading")).toEqual({
      ok: true,
      anchors: ["café-Ünicode-🎉-heading"],
      texts: ["Café Ünicode 🎉 heading"],
    });
    expect(anchorsOf("## What? Yes & No! (v2)")).toEqual({
      ok: true,
      anchors: ["what-yes--no-v2"],
      texts: ["What? Yes & No! (v2)"],
    });
    expect(anchorsOf("## Some *emphasis* and `code` and [link](x) text")).toEqual({
      ok: true,
      anchors: ["some-emphasis-and-code-and-link-text"],
      texts: ["Some emphasis and code and link text"],
    });
    expect(anchorsOf("Line one\nLine two\n---")).toEqual({
      ok: true,
      anchors: ["line-one-line-two"],
      texts: ["Line one\nLine two"],
    });
    expect(anchorsOf("## !!!")).toEqual({
      ok: true,
      anchors: ["heading"],
      texts: ["!!!"],
    });
  });

  test("T23: duplicate bases disambiguate and suffix escalation keeps uniqueness", () => {
    expect(anchorsOf("# Details\n\n# Details\n\n# Details")).toEqual({
      ok: true,
      anchors: ["details", "details-2", "details-3"],
      texts: ["Details", "Details", "Details"],
    });
    // The literal `heading` base is a second occurrence of the same base, so
    // it receives the k-th candidate instead of colliding.
    expect(anchorsOf("# Heading\n\n# !!!")).toEqual({
      ok: true,
      anchors: ["heading", "heading-2"],
      texts: ["Heading", "!!!"],
    });
    // A real `details-2` anchor claimed by a different base forces the third
    // `Details` heading's suffix escalation past its natural candidate.
    expect(anchorsOf("# Details\n\n# Details-2\n\n# Details")).toEqual({
      ok: true,
      anchors: ["details", "details-2", "details-3"],
      texts: ["Details", "Details-2", "Details"],
    });
  });

  test("T24: Setext and ATX headings are equivalent with the exact Setext span", () => {
    const setext = parseDocumentV1(sourceWith("Title\n====="), BUDGETS);
    const atx = parseDocumentV1(sourceWith("# Title"), BUDGETS);
    expect(setext.ok && atx.ok).toBe(true);
    if (!setext.ok || !atx.ok) return;
    const anchorsSetext = deriveHeadingAnchorsV1(setext);
    const anchorsAtx = deriveHeadingAnchorsV1(atx);
    expect(anchorsSetext.ok && anchorsAtx.ok).toBe(true);
    if (!anchorsSetext.ok || !anchorsAtx.ok) return;
    expect(anchorsSetext.headings).toHaveLength(1);
    expect(anchorsAtx.headings).toHaveLength(1);
    expect(anchorsSetext.headings[0]!.depth).toBe(1);
    expect(anchorsSetext.headings[0]!.text).toBe("Title");
    expect(anchorsSetext.headings[0]!.anchor).toBe("title");
    expect(anchorsAtx.headings[0]!.anchor).toBe("title");
    // The Setext span covers the text plus the underline.
    expect(anchorsSetext.headings[0]!.span).toEqual({
      startLine: 1,
      startColumn: 1,
      startOffset: 0,
      endLine: 2,
      endColumn: 6,
      endOffset: 11,
    });
  });
});
