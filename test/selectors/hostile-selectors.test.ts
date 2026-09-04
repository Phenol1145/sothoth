// Task 5 / Declarative Selector Engine — hostile-input and budget matrix
// (plan Steps 1/3; Dossier criteria selectors-hostile-input-budgets and the
// typed-rejection classes of selectors-closed-selector-algebra: JavaScript
// predicates, shell expressions, network lookups, free-text inference, and
// unrestricted regular expressions are never selectors and fail closed as
// unknown terms). Every rejection is `sothoth.selectors/invalid-selector`
// with an exact subject; hostile objects never have a field getter executed;
// hostile inputs never throw outward; budgets fail deterministically.

import { describe, expect, test } from "vitest";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
} from "../../packages/document-index/src/index.js";
import {
  DEFAULT_SELECTOR_BUDGETS_V1,
  parseSelectorV1,
  type SelectorBudgetsV1,
} from "../../packages/selectors/src/parser.js";
import { selectDocumentsV1 } from "../../packages/selectors/src/evaluate.js";

const ZERO_DIGEST = `sha256:${"0".repeat(64)}`;

function singleEntry(overrides: Partial<DocumentEntryV1> & { artifactId: string }): DocumentIndexProjectionV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    documents: [
      {
        schema: "sothoth.document-index/document-index@1",
        path: "docs/x.md",
        version: "1.0.0",
        kind: "guide",
        status: "active",
        owner: "team-a",
        tags: ["release"],
        contentDigest: ZERO_DIGEST,
        blobSha: null,
        headings: [],
        sections: [],
        relations: [],
        entryDigest: ZERO_DIGEST,
        ...overrides,
      },
    ],
    provenance: {
      compiler: { compilerId: "t", compilerRevision: 1 },
      budgets: {
        maxContentCodeUnits: 1_000_000,
        maxDocuments: 100,
        maxAstNodes: 100_000,
        maxRelationsPerDocument: 100,
        maxHeadingTextCodeUnits: 1_000,
      },
      inputs: [],
    },
    indexDigest: ZERO_DIGEST,
  };
}

const INDEX = singleEntry({ artifactId: "doc-x" });

function expectRejected(source: unknown, subject?: string, budgets?: SelectorBudgetsV1): void {
  const parsed = parseSelectorV1(source, budgets);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    throw new Error(`expected parse rejection for ${JSON.stringify(subject ?? source)}`);
  }
  expect(parsed.issues.length).toBeGreaterThanOrEqual(1);
  for (const issue of parsed.issues) {
    expect(issue.code).toBe("sothoth.selectors/invalid-selector");
  }
  if (subject !== undefined) {
    expect(parsed.issues.map((issue) => issue.subject)).toContain(subject);
  }
}

function expectSelectionRejected(
  projection: unknown,
  selector: unknown,
  subject?: string,
): void {
  const result = selectDocumentsV1(projection, selector);
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected the selection to fail closed");
  }
  expect(result.issues.length).toBeGreaterThanOrEqual(1);
  for (const issue of result.issues) {
    expect(issue.code).toBe("sothoth.selectors/invalid-selector");
  }
  if (subject !== undefined) {
    expect(result.issues.map((issue) => issue.subject)).toContain(subject);
  }
}

describe("unknown operators and escape attempts fail closed", () => {
  test("an unknown operator is an unknown term outside the closed vocabulary", () => {
    expectRejected({ unknown: true }, "selector.unknown");
    expectRejected({ all: [{ artifactId: "x" }], extra: 1 }, "selector.extra");
  });

  test("a JavaScript predicate is never a selector term", () => {
    expectRejected({ $where: "this.kind === 'guide'" }, "selector.$where");
    expectRejected({ predicate: (entry: unknown) => entry === entry }, "selector.predicate");
    expectRejected({ all: [{ artifactId: "x" }, () => true] }, "selector.all[1]");
  });

  test("shell expressions, network lookups, and free-text inference are unknown terms", () => {
    expectRejected({ shell: "ls docs" }, "selector.shell");
    expectRejected({ exec: "cat docs/guide/a.md" }, "selector.exec");
    expectRejected({ url: "https://example.invalid/search" }, "selector.url");
    expectRejected({ fetch: "https://example.invalid" }, "selector.fetch");
    expectRejected({ infer: "documents about release stuff" }, "selector.infer");
    expectRejected({ search: "release documents" }, "selector.search");
  });

  test("an unrestricted regular expression is not a supported glob term", () => {
    expectRejected({ path: /release.*/ }, "selector.path");
    expectRejected({ path: { regex: "release.*" } }, "selector.path");
  });
});

describe("empty boolean groups and structural malformation fail closed", () => {
  test("empty boolean groups are rejected with exact subjects", () => {
    expectRejected({ all: [] }, "selector.all");
    expectRejected({ any: [] }, "selector.any");
  });

  test("not requires exactly one closed child object", () => {
    expectRejected({ not: {} }, "selector.not");
    expectRejected({ not: [] }, "selector.not");
    expectRejected({ not: "release" }, "selector.not");
    expectRejected({ not: { unknown: 1 } }, "selector.not");
  });

  test("non-object selectors, arrays, and nulls fail closed", () => {
    expectRejected(undefined, "selector");
    expectRejected(null, "selector");
    expectRejected(42, "selector");
    expectRejected("release", "selector");
    expectRejected([], "selector");
    expectRejected([["release"]], "selector");
  });

  test("set terms require a non-empty dense array of non-empty strings", () => {
    expectRejected({ tag: { any: [] } }, "selector.tag.any");
    expectRejected({ kind: {} }, "selector.kind.any");
    expectRejected({ kind: { any: ["a", ""] } }, "selector.kind.any[1]");
    expectRejected({ status: { any: "draft" } }, "selector.status.any");
    expectRejected({ owner: { any: [1] } }, "selector.owner.any[0]");
    const sparse: unknown[] = new Array(2);
    sparse[0] = "draft";
    expectRejected({ status: { any: sparse } }, "selector.status.any");
  });

  test("exact identity and diagnostic terms require non-empty contract-valid strings", () => {
    expectRejected({ artifactId: "" }, "selector.artifactId");
    expectRejected({ artifactId: 7 }, "selector.artifactId");
    expectRejected({ diagnostic: "not-a-diagnostic-code" }, "selector.diagnostic");
    expectRejected({ diagnostic: "sothoth.selectors" }, "selector.diagnostic");
    expectRejected({ namespace: "sothoth" }, "selector.namespace");
    expectRejected({ namespace: "sothoth." }, "selector.namespace");
    expectRejected({ namespace: ".selectors" }, "selector.namespace");
  });

  test("relation terms require a closed target and an optional reference role", () => {
    expectRejected({ reference: {} }, "selector.reference.target");
    expectRejected({ reference: { target: "" } }, "selector.reference.target");
    expectRejected({ reference: { target: "x", extra: 1 } }, "selector.reference.extra");
    expectRejected({ reference: { target: "x", role: "" } }, "selector.reference.role");
    expectRejected({ traceability: { target: "x", role: "r" } }, "selector.traceability.role");
    expectRejected({ reference: "doc-x" }, "selector.reference");
  });

  test("cardinality bounds are legal only at the selection root and never negative", () => {
    expectRejected({ kind: { any: ["guide"] }, min: -1 }, "selector.min");
    expectRejected({ kind: { any: ["guide"] }, min: 1.5 }, "selector.min");
    expectRejected({ kind: { any: ["guide"] }, max: 0.5 }, "selector.max");
    expectRejected({ kind: { any: ["guide"] }, min: 5, max: 2 }, "selector");
    expectRejected({ tag: { any: ["release"], min: 0 } }, "selector.tag.min");
    expectRejected({ all: [{ artifactId: "x", min: 0 }] }, "selector.all[0].min");
    expectRejected({ min: "1" }, "selector.min");
    expectRejected({ max: true }, "selector.max");
  });
});

describe("hostile globs fail closed", () => {
  test("absolute paths, dot segments, and NUL are rejected", () => {
    expectRejected({ path: "/etc/passwd" }, "selector.path");
    expectRejected({ path: "docs/../secrets/x.md" }, "selector.path");
    expectRejected({ path: "docs/./x.md" }, "selector.path");
    expectRejected({ path: "a\u0000b" }, "selector.path");
    expectRejected({ path: "" }, "selector.path");
  });

  test("unsupported glob syntax is rejected: bracket classes, brace expansion, escapes, and broken stars", () => {
    expectRejected({ path: "docs/[abc].md" }, "selector.path");
    expectRejected({ path: "docs/{a,b}.md" }, "selector.path");
    expectRejected({ path: "docs/guide\\*.md" }, "selector.path");
    expectRejected({ path: "a***b" }, "selector.path");
    expectRejected({ path: "a**b" }, "selector.path");
    expectRejected({ path: "**/**x" }, "selector.path");
    expectRejected({ path: "a/b**" }, "selector.path");
  });

  test("a glob run over a hostile path fails deterministically inside the state budget", () => {
    const tight: SelectorBudgetsV1 = { ...DEFAULT_SELECTOR_BUDGETS_V1, maxGlobStates: 10 };
    const result = selectDocumentsV1(
      singleEntry({ artifactId: "doc-x", path: `docs/${"y".repeat(40)}.md` }),
      { path: "docs/*.md" },
      tight,
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the state-budget exhaustion to fail the selection");
    }
    expect(result.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "selector.path" },
    ]);
    const repeat = selectDocumentsV1(
      singleEntry({ artifactId: "doc-x", path: `docs/${"y".repeat(40)}.md` }),
      { path: "docs/*.md" },
      tight,
    );
    expect(repeat).toEqual(result);
  });
});

describe("hostile objects never execute accessors and never throw", () => {
  test("accessor fields on known keys fail closed without executing the getter", () => {
    let reads = 0;
    const hostile = {
      get tag() {
        reads += 1;
        return { any: ["release"] };
      },
    };
    expectRejected(hostile, "selector.tag");
    expect(reads).toBe(0);
  });

  test("nested accessors on known keys fail closed without executing any getter", () => {
    let reads = 0;
    const hostile = {
      all: [
        {
          get path() {
            reads += 1;
            return "docs/**";
          },
        },
      ],
    };
    expectRejected(hostile, "selector.all[0].path");
    expect(reads).toBe(0);
  });

  test("a cyclic selector fails closed as a budget rejection, never a native stack overflow", () => {
    const inner: { not: unknown } = { not: null };
    const root: { all: unknown[] } = { all: [inner] };
    inner.not = root;
    const parsed = parseSelectorV1(root);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("expected the cyclic selector to be rejected");
    }
    expect(parsed.issues[0]?.code).toBe("sothoth.selectors/invalid-selector");
  });

  test("an own __proto__ data key is an unknown field and pollutes nothing", () => {
    const hostile = JSON.parse('{"__proto__": {"all": []}, "artifactId": "x"}') as Record<
      string,
      unknown
    >;
    expectRejected(hostile, "selector.__proto__");
    expect(({} as Record<string, unknown>).all).toBeUndefined();
  });

  test("hostile index entries fail closed without executing their accessors", () => {
    let reads = 0;
    const projection = {
      schema: "sothoth.document-index/document-index@1",
      documents: [
        {
          get artifactId() {
            reads += 1;
            return "doc-x";
          },
          path: "docs/x.md",
          kind: "guide",
          status: "active",
          owner: "team-a",
          tags: ["release"],
          relations: [],
        },
      ],
    };
    expectSelectionRejected(projection, { tag: { any: ["release"] } }, "index.documents[0].artifactId");
    expect(reads).toBe(0);
  });

  test("malformed index containers and entries fail closed with exact subjects", () => {
    expectSelectionRejected(null, { tag: { any: ["release"] } }, "index");
    expectSelectionRejected("index", { tag: { any: ["release"] } }, "index");
    expectSelectionRejected({}, { tag: { any: ["release"] } }, "index.documents");
    expectSelectionRejected(
      { documents: {} },
      { tag: { any: ["release"] } },
      "index.documents",
    );
    expectSelectionRejected(
      { documents: [null] },
      { tag: { any: ["release"] } },
      "index.documents[0]",
    );
    expectSelectionRejected(
      singleEntry({ artifactId: "doc-x", tags: "release" }),
      { tag: { any: ["release"] } },
      "index.documents[0].tags",
    );
  });

  test("duplicate artifact identities in the supplied index fail closed", () => {
    expectSelectionRejected(
      {
        schema: "sothoth.document-index/document-index@1",
        documents: [
          { artifactId: "doc-x", path: "a.md", kind: "k", status: "s", owner: "o", tags: [], relations: [] },
          { artifactId: "doc-x", path: "b.md", kind: "k", status: "s", owner: "o", tags: [], relations: [] },
        ],
      },
      { tag: { any: ["release"] } },
      "index.documents[1].artifactId",
    );
  });
});

function expectExactParseIssues(source: unknown, subject: string): void {
  const parsed = parseSelectorV1(source);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    throw new Error(`expected parse rejection at ${subject}`);
  }
  expect(parsed.issues).toEqual([
    { code: "sothoth.selectors/invalid-selector", subject },
  ]);
}

function expectExactSelectionIssues(
  projection: unknown,
  selector: unknown,
  subject: string,
): void {
  const result = selectDocumentsV1(projection, selector);
  expect(result).toEqual({
    ok: false,
    issues: [{ code: "sothoth.selectors/invalid-selector", subject }],
  });
}

describe("hostile array slots never execute accessors and never carry extra keys", () => {
  // Array-slot discipline (I-1): every external array — selector set arrays,
  // boolean-group children, index documents, entry tags, entry relations —
  // must pass a descriptor-only dense-array contract before any slot value
  // is read: dense; every `0..length-1` slot an own enumerable data
  // property; no own symbol keys; no extra own string keys. Every probe
  // below uses an accessor whose return value would pass every semantic
  // check, so only the descriptor shape can explain the rejection.

  test("accessor slots in set-term arrays are rejected without executing the getter, at any position", () => {
    for (const slot of [0, 1, 2]) {
      let reads = 0;
      const values = ["a", "b", "c"];
      Object.defineProperty(values, slot, {
        get() {
          reads += 1;
          return "z"; // a semantically valid set member
        },
        enumerable: true,
        configurable: true,
      });
      expectExactParseIssues({ kind: { any: values } }, "selector.kind.any");
      expect(reads).toBe(0);
      // The hostile input is left unmodified: its accessor is intact.
      expect(Object.getOwnPropertyDescriptor(values, slot)?.get).toBeDefined();
      expect(values.length).toBe(3);
      // The rejection is byte-stable across repeated invocations.
      const first = parseSelectorV1({ kind: { any: values } });
      const second = parseSelectorV1({ kind: { any: values } });
      expect(second).toEqual(first);
    }
  });

  test("accessor slots in boolean-group children arrays are rejected without executing the getter", () => {
    let reads = 0;
    const validChild = { tag: { any: ["release"] } };
    const children = [validChild];
    Object.defineProperty(children, 0, {
      get() {
        reads += 1;
        return validChild; // a semantically valid child term
      },
      enumerable: true,
      configurable: true,
    });
    expectExactParseIssues({ all: children }, "selector.all");
    expect(reads).toBe(0);
  });

  test("a throwing accessor slot fails closed as a typed rejection, never an escaped exception", () => {
    let reads = 0;
    const values = ["guide"];
    Object.defineProperty(values, 0, {
      get() {
        reads += 1;
        throw new Error("HOSTILE-GETTER-RAN");
      },
      enumerable: true,
      configurable: true,
    });
    expectExactParseIssues({ kind: { any: values } }, "selector.kind.any");
    expect(reads).toBe(0);
  });

  test("own symbol keys — data or accessor — on selector arrays are rejected without executing the accessor", () => {
    let reads = 0;
    const withSymbolData: unknown[] = ["guide"];
    Object.defineProperty(withSymbolData, Symbol("stowaway"), {
      value: 1,
      enumerable: false,
      configurable: true,
    });
    expectExactParseIssues({ kind: { any: withSymbolData } }, "selector.kind.any");

    const withSymbolAccessor: unknown[] = ["guide"];
    Object.defineProperty(withSymbolAccessor, Symbol("boom"), {
      get() {
        reads += 1;
        return "x";
      },
      enumerable: true,
      configurable: true,
    });
    expectExactParseIssues({ all: withSymbolAccessor }, "selector.all");
    expect(reads).toBe(0);
  });

  test("a non-enumerable data index slot is rejected even though the slot value is valid", () => {
    const values = ["guide"];
    Object.defineProperty(values, 0, {
      value: "guide",
      enumerable: false,
      writable: true,
      configurable: true,
    });
    expectExactParseIssues({ kind: { any: values } }, "selector.kind.any");
  });

  test("an extra own string key on a selector array is rejected", () => {
    const values = ["guide"];
    Object.defineProperty(values, "extra", {
      value: 1,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    expectExactParseIssues({ kind: { any: values } }, "selector.kind.any");
  });

  test("accessor slots in index documents are rejected without executing the getter", () => {
    let reads = 0;
    const validEntry = {
      artifactId: "doc-x",
      path: "docs/x.md",
      kind: "guide",
      status: "active",
      owner: "team-a",
      tags: ["release"],
      relations: [],
    };
    const documents = [validEntry];
    Object.defineProperty(documents, 0, {
      get() {
        reads += 1;
        return validEntry; // a semantically valid entry
      },
      enumerable: true,
      configurable: true,
    });
    expectExactSelectionIssues(
      { documents },
      { tag: { any: ["release"] } },
      "index.documents",
    );
    expect(reads).toBe(0);
    const repeat = selectDocumentsV1(
      { documents },
      { tag: { any: ["release"] } },
    );
    expect(repeat).toEqual({
      ok: false,
      issues: [{ code: "sothoth.selectors/invalid-selector", subject: "index.documents" }],
    });
  });

  test("accessor slots in entry tags are rejected without executing the getter", () => {
    let reads = 0;
    const tags = ["release"];
    Object.defineProperty(tags, 0, {
      get() {
        reads += 1;
        return "release"; // a semantically valid tag
      },
      enumerable: true,
      configurable: true,
    });
    expectExactSelectionIssues(
      singleEntry({ artifactId: "doc-x", tags }),
      { tag: { any: ["release"] } },
      "index.documents[0].tags",
    );
    expect(reads).toBe(0);
  });

  test("accessor slots in entry relations are rejected without executing the getter", () => {
    let reads = 0;
    const validRelation = { kind: "reference", role: "governs", target: { artifactId: "doc-b" } };
    const relations = [validRelation];
    Object.defineProperty(relations, 0, {
      get() {
        reads += 1;
        return validRelation; // a semantically valid relation
      },
      enumerable: true,
      configurable: true,
    });
    expectExactSelectionIssues(
      {
        documents: [
          {
            artifactId: "doc-a",
            path: "docs/a.md",
            kind: "guide",
            status: "active",
            owner: "team-a",
            tags: [],
            relations,
          },
          {
            artifactId: "doc-b",
            path: "docs/b.md",
            kind: "guide",
            status: "active",
            owner: "team-a",
            tags: [],
            relations: [],
          },
        ],
      },
      { reference: { target: "doc-b", role: "governs" } },
      "index.documents[0].relations",
    );
    expect(reads).toBe(0);
  });

  test("hostile documents arrays: symbols, non-enumerable slots, and throwing accessors all fail closed", () => {
    let reads = 0;
    const minimalEntry = (artifactId: string) => ({
      artifactId,
      path: `docs/${artifactId}.md`,
      kind: "guide",
      status: "active",
      owner: "team-a",
      tags: ["release"],
      relations: [],
    });

    const withSymbol = [minimalEntry("doc-x")];
    Object.defineProperty(withSymbol, Symbol("stowaway"), {
      value: 1,
      enumerable: false,
      configurable: true,
    });
    expectExactSelectionIssues(
      { documents: withSymbol },
      { tag: { any: ["release"] } },
      "index.documents",
    );

    const nonEnumerable = [minimalEntry("doc-x")];
    Object.defineProperty(nonEnumerable, 0, {
      value: nonEnumerable[0],
      enumerable: false,
      writable: true,
      configurable: true,
    });
    expectExactSelectionIssues(
      { documents: nonEnumerable },
      { tag: { any: ["release"] } },
      "index.documents",
    );

    const throwing = [minimalEntry("doc-x")];
    Object.defineProperty(throwing, 0, {
      get() {
        reads += 1;
        throw new Error("HOSTILE-GETTER-RAN");
      },
      enumerable: true,
      configurable: true,
    });
    expectExactSelectionIssues(
      { documents: throwing },
      { tag: { any: ["release"] } },
      "index.documents",
    );
    expect(reads).toBe(0);
  });

  test("normal dense arrays of enumerable data properties still parse and match", () => {
    const parsed = parseSelectorV1({ kind: { any: ["guide", "draft"] } });
    expect(parsed.ok).toBe(true);
    const result = selectDocumentsV1(INDEX, { tag: { any: ["release"] } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matches.map((match) => match.artifactId)).toEqual(["doc-x"]);
    }
  });
});

describe("declared budgets bound every pattern construct deterministically", () => {
  test("budget containers are hostile-validated with closed keys and positive integers", () => {
    expectRejected({ artifactId: "x" }, "budgets.maxDepth", {
      ...DEFAULT_SELECTOR_BUDGETS_V1,
      maxDepth: 0,
    });
    expectRejected({ artifactId: "x" }, "budgets.extra", {
      ...DEFAULT_SELECTOR_BUDGETS_V1,
      extra: 1,
    } as unknown as SelectorBudgetsV1);
    expectRejected({ artifactId: "x" }, "budgets.maxGlobStates", {
      ...DEFAULT_SELECTOR_BUDGETS_V1,
      maxGlobStates: -5,
    });
    expectRejected({ artifactId: "x" }, "budgets", null as unknown as SelectorBudgetsV1);
  });

  test("the source-size budget bounds the declared selector data", () => {
    const big = { all: [{ artifactId: "x".repeat(200) }] };
    expectRejected(big, "selector", {
      ...DEFAULT_SELECTOR_BUDGETS_V1,
      maxSourceCodeUnits: 50,
    });
  });

  test("the depth budget bounds combinator nesting and doubles as the cycle guard", () => {
    let selector: unknown = { artifactId: "x" };
    for (let depth = 0; depth < 40; depth += 1) {
      selector = { not: selector };
    }
    const ok = parseSelectorV1(selector, {
      ...DEFAULT_SELECTOR_BUDGETS_V1,
      maxDepth: 64,
    });
    expect(ok.ok).toBe(true);
    const rejected = parseSelectorV1(selector, {
      ...DEFAULT_SELECTOR_BUDGETS_V1,
      maxDepth: 8,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      // The ninth nesting level is the first node past the budget; its
      // subject is the exact root-relative path to that node.
      expect(rejected.issues.map((issue) => issue.subject)).toContain(
        `selector${".not".repeat(8)}`,
      );
    }
  });

  test("the pattern-length budget bounds hostile glob sources before any match work", () => {
    expectRejected({ path: "a".repeat(100_000) }, "selector.path");
  });

  test("budget behavior is byte-identical across repeated hostile invocations", () => {
    const hostile = { path: "/abs" };
    const first = parseSelectorV1(hostile);
    const second = parseSelectorV1(hostile);
    expect(second).toEqual(first);
  });
});

describe("hostile 100k-character paths stay bounded and correct", () => {
  test("a 100k-character entry path matches within the default budgets", () => {
    const longPath = `docs/${"segment/".repeat(13_000)}leaf.md`;
    expect(longPath.length).toBeGreaterThan(100_000);
    const projection = singleEntry({ artifactId: "doc-x", path: longPath });
    const ok = selectDocumentsV1(projection, { path: "docs/**/leaf.md" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-x"]);
    }
  });

  test("a 100k-character single-segment path matches a short glob within the default budgets", () => {
    const longPath = `docs/${"a".repeat(99_000)}.md`;
    const projection = singleEntry({ artifactId: "doc-x", path: longPath });
    const ok = selectDocumentsV1(projection, { path: "docs/*.md" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-x"]);
    }
    const noMatch = selectDocumentsV1(projection, { path: "docs/?.md" });
    expect(noMatch.ok).toBe(true);
    if (noMatch.ok) {
      expect(noMatch.matches).toEqual([]);
    }
  });

  test("a 100k-character path against a 100k-character pattern fails closed on the pattern budget", () => {
    const longPath = `docs/${"a".repeat(99_000)}.md`;
    const projection = singleEntry({ artifactId: "doc-x", path: longPath });
    expectSelectionRejected(projection, { path: longPath }, "selector.path");
  });
});
