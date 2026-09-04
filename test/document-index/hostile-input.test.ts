// §11 conformance rows routed to H: T32, T33, T34, T40, T42. Hostile inputs
// fail closed through descriptor-only reads: zero getter executions, exact
// §9 codes and subjects, no native exception escaping any public function.

import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  parseDocumentV1,
  type DocumentIndexBudgetsV1,
  type DocumentSourceV1,
  type ParseDocumentResultV1,
  type SourceSpanV1,
  type StructuralIssueCodeV1,
} from "../../packages/document-index/src/parse.js";
import { bindStableSectionsV1 } from "../../packages/document-index/src/sections.js";
import { deriveHeadingAnchorsV1 } from "../../packages/document-index/src/anchors.js";
import { resolveDocumentRelationsV1 } from "../../packages/document-index/src/references.js";
import {
  buildDocumentIndexV1,
  type CompilerIdentityV1,
} from "../../packages/document-index/src/index.js";

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

function issue(code: StructuralIssueCodeV1, subject: string, location: unknown = null) {
  return { code, subject, location };
}

const SPAN: SourceSpanV1 = {
  startLine: 1,
  startColumn: 1,
  startOffset: 0,
  endLine: 1,
  endColumn: 5,
  endOffset: 4,
};

/** Iteratively asserts every container of a value is frozen. */
function assertDeeplyFrozen(value: unknown): void {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== "object") {
      continue;
    }
    expect(Object.isFrozen(current)).toBe(true);
    for (const child of Object.values(current as Record<string, unknown>)) {
      stack.push(child);
    }
  }
}

describe("hostile objects (T32)", () => {
  test("T32: accessors on known fields fail closed without executing getters", () => {
    let runs = 0;
    const hostile: Record<string, unknown> = {};
    for (const [key, value] of Object.entries({
      artifactId: "A",
      path: "docs/a.md",
      version: "1",
      content: "# H\n",
      contentDigest: digestOf("# H\n"),
      blobSha: null,
      kind: "doc",
      status: "active",
      owner: "team",
      tags: [],
      references: [],
    })) {
      if (key === "artifactId") {
        Object.defineProperty(hostile, key, {
          enumerable: true,
          get() {
            runs += 1;
            throw new Error("getter must never run");
          },
        });
      } else {
        hostile[key] = value;
      }
    }
    const result = parseDocumentV1(hostile as unknown as DocumentSourceV1, BUDGETS);
    expect(runs).toBe(0);
    expect(result).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "sources[0].artifactId")],
    });
  });

  test("T32: symbol keys and own __proto__ data keys are unknown fields", () => {
    const symbolKey = Symbol("stowaway");
    const withSymbol: Record<string | symbol, unknown> = {
      ...sourceWith("# H\n"),
      [symbolKey]: 1,
    } as Record<string | symbol, unknown>;
    expect(parseDocumentV1(withSymbol as unknown as DocumentSourceV1, BUDGETS)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/unknown-field", "sources[0][symbol:stowaway]")],
    });

    const withProto = JSON.parse('{"artifactId":"A"}') as Record<string, unknown>;
    withProto.artifactId = "A";
    const hostileProto: Record<string, unknown> = { ...sourceWith("# H\n") };
    Object.defineProperty(hostileProto, "__proto__", {
      value: { danger: true },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    void withProto;
    expect(parseDocumentV1(hostileProto as unknown as DocumentSourceV1, BUDGETS)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/unknown-field", "sources[0].__proto__")],
    });
  });

  test("T32: sparse and decorated arrays and non-plain objects fail closed", () => {
    const sparse: DocumentSourceV1[] = Array(2);
    sparse[1] = sourceWith("# H\n");
    expect(
      buildDocumentIndexV1({ sources: sparse, budgets: BUDGETS, compiler: COMPILER }),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-input", "input.sources")],
    });

    const decorated = sourceWith("# H\n");
    (decorated.tags as string[] & { extra?: unknown }).extra = "stowaway";
    expect(parseDocumentV1(decorated, BUDGETS)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "sources[0].tags")],
    });

    class NotPlain {
      artifactId = "A";
    }
    expect(parseDocumentV1(new NotPlain() as unknown as DocumentSourceV1, BUDGETS)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-input", "sources[0]")],
    });
  });

  test("T32: cyclic containers cannot loop a walk", () => {
    const cyclic: unknown[] = ["x"];
    cyclic.push(cyclic);
    expect(
      parseDocumentV1(
        sourceWith("# H\n", { tags: cyclic as unknown as readonly string[] }),
        BUDGETS,
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "sources[0].tags")],
    });
  });
});

describe("stack safety, freeze, and isolation (T33)", () => {
  test(
    "T33: a 100,000-block document completes every stage without RangeError",
    () => {
    const blocks = Array.from({ length: 100_000 }, () => "# H");
    const content = `${blocks.join("\n")}\n`;
    const source = sourceWith(content);
    const parsed = parseDocumentV1(source, BUDGETS);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parsed.nodes).toHaveLength(100_000);
    expect(bindStableSectionsV1(parsed).ok).toBe(true);
    const anchors = deriveHeadingAnchorsV1(parsed);
    expect(anchors.ok).toBe(true);
    if (anchors.ok) {
      expect(anchors.headings).toHaveLength(100_000);
    }
    expect(resolveDocumentRelationsV1([parsed]).ok).toBe(true);
    const index = buildDocumentIndexV1({ sources: [source], budgets: BUDGETS, compiler: COMPILER });
    expect(index.ok).toBe(true);
    if (index.ok) {
      assertDeeplyFrozen(index);
      expect(index.projection.documents[0]!.headings).toHaveLength(100_000);
    }
    // Caller input is not frozen, is unmutated, and shares nothing with results.
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(parsed.parsed.nodes)).toBe(true);
    assertDeeplyFrozen(parsed);
    const tags: string[] = [];
    const probed = sourceWith("# H\n", { tags });
    const probedResult = parseDocumentV1(probed, BUDGETS);
    tags.push("later-mutation");
    expect(probedResult.ok).toBe(true);
    if (probedResult.ok) {
      expect(probedResult.source.tags).toEqual([]);
      expect(probedResult.source.tags).not.toBe(tags);
    }
    },
    60_000,
  );
});

describe("budget dimensions and invalid grammar paths (T34)", () => {
  function tight(overrides: Partial<DocumentIndexBudgetsV1>): DocumentIndexBudgetsV1 {
    return { ...BUDGETS, ...overrides };
  }

  test("T34: each budget dimension fails with its exact subject", () => {
    expect(parseDocumentV1(sourceWith("abc"), tight({ maxContentCodeUnits: 2 }))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/budget-exhausted", "sources[0].content")],
    });
    expect(parseDocumentV1(sourceWith("# H\n"), tight({ maxAstNodes: 1 }))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/budget-exhausted", "sources[0]")],
    });
    expect(
      parseDocumentV1(sourceWith("# Longer heading"), tight({ maxHeadingTextCodeUnits: 3 })),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/budget-exhausted", "sources[0]")],
    });
    expect(
      parseDocumentV1(
        sourceWith("# H\n", {
          references: [
            { kind: "supersession", target: { artifactId: "A", revision: null, external: false } },
            { kind: "traceability", target: { artifactId: "B", revision: null, external: true } },
          ],
        }),
        tight({ maxRelationsPerDocument: 1 }),
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/budget-exhausted", "sources[0].references")],
    });
    expect(
      buildDocumentIndexV1({
        sources: [
          sourceWith("# A\n", { artifactId: "A" }),
          sourceWith("# B\n", { artifactId: "B", path: "docs/b.md" }),
        ],
        budgets: tight({ maxDocuments: 1 }),
        compiler: COMPILER,
      }),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/budget-exhausted", "input.sources")],
    });
  });

  test("T34: malformed normalized paths fail with invalid-field", () => {
    for (const bad of ["/abs", "a/../b", "a//b", "a/", "a\\b", "a\u0000b", "C:x"]) {
      expect(parseDocumentV1(sourceWith("# H\n", { path: bad }), BUDGETS)).toEqual({
        ok: false,
        issues: [issue("sothoth.document-index/invalid-field", "sources[0].path")],
      });
    }
  });

  test("T34: malformed digest, blobSha, revision, and status shapes fail typed", () => {
    expect(
      parseDocumentV1(
        sourceWith("# H\n", { contentDigest: `sha256:${"g".repeat(64)}` }),
        BUDGETS,
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "sources[0].contentDigest")],
    });
    for (const bad of ["xyz", "a".repeat(39), "A".repeat(40), "a".repeat(41), "a".repeat(63), "a".repeat(65)]) {
      expect(parseDocumentV1(sourceWith("# H\n", { blobSha: bad }), BUDGETS)).toEqual({
        ok: false,
        issues: [issue("sothoth.document-index/invalid-field", "sources[0].blobSha")],
      });
    }
    for (const bad of [0, -1, 1.5, 2 ** 53]) {
      expect(
        parseDocumentV1(
          sourceWith("# H\n", {
            references: [
              {
                kind: "reference",
                role: "dep",
                target: { artifactId: "A", revision: bad, external: false },
              },
            ],
          }),
          BUDGETS,
        ),
      ).toEqual({
        ok: false,
        issues: [issue("sothoth.document-index/invalid-field", "sources[0].references[0].target.revision")],
      });
    }
    expect(parseDocumentV1(sourceWith("# H\n", { status: "" }), BUDGETS)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "sources[0].status")],
    });
  });
});

describe("closed fifteen-code vocabulary (T40)", () => {
  test("T40: a grammar-compatible sixteenth code is rejected at runtime and statically", () => {
    // @ts-expect-error the closed union has no sixteenth member
    const sixteenth: StructuralIssueCodeV1 = "sothoth.document-index/whatever";
    void sixteenth;
    const crafted = {
      ok: false,
      issues: [{ code: "sothoth.document-index/whatever", subject: "x", location: null }],
    } as unknown as ParseDocumentResultV1;
    expect(bindStableSectionsV1(crafted)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0].code")],
    });
  });
});

describe("crafted stage envelopes (T42)", () => {
  const markerFailure = () => ({
    ok: false,
    issues: [
      {
        code: "sothoth.document-index/marker-not-followed-by-heading",
        subject: "s",
        location: { artifactId: "A", span: SPAN },
      },
    ],
  });

  function craft(issues: unknown, extra: Record<string, unknown> = {}): ParseDocumentResultV1 {
    return { ok: false, issues, ...extra } as unknown as ParseDocumentResultV1;
  }

  test("T42: issues container violations fail at parsed.issues", () => {
    expect(bindStableSectionsV1(craft([]))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues")],
    });
    const entry = { code: "sothoth.document-index/invalid-input", subject: "x", location: null };
    const sparse: unknown[] = [entry];
    delete sparse[0];
    expect(bindStableSectionsV1(craft(sparse))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues")],
    });
    const decorated: unknown[] = [{ code: "sothoth.document-index/invalid-input", subject: "x", location: null }];
    (decorated as Record<string, unknown>).extra = 1;
    expect(bindStableSectionsV1(craft(decorated))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues")],
    });
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(bindStableSectionsV1(craft(cyclic))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0]")],
    });
  });

  test("T42: location/code correspondence is exact in both directions", () => {
    expect(
      bindStableSectionsV1(
        craft([{ code: "sothoth.document-index/marker-not-followed-by-heading", subject: "s", location: null }]),
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0].location")],
    });
    expect(
      bindStableSectionsV1(
        craft([
          {
            code: "sothoth.document-index/invalid-input",
            subject: "parsed",
            location: { artifactId: "A", span: SPAN },
          },
        ]),
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0].location")],
    });
  });

  test("T42: bad spans, extra fields, and accessors fail with exact codes", () => {
    // §8.1.2 phase 8 anchors location violations at the location field itself.
    const badSpan = { ...SPAN, startOffset: 5, endOffset: 2 };
    expect(
      bindStableSectionsV1(
        craft([
          {
            code: "sothoth.document-index/marker-not-followed-by-heading",
            subject: "s",
            location: { artifactId: "A", span: badSpan },
          },
        ]),
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0].location")],
    });
    const nonInteger = { ...SPAN, startOffset: 1.5 };
    expect(
      bindStableSectionsV1(
        craft([
          {
            code: "sothoth.document-index/marker-not-followed-by-heading",
            subject: "s",
            location: { artifactId: "A", span: nonInteger },
          },
        ]),
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0].location")],
    });
    expect(
      bindStableSectionsV1(
        craft([{ code: "sothoth.document-index/invalid-input", subject: "x", location: null, extra: 1 }]),
      ),
    ).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/unknown-field", "parsed.issues[0].extra")],
    });
    expect(bindStableSectionsV1(craft(markerFailure().issues, { extra: "x" }))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/unknown-field", "parsed.extra")],
    });

    let runs = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "code", {
      enumerable: true,
      get() {
        runs += 1;
        throw new Error("getter must never run");
      },
    });
    accessor.subject = "x";
    accessor.location = null;
    expect(bindStableSectionsV1(craft([accessor]))).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.issues[0].code")],
    });
    expect(runs).toBe(0);
  });

  test("T42: duplicate issues coalesce and valid failures forward canonically", () => {
    const duplicated = [
      { code: "sothoth.document-index/invalid-input", subject: "parsed", location: null },
      { code: "sothoth.document-index/invalid-input", subject: "parsed", location: null },
    ];
    const result = bindStableSectionsV1(craft(duplicated));
    expect(result).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-input", "parsed")],
    });

    const valid = markerFailure() as unknown as ParseDocumentResultV1;
    const forwarded = bindStableSectionsV1(valid);
    expect(forwarded).toEqual(valid);
    expect(canonicalJson((forwarded as { issues: unknown }).issues)).toBe(
      canonicalJson((valid as { issues: unknown }).issues),
    );
    const anchorForwarded = deriveHeadingAnchorsV1(valid);
    expect(canonicalJson((anchorForwarded as { issues: unknown }).issues)).toBe(
      canonicalJson((valid as { issues: unknown }).issues),
    );
  });

  test("T42: malformed crafted successes fail with exact codes", () => {
    const source = {
      ok: true,
      source: {
        artifactId: "A",
        path: "docs/a.md",
        version: "1",
        contentDigest: digestOf("# H\n"),
        blobSha: null,
        kind: "doc",
        status: "active",
        owner: "team",
        tags: [],
        relations: [],
      },
      parsed: {
        artifactId: "A",
        nodes: [{ type: "heading", depth: 1, text: "H", span: SPAN }],
      },
    };
    const withExtra = { ...source, extra: 1 };
    expect(bindStableSectionsV1(withExtra as unknown as ParseDocumentResultV1)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/unknown-field", "parsed.extra")],
    });
    const wrongBlockKind = {
      ...source,
      parsed: {
        artifactId: "A",
        nodes: [{ type: "block", blockKind: "paragraphs", span: SPAN }],
      },
    };
    expect(deriveHeadingAnchorsV1(wrongBlockKind as unknown as ParseDocumentResultV1)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.parsed.nodes[0].blockKind")],
    });
    const depthSeven = {
      ...source,
      parsed: {
        artifactId: "A",
        nodes: [{ type: "heading", depth: 7, text: "H", span: SPAN }],
      },
    };
    expect(deriveHeadingAnchorsV1(depthSeven as unknown as ParseDocumentResultV1)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.parsed.nodes[0].depth")],
    });
    const mismatched = {
      ...source,
      parsed: {
        artifactId: "B",
        nodes: [{ type: "heading", depth: 1, text: "H", span: SPAN }],
      },
    };
    expect(deriveHeadingAnchorsV1(mismatched as unknown as ParseDocumentResultV1)).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed.parsed.artifactId")],
    });
  });

  test("T42: the array stage anchors each element at parsed[k]", () => {
    const valid = parseDocumentV1(sourceWith("# H\n"), BUDGETS);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(resolveDocumentRelationsV1([valid, craft([])])).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-field", "parsed[1].issues")],
    });
    expect(resolveDocumentRelationsV1({ length: 0 } as unknown as readonly ParseDocumentResultV1[])).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-input", "parsed")],
    });
    expect(resolveDocumentRelationsV1([[valid]] as unknown as readonly ParseDocumentResultV1[])).toEqual({
      ok: false,
      issues: [issue("sothoth.document-index/invalid-input", "parsed[0]")],
    });
  });
});
