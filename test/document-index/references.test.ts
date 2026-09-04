// §11 conformance rows routed to R: T25, T26, T27. Relation semantics come
// from §8.5/§8.6: caller-metadata declarations only, canonical identity
// ordering via the single Graph call, cycles recorded and never rejected.

import { describe, expect, test } from "vitest";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import {
  DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
  parseDocumentV1,
  type DeclaredRelationV1,
  type DocumentSourceV1,
  type RelationTargetV1,
} from "../../packages/document-index/src/parse.js";
import { resolveDocumentRelationsV1 } from "../../packages/document-index/src/references.js";

const BUDGETS = DEFAULT_DOCUMENT_INDEX_BUDGETS_V1;

function digestOf(content: string): string {
  return sha256Digest(content);
}

function sourceWith(
  artifactId: string,
  references: readonly DeclaredRelationV1[] = [],
  overrides: Partial<DocumentSourceV1> = {},
): DocumentSourceV1 {
  const content = `# ${artifactId}\n`;
  return {
    artifactId,
    path: `docs/${artifactId.toLowerCase()}.md`,
    version: "1",
    content,
    contentDigest: digestOf(content),
    blobSha: null,
    kind: "doc",
    status: "active",
    owner: "team",
    tags: [],
    references: [...references],
    ...overrides,
  };
}

function parsedOf(...sources: readonly DocumentSourceV1[]) {
  return sources.map((source) => parseDocumentV1(source, BUDGETS));
}

function reference(
  artifactId: string,
  role: string,
  target: RelationTargetV1,
): DeclaredRelationV1 {
  return { kind: "reference", role, target };
}

function target(artifactId: string, revision: number | null, external: boolean): RelationTargetV1 {
  return { artifactId, revision, external };
}

describe("resolveDocumentRelationsV1 (T25–T27)", () => {
  test("T25: mixed relations build a valid graph in canonical identity order", () => {
    const parsed = parsedOf(
      sourceWith("A", [
        reference("A", "implements", target("B", null, false)),
        { kind: "supersession", target: target("C", 2, false) },
        { kind: "traceability", target: target("EXT", null, true) },
      ]),
      sourceWith("B", [
        {
          kind: "supersession",
          target: target("C", null, false),
        },
      ]),
      sourceWith("C"),
    );
    expect(parsed.every((result) => result.ok)).toBe(true);
    const result = resolveDocumentRelationsV1(parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Canonical identity order: ascending relationId in code-point order.
    const ids = result.relations.map((relation) => relation.relationId);
    expect([...ids].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))).toEqual(ids);
    expect(result.graph.relationOrder).toEqual(ids);
    // The snapshot carries exactly the Graph canonical edge-id sequence and
    // nothing else.
    expect(Object.keys(result.graph)).toEqual(["relationOrder"]);
    // Every record carries its canonical identity and exact shape.
    for (const relation of result.relations) {
      expect(relation.relationId).toBe(
        canonicalJson({
          from: relation.fromArtifactId,
          kind: relation.kind,
          role: relation.role,
          to: relation.target.artifactId,
          revision: relation.target.revision,
        }),
      );
      if (relation.kind === "reference") {
        expect(typeof relation.role).toBe("string");
      } else {
        expect(relation.role).toBeNull();
      }
    }
    expect(result.relations).toHaveLength(4);
  });

  test("T26: unresolved, contradictory, and duplicate declarations fail closed", () => {
    const unresolved = resolveDocumentRelationsV1(
      parsedOf(sourceWith("A", [reference("A", "dep", target("MISSING", null, false))])),
    );
    expect(unresolved).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/unresolved-relation-target",
          subject: "parsed[0].source.relations[0].target.artifactId",
          location: null,
        },
      ],
    });
    const contradiction = resolveDocumentRelationsV1(
      parsedOf(
        sourceWith("A"),
        sourceWith("B", [reference("B", "dep", target("A", null, true))]),
      ),
    );
    expect(contradiction).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/external-target-contradiction",
          subject: "parsed[1].source.relations[0].target.artifactId",
          location: null,
        },
      ],
    });
    const duplicated: DeclaredRelationV1 = reference("A", "dep", target("A", null, false));
    const duplicate = resolveDocumentRelationsV1(
      parsedOf(sourceWith("A", [duplicated, duplicated])),
    );
    expect(duplicate).toEqual({
      ok: false,
      issues: [
        {
          code: "sothoth.document-index/duplicate-relation",
          subject: "parsed[0].source.relations[0]",
          location: null,
        },
      ],
    });
  });

  test("T27: self-edges, cycles, parallel edges, and the empty universe are recorded", () => {
    const selfEdge = resolveDocumentRelationsV1(
      parsedOf(
        sourceWith("A", [
          { kind: "supersession", target: target("A", null, false) },
        ]),
      ),
    );
    expect(selfEdge.ok).toBe(true);
    if (selfEdge.ok) {
      expect(selfEdge.relations).toEqual([
        {
          relationId: canonicalJson({
            from: "A",
            kind: "supersession",
            role: null,
            to: "A",
            revision: null,
          }),
          fromArtifactId: "A",
          kind: "supersession",
          role: null,
          target: { artifactId: "A", revision: null, external: false },
        },
      ]);
      expect(selfEdge.graph.relationOrder).toEqual(selfEdge.relations.map((r) => r.relationId));
    }

    const cycle = resolveDocumentRelationsV1(
      parsedOf(
        sourceWith("A", [
          { kind: "supersession", target: target("B", null, false) },
        ]),
        sourceWith("B", [
          { kind: "supersession", target: target("A", null, false) },
        ]),
      ),
    );
    expect(cycle.ok).toBe(true);
    if (cycle.ok) {
      expect(cycle.relations).toHaveLength(2);
      expect(cycle.graph.relationOrder).toEqual(cycle.relations.map((r) => r.relationId));
    }

    const parallel = resolveDocumentRelationsV1(
      parsedOf(
        sourceWith("A", [reference("A", "dep", target("C", null, false))]),
        sourceWith("B", [reference("B", "dep", target("C", null, false))]),
        sourceWith("C"),
      ),
    );
    expect(parallel.ok).toBe(true);
    if (parallel.ok) {
      expect(parallel.relations).toHaveLength(2);
      expect(parallel.relations[0]!.fromArtifactId).toBe("A");
      expect(parallel.relations[1]!.fromArtifactId).toBe("B");
    }

    const empty = resolveDocumentRelationsV1([]);
    expect(empty).toEqual({ ok: true, relations: [], graph: { relationOrder: [] } });
  });
});
