// Task 10 / Public SDK facade — delegation-only conformance over the real
// upstream capabilities of Tasks 2–9. Every semantic operation must delegate
// to its owning package and return the owner's typed outcome verbatim inside
// the closed facade envelope; the facade performs no semantic step itself.
// Criteria owned here: sdk-facade-delegation-only, sdk-import-boundary-
// closure, sdk-no-domain-truth, sdk-no-exit-code-authority,
// sdk-no-generic-graph-wrap.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

// The facade under test, imported from workspace sources.
import {
  SDK_DELEGATES_V1,
  SDK_RUNTIME_IMPORT_ALLOWLIST_V1,
  buildDocumentIndex,
  checkDesignClosure,
  compileChangePlan,
  compileGovernance,
  compilePlanning,
  createGitSourceAdapterV1,
  createSothothV1,
  explainSelector,
  loadConsumerProfile,
  runConsumerProfileConformance,
  selectDocuments,
  verifyProjectionDigest,
} from "../../packages/sdk/src/index.js";

// The owners, imported directly: delegation identity is proven against these.
import { buildDocumentIndexV1 } from "../../packages/document-index/src/index.js";
import type { DocumentIndexProjectionV1 } from "../../packages/document-index/src/index.js";
import { compileDesignClosureV1, compileScopeBomAdmissibilityV1 } from "../../packages/governance/src/pre-design.js";
import { compileChangePlanV1 } from "../../packages/governance/src/change-plan.js";
import { compileDependencyScheduleV1 } from "../../packages/planning/src/schedule.js";
import { selectDocumentsV1 } from "../../packages/selectors/src/evaluate.js";
import { defineProfileV1, validateProfileV1 } from "../../packages/profile-sdk/src/profile.js";
import { runProfileConformanceV1 } from "../../packages/profile-sdk/src/conformance.js";
import { createGitSourceAdapterV1 as createGitSourceAdapterV1Direct } from "../../packages/git/src/index.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// ---------------------------------------------------------------------------
// Shared fixtures (compact forms of the Task 6/7/8/9 suite fixtures)
// ---------------------------------------------------------------------------

const REAL_MARKDOWN_A = `<!-- sothoth:section id="alpha" -->\n# Alpha\nprose\n<!-- sothoth:section id="beta" -->\n# Beta\nprose\n`;
const REAL_MARKDOWN_B = `<!-- sothoth:section id="alpha" -->\n# Alpha\nother prose\n`;

function indexInput() {
  return {
    sources: [
      {
        artifactId: "DOC-A",
        path: "docs/DOC-A.md",
        version: "1",
        content: REAL_MARKDOWN_A,
        contentDigest: sha256Digest(REAL_MARKDOWN_A),
        blobSha: null,
        kind: "dossier",
        status: "accepted",
        owner: "sothoth",
        tags: ["zeta", "alpha"],
        references: [],
      },
      {
        artifactId: "DOC-B",
        path: "docs/DOC-B.md",
        version: "1",
        content: REAL_MARKDOWN_B,
        contentDigest: sha256Digest(REAL_MARKDOWN_B),
        blobSha: null,
        kind: "dossier",
        status: "accepted",
        owner: "sothoth",
        tags: [],
        references: [],
      },
    ],
    budgets: {
      maxContentCodeUnits: 100_000,
      maxDocuments: 100,
      maxAstNodes: 100_000,
      maxRelationsPerDocument: 100,
      maxHeadingTextCodeUnits: 2_000,
    },
    compiler: { compilerId: "sothoth-sdk-test", compilerRevision: 1 },
  };
}

const ZERO_SPAN = {
  startLine: 1,
  startColumn: 1,
  startOffset: 0,
  endLine: 1,
  endColumn: 1,
  endOffset: 0,
};

function indexEntry(artifactId: string, sectionIds: readonly string[]) {
  return {
    schema: "sothoth.document-index/document-index@1",
    artifactId,
    path: `docs/${artifactId}.md`,
    version: "1",
    kind: "test-dossier",
    status: "accepted",
    owner: "sothoth",
    tags: [],
    contentDigest: sha256Digest(`content of ${artifactId}`),
    blobSha: null,
    headings: [],
    sections: sectionIds.map((sectionId, index) => ({
      sectionId,
      markerSpan: ZERO_SPAN,
      headingId: `${artifactId}#h${index + 1}`,
      headingSpan: ZERO_SPAN,
    })),
    relations: [],
    entryDigest: sha256Digest({ artifactId, sectionIds }),
  };
}

function indexProjectionOf(documents: readonly ReturnType<typeof indexEntry>[]): DocumentIndexProjectionV1 {
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

const CONTRACT = {
  schema: "sothoth.document-contract/v1",
  contractId: "test.design-dossier/full/v1",
  contractRevision: 1,
  description: "Consumer-neutral test contract.",
  documentKind: "test-dossier",
  sections: { ordering: "exact", requiredSectionIds: ["alpha", "beta"] },
  topics: {
    closedSet: ["identity", "verification"],
    resolutions: ["local", "inherited", "not-applicable"],
    inheritanceApplicability: ["adopts", "narrows"],
  },
  references: { exactFields: ["documentId", "documentRevision", "sectionId", "applicability"] },
  criteria: { minimumPerRegistration: 1, fields: ["criterionId", "sectionId"] },
};

function closureFacts() {
  const registry = {
    schema: "sothoth.design-document-registry/v1",
    registryId: "TEST-REGISTRY",
    registryRevision: 1,
    documents: [
      { documentId: "DOC-A", documentRevision: 1, path: "docs/DOC-A.md", status: "accepted", sectionIds: ["alpha", "beta"] },
      { documentId: "DOC-B", documentRevision: 1, path: "docs/DOC-B.md", status: "accepted", sectionIds: ["alpha", "beta"] },
    ],
  };
  const registration = (designId: string, componentId: string, documentId: string, inherits: boolean) => ({
    designId,
    componentId,
    designRevision: 1,
    designRequirement: "full",
    status: "accepted",
    documentRef: { documentId, documentRevision: 1 },
    topicCoverage: inherits
      ? {
          identity: {
            resolution: "inherited",
            sectionId: null,
            refs: [{ documentId: "DOC-A", documentRevision: 1, sectionId: "alpha", applicability: "adopts" }],
            reason: null,
          },
          verification: { resolution: "not-applicable", sectionId: null, refs: [], reason: "inherited" },
        }
      : {
          identity: { resolution: "local", sectionId: "alpha", refs: [], reason: null },
          verification: { resolution: "local", sectionId: "beta", refs: [], reason: null },
        },
    providedContractRefs: inherits ? [] : ["CONTRACT/TEST/PRE@1"],
    requiredContractRefs: inherits ? ["CONTRACT/TEST/PRE@1"] : [],
    producedStateRefs: [`${componentId}/state@1`],
    consumedStateRefs: [],
    issuedAuthorityRefs: [],
    requiredAuthorityRefs: [],
    emittedObservationRefs: [],
    deploymentDependencyRefs: [],
    acceptanceCriteria: [{ criterionId: `${designId}-criterion`, sectionId: "beta" }],
    supersedes: null,
  });
  return {
    contract: structuredClone(CONTRACT),
    catalog: {
      schema: "sothoth.design-scope-catalog/v1",
      catalogId: "TEST-CATALOG",
      catalogRevision: 1,
      targetReleaseIntent: "0.1.0",
      status: "working",
      candidates: [
        { componentId: "@test/a", designId: "TEST-A-DOSSIER", artifactType: "npm-package", designRequirement: "full", coverage: "complete", owner: "sothoth" },
        { componentId: "@test/b", designId: "TEST-B-DOSSIER", artifactType: "npm-package", designRequirement: "full", coverage: "complete", owner: "sothoth" },
      ],
      externalRelations: [],
      deferredCapabilities: [],
    },
    registry,
    registrations: {
      schema: "sothoth.artifact-design-registrations/v1",
      collectionId: "TEST-REGISTRATIONS",
      collectionRevision: 1,
      registrations: [
        registration("TEST-A-DOSSIER", "@test/a", "DOC-A", false),
        registration("TEST-B-DOSSIER", "@test/b", "DOC-B", true),
      ],
    },
    documents: { "DOC-A": REAL_MARKDOWN_A, "DOC-B": REAL_MARKDOWN_A },
    documentIndex: indexProjectionOf([indexEntry("DOC-A", ["alpha", "beta"]), indexEntry("DOC-B", ["alpha", "beta"])]),
  };
}

function scopeFacts() {
  return {
    ...closureFacts(),
    architectureBaseline: {
      schema: "sothoth.architecture-baseline/v1",
      baselineId: "TEST-BASELINE",
      baselineRevision: 1,
      targetRelease: "0.1.0",
      status: "accepted",
      acceptedBy: { principalType: "human", principalId: "test-owner" },
      acceptedAt: "2026-09-01",
      members: [
        { componentId: "@test/a", designId: "TEST-A-DOSSIER", designRevision: 1, documentRef: { documentId: "DOC-A", documentRevision: 1 }, dossierDigest: sha256Digest(REAL_MARKDOWN_A) },
        { componentId: "@test/b", designId: "TEST-B-DOSSIER", designRevision: 1, documentRef: { documentId: "DOC-B", documentRevision: 1 }, dossierDigest: sha256Digest(REAL_MARKDOWN_A) },
      ],
    },
    scopeBom: {
      schema: "sothoth.release-bom/v1",
      bomId: "TEST-SCOPE-BOM",
      bomRevision: 1,
      targetRelease: "0.1.0",
      members: [
        {
          id: "@test/a",
          version: "0.1.0",
          type: "npm-package",
          layer: "required",
          owner: "sothoth",
          designRef: { architectureBaselineId: "TEST-BASELINE", architectureBaselineRevision: 1, designId: "TEST-A-DOSSIER", designRevision: 1 },
          completionGates: [{ gateId: "gate-a", criterionIds: ["TEST-A-DOSSIER-criterion"] }],
        },
        {
          id: "@test/b",
          version: "0.1.0",
          type: "npm-package",
          layer: "required",
          owner: "sothoth",
          designRef: { architectureBaselineId: "TEST-BASELINE", architectureBaselineRevision: 1, designId: "TEST-B-DOSSIER", designRevision: 1 },
          completionGates: [{ gateId: "gate-b", criterionIds: ["TEST-B-DOSSIER-criterion"] }],
        },
      ],
    },
  };
}

function changePlanFacts() {
  return {
    documentIndex: {
      schema: "sothoth.document-index/document-index@1",
      documents: [
        {
          schema: "sothoth.document-index/document-index@1",
          artifactId: "consumer",
          path: "docs/consumer.md",
          version: "1",
          kind: "test-artifact",
          status: "accepted",
          owner: "sothoth",
          tags: [],
          contentDigest: sha256Digest("consumer content"),
          blobSha: null,
          headings: [],
          sections: [{ sectionId: "body", markerSpan: ZERO_SPAN, headingId: "consumer#h1", headingSpan: ZERO_SPAN }],
          relations: [
            {
              relationId: "rel-1",
              fromArtifactId: "consumer",
              kind: "reference",
              role: "requires",
              target: { artifactId: "prereq", revision: null, external: false },
            },
          ],
          entryDigest: sha256Digest("consumer"),
        },
        {
          schema: "sothoth.document-index/document-index@1",
          artifactId: "prereq",
          path: "docs/prereq.md",
          version: "1",
          kind: "test-artifact",
          status: "accepted",
          owner: "sothoth",
          tags: [],
          contentDigest: sha256Digest("prereq content"),
          blobSha: null,
          headings: [],
          sections: [{ sectionId: "body", markerSpan: ZERO_SPAN, headingId: "prereq#h1", headingSpan: ZERO_SPAN }],
          relations: [],
          entryDigest: sha256Digest("prereq"),
        },
      ],
      provenance: {
        compiler: { compilerId: "test-compiler", compilerRevision: 1 },
        budgets: {
          maxContentCodeUnits: 1000,
          maxDocuments: 100,
          maxAstNodes: 1000,
          maxRelationsPerDocument: 10,
          maxHeadingTextCodeUnits: 200,
        },
        inputs: [
          { artifactId: "consumer", path: "docs/consumer.md", version: "1", contentDigest: sha256Digest("consumer content") },
          { artifactId: "prereq", path: "docs/prereq.md", version: "1", contentDigest: sha256Digest("prereq content") },
        ],
      },
      indexDigest: sha256Digest(["consumer", "prereq"]),
    },
    roleMapping: {
      schema: "sothoth.governance/relation-role-mapping@1",
      mappingId: "TEST-MAPPING",
      mappingRevision: 2,
      entries: [{ relationRole: "requires", edgeRole: "normative-dependency" }],
    },
    changedArtifactIds: ["prereq"],
  };
}

const CONSUMER_PROFILE = {
  schema: "sothoth.profile/consumer-profile@1",
  profileId: "TEST-PROFILE",
  profileRevision: 1,
  documentContracts: [],
  gateMacros: [],
  relationRoleMappings: [],
  diagnosticHelp: [],
  moduleLocks: [],
};

const SCHEDULING_PROBLEM = {
  tasks: [
    { taskId: "build", dependsOn: [] },
    { taskId: "test", dependsOn: ["build"] },
    { taskId: "publish", dependsOn: ["test", "sign"] },
    { taskId: "sign", dependsOn: ["build"] },
  ],
};

// ---------------------------------------------------------------------------
// Temporary Git repositories for the git facade (OS temp dir only)
// ---------------------------------------------------------------------------

const repoRoots: string[] = [];

function makeRepo(): string {
  const path = mkdtempSync(join(tmpdir(), "sothoth-sdk-git-"));
  repoRoots.push(path);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: path, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "sothoth@example.invalid");
  git("config", "user.name", "Sothoth Test");
  writeFileSync(join(path, "doc.md"), "# Doc\n");
  git("add", "-A");
  git("commit", "-qm", "base");
  return path;
}

afterAll(() => {
  for (const path of repoRoots) {
    rmSync(path, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The plan-pinned aggregate callable
// ---------------------------------------------------------------------------

describe("createSothothV1() aggregate facade", () => {
  test("exposes exactly the seven capability groups, deeply frozen", () => {
    const sothoth = createSothothV1();
    expect(Object.keys(sothoth).sort()).toEqual([
      "changePlan",
      "check",
      "compile",
      "documents",
      "git",
      "profiles",
      "verify",
    ]);
    expect(Object.isFrozen(sothoth)).toBe(true);
    for (const group of Object.values(sothoth)) {
      expect(Object.isFrozen(group)).toBe(true);
    }
  });

  test("creates a fresh facade per call — no singleton, no shared state", () => {
    const first = createSothothV1();
    const second = createSothothV1();
    expect(first).not.toBe(second);
    expect(first.documents).not.toBe(second.documents);
  });

  test("end-to-end smoke: documents/index over real markdown through buildDocumentIndexV1, then planning with a digest-bearing result", () => {
    const sothoth = createSothothV1();
    // Plan-authorized documents/index capability over real markdown input.
    const indexed = sothoth.documents.buildIndex(indexInput());
    expect(indexed.outcome).toBe("valid");
    expect(indexed.result?.ok).toBe(true);
    const projection = (indexed.result as { projection: DocumentIndexProjectionV1 }).projection;
    expect(projection.schema).toBe("sothoth.document-index/document-index@1");
    expect(projection.indexDigest).toMatch(DIGEST_PATTERN);
    expect(projection.documents.map((document) => document.artifactId)).toEqual(["DOC-A", "DOC-B"]);
    // Governance/planning delegation round-trip with a digest-bearing result.
    const scheduled = sothoth.compile.planning(SCHEDULING_PROBLEM);
    expect(scheduled.outcome).toBe("valid");
    const solution = scheduled.result as unknown as { digest: string; waves: unknown[] };
    expect(solution.digest).toMatch(DIGEST_PATTERN);
    expect(solution.waves.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Delegation identity: the facade returns the owner's typed outcome verbatim
// ---------------------------------------------------------------------------

describe("sdk-facade-delegation-only", () => {
  test("documents/index delegates to buildDocumentIndexV1 under CONTRACT/SOTHOTH/DOCUMENT-INDEX@1", () => {
    const input = indexInput();
    const inputClone = structuredClone(input);
    const viaFacade = buildDocumentIndex(input);
    const direct = buildDocumentIndexV1(input);
    // Delegation identity: the owner's typed outcome arrives verbatim.
    expect(viaFacade.result).toEqual(direct);
    expect(viaFacade.outcome).toBe("valid");
    expect(viaFacade.contractRefs).toEqual(["CONTRACT/SOTHOTH/DOCUMENT-INDEX@1"]);
    expect(viaFacade.operation).toBe("buildDocumentIndexV1");
    // The delegated callable itself is the owner's function (mutation-killable seam).
    expect(SDK_DELEGATES_V1.buildDocumentIndexV1).toBe(buildDocumentIndexV1);
    // Caller data is never mutated.
    expect(input).toEqual(inputClone);
  });

  test("check delegates to compileDesignClosureV1 and passes the owner outcome through verbatim", () => {
    const facts = closureFacts();
    const viaFacade = checkDesignClosure(facts);
    const direct = compileDesignClosureV1(facts);
    expect(viaFacade.result).toEqual(direct);
    expect(viaFacade.outcome).toBe(direct.outcome);
    expect(viaFacade.outcome).toBe("valid");
    expect((direct.projection as { sourceFactsDigest: string }).sourceFactsDigest).toMatch(DIGEST_PATTERN);
    expect(viaFacade.contractRefs).toEqual(["CONTRACT/SOTHOTH/PRE-DESIGN@1"]);
  });

  test("compile governance delegates to compileScopeBomAdmissibilityV1", () => {
    const facts = scopeFacts();
    const viaFacade = compileGovernance(facts);
    const direct = compileScopeBomAdmissibilityV1(facts);
    expect(viaFacade.result).toEqual(direct);
    expect(viaFacade.outcome).toBe("valid");
    expect((direct.projection as { sourceFactsDigest: string }).sourceFactsDigest).toMatch(DIGEST_PATTERN);
    expect(viaFacade.contractRefs).toEqual(["CONTRACT/SOTHOTH/PRE-DESIGN@1"]);
  });

  test("compile planning delegates to compileDependencyScheduleV1", () => {
    const viaFacade = compilePlanning(SCHEDULING_PROBLEM);
    const direct = compileDependencyScheduleV1(SCHEDULING_PROBLEM);
    expect(viaFacade.result).toEqual(direct);
    expect(viaFacade.outcome).toBe("valid");
    expect((direct as { digest: string }).digest).toMatch(DIGEST_PATTERN);
    expect(viaFacade.contractRefs).toEqual(["CONTRACT/SOTHOTH/PLANNING@1"]);
  });

  test("change-plan delegates to compileChangePlanV1", () => {
    const facts = changePlanFacts();
    const viaFacade = compileChangePlan(facts);
    const direct = compileChangePlanV1(facts);
    expect(viaFacade.result).toEqual(direct);
    expect(viaFacade.outcome).toBe("valid");
    const projection = direct as unknown as { orderingEdges: { prerequisiteId: string; dependentId: string }[] };
    expect(projection.orderingEdges).toEqual([
      expect.objectContaining({ prerequisiteId: "prereq", dependentId: "consumer" }),
    ]);
    expect(viaFacade.contractRefs).toEqual(["CONTRACT/SOTHOTH/CHANGE-PLAN@1"]);
  });

  test("select and explain delegate to selectDocumentsV1 (the explain-trace owner)", () => {
    const projection = indexProjectionOf([indexEntry("DOC-A", ["alpha", "beta"]), indexEntry("DOC-B", ["alpha", "beta"])]);
    const selector = { kind: { any: ["test-dossier"] } };
    const request = { documentIndex: projection, selector };
    const viaSelect = selectDocuments(request);
    const viaExplain = explainSelector(request);
    const direct = selectDocumentsV1(projection, selector);
    expect(viaSelect.result).toEqual(direct);
    expect(viaExplain.result).toEqual(direct);
    expect(viaSelect.outcome).toBe("valid");
    const result = direct as unknown as { matches: { artifactId: string }[]; trace: { artifactId: string }[] };
    expect(result.matches.map((match) => match.artifactId)).toEqual(["DOC-A", "DOC-B"]);
    expect(result.trace.length).toBe(2);
    expect(SDK_DELEGATES_V1.selectDocumentsV1).toBe(selectDocumentsV1);
    expect(viaSelect.contractRefs).toEqual(["CONTRACT/SOTHOTH/SELECTOR@1"]);
  });

  test("profiles facade delegates to profile-sdk load and conformance", () => {
    const viaLoad = loadConsumerProfile(CONSUMER_PROFILE);
    const directLoad = defineProfileV1(CONSUMER_PROFILE);
    expect(viaLoad.result).toEqual(directLoad);
    expect(viaLoad.outcome).toBe("valid");
    const viaConformance = runConsumerProfileConformance(CONSUMER_PROFILE);
    const directConformance = runProfileConformanceV1(CONSUMER_PROFILE);
    expect(viaConformance.result).toEqual(directConformance);
    expect(viaConformance.outcome).toBe("valid");
    expect(SDK_DELEGATES_V1.defineProfileV1).toBe(defineProfileV1);
    expect(SDK_DELEGATES_V1.runProfileConformanceV1).toBe(runProfileConformanceV1);
    expect(viaConformance.contractRefs).toEqual(["CONTRACT/SOTHOTH/CONSUMER-PROFILE@1"]);
  });

  test("every delegated callable in SDK_DELEGATES_V1 is its owner's function by reference", () => {
    expect(SDK_DELEGATES_V1.compileDesignClosureV1).toBe(compileDesignClosureV1);
    expect(SDK_DELEGATES_V1.compileScopeBomAdmissibilityV1).toBe(compileScopeBomAdmissibilityV1);
    expect(SDK_DELEGATES_V1.compileChangePlanV1).toBe(compileChangePlanV1);
    expect(SDK_DELEGATES_V1.compileDependencyScheduleV1).toBe(compileDependencyScheduleV1);
    expect(SDK_DELEGATES_V1.buildDocumentIndexV1).toBe(buildDocumentIndexV1);
    expect(SDK_DELEGATES_V1.selectDocumentsV1).toBe(selectDocumentsV1);
    expect(SDK_DELEGATES_V1.validateProfileV1).toBe(validateProfileV1);
    expect(SDK_DELEGATES_V1.createGitSourceAdapterV1).toBe(createGitSourceAdapterV1Direct);
  });

  test("failures forward unchanged: no softening of owner rejections", () => {
    // A malformed document-index input keeps the owner's typed rejection.
    const malformed = { sources: [{}], budgets: {}, compiler: null };
    const viaFacade = buildDocumentIndex(malformed as never);
    const direct = buildDocumentIndexV1(malformed);
    expect(viaFacade.result).toEqual(direct);
    expect(viaFacade.outcome).toBe("invalid-input");
    expect(direct.ok).toBe(false);
    expect(viaFacade.diagnostics.length).toBe(direct.issues.length);
    // A profile that fails validation forwards the owner's issues and codes.
    const badProfile = { ...CONSUMER_PROFILE, profileRevision: -1 };
    const viaProfile = runConsumerProfileConformance(badProfile);
    const directProfile = runProfileConformanceV1(badProfile);
    expect(viaProfile.result).toEqual(directProfile);
    expect(viaProfile.outcome).toBe("invalid-input");
    expect(viaProfile.diagnostics.map((diagnostic) => diagnostic.code)).toContain("sothoth.contracts/invalid-field");
    // A planning problem that fails closed forwards its folded outcome.
    const badProblem = { tasks: [{ taskId: "a", dependsOn: ["missing"] }] };
    const viaPlanning = compilePlanning(badProblem);
    const directPlanning = compileDependencyScheduleV1(badProblem);
    expect(viaPlanning.result).toEqual(directPlanning);
    expect(viaPlanning.outcome).toBe(directPlanning.outcome);
  });

  test("the envelope is the facade's only produced state, closed and frozen", () => {
    const viaFacade = buildDocumentIndex(indexInput());
    expect(viaFacade.schema).toBe("sothoth.sdk/facade-result@1");
    expect(viaFacade.capability).toBe("documents/index");
    expect(viaFacade.diagnosticCount).toBe(viaFacade.diagnostics.length);
    expect(Object.isFrozen(viaFacade)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// X9→10: the git facade delegates to the @sothoth/git public entries
// ---------------------------------------------------------------------------

describe("sdk git facade (X9→10)", () => {
  test("re-exports createGitSourceAdapterV1 as the owner's own function", () => {
    expect(createGitSourceAdapterV1).toBe(createGitSourceAdapterV1Direct);
  });

  test("adapter() snapshots equal the direct adapter's snapshots over a real repository", async () => {
    const repositoryRoot = makeRepo();
    const sothoth = createSothothV1();
    const viaFacade = await sothoth.git.createAdapter().snapshotCommit(repositoryRoot, "HEAD");
    const direct = await createGitSourceAdapterV1Direct().snapshotCommit(repositoryRoot, "HEAD");
    expect(viaFacade).toEqual(direct);
    expect(viaFacade.schema).toBe("sothoth.git/source-snapshot@1");
    expect(viaFacade.digest).toMatch(DIGEST_PATTERN);
    expect((viaFacade as { files: { path: string }[] }).files.map((file) => file.path)).toEqual(["doc.md"]);
  });

  test("fail-closed rejections pass through unsoftened", async () => {
    const repositoryRoot = makeRepo();
    const sothoth = createSothothV1();
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    await expect(sothoth.git.createAdapter().snapshotCommit(repositoryRoot, `${head}~1`)).rejects.toThrow();
    await expect(sothoth.git.createAdapter().snapshotCommit(repositoryRoot, "HEAD^{tree}")).rejects.toThrow();
    await expect(sothoth.git.createAdapter().snapshotWorkspace(join(repositoryRoot, "doc.md"))).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// verify: projection digest verification through the canonical compilation
// primitives of @sothoth/core
// ---------------------------------------------------------------------------

describe("sdk verify capability", () => {
  test("verifies a real document-index projection digest", () => {
    const direct = buildDocumentIndexV1(indexInput());
    expect(direct.ok).toBe(true);
    const projection = (direct as { projection: DocumentIndexProjectionV1 }).projection;
    const verification = verifyProjectionDigest({ document: projection, digestField: "indexDigest" });
    expect(verification.outcome).toBe("valid");
    expect(verification.result).toEqual({
      verified: true,
      digestField: "indexDigest",
      claimedDigest: projection.indexDigest,
      recomputedDigest: projection.indexDigest,
    });
    expect(verification.contractRefs).toEqual(["CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1"]);
  });

  test("a tampered digest is invalid, not valid and not invalid-input", () => {
    const direct = buildDocumentIndexV1(indexInput());
    const projection = (direct as { projection: DocumentIndexProjectionV1 }).projection;
    const tampered = { ...projection, indexDigest: `sha256:${"0".repeat(64)}` };
    const verification = verifyProjectionDigest({ document: tampered, digestField: "indexDigest" });
    expect(verification.outcome).toBe("invalid");
    expect(verification.result).toMatchObject({ verified: false });
    expect(verification.result).toMatchObject({ recomputedDigest: projection.indexDigest });
  });

  test("a malformed request fails closed as invalid-input with no result", () => {
    expect(verifyProjectionDigest({ document: null, digestField: "indexDigest" }).outcome).toBe("invalid-input");
    expect(verifyProjectionDigest({ document: {}, digestField: 7 }).outcome).toBe("invalid-input");
    expect(verifyProjectionDigest("nope").outcome).toBe("invalid-input");
    // A present string claim that does not recompute is a mismatch (invalid),
    // not a malformed request: the claim is verified and fails.
    const mismatch = verifyProjectionDigest({ document: { indexDigest: "sha256:x" }, digestField: "indexDigest" });
    expect(mismatch.outcome).toBe("invalid");
    expect(mismatch.result).toMatchObject({ verified: false });
    const absent = verifyProjectionDigest({ document: {}, digestField: "indexDigest" });
    expect(absent.outcome).toBe("invalid-input");
    expect(absent.result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Boundary scans
// ---------------------------------------------------------------------------

describe("sdk-import-boundary-closure / sdk-no-generic-graph-wrap (source scan)", () => {
  const source = readFileSync(join(repoRoot, "packages/sdk/src/index.ts"), "utf8");
  const specifiers = [...source.matchAll(/from "(@sothoth\/[^"]+)"/g)].map((match) => match[1]!);
  const packages = new Set(specifiers.map((specifier) => specifier.split("/").slice(0, 2).join("/")));

  test("imports only the eight allowlisted packages", () => {
    expect(packages).toEqual(new Set(SDK_RUNTIME_IMPORT_ALLOWLIST_V1));
    expect(SDK_RUNTIME_IMPORT_ALLOWLIST_V1).toEqual([
      "@sothoth/contracts",
      "@sothoth/core",
      "@sothoth/document-index",
      "@sothoth/git",
      "@sothoth/governance",
      "@sothoth/planning",
      "@sothoth/profile-sdk",
      "@sothoth/selectors",
    ]);
  });

  test("never imports @sothoth/graph, @sothoth/cli, or a non-allowlisted package", () => {
    expect(packages.has("@sothoth/graph")).toBe(false);
    expect(packages.has("@sothoth/cli")).toBe(false);
    expect(source.includes('from "@sothoth/graph')).toBe(false);
  });
});

describe("sdk-no-exit-code-authority / sdk-no-domain-truth", () => {
  test("no code path selects a process exit, even on failure", () => {
    const originalExit = process.exit;
    let exitCalls = 0;
    process.exit = ((() => {
      exitCalls += 1;
      throw new Error("process.exit must never be called by the SDK");
    }) as unknown) as typeof process.exit;
    try {
      expect(buildDocumentIndex({ sources: "nope" } as never).outcome).toBe("invalid-input");
      expect(checkDesignClosure(null).outcome).toBeDefined();
      expect(verifyProjectionDigest(undefined).outcome).toBe("invalid-input");
    } finally {
      process.exit = originalExit;
    }
    expect(exitCalls).toBe(0);
  });

  test("no filesystem, network, clock, or randomness module is imported by the facade", () => {
    const source = readFileSync(join(repoRoot, "packages/sdk/src/index.ts"), "utf8");
    expect(/from "node:/.test(source)).toBe(false);
    expect(/\bMath\.random\b|\bDate\.now\b|new Date\(/.test(source)).toBe(false);
  });
});
