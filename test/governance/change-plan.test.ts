// Task 6 / Governance Compilation — change impact and change planning
// (plan Step 1). Only `normative-dependency` and `derivation` roles produce
// `prerequisite -> dependent` Ordering Edges, and only under an explicit
// versioned mapping that every edge records. `impact` expands review scope
// without creating order, impact-only cycles stay legal, ordering cycles
// fail closed, waves are deterministic, and dispositions come from the
// closed `CHANGE_DISPOSITIONS_V1` vocabulary. The compilation applies no
// edit and writes nothing back.

import { describe, expect, test } from "vitest";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
  ResolvedRelationRecordV1,
} from "../../packages/document-index/src/index.js";
import { compileChangePlanV1 } from "../../packages/governance/src/change-plan.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const ZERO_SPAN = {
  startLine: 1,
  startColumn: 1,
  startOffset: 0,
  endLine: 1,
  endColumn: 1,
  endOffset: 0,
};

function relation(
  relationId: string,
  fromArtifactId: string,
  role: string,
  targetArtifactId: string,
  external = false,
): ResolvedRelationRecordV1 {
  return {
    relationId,
    fromArtifactId,
    kind: "reference",
    role,
    target: { artifactId: targetArtifactId, revision: null, external },
  };
}

function entry(
  artifactId: string,
  relations: readonly ResolvedRelationRecordV1[],
): DocumentEntryV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    artifactId,
    path: `docs/${artifactId}.md`,
    version: "1",
    kind: "test-artifact",
    status: "accepted",
    owner: "sothoth",
    tags: [],
    contentDigest: sha256Digest(`content of ${artifactId}`),
    blobSha: null,
    headings: [],
    sections: [{ sectionId: "body", markerSpan: ZERO_SPAN, headingId: `${artifactId}#h1`, headingSpan: ZERO_SPAN }],
    relations,
    entryDigest: sha256Digest({ artifactId, relations }),
  };
}

function indexProjection(documents: readonly DocumentEntryV1[]): DocumentIndexProjectionV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    documents,
    provenance: {
      compiler: { compilerId: "test-compiler", compilerRevision: 1 },
      budgets: {
        maxContentCodeUnits: 1000,
        maxDocuments: 100,
        maxAstNodes: 1000,
        maxRelationsPerDocument: 10,
        maxHeadingTextCodeUnits: 200,
      },
      inputs: documents.map((document) => ({
        artifactId: document.artifactId,
        path: document.path,
        version: document.version,
        contentDigest: document.contentDigest,
      })),
    },
    indexDigest: sha256Digest(documents.map((document) => document.artifactId)),
  };
}

function mapping(entries: ReadonlyArray<{ relationRole: string; edgeRole: string }>) {
  return {
    schema: "sothoth.governance/relation-role-mapping@1",
    mappingId: "TEST-MAPPING",
    mappingRevision: 2,
    entries,
  };
}

// The plan's Step 1 example shape: a changed "source" artifact related to a
// "dependent" artifact under a single mapped domain relation.
function changeFixture(options: { role: string }) {
  return {
    documentIndex: indexProjection([
      entry("source", [relation("rel-1", "source", "relates", "dependent")]),
      entry("dependent", []),
    ]),
    roleMapping: mapping([{ relationRole: "relates", edgeRole: options.role }]),
    changedArtifactIds: ["source"],
  };
}

function code(result: { diagnostics: ReadonlyArray<{ code: string; subjects: readonly string[] }> }) {
  return result.diagnostics.map((diagnostic) => `${diagnostic.code}|${diagnostic.subjects.join(",")}`);
}

function dispositionsOf(result: { artifacts: ReadonlyArray<{ artifactId: string; disposition: string }> }) {
  return new Map(result.artifacts.map((artifact) => [artifact.artifactId, artifact.disposition]));
}

describe("compileChangePlanV1 ordering versus impact", () => {
  test("impact expands review scope but never creates an ordering edge", () => {
    const result = compileChangePlanV1(changeFixture({ role: "impact" }));
    expect(result.outcome).toBe("valid");
    expect(result.artifacts.find((item) => item.artifactId === "dependent")?.disposition).toBe("review-required");
    expect(result.orderingEdges).toEqual([]);
    expect(result.artifacts.find((item) => item.artifactId === "source")?.disposition).toBe("revise");
    expect(result.schema).toBe("sothoth.governance/change-plan-projection@1");
    expect(result.mappingId).toBe("TEST-MAPPING");
    expect(result.mappingRevision).toBe(2);
  });

  test("normative-dependency produces a prerequisite->dependent ordering edge and revalidation", () => {
    const result = compileChangePlanV1({
      documentIndex: indexProjection([
        entry("consumer", [relation("rel-1", "consumer", "requires", "prereq")]),
        entry("prereq", []),
      ]),
      roleMapping: mapping([{ relationRole: "requires", edgeRole: "normative-dependency" }]),
      changedArtifactIds: ["prereq"],
    });
    expect(result.outcome).toBe("valid");
    expect(result.orderingEdges).toEqual([
      {
        prerequisiteId: "prereq",
        dependentId: "consumer",
        relationRole: "requires",
        edgeRole: "normative-dependency",
        mappingId: "TEST-MAPPING",
        mappingRevision: 2,
        originatingRelationId: "rel-1",
      },
    ]);
    expect(dispositionsOf(result)).toEqual(
      new Map([
        ["prereq", "revise"],
        ["consumer", "revalidate"],
      ]),
    );
  });

  test("derivation dependents rebuild instead of revalidating", () => {
    const result = compileChangePlanV1({
      documentIndex: indexProjection([
        entry("derived", [relation("rel-1", "derived", "derives-from", "origin")]),
        entry("origin", []),
      ]),
      roleMapping: mapping([{ relationRole: "derives-from", edgeRole: "derivation" }]),
      changedArtifactIds: ["origin"],
    });
    expect(dispositionsOf(result).get("derived")).toBe("rebuild");
    expect(result.orderingEdges[0]?.edgeRole).toBe("derivation");
  });

  test("validation, history, and navigation roles order nothing and expand nothing", () => {
    for (const edgeRole of ["validation", "history", "navigation"]) {
      const result = compileChangePlanV1(changeFixture({ role: edgeRole }));
      expect(result.outcome, edgeRole).toBe("valid");
      expect(result.orderingEdges, edgeRole).toEqual([]);
      expect(result.artifacts.find((item) => item.artifactId === "dependent")?.disposition, edgeRole).toBe(
        "unchanged",
      );
    }
  });

  test("an impact-only cycle stays legal while expanding review scope", () => {
    const result = compileChangePlanV1({
      documentIndex: indexProjection([
        entry("left", [relation("rel-1", "left", "affects", "right")]),
        entry("right", [relation("rel-2", "right", "affects", "left")]),
      ]),
      roleMapping: mapping([{ relationRole: "affects", edgeRole: "impact" }]),
      changedArtifactIds: ["left"],
    });
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.orderingEdges).toEqual([]);
    expect(dispositionsOf(result)).toEqual(
      new Map([
        ["left", "revise"],
        ["right", "review-required"],
      ]),
    );
  });

  test("an ordering cycle fails closed", () => {
    const result = compileChangePlanV1({
      documentIndex: indexProjection([
        entry("a", [relation("rel-1", "a", "requires", "b")]),
        entry("b", [relation("rel-2", "b", "requires", "a")]),
      ]),
      roleMapping: mapping([{ relationRole: "requires", edgeRole: "normative-dependency" }]),
      changedArtifactIds: ["a"],
    });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ordering-cycle|a");
    expect(result.orderingEdges).toEqual([]);
    expect(result.artifacts).toEqual([]);
    expect(result.waves).toEqual([]);
  });
});

describe("compileChangePlanV1 change sources and evidence", () => {
  const CHAIN_INDEX = indexProjection([
    entry("derived", [relation("rel-1", "derived", "derives-from", "middle")]),
    entry("middle", [relation("rel-2", "middle", "derives-from", "origin")]),
    entry("origin", []),
    entry("bystander", []),
  ]);
  const CHAIN_MAPPING = mapping([{ relationRole: "derives-from", edgeRole: "derivation" }]);

  test("a changed-artifact selector selects the change set like explicit ids", () => {
    const bySelector = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      selector: { any: [{ artifactId: "origin" }, { artifactId: "bystander" }] },
    });
    expect(bySelector.outcome).toBe("valid");
    expect(bySelector.changedArtifactIds).toEqual(["bystander", "origin"]);
    const explicit = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      changedArtifactIds: ["origin", "bystander", "origin"],
    });
    expect(explicit.changedArtifactIds).toEqual(["bystander", "origin"]);
    expect(canonicalJson(explicit.artifacts)).toBe(canonicalJson(bySelector.artifacts));
  });

  test("exactly one change source is required", () => {
    const both = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      selector: { artifactId: "origin" },
      changedArtifactIds: ["origin"],
    });
    expect(both.outcome).toBe("invalid-input");
    expect(code(both)).toContain("sothoth.governance/changed-source-invalid|input");

    const neither: Record<string, unknown> = {
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
    };
    const neitherResult = compileChangePlanV1(neither);
    expect(neitherResult.outcome).toBe("invalid-input");
    expect(code(neitherResult)).toContain("sothoth.governance/changed-source-invalid|input");
  });

  test("a rejected selector fails closed as changed-selector-invalid", () => {
    const result = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      selector: { unknownTerm: true },
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/changed-selector-invalid|selector");
  });

  test("changed identities must resolve inside the index", () => {
    const result = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      changedArtifactIds: ["ghost"],
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/changed-artifact-unresolved|ghost");
  });

  test("stale evidence snapshots invalidate the bound artifact's evidence", () => {
    const result = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      changedArtifactIds: ["origin"],
      evidenceBindings: [
        { artifactId: "bystander", snapshotIdentity: `sha256:${"0".repeat(64)}` },
        { artifactId: "origin", snapshotIdentity: CHAIN_INDEX.documents[2]!.contentDigest },
      ],
    });
    expect(result.outcome).toBe("valid");
    expect(dispositionsOf(result).get("bystander")).toBe("invalidate-evidence");
    expect(dispositionsOf(result).get("origin")).toBe("revise");
  });

  test("evidence bindings must name indexed artifacts", () => {
    const result = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      changedArtifactIds: ["origin"],
      evidenceBindings: [{ artifactId: "ghost", snapshotIdentity: `sha256:${"0".repeat(64)}` }],
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/evidence-binding-unresolved|ghost");
  });
});

describe("compileChangePlanV1 mapping compilation", () => {
  test("an unmapped domain relation interprets to nothing", () => {
    const extended = {
      documentIndex: indexProjection([
        entry("source", [
          relation("rel-1", "source", "relates", "dependent"),
          relation("rel-2", "source", "unmapped-role", "dependent"),
        ]),
        entry("dependent", []),
      ]),
      roleMapping: mapping([{ relationRole: "relates", edgeRole: "normative-dependency" }]),
      changedArtifactIds: ["dependent"],
    };
    const extendedResult = compileChangePlanV1(extended);
    expect(extendedResult.outcome).toBe("valid");
    expect(extendedResult.orderingEdges).toEqual([
      {
        prerequisiteId: "dependent",
        dependentId: "source",
        relationRole: "relates",
        edgeRole: "normative-dependency",
        mappingId: "TEST-MAPPING",
        mappingRevision: 2,
        originatingRelationId: "rel-1",
      },
    ]);
  });

  test("duplicate mapping entries and unknown edge roles fail closed", () => {
    const duplicate = compileChangePlanV1({
      ...changeFixture({ role: "impact" }),
      roleMapping: mapping([
        { relationRole: "relates", edgeRole: "impact" },
        { relationRole: "relates", edgeRole: "navigation" },
      ]),
    });
    expect(duplicate.outcome).toBe("invalid-input");
    expect(code(duplicate)).toContain("sothoth.governance/mapping-entry-duplicate|relates");

    const unknown = compileChangePlanV1({
      ...changeFixture({ role: "impact" }),
      roleMapping: mapping([{ relationRole: "relates", edgeRole: "causality" }]),
    });
    expect(unknown.outcome).toBe("invalid-input");
    expect(code(unknown)).toContain("sothoth.governance/mapping-role-unknown|relates:causality");
  });

  test("a malformed mapping fails closed as role-mapping-invalid", () => {
    const result = compileChangePlanV1({
      ...changeFixture({ role: "impact" }),
      roleMapping: { schema: "sothoth.governance/relation-role-mapping@1", mappingId: "X" },
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/role-mapping-invalid|mappingRevision");
    expect(code(result)).toContain("sothoth.governance/role-mapping-invalid|entries");
  });

  test("an ordering-mapped relation to an external target fails closed", () => {
    const result = compileChangePlanV1({
      documentIndex: indexProjection([
        entry("consumer", [relation("rel-1", "consumer", "requires", "vendor", true)]),
      ]),
      roleMapping: mapping([{ relationRole: "requires", edgeRole: "normative-dependency" }]),
      changedArtifactIds: ["consumer"],
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/relation-target-external|rel-1");
  });
});

describe("compileChangePlanV1 waves and determinism", () => {
  const CHAIN_INDEX = indexProjection([
    entry("derived", [relation("rel-1", "derived", "derives-from", "middle")]),
    entry("middle", [relation("rel-2", "middle", "derives-from", "origin")]),
    entry("origin", []),
    entry("bystander", []),
  ]);
  const CHAIN_MAPPING = mapping([{ relationRole: "derives-from", edgeRole: "derivation" }]);

  test("waves schedule the affected closure deterministically", () => {
    const result = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      changedArtifactIds: ["origin"],
    });
    expect(result.waves).toEqual([
      [{ nodeId: "origin", wave: 0 }],
      [{ nodeId: "middle", wave: 1 }],
      [{ nodeId: "derived", wave: 2 }],
    ]);
    expect(result.artifactCount).toBe(4);
    expect(result.artifacts.map((artifact) => artifact.artifactId)).toEqual([
      "bystander",
      "derived",
      "middle",
      "origin",
    ]);
  });

  test("recompilation and permuted input orderings produce identical plans", () => {
    const straight = compileChangePlanV1({
      documentIndex: CHAIN_INDEX,
      roleMapping: CHAIN_MAPPING,
      changedArtifactIds: ["origin"],
    });
    const repeat = compileChangePlanV1({
      documentIndex: structuredClone(CHAIN_INDEX),
      roleMapping: structuredClone(CHAIN_MAPPING),
      changedArtifactIds: ["origin"],
    });
    expect(canonicalJson(repeat)).toBe(canonicalJson(straight));

    const permutedIndex = indexProjection([
      entry("bystander", []),
      entry("origin", []),
      entry("middle", [relation("rel-2", "middle", "derives-from", "origin")]),
      entry("derived", [relation("rel-1", "derived", "derives-from", "middle")]),
    ]);
    const permuted = compileChangePlanV1({
      documentIndex: permutedIndex,
      roleMapping: mapping([{ relationRole: "derives-from", edgeRole: "derivation" }]),
      changedArtifactIds: ["origin"],
    });
    expect(canonicalJson(permuted)).toBe(canonicalJson(straight));
  });

  test("the compilation never mutates its inputs", () => {
    const facts = {
      documentIndex: structuredClone(CHAIN_INDEX),
      roleMapping: structuredClone(CHAIN_MAPPING),
      changedArtifactIds: ["origin"],
    };
    const before = canonicalJson(facts);
    compileChangePlanV1(facts);
    expect(canonicalJson(facts)).toBe(before);
  });
});
