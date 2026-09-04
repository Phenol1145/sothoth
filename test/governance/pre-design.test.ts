// Task 6 / Governance Compilation — pre-design closure and Scope BOM
// admissibility (plan Step 1). The compiler validates catalog/registration
// uniqueness, the contract's closed topic set, exact-section inheritance,
// inheritance DAGs, Producer/Consumer contract agreement, unique truth
// owners, criteria cardinality, external acceptance, and Scope BOM
// designRefs; it emits digest-bearing, byte-stable projections only and
// never mutates a Source Fact. Structural sections come from the Document
// Index projection; markdown arrives as declared input data and only ever
// feeds digest binding.

import { describe, expect, test } from "vitest";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
} from "../../packages/document-index/src/index.js";
import {
  compileDesignClosureV1,
  compileScopeBomAdmissibilityV1,
} from "../../packages/governance/src/pre-design.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ZERO_SPAN = {
  startLine: 1,
  startColumn: 1,
  startOffset: 0,
  endLine: 1,
  endColumn: 1,
  endOffset: 0,
};

const MARKDOWN_A = `<!-- sothoth:section id="alpha" -->\n# Alpha\nprose\n<!-- sothoth:section id="beta" -->\n# Beta\nprose\n`;
const MARKDOWN_B = `<!-- sothoth:section id="alpha" -->\n# Alpha\nprose\n<!-- sothoth:section id="beta" -->\n# Beta\nprose\n`;

function indexEntry(artifactId: string, sectionIds: readonly string[]): DocumentEntryV1 {
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
  references: {
    exactFields: ["documentId", "documentRevision", "sectionId", "applicability"],
  },
  criteria: { minimumPerRegistration: 1, fields: ["criterionId", "sectionId"] },
};

const CATALOG = {
  schema: "sothoth.design-scope-catalog/v1",
  catalogId: "TEST-CATALOG",
  catalogRevision: 1,
  targetReleaseIntent: "0.1.0",
  status: "working",
  candidates: [
    {
      componentId: "@test/a",
      designId: "TEST-A-DOSSIER",
      artifactType: "npm-package",
      designRequirement: "full",
      coverage: "complete",
      owner: "sothoth",
    },
    {
      componentId: "@test/b",
      designId: "TEST-B-DOSSIER",
      artifactType: "npm-package",
      designRequirement: "full",
      coverage: "complete",
      owner: "sothoth",
    },
  ],
  externalRelations: [],
  deferredCapabilities: [],
};

const REGISTRY = {
  schema: "sothoth.design-document-registry/v1",
  registryId: "TEST-REGISTRY",
  registryRevision: 1,
  documents: [
    { documentId: "DOC-A", documentRevision: 1, path: "docs/DOC-A.md", status: "accepted", sectionIds: ["alpha", "beta"] },
    { documentId: "DOC-B", documentRevision: 1, path: "docs/DOC-B.md", status: "accepted", sectionIds: ["alpha", "beta"] },
  ],
};

const REGISTRATION_A = {
  designId: "TEST-A-DOSSIER",
  componentId: "@test/a",
  designRevision: 1,
  designRequirement: "full",
  status: "accepted",
  documentRef: { documentId: "DOC-A", documentRevision: 1 },
  topicCoverage: {
    identity: { resolution: "local", sectionId: "alpha", refs: [], reason: null },
    verification: { resolution: "local", sectionId: "beta", refs: [], reason: null },
  },
  providedContractRefs: ["CONTRACT/TEST/PRE@1"],
  requiredContractRefs: [],
  producedStateRefs: ["test.a/state@1"],
  consumedStateRefs: [],
  issuedAuthorityRefs: [],
  requiredAuthorityRefs: [],
  emittedObservationRefs: [],
  deploymentDependencyRefs: [],
  acceptanceCriteria: [{ criterionId: "a-criterion", sectionId: "beta" }],
  supersedes: null,
};

const REGISTRATION_B = {
  designId: "TEST-B-DOSSIER",
  componentId: "@test/b",
  designRevision: 1,
  designRequirement: "full",
  status: "accepted",
  documentRef: { documentId: "DOC-B", documentRevision: 1 },
  topicCoverage: {
    identity: {
      resolution: "inherited",
      sectionId: null,
      refs: [
        {
          documentId: "DOC-A",
          documentRevision: 1,
          sectionId: "alpha",
          applicability: "adopts",
        },
      ],
      reason: null,
    },
    verification: {
      resolution: "not-applicable",
      sectionId: null,
      refs: [],
      reason: "covered by the inherited contract",
    },
  },
  providedContractRefs: [],
  requiredContractRefs: ["CONTRACT/TEST/PRE@1"],
  producedStateRefs: ["test.b/state@1"],
  consumedStateRefs: [],
  issuedAuthorityRefs: [],
  requiredAuthorityRefs: [],
  emittedObservationRefs: [],
  deploymentDependencyRefs: [],
  acceptanceCriteria: [{ criterionId: "b-criterion", sectionId: "beta" }],
  supersedes: null,
};

const REGISTRATIONS = {
  schema: "sothoth.artifact-design-registrations/v1",
  collectionId: "TEST-REGISTRATIONS",
  collectionRevision: 1,
  registrations: [REGISTRATION_A, REGISTRATION_B],
};

const BASELINE = {
  schema: "sothoth.architecture-baseline/v1",
  baselineId: "TEST-BASELINE",
  baselineRevision: 1,
  targetRelease: "0.1.0",
  status: "accepted",
  acceptedBy: { principalType: "human", principalId: "test-owner" },
  acceptedAt: "2026-09-01",
  members: [
    {
      componentId: "@test/a",
      designId: "TEST-A-DOSSIER",
      designRevision: 1,
      documentRef: { documentId: "DOC-A", documentRevision: 1 },
      dossierDigest: sha256Digest(MARKDOWN_A),
    },
    {
      componentId: "@test/b",
      designId: "TEST-B-DOSSIER",
      designRevision: 1,
      documentRef: { documentId: "DOC-B", documentRevision: 1 },
      dossierDigest: sha256Digest(MARKDOWN_B),
    },
  ],
};

const SCOPE_BOM = {
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
      designRef: {
        architectureBaselineId: "TEST-BASELINE",
        architectureBaselineRevision: 1,
        designId: "TEST-A-DOSSIER",
        designRevision: 1,
      },
      completionGates: [{ gateId: "gate-a", criterionIds: ["a-criterion"] }],
    },
    {
      id: "@test/b",
      version: "0.1.0",
      type: "npm-package",
      layer: "required",
      owner: "sothoth",
      designRef: {
        architectureBaselineId: "TEST-BASELINE",
        architectureBaselineRevision: 1,
        designId: "TEST-B-DOSSIER",
        designRevision: 1,
      },
      completionGates: [{ gateId: "gate-b", criterionIds: ["b-criterion"] }],
    },
  ],
};

function closureFacts() {
  return {
    contract: structuredClone(CONTRACT),
    catalog: structuredClone(CATALOG),
    registry: structuredClone(REGISTRY),
    registrations: structuredClone(REGISTRATIONS),
    documents: { "DOC-A": MARKDOWN_A, "DOC-B": MARKDOWN_B },
    documentIndex: indexProjection([indexEntry("DOC-A", ["alpha", "beta"]), indexEntry("DOC-B", ["alpha", "beta"])]),
  };
}

function scopeFacts() {
  return {
    ...closureFacts(),
    architectureBaseline: structuredClone(BASELINE),
    scopeBom: structuredClone(SCOPE_BOM),
  };
}

function code(result: { diagnostics: ReadonlyArray<{ code: string; subjects: readonly string[] }> }) {
  return result.diagnostics.map((diagnostic) => `${diagnostic.code}|${diagnostic.subjects.join(",")}`);
}

describe("compileDesignClosureV1 over a conforming fact set", () => {
  test("projects a valid, acceptance-ready closure with digest-bound members", () => {
    const result = compileDesignClosureV1(closureFacts());
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.schema).toBe("sothoth.governance/design-closure-compilation@1");
    const projection = result.projection;
    expect(projection).not.toBeNull();
    expect(projection?.schema).toBe("sothoth.design-closure-projection/v1");
    expect(projection?.phase).toBe("closure");
    expect(projection?.outcome).toBe("valid");
    expect(projection?.readyForAcceptance).toBe(true);
    expect(projection?.memberCount).toBe(2);
    expect(projection?.diagnosticCount).toBe(0);
    expect(projection?.sourceFactsDigest).toMatch(DIGEST_PATTERN);
    expect(projection?.members.map((member) => member.componentId)).toEqual(["@test/a", "@test/b"]);
    expect(projection?.members[0]).toEqual({
      componentId: "@test/a",
      designId: "TEST-A-DOSSIER",
      registrationStatus: "accepted",
      designRevision: 1,
      documentRef: { documentId: "DOC-A", documentRevision: 1 },
      localTopics: 2,
      inheritedTopics: 0,
      notApplicableTopics: 0,
      criteria: 1,
    });
    expect(projection?.members[1]?.localTopics).toBe(0);
    expect(projection?.members[1]?.inheritedTopics).toBe(1);
    expect(projection?.members[1]?.notApplicableTopics).toBe(1);
  });

  test("recompilation is byte-identical", () => {
    const first = compileDesignClosureV1(closureFacts());
    const second = compileDesignClosureV1(closureFacts());
    expect(canonicalJson(first.projection)).toBe(canonicalJson(second.projection));
  });

  test("permuted registry and registration orderings compile to identical bytes", () => {
    const facts = closureFacts();
    facts.registry.documents = [...facts.registry.documents].reverse();
    facts.registrations.registrations = [...facts.registrations.registrations].reverse();
    const permuted = compileDesignClosureV1(facts);
    const straight = compileDesignClosureV1(closureFacts());
    expect(canonicalJson(permuted.projection)).toBe(canonicalJson(straight.projection));
  });
});

describe("compileDesignClosureV1 closure rules fail closed", () => {
  test("a second registration for one candidate fails with registration-duplicate and a duplicate member status", () => {
    const facts = closureFacts();
    facts.registrations.registrations.push(structuredClone(REGISTRATION_A));
    const result = compileDesignClosureV1(facts);
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/registration-duplicate|@test/a");
    const member = result.projection?.members.find((candidate) => candidate.componentId === "@test/a");
    expect(member?.registrationStatus).toBe("duplicate");
    expect(member?.designRevision).toBe(0);
    expect(member?.documentRef).toBeNull();
  });

  test("a catalog candidate without any registration fails with registration-missing and a missing member status", () => {
    const facts = closureFacts();
    facts.registrations.registrations = facts.registrations.registrations.filter(
      (registration: { componentId: string }) => registration.componentId !== "@test/b",
    );
    const result = compileDesignClosureV1(facts);
    expect(code(result)).toContain("sothoth.governance/registration-missing|@test/b");
    const member = result.projection?.members.find((candidate) => candidate.componentId === "@test/b");
    expect(member?.registrationStatus).toBe("missing");
  });

  test("a registration for an unknown candidate fails with registration-orphan", () => {
    const facts = closureFacts();
    const orphan = structuredClone(REGISTRATION_A);
    orphan.componentId = "@test/ghost";
    orphan.producedStateRefs = ["test.ghost/state@1"];
    facts.registrations.registrations.push(orphan);
    const result = compileDesignClosureV1(facts);
    expect(code(result)).toContain("sothoth.governance/registration-orphan|@test/ghost");
  });

  test("a second producer of an already-owned state ref fails with truth-owner-duplicate", () => {
    const facts = closureFacts();
    facts.registrations.registrations
      .find((registration: { componentId: string }) => registration.componentId === "@test/b")!
      .producedStateRefs.push("test.a/state@1");
    const result = compileDesignClosureV1(facts);
    expect(code(result)).toContain("sothoth.governance/truth-owner-duplicate|test.a/state@1");
  });

  test("an exact-section inheritance cycle fails with inheritance-cycle on both documents", () => {
    const facts = closureFacts();
    facts.registrations.registrations
      .find((registration: { componentId: string }) => registration.componentId === "@test/a")!
      .topicCoverage.identity = {
      resolution: "inherited",
      sectionId: null,
      refs: [{ documentId: "DOC-B", documentRevision: 1, sectionId: "alpha", applicability: "adopts" }],
      reason: null,
    };
    const result = compileDesignClosureV1(facts);
    expect(code(result)).toContain("sothoth.governance/inheritance-cycle|DOC-A");
    expect(code(result)).toContain("sothoth.governance/inheritance-cycle|DOC-B");
  });

  test("topics outside the contract's closed set and missing topics fail closed", () => {
    const unknownTopic = closureFacts();
    const registration = unknownTopic.registrations.registrations[0]!;
    registration.topicCoverage = { ...registration.topicCoverage, mystery: structuredClone(registration.topicCoverage.identity) };
    expect(code(compileDesignClosureV1(unknownTopic))).toContain(
      "sothoth.governance/topic-unknown|@test/a:mystery",
    );

    const missingTopic = closureFacts();
    delete missingTopic.registrations.registrations[0]!.topicCoverage.verification;
    expect(code(compileDesignClosureV1(missingTopic))).toContain(
      "sothoth.governance/topic-missing|@test/a:verification",
    );
  });

  test("malformed topic resolutions and forbidden overrides fail closed", () => {
    const badLocal = closureFacts();
    badLocal.registrations.registrations[0]!.topicCoverage.identity = {
      resolution: "local",
      sectionId: "alpha",
      refs: [{ documentId: "DOC-B", documentRevision: 1, sectionId: "alpha", applicability: "adopts" }],
      reason: null,
    };
    expect(code(compileDesignClosureV1(badLocal))).toContain(
      "sothoth.governance/topic-resolution-invalid|@test/a:identity",
    );

    const overrides = closureFacts();
    overrides.registrations.registrations[1]!.topicCoverage.identity.refs[0]!.applicability = "overrides";
    expect(code(compileDesignClosureV1(overrides))).toContain(
      "sothoth.governance/inheritance-overrides-forbidden|@test/b:identity",
    );
  });

  test("inherited references must resolve to registered documents, revisions, and sections", () => {
    const facts = closureFacts();
    facts.registrations.registrations[1]!.topicCoverage.identity.refs[0]!.documentId = "DOC-X";
    expect(code(compileDesignClosureV1(facts))).toContain(
      "sothoth.governance/reference-unresolved|@test/b:identity",
    );
  });

  test("criteria below the contract minimum and unresolved criterion sections fail closed", () => {
    const facts = closureFacts();
    facts.contract.criteria.minimumPerRegistration = 2;
    expect(code(compileDesignClosureV1(facts))).toContain(
      "sothoth.governance/criterion-missing|@test/a",
    );

    const unresolved = closureFacts();
    unresolved.registrations.registrations[0]!.acceptanceCriteria[0]!.sectionId = "ghost";
    expect(code(compileDesignClosureV1(unresolved))).toContain(
      "sothoth.governance/criterion-unresolved|@test/a:ghost",
    );
  });

  test("Producer/Consumer contract agreement fails closed on revision splits and missing providers", () => {
    const revisionSplit = closureFacts();
    revisionSplit.registrations.registrations[0]!.providedContractRefs = ["CONTRACT/TEST/PRE@2"];
    expect(code(compileDesignClosureV1(revisionSplit))).toContain(
      "sothoth.governance/contract-revision-mismatch|CONTRACT/TEST/PRE",
    );

    const missingProvider = closureFacts();
    missingProvider.registrations.registrations[1]!.requiredContractRefs = [
      "CONTRACT/TEST/ABSENT@1",
    ];
    expect(code(compileDesignClosureV1(missingProvider))).toContain(
      "sothoth.governance/contract-edge-mismatch|CONTRACT/TEST/ABSENT@1",
    );
  });

  test("document markdown and index entries are required per registry document", () => {
    const missingMarkdown = closureFacts();
    missingMarkdown.documents["DOC-B"] = null;
    expect(code(compileDesignClosureV1(missingMarkdown))).toContain(
      "sothoth.governance/document-missing|DOC-B",
    );

    const unindexed = closureFacts();
    unindexed.documentIndex = indexProjection([indexEntry("DOC-A", ["alpha", "beta"])]);
    expect(code(compileDesignClosureV1(unindexed))).toContain(
      "sothoth.governance/document-unindexed|DOC-B",
    );
  });

  test("declared section identities must equal the indexed sections and the contract's exact list", () => {
    const declared = closureFacts();
    declared.registry.documents[1]!.sectionIds = ["beta", "alpha"];
    expect(code(compileDesignClosureV1(declared))).toContain(
      "sothoth.governance/document-sections-mismatch|DOC-B",
    );

    const contractMismatch = closureFacts();
    contractMismatch.documentIndex = indexProjection([
      indexEntry("DOC-A", ["alpha"]),
      indexEntry("DOC-B", ["alpha", "beta"]),
    ]);
    contractMismatch.registry.documents[0]!.sectionIds = ["alpha"];
    expect(code(compileDesignClosureV1(contractMismatch))).toContain(
      "sothoth.governance/contract-sections-mismatch|DOC-A",
    );
  });

  test("a shape-invalid fact fails as invalid-input and leaves no projection", () => {
    const facts = closureFacts();
    facts.contract = { schema: "sothoth.document-contract/v1" };
    const result = compileDesignClosureV1(facts);
    expect(result.outcome).toBe("invalid-input");
    expect(result.projection).toBeNull();
    expect(code(result).length).toBeGreaterThan(0);
  });

  test("compilation never mutates its input facts", () => {
    const facts = closureFacts();
    const before = canonicalJson(facts);
    compileDesignClosureV1(facts);
    expect(canonicalJson(facts)).toBe(before);
  });
});

describe("compileScopeBomAdmissibilityV1", () => {
  test("projects an admissible scope over an accepted baseline and a bound BOM", () => {
    const result = compileScopeBomAdmissibilityV1(scopeFacts());
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.schema).toBe("sothoth.governance/scope-bom-admissibility-compilation@1");
    const projection = result.projection;
    expect(projection?.schema).toBe("sothoth.scope-bom-admissibility-projection/v1");
    expect(projection?.phase).toBe("scope");
    expect(projection?.admissible).toBe(true);
    expect(projection?.architectureBaseline).toEqual({
      baselineId: "TEST-BASELINE",
      baselineRevision: 1,
      status: "accepted",
    });
    expect(projection?.scopeBom).toEqual({ bomId: "TEST-SCOPE-BOM", bomRevision: 1, targetRelease: "0.1.0" });
    expect(projection?.members.every((member) => member.designRefResolved && member.baselineMemberResolved && member.completionCriteriaResolved)).toBe(true);
    expect(projection?.sourceFactsDigest).toMatch(DIGEST_PATTERN);
  });

  test("closure and scope digests bind different fact sets and both rebuild byte-identically", () => {
    const closure = compileDesignClosureV1(closureFacts());
    const scope = compileScopeBomAdmissibilityV1(scopeFacts());
    expect(scope.projection?.sourceFactsDigest).not.toBe(closure.projection?.sourceFactsDigest);
    const scopeAgain = compileScopeBomAdmissibilityV1(scopeFacts());
    expect(canonicalJson(scope.projection)).toBe(canonicalJson(scopeAgain.projection));
  });

  test("permuted member orderings compile to identical scope bytes", () => {
    const facts = scopeFacts();
    facts.architectureBaseline.members = [...facts.architectureBaseline.members].reverse();
    facts.scopeBom.members = [...facts.scopeBom.members].reverse();
    const permuted = compileScopeBomAdmissibilityV1(facts);
    const straight = compileScopeBomAdmissibilityV1(scopeFacts());
    expect(canonicalJson(permuted.projection)).toBe(canonicalJson(straight.projection));
  });

  test("external acceptance: a baseline that is not accepted fails closed", () => {
    const facts = scopeFacts();
    facts.architectureBaseline.status = "proposed";
    const result = compileScopeBomAdmissibilityV1(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.projection?.admissible).toBe(false);
    expect(code(result)).toContain("sothoth.governance/baseline-not-accepted|TEST-BASELINE");
  });

  test("external acceptance: a retained registration that is not accepted fails closed", () => {
    const facts = scopeFacts();
    facts.registrations.registrations[1]!.status = "proposed";
    const result = compileScopeBomAdmissibilityV1(facts);
    expect(code(result)).toContain("sothoth.governance/registration-not-accepted|@test/b");
    expect(result.projection?.admissible).toBe(false);
  });

  test("a baseline member digest that does not bind the dossier bytes fails closed", () => {
    const facts = scopeFacts();
    facts.documents["DOC-A"] = `${MARKDOWN_A}<!-- edited -->`;
    const result = compileScopeBomAdmissibilityV1(facts);
    expect(code(result)).toContain("sothoth.governance/baseline-dossier-digest-mismatch|@test/a");
  });

  test("Scope BOM designRefs must resolve to the component's own accepted registration", () => {
    const facts = scopeFacts();
    facts.scopeBom.members[0]!.designRef.designRevision = 2;
    const result = compileScopeBomAdmissibilityV1(facts);
    expect(code(result)).toContain("sothoth.governance/design-ref-unresolved|@test/a");
    expect(result.projection?.members[0]?.designRefResolved).toBe(false);
  });

  test("unknown Scope BOM members and missing members fail closed", () => {
    const unknown = scopeFacts();
    unknown.scopeBom.members[0]!.id = "@test/ghost";
    expect(code(compileScopeBomAdmissibilityV1(unknown))).toContain(
      "sothoth.governance/scope-bom-member-unknown|@test/ghost",
    );

    const missing = scopeFacts();
    missing.scopeBom.members = missing.scopeBom.members.slice(0, 1);
    expect(code(compileScopeBomAdmissibilityV1(missing))).toContain(
      "sothoth.governance/scope-bom-member-missing|@test/b",
    );

    const baselineMissing = scopeFacts();
    baselineMissing.architectureBaseline.members = baselineMissing.architectureBaseline.members.slice(0, 1);
    expect(code(compileScopeBomAdmissibilityV1(baselineMissing))).toContain(
      "sothoth.governance/baseline-member-missing|@test/b",
    );
  });

  test("completion gates must cover exactly the registration criteria in code-point order", () => {
    const unknown = scopeFacts();
    unknown.scopeBom.members[0]!.completionGates = [
      { gateId: "gate-a", criterionIds: ["a-criterion", "ghost-criterion"] },
    ];
    const result = compileScopeBomAdmissibilityV1(unknown);
    expect(code(result)).toContain("sothoth.governance/scope-bom-criterion-unknown|@test/a:ghost-criterion");
    expect(result.projection?.members[0]?.completionCriteriaResolved).toBe(false);

    const unsorted = scopeFacts();
    unsorted.registrations.registrations[0]!.acceptanceCriteria = [
      { criterionId: "a-criterion", sectionId: "beta" },
      { criterionId: "a-second", sectionId: "beta" },
    ];
    unsorted.scopeBom.members[0]!.completionGates = [
      { gateId: "gate-a", criterionIds: ["a-second", "a-criterion"] },
    ];
    expect(code(compileScopeBomAdmissibilityV1(unsorted))).toContain(
      "sothoth.governance/scope-bom-criterion-order|@test/a:gate-a",
    );

    const empty = scopeFacts();
    empty.scopeBom.members[0]!.completionGates = [];
    expect(code(compileScopeBomAdmissibilityV1(empty))).toContain(
      "sothoth.governance/scope-bom-invalid|@test/a:completionGates",
    );

    const emptyCriteria = scopeFacts();
    emptyCriteria.scopeBom.members[0]!.completionGates = [
      { gateId: "gate-a", criterionIds: [] },
    ];
    expect(code(compileScopeBomAdmissibilityV1(emptyCriteria))).toContain(
      "sothoth.governance/scope-bom-gate-invalid|@test/a:gate-a",
    );
  });

  test("a baseline member bound to the wrong design revision fails closed", () => {
    const facts = scopeFacts();
    facts.architectureBaseline.members[1]!.designRevision = 2;
    const result = compileScopeBomAdmissibilityV1(facts);
    expect(code(result)).toContain(
      "sothoth.governance/baseline-member-design-mismatch|@test/b",
    );
  });

  test("a missing formal Scope BOM still yields an invalid projection, never a partial one", () => {
    const facts = scopeFacts();
    facts.scopeBom = null;
    const result = compileScopeBomAdmissibilityV1(facts);
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/scope-bom-missing|scopeBom");
    expect(result.projection).not.toBeNull();
    expect(result.projection?.members).toEqual([]);
    expect(result.projection?.scopeBom.bomId).toBeNull();
    expect(result.projection?.admissible).toBe(false);
  });
});
