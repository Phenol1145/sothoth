// §11 conformance rows routed to S: T9, T9a, T10–T21. Every fixture is the
// exact plan literal; spans are the parser-verified values pinned by §8.2/§8.3.

import { describe, expect, test } from "vitest";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  parseDocumentV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/parse.js";
import { bindStableSectionsV1 } from "../../packages/document-index/src/sections.js";
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

function parse(content: string, overrides: Partial<DocumentSourceV1> = {}) {
  return parseDocumentV1(sourceWith(content, overrides), BUDGETS);
}

const MARKER_PURPOSE = '<!-- sothoth:section id="purpose" -->';

describe("bindStableSectionsV1 (T9–T21)", () => {
  test("T9: marker binds across blank lines with exact spans", () => {
    const parsed = parse(`${MARKER_PURPOSE}\n\n## Purpose`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = bindStableSectionsV1(parsed);
    expect(result).toEqual({
      ok: true,
      sections: [
        {
          sectionId: "purpose",
          markerSpan: {
            startLine: 1,
            startColumn: 1,
            startOffset: 0,
            endLine: 1,
            endColumn: 38,
            endOffset: 37,
          },
          headingId: "A#h1",
          headingSpan: {
            startLine: 3,
            startColumn: 1,
            startOffset: 39,
            endLine: 3,
            endColumn: 11,
            endOffset: 49,
          },
        },
      ],
    });
  });

  test("T9a: marker adjacency across a definition rejects at the exact marker span", () => {
    const fixture = `${MARKER_PURPOSE}\n\n[id]: https://example.com\n\n## Purpose`;
    const parsed = parse(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // The definition is represented as a block node (T43's projection).
    expect(parsed.parsed.nodes[1]).toEqual({
      type: "block",
      blockKind: "definition",
      span: {
        startLine: 3,
        startColumn: 1,
        startOffset: 39,
        endLine: 3,
        endColumn: 26,
        endOffset: 64,
      },
    });
    const result = bindStableSectionsV1(parsed);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/marker-not-followed-by-heading",
          subject: "purpose",
          location: {
            artifactId: "A",
            span: {
              startLine: 1,
              startColumn: 1,
              startOffset: 0,
              endLine: 1,
              endColumn: 38,
              endOffset: 37,
            },
          },
        },
      ],
    });
  });

  test("T10: marker binds immediately on the next line", () => {
    const parsed = parse(`${MARKER_PURPOSE}\n## Purpose`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = bindStableSectionsV1(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]!.sectionId).toBe("purpose");
      expect(result.sections[0]!.headingSpan).toEqual({
        startLine: 2,
        startColumn: 1,
        startOffset: 38,
        endLine: 2,
        endColumn: 11,
        endOffset: 48,
      });
    }
  });

  test("T11: heading rename keeps sectionId and headingId, changes the anchor", () => {
    const first = parse(`${MARKER_PURPOSE}\n\n## Purpose`);
    const second = parse(`${MARKER_PURPOSE}\n\n## Why this exists`);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const sectionsFirst = bindStableSectionsV1(first);
    const sectionsSecond = bindStableSectionsV1(second);
    expect(sectionsFirst.ok && sectionsSecond.ok).toBe(true);
    if (sectionsFirst.ok && sectionsSecond.ok) {
      expect(sectionsFirst.sections[0]!.sectionId).toBe("purpose");
      expect(sectionsSecond.sections[0]!.sectionId).toBe("purpose");
      expect(sectionsFirst.sections[0]!.headingId).toBe("A#h1");
      expect(sectionsSecond.sections[0]!.headingId).toBe("A#h1");
    }
    const anchorsFirst = deriveHeadingAnchorsV1(first);
    const anchorsSecond = deriveHeadingAnchorsV1(second);
    expect(anchorsFirst.ok && anchorsSecond.ok).toBe(true);
    if (anchorsFirst.ok && anchorsSecond.ok) {
      expect(anchorsFirst.headings[0]!.anchor).toBe("purpose");
      expect(anchorsSecond.headings[0]!.anchor).toBe("why-this-exists");
    }
  });

  test("T12: an intervening node rejects binding with the located marker span", () => {
    const parsed = parse(`${MARKER_PURPOSE}\nplain text\n\n## Purpose`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = bindStableSectionsV1(parsed);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/marker-not-followed-by-heading",
          subject: "purpose",
          location: {
            artifactId: "A",
            span: {
              startLine: 1,
              startColumn: 1,
              startOffset: 0,
              endLine: 1,
              endColumn: 38,
              endOffset: 37,
            },
          },
        },
      ],
    });
  });

  test("T13: EOF after a lone marker rejects with the located marker span", () => {
    const marker = '<!-- sothoth:section id="lonely" -->';
    const parsed = parse(marker);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = bindStableSectionsV1(parsed);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/marker-not-followed-by-heading",
          subject: "lonely",
          location: {
            artifactId: "A",
            span: {
              startLine: 1,
              startColumn: 1,
              startOffset: 0,
              endLine: 1,
              endColumn: 37,
              endOffset: 36,
            },
          },
        },
      ],
    });
  });

  test("T14: fenced code, list, and thematic break next siblings all reject", () => {
    const marker = '<!-- sothoth:section id="a" -->';
    const located = {
      artifactId: "A",
      span: {
        startLine: 1,
        startColumn: 1,
        startOffset: 0,
        endLine: 1,
        endColumn: 32,
        endOffset: 31,
      },
    };
    for (const tail of ["\n```\ncode\n```", "\n\n- item", "\n\n---"]) {
      const parsed = parse(`${marker}${tail}`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const result = bindStableSectionsV1(parsed);
      expect(result).toEqual({
        ok: false,
        issues: [
          {
            code: "sothoth.document-index/marker-not-followed-by-heading",
            subject: "a",
            location: located,
          },
        ],
      });
    }
  });

  test("T15: non-exact comment forms are ignored with no issues", () => {
    for (const marker of [
      '<!--sothoth:section id="a" -->',
      '<!-- sothoth:section id="b"-->',
      '<!--  sothoth:section id="c"  -->',
    ]) {
      const parsed = parse(`${marker}\n\n## A`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const result = bindStableSectionsV1(parsed);
      expect(result).toEqual({ ok: true, sections: [] });
    }
  });

  test("T16: indented markers are ignored (3-space html value, 4-space code block)", () => {
    const threeSpace = parse('   <!-- sothoth:section id="a" -->\n\n## A');
    expect(threeSpace.ok).toBe(true);
    if (threeSpace.ok) {
      // The html value keeps its leading spaces and therefore never matches.
      expect(threeSpace.parsed.nodes[0]).toEqual({
        type: "html",
        value: '   <!-- sothoth:section id="a" -->',
        span: {
          startLine: 1,
          startColumn: 1,
          startOffset: 0,
          endLine: 1,
          endColumn: 35,
          endOffset: 34,
        },
      });
      expect(bindStableSectionsV1(threeSpace)).toEqual({ ok: true, sections: [] });
    }
    const fourSpace = parse('    <!-- sothoth:section id="a" -->\n\n## A');
    expect(fourSpace.ok).toBe(true);
    if (fourSpace.ok) {
      expect(fourSpace.parsed.nodes[0]!.type).toBe("block");
      expect(bindStableSectionsV1(fourSpace)).toEqual({ ok: true, sections: [] });
    }
  });

  test("T17: marker text inside a fenced code block produces no section", () => {
    const parsed = parse('```\n<!-- sothoth:section id="x" -->\n```\n\n## Real');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(bindStableSectionsV1(parsed)).toEqual({ ok: true, sections: [] });
    const anchors = deriveHeadingAnchorsV1(parsed);
    expect(anchors.ok).toBe(true);
    if (anchors.ok) {
      expect(anchors.headings).toEqual([
        {
          headingId: "A#h1",
          depth: 2,
          text: "Real",
          anchor: "real",
          span: {
            startLine: 5,
            startColumn: 1,
            startOffset: 41,
            endLine: 5,
            endColumn: 8,
            endOffset: 48,
          },
        },
      ]);
    }
  });

  test("T18: markers nested in a blockquote or list are ignored at root level", () => {
    const quoted = parse('> <!-- sothoth:section id="q" -->\n> ## Inner\n\n## Outer');
    expect(quoted.ok).toBe(true);
    if (quoted.ok) {
      expect(bindStableSectionsV1(quoted)).toEqual({ ok: true, sections: [] });
    }
    const listed = parse('- <!-- sothoth:section id="l" -->\n- ## Inner');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(bindStableSectionsV1(listed)).toEqual({ ok: true, sections: [] });
    }
  });

  test("T19: stacked markers reject the first and bind the last", () => {
    const parsed = parse(
      '<!-- sothoth:section id="c" -->\n<!-- sothoth:section id="d" -->\n\n## H',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = bindStableSectionsV1(parsed);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/marker-not-followed-by-heading",
          subject: "c",
          location: {
            artifactId: "A",
            span: {
              startLine: 1,
              startColumn: 1,
              startOffset: 0,
              endLine: 1,
              endColumn: 32,
              endOffset: 31,
            },
          },
        },
      ],
    });
  });

  test("T20: duplicate section ids fail the later occurrence at its own marker span", () => {
    const parsed = parse(
      '<!-- sothoth:section id="dup" -->\n\n## One\n\n<!-- sothoth:section id="dup" -->\n\n## Two',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = bindStableSectionsV1(parsed);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/duplicate-section-id",
          subject: "dup",
          location: {
            artifactId: "A",
            span: {
              startLine: 5,
              startColumn: 1,
              startOffset: 43,
              endLine: 5,
              endColumn: 34,
              endOffset: 76,
            },
          },
        },
      ],
    });
  });

  test("T21: CRLF and CR-only line endings bind with exact spans", () => {
    const crlf = parse('# T\r\n\r\n<!-- sothoth:section id="a" -->\r\n\r\n## A\r\n');
    expect(crlf.ok).toBe(true);
    if (crlf.ok) {
      const result = bindStableSectionsV1(crlf);
      expect(result).toEqual({
        ok: true,
        sections: [
          {
            sectionId: "a",
            markerSpan: {
              startLine: 3,
              startColumn: 1,
              startOffset: 7,
              endLine: 3,
              endColumn: 32,
              endOffset: 38,
            },
            headingId: "A#h2",
            headingSpan: {
              startLine: 5,
              startColumn: 1,
              startOffset: 42,
              endLine: 5,
              endColumn: 5,
              endOffset: 46,
            },
          },
        ],
      });
    }
    const crOnly = parse('# T\r\r<!-- sothoth:section id="a" -->\r\r## A\r');
    expect(crOnly.ok).toBe(true);
    if (crOnly.ok) {
      const result = bindStableSectionsV1(crOnly);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sections).toHaveLength(1);
        expect(result.sections[0]!.sectionId).toBe("a");
      }
    }
  });
});
