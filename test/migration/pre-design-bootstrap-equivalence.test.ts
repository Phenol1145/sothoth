// Task 6 / Governance — mandatory self-host replay (plan Step 4).
//
// This test owns the released-Governance equivalence proof for the pre-design
// bootstrap: the exact accepted revision-3 Source Facts — the eleven accepted
// Artifact Design registrations with `SOTHOTH-GRAPH-DOSSIER` and
// `SOTHOTH-DOCUMENT-INDEX-DOSSIER` at design revision 2 and the other nine at
// design revision 1, Architecture Baseline `SOTHOTH-ARCHITECTURE-BASELINE-0.1`
// revision 3, and the formal `SOTHOTH-RELEASE-SCOPE-BOM-0.1@3` — are fed to
// the shipped Governance implementation (`packages/governance/src/pre-design.ts`),
// and both canonical inner projections are compared byte-for-byte with the
// frozen revision-3 fixtures, including `sourceFactsDigest`, with the frozen
// `scripts/check-pre-design.mjs` as the independent replay reference.
//
// No revision-1 or revision-2 feed and no historical fixture participates in
// this replay; the identity pins below fail the test if the live facts drift
// away from the accepted revision-3 state. This replay is implementation
// evidence for `governance-projection-rebuild-determinism`; it claims no
// acceptance authority.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  buildDocumentIndexV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/index.js";
import type { DocumentIndexProjectionV1 } from "../../packages/document-index/src/index.js";
import { DEFAULT_DOCUMENT_INDEX_BUDGETS_V1 } from "../../packages/document-index/src/parse.js";
import {
  compileDesignClosureV1,
  compileScopeBomAdmissibilityV1,
} from "../../packages/governance/src/pre-design.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";
import { checkPreDesign } from "../../scripts/check-pre-design.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const CATALOG_PATH = `${root}/docs/design/v0.1.0-design-scope-catalog.json`;
const CONTRACT_PATH = `${root}/docs/design/contracts/artifact-design-dossier.v1.json`;
const REGISTRY_PATH = `${root}/docs/design/document-registry.json`;
const REGISTRATIONS_PATH = `${root}/docs/design/artifact-design-registrations.json`;
const BASELINE_PATH = `${root}/docs/design/v0.1.0-architecture-baseline.json`;
const SCOPE_BOM_PATH = `${root}/docs/release/v0.1.0-scope-bom.json`;
const CLOSURE_FIXTURE_PATH = `${root}/test/fixtures/pre-design-bootstrap/design-closure.json`;
const SCOPE_FIXTURE_PATH = `${root}/test/fixtures/pre-design-bootstrap/scope-bom-admissibility.json`;

// The exact revision-3 source-facts digests of the frozen fixtures.
const REVISION_3_CLOSURE_DIGEST =
  "sha256:10fe717ef0b0d3a783bac4af36bdfc24866245d4870ae71995427bad1c9e6bdc";
const REVISION_3_SCOPE_DIGEST =
  "sha256:36de3a7d058c945d1ee38c26f094188096beb6fc8eae1985ef3f10f91f0a7796";

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

interface Facts {
  contract: unknown;
  catalog: unknown;
  registry: {
    schema: string;
    registryId: string;
    registryRevision: number;
    documents: Array<{
      documentId: string;
      documentRevision: number;
      path: string;
      status: string;
      sectionIds: string[];
    }>;
  };
  registrations: {
    schema: string;
    collectionId: string;
    collectionRevision: number;
    registrations: Array<Record<string, unknown>>;
  };
  documents: Record<string, string>;
  architectureBaseline?: unknown;
  scopeBom?: unknown;
}

async function loadRevision3Facts(phase: "closure" | "scope"): Promise<Facts> {
  const contract = await readJson(CONTRACT_PATH);
  const catalog = await readJson(CATALOG_PATH);
  const registry = await readJson(REGISTRY_PATH);
  const registrations = await readJson(REGISTRATIONS_PATH);
  const documents: Record<string, string> = {};
  for (const entry of registry.documents) {
    documents[entry.documentId] = await readFile(`${root}/${entry.path}`, "utf8");
  }
  const facts: Facts = { contract, catalog, registry, registrations, documents };
  if (phase === "scope") {
    facts.architectureBaseline = await readJson(BASELINE_PATH);
    facts.scopeBom = await readJson(SCOPE_BOM_PATH);
  }
  return facts;
}

// The structural input: one Document Index projection built by the shipped
// document-index package over the exact revision-3 Dossier bytes, with index
// artifact identities bound to the registry's document identities.
function buildIndex(facts: Facts, documentKind: string): DocumentIndexProjectionV1 {
  const sources: DocumentSourceV1[] = facts.registry.documents.map((entry) => {
    const content = facts.documents[entry.documentId]!;
    return {
      artifactId: entry.documentId,
      path: entry.path,
      version: String(entry.documentRevision),
      content,
      contentDigest: sha256Digest(content),
      blobSha: null,
      kind: documentKind,
      status: entry.status,
      owner: "sothoth",
      tags: [],
      references: [],
    };
  });
  const result = buildDocumentIndexV1({
    sources,
    budgets: DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
    compiler: { compilerId: "sothoth.governance/pre-design-replay", compilerRevision: 1 },
  });
  if (!result.ok) {
    throw new Error(`revision-3 index build failed: ${canonicalJson(result.issues)}`);
  }
  return result.projection;
}

function governanceClosureInput(facts: Facts) {
  const contract = facts.contract as { documentKind: string };
  return {
    ...facts,
    documentIndex: buildIndex(facts, contract.documentKind),
  };
}

describe("revision-3 feed identity pins (no historical fixture feeds this replay)", () => {
  test("the live facts are exactly the accepted revision-3 Source Facts", async () => {
    const facts = await loadRevision3Facts("scope");
    expect(facts.registry.registryRevision).toBe(3);
    expect(facts.registrations.collectionRevision).toBe(3);
    expect(facts.registrations.registrations).toHaveLength(11);
    expect(facts.registrations.registrations.every((registration) => registration.status === "accepted")).toBe(true);
    const byComponent = new Map(
      facts.registrations.registrations.map((registration) => [
        registration.componentId as string,
        registration,
      ]),
    );
    expect(byComponent.get("@sothoth/graph")?.designRevision).toBe(2);
    expect(byComponent.get("@sothoth/document-index")?.designRevision).toBe(2);
    const others = [...byComponent.keys()].filter(
      (componentId) => componentId !== "@sothoth/graph" && componentId !== "@sothoth/document-index",
    );
    expect(others).toHaveLength(9);
    for (const componentId of others) {
      expect(byComponent.get(componentId)?.designRevision, componentId).toBe(1);
    }
    const baseline = facts.architectureBaseline as Record<string, unknown>;
    expect(baseline.baselineId).toBe("SOTHOTH-ARCHITECTURE-BASELINE-0.1");
    expect(baseline.baselineRevision).toBe(3);
    expect(baseline.status).toBe("accepted");
    const scopeBom = facts.scopeBom as Record<string, unknown>;
    expect(scopeBom.bomId).toBe("SOTHOTH-RELEASE-SCOPE-BOM-0.1");
    expect(scopeBom.bomRevision).toBe(3);
  });
});

describe("governance self-host replay over the exact revision-3 Source Facts", () => {
  test("the Design Closure projection is byte-identical to the frozen fixture and the frozen checker", async () => {
    const facts = await loadRevision3Facts("closure");
    const result = compileDesignClosureV1(governanceClosureInput(facts));
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.projection).not.toBeNull();
    expect(result.projection?.sourceFactsDigest).toBe(REVISION_3_CLOSURE_DIGEST);

    const fixture = await readJson(CLOSURE_FIXTURE_PATH);
    const fixtureBytes = canonicalJson(fixture);
    const governanceBytes = canonicalJson(result.projection);
    expect(governanceBytes).toBe(fixtureBytes);

    const checkerProjection = checkPreDesign({ phase: "closure", ...facts }).projection;
    expect(canonicalJson(checkerProjection)).toBe(fixtureBytes);
    expect(result.projection?.memberCount).toBe(11);
    expect(result.projection?.readyForAcceptance).toBe(true);
    expect(result.projection?.diagnosticCount).toBe(0);
  });

  test("the Scope BOM Admissibility projection is byte-identical to the frozen fixture and the frozen checker", async () => {
    const facts = await loadRevision3Facts("scope");
    const result = compileScopeBomAdmissibilityV1(governanceClosureInput(facts));
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.projection).not.toBeNull();
    expect(result.projection?.sourceFactsDigest).toBe(REVISION_3_SCOPE_DIGEST);

    const fixture = await readJson(SCOPE_FIXTURE_PATH);
    const fixtureBytes = canonicalJson(fixture);
    const governanceBytes = canonicalJson(result.projection);
    expect(governanceBytes).toBe(fixtureBytes);

    const checkerProjection = checkPreDesign({ phase: "scope", ...facts }).projection;
    expect(canonicalJson(checkerProjection)).toBe(fixtureBytes);
    expect(result.projection?.admissible).toBe(true);
    expect(result.projection?.memberCount).toBe(11);
  });

  test("equality covers the full projection bytes and conclusions, not selected fields", async () => {
    const closureFacts = await loadRevision3Facts("closure");
    const closure = compileDesignClosureV1(governanceClosureInput(closureFacts));
    const closureFixture = await readJson<Record<string, unknown>>(CLOSURE_FIXTURE_PATH);
    const closureProjection = closure.projection as unknown as Record<string, unknown>;
    expect(Object.keys(closureProjection).sort()).toEqual(Object.keys(closureFixture).sort());
    expect(closureProjection.members).toEqual(closureFixture.members);
    expect(closureProjection.outcome).toBe(closureFixture.outcome);
    expect(closureProjection.readyForAcceptance).toBe(closureFixture.readyForAcceptance);
    expect(closureProjection.diagnosticCount).toBe(closureFixture.diagnosticCount);
    expect(closureProjection.sourceFactsDigest).toBe(closureFixture.sourceFactsDigest);

    const scopeFacts = await loadRevision3Facts("scope");
    const scope = compileScopeBomAdmissibilityV1(governanceClosureInput(scopeFacts));
    const scopeFixture = await readJson<Record<string, unknown>>(SCOPE_FIXTURE_PATH);
    const scopeProjection = scope.projection as unknown as Record<string, unknown>;
    expect(Object.keys(scopeProjection).sort()).toEqual(Object.keys(scopeFixture).sort());
    expect(scopeProjection.members).toEqual(scopeFixture.members);
    expect(scopeProjection.architectureBaseline).toEqual(scopeFixture.architectureBaseline);
    expect(scopeProjection.scopeBom).toEqual(scopeFixture.scopeBom);
    expect(scopeProjection.admissible).toBe(scopeFixture.admissible);
  });
});

describe("governance-projection-rebuild-determinism evidence", () => {
  test("repeated compilation of identical facts is byte-identical for both projections", async () => {
    const closureFacts = await loadRevision3Facts("closure");
    const first = compileDesignClosureV1(governanceClosureInput(closureFacts));
    const second = compileDesignClosureV1(governanceClosureInput(closureFacts));
    expect(canonicalJson(first.projection)).toBe(canonicalJson(second.projection));

    const scopeFacts = await loadRevision3Facts("scope");
    const scopeFirst = compileScopeBomAdmissibilityV1(governanceClosureInput(scopeFacts));
    const scopeSecond = compileScopeBomAdmissibilityV1(governanceClosureInput(scopeFacts));
    expect(canonicalJson(scopeFirst.projection)).toBe(canonicalJson(scopeSecond.projection));
  });

  test("permuted input orderings rebuild identical projection bytes", async () => {
    const closureFacts = await loadRevision3Facts("closure");
    const straight = compileDesignClosureV1(governanceClosureInput(closureFacts));

    const permutedFacts = structuredClone(closureFacts);
    permutedFacts.registry.documents = [...permutedFacts.registry.documents].reverse();
    permutedFacts.registrations.registrations = [...permutedFacts.registrations.registrations].reverse();
    const permutedDocuments: Record<string, string> = {};
    for (const documentId of Object.keys(permutedFacts.documents).reverse()) {
      permutedDocuments[documentId] = permutedFacts.documents[documentId]!;
    }
    permutedFacts.documents = permutedDocuments;
    const permuted = compileDesignClosureV1(governanceClosureInput(permutedFacts));
    expect(canonicalJson(permuted.projection)).toBe(canonicalJson(straight.projection));

    const scopeFacts = await loadRevision3Facts("scope");
    const scopeStraight = compileScopeBomAdmissibilityV1(governanceClosureInput(scopeFacts));
    const scopePermutedFacts = structuredClone(scopeFacts);
    scopePermutedFacts.registry.documents = [...scopePermutedFacts.registry.documents].reverse();
    scopePermutedFacts.registrations.registrations = [...scopePermutedFacts.registrations.registrations].reverse();
    const baseline = scopePermutedFacts.architectureBaseline as { members: unknown[] };
    baseline.members = [...baseline.members].reverse();
    const scopeBom = scopePermutedFacts.scopeBom as { members: unknown[] };
    scopeBom.members = [...scopeBom.members].reverse();
    const scopePermuted = compileScopeBomAdmissibilityV1(governanceClosureInput(scopePermutedFacts));
    expect(canonicalJson(scopePermuted.projection)).toBe(canonicalJson(scopeStraight.projection));
  });
});
