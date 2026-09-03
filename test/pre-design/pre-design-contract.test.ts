import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  canonicalJsonStringify,
  checkPreDesign,
  parseStableSections,
} from "../../scripts/check-pre-design.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const runCli = promisify(execFile);

// A fulfilled promisified `execFile` result carries only `stdout` and `stderr`: the process exited
// 0, so an absent `code` normalizes to exit 0. Rejected results keep their real nonzero exit code.
function exitCodeOf(result: any): number {
  return typeof result?.code === "number" ? result.code : 0;
}

// The repository CLI maps result outcomes to process exits; assertions compare the normalized
// actual exit against the emitted outcome instead of freezing a phase as permanently invalid.
const OUTCOME_EXIT: Record<string, number> = {
  valid: 0,
  invalid: 1,
  "invalid-input": 2,
};

function expectedExitForOutcome(outcome: string): number {
  const exit = OUTCOME_EXIT[outcome];
  if (exit === undefined) throw new Error(`unexpected outcome: ${outcome}`);
  return exit;
}

function codePointCompare(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index].codePointAt(0)! - b[index].codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

const CATALOG_PATH = `${root}/docs/design/v0.1.0-design-scope-catalog.json`;
const CONTRACT_PATH = `${root}/docs/design/contracts/artifact-design-dossier.v1.json`;
const REGISTRY_PATH = `${root}/docs/design/document-registry.json`;
const REGISTRATIONS_PATH = `${root}/docs/design/artifact-design-registrations.json`;
const GOVERNANCE_DOC_PATH = `${root}/docs/design/governance-control-plane.md`;

const DESIGN_CAPSULE_ID = "DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN";
const FIXTURE_DOSSIER_ID = "DOC-FIXTURE-PACKAGE-DOSSIER";
const FIXTURE_DOSSIER_B_ID = "DOC-FIXTURE-PACKAGE-DOSSIER-B";
const BASELINE_ID = "SOTHOTH-ARCHITECTURE-BASELINE-0.1";
const BOM_ID = "SOTHOTH-RELEASE-SCOPE-BOM-0.1";

const CAPSULE_SECTION_IDS = [
  "decision",
  "authority-boundary",
  "package-architecture",
  "documents-and-selectors",
  "graphs-change-order-and-scheduling",
  "pre-design-boundary",
  "extensions-and-evidence",
  "diagnostics-and-process-outcomes",
  "release-boundary",
];

const REQUIRED_SECTIONS = [
  "decision-summary",
  "artifact-identity-and-classification",
  "purpose-and-non-goals",
  "responsibility-and-truth-ownership",
  "public-surface-and-consumers",
  "core-sdk-protocol-boundary",
  "dependency-and-topology",
  "state-lifecycle-and-data-flow",
  "authority-security-and-effects",
  "failure-recovery-and-consistency",
  "observation-and-audit",
  "deployment-configuration-and-operations",
  "compatibility-and-migration",
  "developer-and-operator-experience",
  "verification-and-acceptance-criteria",
  "future-capability-compatibility",
  "traceability-and-exact-references",
  "topic-coverage-declaration",
];

const CLOSED_TOPICS = [
  "identity",
  "intent-and-non-goals",
  "responsibility",
  "truth-ownership",
  "public-surface",
  "core-sdk-boundary",
  "dependency-boundary",
  "protocol-and-data-flow",
  "state-and-lifecycle",
  "authority-and-security",
  "failure-and-recovery",
  "concurrency-and-consistency",
  "observation-and-audit",
  "deployment-and-configuration",
  "compatibility-and-migration",
  "developer-and-operator-experience",
  "verification",
  "future-compatibility",
];

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

function localTopic(sectionId: string) {
  return { resolution: "local", sectionId, refs: [], reason: null };
}

function inheritedTopic(documentId: string, documentRevision: number, sectionId: string) {
  return {
    resolution: "inherited",
    sectionId: null,
    refs: [
      {
        documentId,
        documentRevision,
        sectionId,
        applicability: "adopts",
      },
    ],
    reason: null,
  };
}

function dossierMarkdown(): string {
  return REQUIRED_SECTIONS.map(
    (sectionId) => `<!-- sothoth:section id="${sectionId}" -->\n\n## ${sectionId}\n\nFixture body.\n`,
  ).join("\n");
}

function validRegistration(componentId: string, designId: string) {
  const topicCoverage: Record<string, unknown> = {};
  CLOSED_TOPICS.forEach((topic, index) => {
    topicCoverage[topic] = localTopic(REQUIRED_SECTIONS[index]);
  });
  const isContracts = componentId === "@sothoth/contracts";
  return {
    designId,
    componentId,
    designRevision: 1,
    designRequirement: "full",
    status: "proposed",
    documentRef: { documentId: FIXTURE_DOSSIER_ID, documentRevision: 1 },
    topicCoverage,
    providedContractRefs: isContracts ? ["@sothoth/contracts@1"] : [],
    requiredContractRefs: isContracts ? [] : ["@sothoth/contracts@1"],
    producedStateRefs: [`${componentId}:state@1`],
    consumedStateRefs: [],
    issuedAuthorityRefs: [],
    requiredAuthorityRefs: [],
    emittedObservationRefs: [],
    deploymentDependencyRefs: [],
    acceptanceCriteria: [{ criterionId: "criterion-1", sectionId: "verification-and-acceptance-criteria" }],
    supersedes: null,
  };
}

function registrationOf(facts: any, componentId: string): any {
  return facts.registrations.registrations.find(
    (registration: any) => registration.componentId === componentId,
  );
}

let baseCache: any = null;

async function baseFacts(): Promise<any> {
  if (!baseCache) {
    const catalog = await readJson(CATALOG_PATH);
    const contract = await readJson(CONTRACT_PATH);
    const registry = await readJson(REGISTRY_PATH);
    const governanceMarkdown = await readFile(GOVERNANCE_DOC_PATH, "utf8");
    const capsule = registry.documents.find((document: any) => document.documentId === DESIGN_CAPSULE_ID);
    if (!capsule) {
      throw new Error("governance capsule is not registered in the document registry");
    }
    const syntheticRegistry = {
      schema: registry.schema,
      registryId: registry.registryId,
      registryRevision: registry.registryRevision,
      documents: [
        structuredClone(capsule),
        {
          documentId: FIXTURE_DOSSIER_ID,
          documentRevision: 1,
          path: "(test fixture)",
          status: "proposed",
          sectionIds: [...REQUIRED_SECTIONS],
        },
      ],
    };
    baseCache = {
      phase: "closure",
      catalog,
      contract,
      registry: syntheticRegistry,
      documents: {
        [DESIGN_CAPSULE_ID]: governanceMarkdown,
        [FIXTURE_DOSSIER_ID]: dossierMarkdown(),
      },
      registrations: {
        schema: "sothoth.artifact-design-registrations/v1",
        collectionId: "SOTHOTH-ARTIFACT-DESIGN-REGISTRATIONS",
        collectionRevision: 1,
        registrations: catalog.candidates.map((candidate: any) =>
          validRegistration(candidate.componentId, candidate.designId),
        ),
      },
    };
  }
  return structuredClone(baseCache);
}

// The scope fixture uses the closed formal schemas: `sothoth.architecture-baseline/v1` and
// `sothoth.release-bom/v1` with completion gates. A generic in-memory fixture may use another
// non-empty principalId and a valid calendar date; only the committed Baseline records the exact
// human principal and acceptance date.
async function scopePhaseFacts(): Promise<any> {
  const facts = await baseFacts();
  facts.phase = "scope";
  for (const registration of facts.registrations.registrations) {
    registration.status = "accepted";
  }
  const dossierDigest = `sha256:${createHash("sha256").update(facts.documents[FIXTURE_DOSSIER_ID], "utf8").digest("hex")}`;
  facts.architectureBaseline = {
    schema: "sothoth.architecture-baseline/v1",
    baselineId: BASELINE_ID,
    baselineRevision: 1,
    targetRelease: "0.1.0",
    status: "accepted",
    acceptedBy: { principalType: "human", principalId: "fixture-owner" },
    acceptedAt: "2026-09-01",
    members: facts.catalog.candidates.map((candidate: any) => {
      const registration = registrationOf(facts, candidate.componentId);
      return {
        componentId: candidate.componentId,
        designId: registration.designId,
        designRevision: registration.designRevision,
        documentRef: structuredClone(registration.documentRef),
        dossierDigest,
      };
    }),
  };
  facts.scopeBom = {
    schema: "sothoth.release-bom/v1",
    bomId: BOM_ID,
    bomRevision: 1,
    targetRelease: "0.1.0",
    members: facts.catalog.candidates.map((candidate: any) => {
      const registration = registrationOf(facts, candidate.componentId);
      return {
        id: candidate.componentId,
        version: "0.1.0",
        type: "npm-package",
        layer: "required",
        owner: "sothoth",
        designRef: {
          architectureBaselineId: BASELINE_ID,
          architectureBaselineRevision: 1,
          designId: registration.designId,
          designRevision: registration.designRevision,
        },
        completionGates: [
          {
            gateId: `${candidate.componentId.slice("@sothoth/".length)}-dossier-criteria`,
            criterionIds: ["criterion-1"],
          },
        ],
      };
    }),
  };
  return facts;
}

describe("bootstrap dossier contract artifacts", () => {
  test("contract file pins the consumer-neutral full dossier contract", async () => {
    const contract = await readJson(CONTRACT_PATH);
    expect(contract.contractId).toBe("sothoth.design-dossier/full/v1");
    expect(contract.sections.requiredSectionIds).toEqual(REQUIRED_SECTIONS);
    expect(contract.topics.closedSet).toEqual(CLOSED_TOPICS);
    expect(contract.topics.resolutions).toEqual(["local", "inherited", "not-applicable"]);
    expect(contract.topics.inheritanceApplicability).toEqual(["adopts", "narrows", "specializes"]);
  });

  test("document registry pins the local design capsule at revision 2 with Task 1 section IDs", async () => {
    const registry = await readJson(REGISTRY_PATH);
    const capsule = registry.documents.find((document: any) => document.documentId === DESIGN_CAPSULE_ID);
    expect(capsule).toBeDefined();
    expect(capsule.documentRevision).toBe(2);
    expect(capsule.sectionIds).toEqual(CAPSULE_SECTION_IDS);
  });

  test("registrations file stays a structurally valid closed collection", async () => {
    const registrations = await readJson(REGISTRATIONS_PATH);
    expect(registrations.schema).toBe("sothoth.artifact-design-registrations/v1");
    expect(registrations.collectionId).toBe("SOTHOTH-ARTIFACT-DESIGN-REGISTRATIONS");
    expect(registrations.collectionRevision).toBe(3);
    expect(Array.isArray(registrations.registrations)).toBe(true);
    const registrationFields = [
      "acceptanceCriteria",
      "componentId",
      "consumedStateRefs",
      "designId",
      "designRequirement",
      "designRevision",
      "deploymentDependencyRefs",
      "documentRef",
      "emittedObservationRefs",
      "issuedAuthorityRefs",
      "producedStateRefs",
      "providedContractRefs",
      "requiredAuthorityRefs",
      "requiredContractRefs",
      "status",
      "supersedes",
      "topicCoverage",
    ].sort(codePointCompare);
    const componentIds = new Set<string>();
    for (const registration of registrations.registrations) {
      expect(Object.keys(registration).sort(codePointCompare)).toEqual(registrationFields);
      expect(["proposed", "accepted", "superseded"]).toContain(registration.status);
      expect(["full", "projection", "compatibility"]).toContain(registration.designRequirement);
      expect(componentIds.has(registration.componentId)).toBe(false);
      componentIds.add(registration.componentId);
    }
  });
});

describe("parseStableSections CommonMark marker rules", () => {
  test("accepts a blank line between the marker and its heading (AST rule, not physical adjacency)", () => {
    const parsed = parseStableSections(
      `# Title\n\n<!-- sothoth:section id="decision-summary" -->\n\n## Decision summary\n`,
    );
    expect(parsed.sectionIds).toEqual(["decision-summary"]);
    expect(parsed.issues).toEqual([]);
  });

  test("accepts a marker physically adjacent to its heading", () => {
    const parsed = parseStableSections(
      `<!-- sothoth:section id="decision-summary" -->\n## Decision summary\n`,
    );
    expect(parsed.sectionIds).toEqual(["decision-summary"]);
    expect(parsed.issues).toEqual([]);
  });

  test("rejects a marker whose next non-blank AST sibling is a paragraph", () => {
    const parsed = parseStableSections(
      `<!-- sothoth:section id="decision-summary" -->\n\nInterrupting prose.\n\n## Decision summary\n`,
    );
    expect(parsed.sectionIds).toEqual([]);
    expect(parsed.issues).toContainEqual({
      code: "sothoth.pre-design/marker-not-followed-by-heading",
      subject: "decision-summary",
    });
  });

  test("flags duplicate stable section markers", () => {
    const parsed = parseStableSections(
      `<!-- sothoth:section id="a-section" -->\n\n## A\n\n<!-- sothoth:section id="a-section" -->\n\n## A again\n`,
    );
    expect(parsed.issues).toContainEqual({
      code: "sothoth.pre-design/section-marker-duplicate",
      subject: "a-section",
    });
  });

  test("ignores HTML comments that do not exactly match the marker pattern", () => {
    const parsed = parseStableSections(
      `<!-- sothoth:section id="Not-Kebab" -->\n\n## A\n\n<!-- an ordinary comment -->\n\n## B\n`,
    );
    expect(parsed.sectionIds).toEqual([]);
    expect(parsed.issues).toEqual([]);
  });

  test("parses the repository governance document into its nine Task 1 section IDs in order", async () => {
    const parsed = parseStableSections(await readFile(GOVERNANCE_DOC_PATH, "utf8"));
    expect(parsed.sectionIds).toEqual(CAPSULE_SECTION_IDS);
    expect(parsed.issues).toEqual([]);
  });
});

describe("checkPreDesign phased validation", () => {
  test("eleven proposed registrations are closure-valid and ready for external acceptance", async () => {
    const result = checkPreDesign(await baseFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.schema).toBe("sothoth.design-closure-projection/v1");
    expect(result.projection.readyForAcceptance).toBe(true);
    expect(result.projection.members.every((member: any) => member.registrationStatus === "proposed")).toBe(true);
  });

  test("dossiers phase permits proposed registrations and emits no projection", async () => {
    const facts = await baseFacts();
    facts.phase = "dossiers";
    const result = checkPreDesign(facts);
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection).toBe(null);
  });

  test("rejects an unknown topic outside the closed set", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").topicCoverage["surprise-topic"] = localTopic("identity");
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/topic-unknown",
      subject: "@sothoth/core:surprise-topic",
    });
  });

  test("rejects a missing topic from the closed set", async () => {
    const facts = await baseFacts();
    delete registrationOf(facts, "@sothoth/core").topicCoverage["verification"];
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/topic-missing",
      subject: "@sothoth/core:verification",
    });
  });

  test("rejects two registrations for one component", async () => {
    const facts = await baseFacts();
    const core = registrationOf(facts, "@sothoth/core");
    facts.registrations.registrations.push(structuredClone(core));
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/registration-duplicate",
      subject: "@sothoth/core",
    });
  });

  test("rejects an orphan registration for an unknown component", async () => {
    const facts = await baseFacts();
    const orphan = structuredClone(registrationOf(facts, "@sothoth/core"));
    orphan.componentId = "@sothoth/orphan-example";
    facts.registrations.registrations.push(orphan);
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/registration-orphan",
      subject: "@sothoth/orphan-example",
    });
  });

  test("rejects the forbidden overrides applicability", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").topicCoverage["truth-ownership"] = {
      resolution: "inherited",
      sectionId: null,
      refs: [
        {
          documentId: DESIGN_CAPSULE_ID,
          documentRevision: 2,
          sectionId: "authority-boundary",
          applicability: "overrides",
        },
      ],
      reason: null,
    };
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/inheritance-overrides-forbidden",
      subject: "@sothoth/core:truth-ownership",
    });
  });

  test("rejects bare path inheritance that is not an exact reference", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").topicCoverage["truth-ownership"] = {
      resolution: "inherited",
      sectionId: null,
      refs: [{ path: "docs/design/governance-control-plane.md", applicability: "adopts" }],
      reason: null,
    };
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/reference-not-exact",
      subject: "@sothoth/core:truth-ownership",
    });
  });

  test("rejects a duplicate stable section marker in a dossier document", async () => {
    const facts = await baseFacts();
    const document = facts.documents[FIXTURE_DOSSIER_ID];
    facts.documents[FIXTURE_DOSSIER_ID] = document.replace(
      `<!-- sothoth:section id="decision-summary" -->`,
      `<!-- sothoth:section id="decision-summary" -->\n\n## decision-summary duplicate\n\n<!-- sothoth:section id="decision-summary" -->`,
    );
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/section-marker-duplicate",
      subject: `${FIXTURE_DOSSIER_ID}:decision-summary`,
    });
  });

  test("rejects a dossier marker whose next non-blank sibling is not a heading", async () => {
    const facts = await baseFacts();
    const document = facts.documents[FIXTURE_DOSSIER_ID];
    facts.documents[FIXTURE_DOSSIER_ID] = document.replace(
      `<!-- sothoth:section id="decision-summary" -->\n\n## decision-summary`,
      `<!-- sothoth:section id="decision-summary" -->\n\nInterrupting prose.\n\n## decision-summary`,
    );
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/marker-not-followed-by-heading",
      subject: `${FIXTURE_DOSSIER_ID}:decision-summary`,
    });
  });

  test("closure phase rejects a registration without acceptance criteria", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").acceptanceCriteria = [];
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/criterion-missing",
      subject: "@sothoth/core",
    });
  });

  test("dossiers phase tolerates empty criteria before closure is demanded", async () => {
    const facts = await baseFacts();
    facts.phase = "dossiers";
    registrationOf(facts, "@sothoth/core").acceptanceCriteria = [];
    const result = checkPreDesign(facts);
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
  });

  test("rejects a Producer/Consumer contract revision mismatch", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").requiredContractRefs = ["@sothoth/contracts@2"];
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/contract-revision-mismatch",
      subject: "@sothoth/contracts",
    });
  });

  test("rejects two registrations claiming the same truth", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/sdk").producedStateRefs.push("@sothoth/core:state@1");
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/truth-owner-duplicate",
      subject: "@sothoth/core:state@1",
    });
  });

  test("accepts exact inheritance resolved into the registered design capsule", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").topicCoverage["truth-ownership"] = inheritedTopic(
      DESIGN_CAPSULE_ID,
      2,
      "authority-boundary",
    );
    const result = checkPreDesign(facts);
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
  });

  test("rejects a resolution whose refs field is not an array, without crashing", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").topicCoverage["truth-ownership"] = {
      resolution: "inherited",
      sectionId: null,
      refs: 42,
      reason: null,
    };
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/topic-resolution-invalid",
      subject: "@sothoth/core:truth-ownership",
    });
  });

  test("rejects cyclic exact inheritance between dossier documents", async () => {
    const facts = await baseFacts();
    facts.registry.documents.push({
      documentId: FIXTURE_DOSSIER_B_ID,
      documentRevision: 1,
      path: "(test fixture)",
      status: "proposed",
      sectionIds: [...REQUIRED_SECTIONS],
    });
    facts.documents[FIXTURE_DOSSIER_B_ID] = dossierMarkdown();
    registrationOf(facts, "@sothoth/sdk").documentRef = {
      documentId: FIXTURE_DOSSIER_B_ID,
      documentRevision: 1,
    };
    registrationOf(facts, "@sothoth/core").topicCoverage["identity"] = inheritedTopic(
      FIXTURE_DOSSIER_B_ID,
      1,
      "decision-summary",
    );
    registrationOf(facts, "@sothoth/sdk").topicCoverage["identity"] = inheritedTopic(
      FIXTURE_DOSSIER_ID,
      1,
      "decision-summary",
    );
    const issues = checkPreDesign(facts).issues;
    expect(issues).toContainEqual({
      code: "sothoth.pre-design/inheritance-cycle",
      subject: FIXTURE_DOSSIER_ID,
    });
    expect(issues).toContainEqual({
      code: "sothoth.pre-design/inheritance-cycle",
      subject: FIXTURE_DOSSIER_B_ID,
    });
  });

  test("scope phase accepts an accepted baseline with accepted registrations and a resolvable Scope BOM", async () => {
    const result = checkPreDesign(await scopePhaseFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.schema).toBe("sothoth.scope-bom-admissibility-projection/v1");
    expect(result.projection.admissible).toBe(true);
    expect(result.projection.architectureBaseline).toEqual({
      baselineId: BASELINE_ID,
      baselineRevision: 1,
      status: "accepted",
    });
    expect(result.projection.scopeBom).toEqual({
      bomId: BOM_ID,
      bomRevision: 1,
      targetRelease: "0.1.0",
    });
    expect(
      result.projection.members.every(
        (member: any) =>
          member.registrationStatus === "accepted" &&
          member.designRefResolved &&
          member.baselineMemberResolved &&
          member.completionCriteriaResolved,
      ),
    ).toBe(true);
  });

  test("scope phase rejects a proposed Dossier referenced by a Scope BOM", async () => {
    const facts = await scopePhaseFacts();
    registrationOf(facts, "@sothoth/core").status = "proposed";
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/registration-not-accepted",
      subject: "@sothoth/core",
    });
  });

  test("scope phase without an Architecture Baseline fails closed", async () => {
    const facts = await scopePhaseFacts();
    delete facts.architectureBaseline;
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-missing",
      subject: "architectureBaseline",
    });
  });
});

describe("deterministic diagnostics and canonical projections", () => {
  test("diagnostic order and projection bytes ignore registration input order", async () => {
    const facts = await baseFacts();
    const first = checkPreDesign(facts);
    const reversed = structuredClone(facts);
    reversed.registrations.registrations.reverse();
    const second = checkPreDesign(reversed);
    expect(second.issues).toEqual(first.issues);
    expect(canonicalJsonStringify(second.projection)).toBe(canonicalJsonStringify(first.projection));
  });

  test("canonical JSON is byte-stable under object key insertion order", () => {
    const first = { schema: "x/v1", issues: [], projection: { b: 1, a: 2 } };
    const second = { projection: { a: 2, b: 1 }, issues: [], schema: "x/v1" };
    expect(canonicalJsonStringify(second)).toBe(canonicalJsonStringify(first));
    expect(canonicalJsonStringify(first)).toBe('{"issues":[],"projection":{"a":2,"b":1},"schema":"x/v1"}');
  });
});

describe("fix round 1: exact bootstrap references", () => {
  test.each([
    ["producedStateRefs"],
    ["consumedStateRefs"],
    ["issuedAuthorityRefs"],
    ["requiredAuthorityRefs"],
    ["emittedObservationRefs"],
    ["deploymentDependencyRefs"],
  ])("rejects a bare reference in %s", async (field: string) => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core")[field] = ["core-state-latest"];
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/reference-not-exact",
      subject: `@sothoth/core:${field}:core-state-latest`,
    });
  });

  test("rejects a zero revision in an exact state reference", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").producedStateRefs = ["@sothoth/core:state@0"];
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/reference-not-exact",
      subject: "@sothoth/core:producedStateRefs:@sothoth/core:state@0",
    });
  });

  test("accepts scoped identities carrying a positive revision", async () => {
    const facts = await baseFacts();
    registrationOf(facts, "@sothoth/core").producedStateRefs = ["@sothoth/core:state@2"];
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("valid");
    expect(result.issues).toEqual([]);
  });
});

describe("fix round 1: Scope BOM membership and designRef binding", () => {
  test("scope phase rejects a Scope BOM that drops a candidate member", async () => {
    const facts = await scopePhaseFacts();
    facts.scopeBom.members = facts.scopeBom.members.filter(
      (member: any) => member.id !== "@sothoth/sdk",
    );
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-member-missing",
      subject: "@sothoth/sdk",
    });
    expect(result.projection.admissible).toBe(false);
  });

  test("scope phase rejects a non-candidate member even when it copies a valid designRef", async () => {
    const facts = await scopePhaseFacts();
    const core = facts.scopeBom.members.find((member: any) => member.id === "@sothoth/core");
    facts.scopeBom.members.push({
      ...structuredClone(core),
      id: "@sothoth/extra-widget",
    });
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-member-unknown",
      subject: "@sothoth/extra-widget",
    });
  });

  test("scope phase rejects a member whose designRef belongs to another component", async () => {
    const facts = await scopePhaseFacts();
    const core = facts.scopeBom.members.find((member: any) => member.id === "@sothoth/core");
    const sdk = facts.scopeBom.members.find((member: any) => member.id === "@sothoth/sdk");
    sdk.designRef = structuredClone(core.designRef);
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/design-ref-component-mismatch",
      subject: "@sothoth/sdk",
    });
    const projected = result.projection.members.find(
      (member: any) => member.componentId === "@sothoth/sdk",
    );
    expect(projected.designRefResolved).toBe(false);
  });
});

describe("fix round 1: Source Facts digest and deterministic projections", () => {
  test("reversing Scope BOM member order changes neither diagnostics, projection bytes, nor the digest", async () => {
    const facts = await scopePhaseFacts();
    const first = checkPreDesign(facts);
    expect(first.projection.sourceFactsDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reversed = structuredClone(facts);
    reversed.scopeBom.members.reverse();
    const second = checkPreDesign(reversed);
    expect(second.issues).toEqual(first.issues);
    expect(second.projection.sourceFactsDigest).toBe(first.projection.sourceFactsDigest);
    expect(canonicalJsonStringify(second.projection)).toBe(canonicalJsonStringify(first.projection));
  });

  test("changing dossier prose without touching markers changes the digest and projection bytes", async () => {
    const facts = await baseFacts();
    const first = checkPreDesign(facts);
    const edited = structuredClone(facts);
    edited.documents[FIXTURE_DOSSIER_ID] = edited.documents[FIXTURE_DOSSIER_ID].replace(
      "Fixture body.",
      "Materially different body.",
    );
    const second = checkPreDesign(edited);
    expect(second.outcome).toBe("valid");
    expect(second.issues).toEqual([]);
    expect(second.projection.sourceFactsDigest).not.toBe(first.projection.sourceFactsDigest);
    expect(canonicalJsonStringify(second.projection)).not.toBe(canonicalJsonStringify(first.projection));
  });

  test("changing a topic resolution while keeping topic counts unchanged changes the digest and projection bytes", async () => {
    const facts = await baseFacts();
    const first = checkPreDesign(facts);
    const edited = structuredClone(facts);
    const coverage = registrationOf(edited, "@sothoth/core").topicCoverage;
    const identity = coverage["identity"];
    coverage["identity"] = coverage["intent-and-non-goals"];
    coverage["intent-and-non-goals"] = identity;
    const second = checkPreDesign(edited);
    expect(second.outcome).toBe("valid");
    const firstCore = first.projection.members.find((member: any) => member.componentId === "@sothoth/core");
    const secondCore = second.projection.members.find(
      (member: any) => member.componentId === "@sothoth/core",
    );
    expect(secondCore.localTopics).toBe(firstCore.localTopics);
    expect(secondCore.inheritedTopics).toBe(firstCore.inheritedTopics);
    expect(secondCore.notApplicableTopics).toBe(firstCore.notApplicableTopics);
    expect(second.projection.sourceFactsDigest).not.toBe(first.projection.sourceFactsDigest);
    expect(canonicalJsonStringify(second.projection)).not.toBe(canonicalJsonStringify(first.projection));
  });

  test("reversing the registration collection changes neither projection bytes nor the digest", async () => {
    const facts = await baseFacts();
    const first = checkPreDesign(facts);
    expect(first.projection.sourceFactsDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reversed = structuredClone(facts);
    reversed.registrations.registrations.reverse();
    const second = checkPreDesign(reversed);
    expect(second.projection.sourceFactsDigest).toBe(first.projection.sourceFactsDigest);
    expect(canonicalJsonStringify(second.projection)).toBe(canonicalJsonStringify(first.projection));
  });
});

describe("fix round 1: schema violations are invalid input", () => {
  test("schema violations in the contract, catalog, registry, and registrations wrapper are invalid-input", async () => {
    const contractBad = await baseFacts();
    contractBad.contract.schema = "sothoth.document-contract/v2";
    const contractResult = checkPreDesign(contractBad);
    expect(contractResult.outcome).toBe("invalid-input");
    expect(contractResult.projection).toBe(null);

    const catalogBad = await baseFacts();
    catalogBad.catalog = { ...catalogBad.catalog, schema: "sothoth.design-scope-catalog/v2" };
    const catalogResult = checkPreDesign(catalogBad);
    expect(catalogResult.outcome).toBe("invalid-input");
    expect(catalogResult.projection).toBe(null);

    const registryBad = await baseFacts();
    registryBad.registry.registryRevision = 0;
    const registryResult = checkPreDesign(registryBad);
    expect(registryResult.outcome).toBe("invalid-input");
    expect(registryResult.projection).toBe(null);

    const wrapperBad = await baseFacts();
    wrapperBad.registrations.schema = "sothoth.artifact-design-registrations/v2";
    const wrapperResult = checkPreDesign(wrapperBad);
    expect(wrapperResult.outcome).toBe("invalid-input");
    expect(wrapperResult.projection).toBe(null);
  });
});

describe("check-pre-design CLI", () => {
  test("repository dossiers check reports exactly the unregistered candidates", async () => {
    const catalog = await readJson(CATALOG_PATH);
    const registrations = await readJson(REGISTRATIONS_PATH);
    const registered = new Set(
      registrations.registrations.map((registration: any) => registration.componentId),
    );
    const expected = catalog.candidates
      .filter((candidate: any) => !registered.has(candidate.componentId))
      .map((candidate: any) => ({
        code: "sothoth.pre-design/registration-missing",
        subject: candidate.componentId,
      }))
      .sort((left: any, right: any) => codePointCompare(left.subject, right.subject));
    const first = await runCli("node", [`${root}/scripts/check-pre-design.mjs`, "--phase", "dossiers"]).catch(
      (error: any) => error,
    );
    const second = await runCli("node", [`${root}/scripts/check-pre-design.mjs`, "--phase", "dossiers"]).catch(
      (error: any) => error,
    );
    expect(exitCodeOf(first)).toBe(expected.length > 0 ? 1 : 0);
    expect(second.stdout).toBe(first.stdout);
    const parsed = JSON.parse(first.stdout);
    expect(parsed.phase).toBe("dossiers");
    expect(parsed.outcome).toBe(expected.length > 0 ? "invalid" : "valid");
    expect(parsed.issues).toEqual(expected);
    expect(`${canonicalJsonStringify(parsed)}\n`).toBe(first.stdout);
  });

  test("--output writes identical canonical bytes; default runs write no files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sothoth-pre-design-"));
    try {
      const defaultRun = await runCli("node", [`${root}/scripts/check-pre-design.mjs`, "--phase", "scope"]).catch(
        (error: any) => error,
      );
      const defaultParsed = JSON.parse(defaultRun.stdout);
      expect(defaultParsed.phase).toBe("scope");
      expect(defaultRun.stdout).toBe(`${canonicalJsonStringify(defaultParsed)}\n`);
      expect(exitCodeOf(defaultRun)).toBe(expectedExitForOutcome(defaultParsed.outcome));
      expect(await readdir(dir)).toEqual([]);

      const outPath = join(dir, "closure.json");
      const withOutput = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "closure",
        "--output",
        outPath,
      ]).catch((error: any) => error);
      const outputParsed = JSON.parse(withOutput.stdout);
      expect(outputParsed.phase).toBe("closure");
      expect(withOutput.stdout).toBe(`${canonicalJsonStringify(outputParsed)}\n`);
      expect(exitCodeOf(withOutput)).toBe(expectedExitForOutcome(outputParsed.outcome));
      const written = await readFile(outPath, "utf8");
      expect(written).toBe(withOutput.stdout);
      expect(await readdir(dir)).toEqual(["closure.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("CLI exits 2 with one invalid-input result when a --baseline file is unreadable", async () => {
    const run = await runCli("node", [
      `${root}/scripts/check-pre-design.mjs`,
      "--phase",
      "scope",
      "--baseline",
      join(tmpdir(), "sothoth-no-such-baseline.json"),
    ]).catch((error: any) => error);
    expect(run.code).toBe(2);
    const parsed = JSON.parse(run.stdout);
    expect(parsed.outcome).toBe("invalid-input");
    expect(parsed.issues[0].code).toBe("sothoth.pre-design/source-unreadable");
    expect(`${canonicalJsonStringify(parsed)}\n`).toBe(run.stdout);
  });

  test("--output into a missing parent directory yields exactly one invalid-input result and exit 2", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sothoth-pre-design-"));
    try {
      const outPath = join(dir, "missing-parent", "result.json");
      const run = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "dossiers",
        "--output",
        outPath,
      ]).catch((error: any) => error);
      expect(run.code).toBe(2);
      const parsed = JSON.parse(run.stdout);
      expect(parsed.outcome).toBe("invalid-input");
      expect(parsed.phase).toBe("dossiers");
      expect(parsed.projection).toBe(null);
      expect(parsed.issues).toEqual([{ code: "sothoth.pre-design/output-unwritable", subject: outPath }]);
      expect(`${canonicalJsonStringify(parsed)}\n`).toBe(run.stdout);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
