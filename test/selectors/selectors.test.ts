// Task 5 / Declarative Selector Engine — conformance matrix (plan Step 1).
// Covers composition, exact metadata, safe globs, relations, cardinality,
// zero matches, canonical ordering, order independence, byte-stable parse,
// immutability, diagnostics, and the package boundary pins. Hostile-input
// and budget behavior lives in hostile-selectors.test.ts.
//
// Index fixtures are literal DocumentIndexProjectionV1-shaped values built by
// hand: selection consumes entries and never reparses source content, so no
// test here needs the Document Index builder.

import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
  ResolvedRelationRecordV1,
} from "../../packages/document-index/src/index.js";
import {
  DEFAULT_SELECTOR_BUDGETS_V1,
  parseSelectorV1,
  type SelectorBudgetsV1,
} from "../../packages/selectors/src/parser.js";
import {
  SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1,
  selectDocumentsV1,
  type SelectorSelectionResultV1,
} from "../../packages/selectors/src/evaluate.js";
import * as selectorAst from "../../packages/selectors/src/index.js";
import type * as AstTypes from "../../packages/selectors/src/index.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

const ZERO_DIGEST = `sha256:${"0".repeat(64)}`;

function relation(
  kind: ResolvedRelationRecordV1["kind"],
  fromArtifactId: string,
  relationId: string,
  targetArtifactId: string,
  role: string | null = null,
): ResolvedRelationRecordV1 {
  return {
    relationId,
    fromArtifactId,
    kind,
    role,
    target: { artifactId: targetArtifactId, revision: null, external: false },
  };
}

function entry(overrides: {
  artifactId: string;
  path: string;
  kind: string;
  status: string;
  owner: string;
  tags: readonly string[];
  relations?: readonly ResolvedRelationRecordV1[];
}): DocumentEntryV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    artifactId: overrides.artifactId,
    path: overrides.path,
    version: "1.0.0",
    kind: overrides.kind,
    status: overrides.status,
    owner: overrides.owner,
    tags: [...overrides.tags],
    contentDigest: ZERO_DIGEST,
    blobSha: null,
    headings: [],
    sections: [],
    relations: overrides.relations ?? [],
    entryDigest: ZERO_DIGEST,
  };
}

function projection(documents: readonly DocumentEntryV1[]): DocumentIndexProjectionV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    documents,
    provenance: {
      compiler: { compilerId: "test-compiler", compilerRevision: 1 },
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

const DOC_A = entry({
  artifactId: "doc-a",
  path: "docs/guide/a.md",
  kind: "guide",
  status: "active",
  owner: "team-a",
  tags: ["release", "web"],
  relations: [relation("reference", "doc-a", "r1", "doc-z", "normative-dependency")],
});
const DOC_Z = entry({
  artifactId: "doc-z",
  path: "docs/ref/z.md",
  kind: "reference",
  status: "draft",
  owner: "team-b",
  tags: ["release"],
  relations: [relation("traceability", "doc-z", "r2", "doc-a")],
});
const DOC_M = entry({
  artifactId: "doc-m",
  path: "src/internal/m.md",
  kind: "spec",
  status: "active",
  owner: "team-a",
  tags: ["draft"],
});

const INDEX = projection([DOC_A, DOC_Z, DOC_M]);
const REVERSED_INDEX = projection([DOC_M, DOC_Z, DOC_A]);

function expectOkOk(result: SelectorSelectionResultV1): Extract<SelectorSelectionResultV1, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected ok:true selection, got issues ${JSON.stringify(result.issues)}`);
  }
  return result;
}

function expectParsedAst(source: unknown, budgets?: SelectorBudgetsV1): AstTypes.SelectorV1 {
  const parsed = parseSelectorV1(source, budgets);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(`expected ok:true parse, got issues ${JSON.stringify(parsed.issues)}`);
  }
  return parsed.ast;
}

describe("composition (all / any / not)", () => {
  test("all requires every child to admit the candidate", () => {
    const result = selectDocumentsV1(INDEX, {
      all: [{ kind: { any: ["guide"] } }, { status: { any: ["active"] } }],
    });
    const ok = expectOkOk(result);
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
  });

  test("any admits a candidate when at least one child admits it", () => {
    const result = selectDocumentsV1(INDEX, {
      any: [{ kind: { any: ["spec"] } }, { owner: { any: ["team-b"] } }],
    });
    const ok = expectOkOk(result);
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-m", "doc-z"]);
  });

  test("not inverts the child decision", () => {
    const result = selectDocumentsV1(INDEX, { not: { tag: { any: ["release"] } } });
    const ok = expectOkOk(result);
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-m"]);
  });

  test("nested combinators compose deterministically", () => {
    const selector = {
      all: [
        { not: { status: { any: ["draft"] } } },
        { any: [{ kind: { any: ["guide"] } }, { path: "src/**/*.md" }] },
      ],
    };
    const parsed = expectParsedAst(selector);
    const fromAst = selectDocumentsV1(INDEX, parsed);
    const fromData = selectDocumentsV1(INDEX, selector);
    expect(canonicalJson(fromAst)).toBe(canonicalJson(fromData));
    const ok = expectOkOk(fromAst);
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-a", "doc-m"]);
  });

  test("the explain trace records which term admitted or rejected each candidate", () => {
    const result = selectDocumentsV1(INDEX, {
      all: [{ kind: { any: ["guide"] } }, { status: { any: ["active"] } }],
    });
    const ok = expectOkOk(result);
    const traceA = ok.trace.find((item) => item.artifactId === "doc-a");
    expect(traceA?.matched).toBe(true);
    expect(traceA?.terms).toEqual([
      { subject: "selector", outcome: "admitted" },
      { subject: "selector.all[0]", outcome: "admitted" },
      { subject: "selector.all[1]", outcome: "admitted" },
    ]);
    const traceZ = ok.trace.find((item) => item.artifactId === "doc-z");
    expect(traceZ?.matched).toBe(false);
    expect(traceZ?.terms).toEqual([
      { subject: "selector", outcome: "rejected" },
      { subject: "selector.all[0]", outcome: "rejected" },
    ]);
  });
});

describe("exact metadata terms", () => {
  test("exact artifact identity matches the canonical identity", () => {
    const result = selectDocumentsV1(INDEX, { artifactId: "doc-z" });
    const ok = expectOkOk(result);
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-z"]);
  });

  test("kind, status, owner, and tag set terms match by membership", () => {
    const kind = expectOkOk(selectDocumentsV1(INDEX, { kind: { any: ["guide", "spec"] } }));
    expect(kind.matches.map((match) => match.artifactId)).toEqual(["doc-a", "doc-m"]);
    const status = expectOkOk(selectDocumentsV1(INDEX, { status: { any: ["draft"] } }));
    expect(status.matches.map((match) => match.artifactId)).toEqual(["doc-z"]);
    const owner = expectOkOk(selectDocumentsV1(INDEX, { owner: { any: ["team-a"] } }));
    expect(owner.matches.map((match) => match.artifactId)).toEqual(["doc-a", "doc-m"]);
    const tag = expectOkOk(selectDocumentsV1(INDEX, { tag: { any: ["web"] } }));
    expect(tag.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
  });

  test("sorts matches by artifact identity independent of index order", () => {
    const result = selectDocumentsV1(REVERSED_INDEX, { all: [{ tag: { any: ["release"] } }] });
    expect(result.matches.map((item) => item.artifactId)).toEqual(["doc-a", "doc-z"]);
  });
});

describe("safe POSIX-path globs", () => {
  test("literal patterns match exactly", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { path: "docs/guide/a.md" }));
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
  });

  test("? matches exactly one character inside a segment", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { path: "docs/guide/?.md" }));
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
  });

  test("* matches zero or more characters within one segment", () => {
    const within = expectOkOk(selectDocumentsV1(INDEX, { path: "docs/guide/*.md" }));
    expect(within.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
    const crossSegment = selectDocumentsV1(INDEX, { path: "docs/*.md" });
    const ok = expectOkOk(crossSegment);
    expect(ok.matches.map((match) => match.artifactId)).toEqual([]);
  });

  test("whole-segment ** matches zero or more segments", () => {
    const zero = expectOkOk(selectDocumentsV1(INDEX, { path: "docs/**" }));
    expect(zero.matches.map((match) => match.artifactId)).toEqual(["doc-a", "doc-z"]);
    const deep = expectOkOk(selectDocumentsV1(INDEX, { path: "**/m.md" }));
    expect(deep.matches.map((match) => match.artifactId)).toEqual(["doc-m"]);
    const trailing = expectOkOk(selectDocumentsV1(INDEX, { path: "src/**/*.md" }));
    expect(trailing.matches.map((match) => match.artifactId)).toEqual(["doc-m"]);
  });

  test("byte order of paths follows the canonical artifact identity ordering", () => {
    const ok = expectOkOk(selectDocumentsV1(REVERSED_INDEX, { path: "**/*.md" }));
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-a", "doc-m", "doc-z"]);
  });
});

describe("explicit reference and traceability relations", () => {
  test("reference terms match by target identity and optional role", () => {
    const byTarget = expectOkOk(
      selectDocumentsV1(INDEX, { reference: { target: "doc-z" } }),
    );
    expect(byTarget.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
    const byRole = expectOkOk(
      selectDocumentsV1(INDEX, { reference: { target: "doc-z", role: "normative-dependency" } }),
    );
    expect(byRole.matches.map((match) => match.artifactId)).toEqual(["doc-a"]);
    const otherRole = selectDocumentsV1(INDEX, {
      reference: { target: "doc-z", role: "impact" },
    });
    const ok = expectOkOk(otherRole);
    expect(ok.matches.map((match) => match.artifactId)).toEqual([]);
  });

  test("traceability terms match declared traceability targets", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { traceability: { target: "doc-a" } }));
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-z"]);
  });

  test("a relation term resolving against no declared identity fails closed", () => {
    const result = selectDocumentsV1(INDEX, { reference: { target: "doc-absent" } });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the unresolved reference term to fail the selection");
    }
    expect(result.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "selector.reference.target" },
    ]);
  });

  test("unresolved traceability targets fail closed with an exact subject", () => {
    const result = selectDocumentsV1(INDEX, { traceability: { target: "doc-absent" } });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the unresolved traceability term to fail the selection");
    }
    expect(result.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "selector.traceability.target" },
    ]);
  });
});

describe("diagnostic identity and namespace terms", () => {
  test("a diagnostic identity term parses as declared contracts vocabulary", () => {
    const ast = expectParsedAst({ diagnostic: "sothoth.document-index/budget-exhausted" });
    expect(canonicalJson(ast)).toBe(
      canonicalJson({ diagnostic: "sothoth.document-index/budget-exhausted" }),
    );
  });

  test("a namespace term parses as a declared diagnostic namespace", () => {
    const ast = expectParsedAst({ namespace: "sothoth.document-index" });
    expect(canonicalJson(ast)).toBe(canonicalJson({ namespace: "sothoth.document-index" }));
  });

  test("diagnostic terms match only declared entry diagnostic facts, of which the accepted entry contract declares none", () => {
    const ok = expectOkOk(
      selectDocumentsV1(INDEX, { diagnostic: "sothoth.document-index/budget-exhausted" }),
    );
    expect(ok.matches).toEqual([]);
    expect(ok.trace.map((item) => item.matched)).toEqual([false, false, false]);
    expect(ok.diagnostics).toEqual([
      { code: SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1, subject: "selector" },
    ]);
  });
});

describe("cardinality bounds", () => {
  test("a selection below its declared minimum fails closed", () => {
    const result = selectDocumentsV1(INDEX, { all: [{ kind: { any: ["guide"] } }], min: 2, max: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the cardinality minimum to fail the selection");
    }
    expect(result.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "selector" },
    ]);
  });

  test("a selection above its declared maximum fails closed", () => {
    const result = selectDocumentsV1(INDEX, { path: "**/*.md", min: 1, max: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the cardinality maximum to fail the selection");
    }
    expect(result.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "selector" },
    ]);
  });

  test("bounds satisfied exactly admit the selection without diagnostics", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { path: "docs/**", min: 2, max: 2 }));
    expect(ok.matches.map((match) => match.artifactId)).toEqual(["doc-a", "doc-z"]);
    expect(ok.diagnostics).toEqual([]);
  });
});

describe("zero matches", () => {
  test("zero matches produce the default zero-match diagnostic by default", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { kind: { any: ["absent-kind"] } }));
    expect(ok.matches).toEqual([]);
    expect(ok.diagnostics).toEqual([
      { code: "sothoth.selectors/zero-match-diagnostic", subject: "selector" },
    ]);
  });

  test("an explicitly declared zero minimum opts out of the zero-match diagnostic", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { kind: { any: ["absent-kind"] }, min: 0 }));
    expect(ok.matches).toEqual([]);
    expect(ok.diagnostics).toEqual([]);
  });

  test("the zero-match trace still covers every candidate with its rejecting terms", () => {
    const ok = expectOkOk(selectDocumentsV1(INDEX, { kind: { any: ["absent-kind"] } }));
    expect(ok.trace.map((item) => item.artifactId)).toEqual(["doc-a", "doc-m", "doc-z"]);
    expect(ok.trace.every((item) => item.matched === false)).toBe(true);
    // A bare leaf root is itself the deciding term at the root subject.
    expect(ok.trace[0]?.terms).toEqual([{ subject: "selector", outcome: "rejected" }]);
  });

  test("an empty index selects nothing and announces it", () => {
    const ok = expectOkOk(selectDocumentsV1(projection([]), { tag: { any: ["release"] } }));
    expect(ok.matches).toEqual([]);
    expect(ok.trace).toEqual([]);
    expect(ok.diagnostics).toEqual([
      { code: "sothoth.selectors/zero-match-diagnostic", subject: "selector" },
    ]);
  });
});

describe("order independence and byte stability", () => {
  test("permuted index input yields byte-equal selection results and traces", () => {
    const forward = selectDocumentsV1(INDEX, {
      all: [{ not: { status: { any: ["draft"] } } }],
      min: 1,
    });
    const reversed = selectDocumentsV1(REVERSED_INDEX, {
      all: [{ not: { status: { any: ["draft"] } } }],
      min: 1,
    });
    expect(canonicalJson(forward)).toBe(canonicalJson(reversed));
  });

  test("parsing the same source twice yields the identical canonical AST, byte for byte", () => {
    const source = {
      all: [{ any: [{ tag: { any: ["b", "a"] } }, { path: "docs/**" }] }, { not: { namespace: "sothoth.selectors" } }],
      min: 0,
    };
    const first = parseSelectorV1(source);
    const second = parseSelectorV1(source);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(canonicalJson(first.ast)).toBe(canonicalJson(second.ast));
    }
  });

  test("output order depends only on the canonical key, never on arrival order", () => {
    const one = expectOkOk(selectDocumentsV1(INDEX, { owner: { any: ["team-a"] } }));
    const two = expectOkOk(selectDocumentsV1(REVERSED_INDEX, { owner: { any: ["team-a"] } }));
    expect(one.matches.map((match) => match.artifactId)).toEqual(
      two.matches.map((match) => match.artifactId),
    );
    expect(one.trace.map((item) => item.artifactId)).toEqual(
      two.trace.map((item) => item.artifactId),
    );
  });
});

describe("immutability and input isolation", () => {
  test("the selector input object is never mutated by parsing or selection", () => {
    const source = {
      all: [{ tag: { any: ["release"] } }],
      min: 0,
    };
    const snapshot = canonicalJson(source);
    const parsed = parseSelectorV1(source);
    expect(parsed.ok).toBe(true);
    selectDocumentsV1(INDEX, source);
    expect(canonicalJson(source)).toBe(snapshot);
  });

  test("parse results, selection results, and traces are deeply frozen", () => {
    const parsed = parseSelectorV1({ all: [{ tag: { any: ["release"] } }] });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(Object.isFrozen(parsed.ast)).toBe(true);
      const nested = (parsed.ast as { all?: readonly unknown[] }).all ?? [];
      expect(Object.isFrozen(nested)).toBe(true);
      expect(Object.isFrozen((nested[0] as { tag?: unknown }).tag)).toBe(true);
    }
    const ok = expectOkOk(selectDocumentsV1(INDEX, { tag: { any: ["release"] } }));
    expect(Object.isFrozen(ok)).toBe(true);
    expect(Object.isFrozen(ok.matches)).toBe(true);
    expect(Object.isFrozen(ok.matches[0])).toBe(true);
    expect(Object.isFrozen(ok.trace)).toBe(true);
    expect(Object.isFrozen(ok.trace[0])).toBe(true);
    expect(Object.isFrozen(ok.trace[0]?.terms)).toBe(true);
    expect(Object.isFrozen(ok.diagnostics)).toBe(true);
  });

  test("freezing the canonical AST does not freeze the caller's source object", () => {
    const source = { tag: { any: ["release"] } };
    const parsed = parseSelectorV1(source);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(Object.isFrozen(parsed.ast)).toBe(true);
    }
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(source.tag)).toBe(false);
    // The canonical AST shares no array alias with the caller's declaration.
    expect(Object.isFrozen(source.tag.any)).toBe(false);
  });
});

describe("parse and selection rejections carry typed issues with exact subjects", () => {
  test("issues are canonically ordered by code, then subject", () => {
    const parsed = parseSelectorV1({ any: [{ path: "/abs" }, { nope: 1 }] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("expected parse rejection");
    }
    expect(parsed.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "selector.any[0].path" },
      { code: "sothoth.selectors/invalid-selector", subject: "selector.any[1]" },
      { code: "sothoth.selectors/invalid-selector", subject: "selector.any[1].nope" },
    ]);
  });

  test("a malformed index container fails closed with an exact subject", () => {
    const result = selectDocumentsV1(undefined, { tag: { any: ["release"] } });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the malformed index to fail the selection");
    }
    expect(result.issues).toEqual([
      { code: "sothoth.selectors/invalid-selector", subject: "index" },
    ]);
  });
});

describe("package boundary", () => {
  test("the exports map resolves exactly the five accepted subpaths and rejects the bare root", () => {
    const probe = `
      const out = [];
      for (const sub of ["parse", "ast", "match", "cardinality", "explain"]) {
        out.push(import.meta.resolve("@sothoth/selectors/" + sub));
      }
      let bare = "";
      try { import.meta.resolve("@sothoth/selectors"); } catch (error) { bare = error.code; }
      console.log(JSON.stringify({ out, bare }));
    `;
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: `${root}/packages/selectors`,
      encoding: "utf8",
    });
    const resolution = JSON.parse(stdout) as { out: string[]; bare: string };
    const repo = root.endsWith("/") ? root.slice(0, -1) : root;
    expect(resolution.out).toEqual([
      `file://${repo}/packages/selectors/dist/parser.js`,
      `file://${repo}/packages/selectors/dist/index.js`,
      `file://${repo}/packages/selectors/dist/evaluate.js`,
      `file://${repo}/packages/selectors/dist/evaluate.js`,
      `file://${repo}/packages/selectors/dist/evaluate.js`,
    ]);
    expect(resolution.bare).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
  });

  test("runtime and type export sets are exactly the accepted module surfaces", async () => {
    expect(Object.keys(await import("../../packages/selectors/src/parser.js")).sort()).toEqual([
      "DEFAULT_SELECTOR_BUDGETS_V1",
      "parseSelectorV1",
    ]);
    expect(
      Object.keys(await import("../../packages/selectors/src/evaluate.js")).sort(),
    ).toEqual(["SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1", "selectDocumentsV1"]);
    // `/ast` exposes the closed canonical form as type-only vocabulary: the
    // runtime namespace is empty and the closure is pinned by the type-level
    // pins below (the retained M-1 posture of the preceding packages).
    expect(Object.keys(selectorAst).sort()).toEqual([]);
    // No source file exists outside the plan whitelist, and no root barrel is exported.
    const topLevel = (await readdir(`${root}/packages/selectors/src`))
      .filter((name) => name.endsWith(".ts"))
      .sort();
    expect(topLevel).toEqual(["evaluate.ts", "glob.ts", "index.ts", "parser.ts"]);
  });

  test("type-level export closure pins for the closed canonical form", () => {
    const pins: unknown[] = [
      ((): AstTypes.SelectorV1 => ({ all: [] }))(),
      ((): AstTypes.SelectorV1 => ({ any: [] }))(),
      ((): AstTypes.SelectorV1 => ({ not: { artifactId: "x" } }))(),
      ((): AstTypes.SelectorV1 => ({ artifactId: "x" }))(),
      ((): AstTypes.SelectorV1 => ({ path: "a/*" }))(),
      ((): AstTypes.SelectorV1 => ({ kind: { any: ["x"] } }))(),
      ((): AstTypes.SelectorV1 => ({ status: { any: ["x"] } }))(),
      ((): AstTypes.SelectorV1 => ({ owner: { any: ["x"] } }))(),
      ((): AstTypes.SelectorV1 => ({ tag: { any: ["x"] } }))(),
      ((): AstTypes.SelectorV1 => ({ reference: { target: "x" } }))(),
      ((): AstTypes.SelectorV1 => ({ reference: { target: "x", role: "r" } }))(),
      ((): AstTypes.SelectorV1 => ({ traceability: { target: "x" } }))(),
      ((): AstTypes.SelectorV1 => ({ diagnostic: "a.b/c" }))(),
      ((): AstTypes.SelectorV1 => ({ namespace: "a.b" }))(),
      ((): AstTypes.SelectorSetV1 => ({ any: ["x"] }))(),
      ((): AstTypes.SelectorAllV1 => ({ all: [{ artifactId: "x" }] }))(),
      ((): AstTypes.SelectorAnyV1 => ({ any: [{ artifactId: "x" }] }))(),
      ((): AstTypes.SelectorNotV1 => ({ not: { artifactId: "x" } }))(),
    ];
    expect(pins).toHaveLength(18);
  });

  test("the default budgets are frozen and the declared zero-match identity is pinned", () => {
    expect(DEFAULT_SELECTOR_BUDGETS_V1).toEqual({
      maxSourceCodeUnits: 100_000,
      maxDepth: 64,
      maxPatternCodeUnits: 4_096,
      maxGlobStates: 4_000_000,
    });
    expect(Object.isFrozen(DEFAULT_SELECTOR_BUDGETS_V1)).toBe(true);
    expect(SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1).toBe("sothoth.selectors/zero-match-diagnostic");
  });
});
