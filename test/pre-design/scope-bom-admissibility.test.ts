import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { canonicalJsonStringify, checkPreDesign } from "../../scripts/check-pre-design.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const runCli = promisify(execFile);

const CATALOG_PATH = `${root}/docs/design/v0.1.0-design-scope-catalog.json`;
const CONTRACT_PATH = `${root}/docs/design/contracts/artifact-design-dossier.v1.json`;
const REGISTRY_PATH = `${root}/docs/design/document-registry.json`;
const REGISTRATIONS_PATH = `${root}/docs/design/artifact-design-registrations.json`;
const BASELINE_PATH = `${root}/docs/design/v0.1.0-architecture-baseline.json`;
const BOM_PATH = `${root}/docs/release/v0.1.0-scope-bom.json`;

const BASELINE_SCHEMA = "sothoth.architecture-baseline/v1";
const BASELINE_ID = "SOTHOTH-ARCHITECTURE-BASELINE-0.1";
const BOM_SCHEMA = "sothoth.release-bom/v1";
const BOM_ID = "SOTHOTH-RELEASE-SCOPE-BOM-0.1";
const TARGET_RELEASE = "0.1.0";
const PROJECTION_SCHEMA = "sothoth.scope-bom-admissibility-projection/v1";
const SCOPE_PREFIX = "@sothoth/";

// The committed-fact constants below are populated verbatim with the exact `acceptedBy` JSON value
// and `acceptedAt` string the human supplied for Architecture Baseline revision 3 (the 2026-09-04
// acceptance act that accepted the Document Index Dossier revision-2 closure proposal); they are
// not read back from the file under test. The identical-looking revision-2 principal/date recorded
// on 2026-09-03 — and the revision-1 record before it — are historical facts only and never govern
// the live revision-3 expectation by inference. The checker itself only requires a human principal
// and a valid calendar date, so the generic in-memory fixture uses a different principal and date
// to prove neither the Agent nor a passing projection is treated as the accepting authority.
const COMMITTED_PRINCIPAL = { principalType: "human", principalId: "anzhize" };
const COMMITTED_ACCEPTED_AT = "2026-09-04";
const FIXTURE_PRINCIPAL = { principalType: "human", principalId: "fixture-owner" };
const FIXTURE_ACCEPTED_AT = "2026-09-01";

const BASELINE_FIELDS = ["acceptedAt", "acceptedBy", "baselineId", "baselineRevision", "members", "schema", "status", "targetRelease"];
const BASELINE_MEMBER_FIELDS = ["componentId", "designId", "designRevision", "documentRef", "dossierDigest"];
const BOM_FIELDS = ["bomId", "bomRevision", "members", "schema", "targetRelease"];
const BOM_MEMBER_FIELDS = ["completionGates", "designRef", "id", "layer", "owner", "type", "version"];
const GATE_FIELDS = ["criterionIds", "gateId"];

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

function codePointCompare(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function sortedCodePoint(values: string[]): string[] {
  return [...values].sort(codePointCompare);
}

function sha256OfUtf8(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function unscopedName(componentId: string): string {
  if (!componentId.startsWith(SCOPE_PREFIX)) throw new Error(`unexpected component id: ${componentId}`);
  return componentId.slice(SCOPE_PREFIX.length);
}

function exitCodeOf(result: any): number {
  return typeof result?.code === "number" ? result.code : 0;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

function registrationOf(facts: any, componentId: string): any {
  return facts.registrations.registrations.find((registration: any) => registration.componentId === componentId);
}

function memberOf(facts: any, componentId: string): any {
  return facts.scopeBom.members.find((member: any) => member.id === componentId);
}

function baselineMemberOf(facts: any, componentId: string): any {
  return facts.architectureBaseline.members.find((member: any) => member.componentId === componentId);
}

let factsCache: any = null;

async function rawFacts(): Promise<any> {
  if (!factsCache) {
    const registry = await readJson(REGISTRY_PATH);
    const documents: Record<string, string> = {};
    for (const entry of registry.documents) {
      documents[entry.documentId] = await readFile(`${root}/${entry.path}`, "utf8");
    }
    factsCache = {
      phase: "closure",
      catalog: await readJson(CATALOG_PATH),
      contract: await readJson(CONTRACT_PATH),
      registry,
      documents,
      registrations: await readJson(REGISTRATIONS_PATH),
    };
  }
  return structuredClone(factsCache);
}

function formalBaseline(facts: any): any {
  const members = sortedCodePoint(facts.catalog.candidates.map((candidate: any) => candidate.componentId)).map(
    (componentId: string) => {
      const registration = registrationOf(facts, componentId);
      return {
        componentId,
        designId: registration.designId,
        designRevision: registration.designRevision,
        documentRef: structuredClone(registration.documentRef),
        dossierDigest: sha256OfUtf8(facts.documents[registration.documentRef.documentId]),
      };
    },
  );
  return {
    schema: BASELINE_SCHEMA,
    baselineId: BASELINE_ID,
    baselineRevision: 1,
    targetRelease: TARGET_RELEASE,
    status: "accepted",
    acceptedBy: structuredClone(FIXTURE_PRINCIPAL),
    acceptedAt: FIXTURE_ACCEPTED_AT,
    members,
  };
}

function formalBom(facts: any): any {
  const members = sortedCodePoint(facts.catalog.candidates.map((candidate: any) => candidate.componentId)).map(
    (componentId: string) => {
      const registration = registrationOf(facts, componentId);
      return {
        id: componentId,
        version: TARGET_RELEASE,
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
            gateId: `${unscopedName(componentId)}-dossier-criteria`,
            criterionIds: sortedCodePoint(
              registration.acceptanceCriteria.map((criterion: any) => criterion.criterionId),
            ),
          },
        ],
      };
    },
  );
  return {
    schema: BOM_SCHEMA,
    bomId: BOM_ID,
    bomRevision: 1,
    targetRelease: TARGET_RELEASE,
    members,
  };
}

async function formalScopeFacts(): Promise<any> {
  const facts = await rawFacts();
  facts.phase = "scope";
  for (const registration of facts.registrations.registrations) {
    registration.status = "accepted";
  }
  facts.architectureBaseline = formalBaseline(facts);
  facts.scopeBom = formalBom(facts);
  return facts;
}

describe("formal Architecture Baseline and release Scope BOM admissibility", () => {
  test("accepts the formal Baseline and sothoth.release-bom/v1 with eleven fully resolved accepted members", async () => {
    const result = checkPreDesign(await formalScopeFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.schema).toBe(PROJECTION_SCHEMA);
    expect(result.projection.admissible).toBe(true);
    expect(result.projection.memberCount).toBe(11);
    expect(result.projection.architectureBaseline).toEqual({
      baselineId: BASELINE_ID,
      baselineRevision: 1,
      status: "accepted",
    });
    expect(result.projection.scopeBom).toEqual({
      bomId: BOM_ID,
      bomRevision: 1,
      targetRelease: TARGET_RELEASE,
    });
    expect(result.projection.members.map((member: any) => member.componentId)).toEqual(
      sortedCodePoint(result.projection.members.map((member: any) => member.componentId)),
    );
    for (const member of result.projection.members) {
      expect(member.registrationStatus).toBe("accepted");
      expect(member.designRefResolved).toBe(true);
      expect(member.baselineMemberResolved).toBe(true);
      expect(member.completionCriteriaResolved).toBe(true);
    }
  });

  test("projection members carry the exact documentRef of each accepted registration", async () => {
    const facts = await formalScopeFacts();
    const result = checkPreDesign(facts);
    expect(result.projection.members.length).toBe(11);
    for (const member of result.projection.members) {
      const registration = registrationOf(facts, member.componentId);
      expect(member.documentRef).toEqual(registration.documentRef);
      expect(member.designId).toBe(registration.designId);
      expect(member.designRevision).toBe(registration.designRevision);
    }
  });

  test("completion gates cover each registration's criteria exactly, with no missing, unknown, or duplicated criterion", async () => {
    const facts = await formalScopeFacts();
    expect(checkPreDesign(facts).issues).toEqual([]);
    for (const member of facts.scopeBom.members) {
      const registration = registrationOf(facts, member.id);
      const union = new Set(member.completionGates.flatMap((gate: any) => gate.criterionIds));
      const expected = new Set(registration.acceptanceCriteria.map((criterion: any) => criterion.criterionId));
      expect(union).toEqual(expected);
    }
  });

  test("the interim sothoth.candidate-scope-bom/v1 schema is no longer admissible", async () => {
    const facts = await formalScopeFacts();
    facts.scopeBom = {
      schema: "sothoth.candidate-scope-bom/v1",
      members: facts.catalog.candidates.map((candidate: any) => ({
        componentId: candidate.componentId,
        designRef: structuredClone(memberOf(facts, candidate.componentId).designRef),
      })),
    };
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({ code: "sothoth.pre-design/scope-bom-invalid", subject: "schema" });
    expect(result.projection.admissible).toBe(false);
  });

  test("an unaccepted retained registration fails the scope phase", async () => {
    const facts = await formalScopeFacts();
    registrationOf(facts, "@sothoth/core").status = "proposed";
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/registration-not-accepted",
      subject: "@sothoth/core",
    });
  });

  test("an absent Baseline member fails closed", async () => {
    const facts = await formalScopeFacts();
    facts.architectureBaseline.members = facts.architectureBaseline.members.filter(
      (member: any) => member.componentId !== "@sothoth/graph",
    );
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-missing",
      subject: "@sothoth/graph",
    });
  });

  test("an unknown Baseline member fails closed", async () => {
    const facts = await formalScopeFacts();
    const clone = structuredClone(baselineMemberOf(facts, "@sothoth/graph"));
    clone.componentId = "@fracta/sothoth-profile";
    facts.architectureBaseline.members.push(clone);
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-unknown",
      subject: "@fracta/sothoth-profile",
    });
  });

  test("a duplicated Baseline member fails closed", async () => {
    const facts = await formalScopeFacts();
    facts.architectureBaseline.members.push(structuredClone(baselineMemberOf(facts, "@sothoth/core")));
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-duplicate",
      subject: "@sothoth/core",
    });
  });

  test("a designRef naming another Baseline revision or identity fails closed", async () => {
    const revisionFacts = await formalScopeFacts();
    memberOf(revisionFacts, "@sothoth/core").designRef.architectureBaselineRevision = 2;
    expect(checkPreDesign(revisionFacts).issues).toContainEqual({
      code: "sothoth.pre-design/design-ref-baseline-mismatch",
      subject: "@sothoth/core",
    });

    const identityFacts = await formalScopeFacts();
    memberOf(identityFacts, "@sothoth/sdk").designRef.architectureBaselineId = "SOTHOTH-ARCHITECTURE-BASELINE-0.2";
    expect(checkPreDesign(identityFacts).issues).toContainEqual({
      code: "sothoth.pre-design/design-ref-baseline-mismatch",
      subject: "@sothoth/sdk",
    });
  });

  test("a Baseline member mapped to another component's design fails closed", async () => {
    const facts = await formalScopeFacts();
    const core = baselineMemberOf(facts, "@sothoth/core");
    const cli = baselineMemberOf(facts, "@sothoth/cli");
    core.designId = cli.designId;
    core.documentRef = structuredClone(cli.documentRef);
    core.dossierDigest = cli.dossierDigest;
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-component-mismatch",
      subject: "@sothoth/core",
    });
  });

  test("a Baseline member bound to a wrong design or document revision fails closed", async () => {
    const facts = await formalScopeFacts();
    baselineMemberOf(facts, "@sothoth/core").designRevision = 2;
    const designResult = checkPreDesign(facts);
    expect(designResult.issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-design-mismatch",
      subject: "@sothoth/core",
    });

    const documentFacts = await formalScopeFacts();
    baselineMemberOf(documentFacts, "@sothoth/contracts").documentRef.documentRevision = 2;
    expect(checkPreDesign(documentFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-design-mismatch",
      subject: "@sothoth/contracts",
    });
  });

  test("a Dossier digest mismatch fails closed, including edited Dossier bytes", async () => {
    const declaredFacts = await formalScopeFacts();
    baselineMemberOf(declaredFacts, "@sothoth/git").dossierDigest = sha256OfUtf8("tampered bytes");
    expect(checkPreDesign(declaredFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-dossier-digest-mismatch",
      subject: "@sothoth/git",
    });

    const byteFacts = await formalScopeFacts();
    byteFacts.documents["DOC-SOTHOTH-GIT-DOSSIER"] = `${byteFacts.documents["DOC-SOTHOTH-GIT-DOSSIER"]}\nextra prose\n`;
    const result = checkPreDesign(byteFacts);
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/baseline-dossier-digest-mismatch",
      subject: "@sothoth/git",
    });
  });

  test("a malformed Baseline member and unknown fields fail closed", async () => {
    const unknownFacts = await formalScopeFacts();
    baselineMemberOf(unknownFacts, "@sothoth/graph").extraField = true;
    expect(checkPreDesign(unknownFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-invalid",
      subject: "@sothoth/graph:extraField",
    });

    const malformedFacts = await formalScopeFacts();
    malformedFacts.architectureBaseline.members.push({ componentId: "@sothoth/graph" });
    expect(checkPreDesign(malformedFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-member-invalid",
      subject: "@sothoth/graph:designId",
    });
  });

  test("the Baseline top-level shape fails closed on unknown fields, non-human principals, and invalid dates", async () => {
    const unknownFacts = await formalScopeFacts();
    unknownFacts.architectureBaseline.reviewVerdict = "approved";
    expect(checkPreDesign(unknownFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-invalid",
      subject: "reviewVerdict",
    });

    const agentFacts = await formalScopeFacts();
    agentFacts.architectureBaseline.acceptedBy.principalType = "agent";
    expect(checkPreDesign(agentFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-invalid",
      subject: "acceptedBy:principalType",
    });

    const emptyPrincipalFacts = await formalScopeFacts();
    emptyPrincipalFacts.architectureBaseline.acceptedBy.principalId = "";
    expect(checkPreDesign(emptyPrincipalFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-invalid",
      subject: "acceptedBy:principalId",
    });

    const dateFacts = await formalScopeFacts();
    dateFacts.architectureBaseline.acceptedAt = "2026-02-30";
    expect(checkPreDesign(dateFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-invalid",
      subject: "acceptedAt",
    });

    const schemaFacts = await formalScopeFacts();
    schemaFacts.architectureBaseline.schema = "sothoth.architecture-baseline/v2";
    expect(checkPreDesign(schemaFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-invalid",
      subject: "schema",
    });

    const releaseFacts = await formalScopeFacts();
    releaseFacts.architectureBaseline.targetRelease = "0.2.0";
    expect(checkPreDesign(releaseFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-invalid",
      subject: "targetRelease",
    });
  });

  test("a not-accepted or missing Baseline fails closed", async () => {
    const proposedFacts = await formalScopeFacts();
    proposedFacts.architectureBaseline.status = "proposed";
    expect(checkPreDesign(proposedFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-not-accepted",
      subject: BASELINE_ID,
    });

    const missingFacts = await formalScopeFacts();
    delete missingFacts.architectureBaseline;
    expect(checkPreDesign(missingFacts).issues).toContainEqual({
      code: "sothoth.pre-design/baseline-missing",
      subject: "architectureBaseline",
    });
  });

  test("a missing or malformed formal Scope BOM fails closed", async () => {
    const missingFacts = await formalScopeFacts();
    delete missingFacts.scopeBom;
    expect(checkPreDesign(missingFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-missing",
      subject: "scopeBom",
    });

    const identityFacts = await formalScopeFacts();
    identityFacts.scopeBom.bomId = "";
    expect(checkPreDesign(identityFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "bomId",
    });

    const revisionFacts = await formalScopeFacts();
    revisionFacts.scopeBom.bomRevision = 0;
    expect(checkPreDesign(revisionFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "bomRevision",
    });

    const releaseFacts = await formalScopeFacts();
    releaseFacts.scopeBom.targetRelease = "0.2.0";
    expect(checkPreDesign(releaseFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "targetRelease",
    });

    const unknownFacts = await formalScopeFacts();
    unknownFacts.scopeBom.externalRelations = [];
    expect(checkPreDesign(unknownFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "externalRelations",
    });
  });

  test("release members with wrong exact identities, unknown fields, or duplicates fail closed", async () => {
    for (const [field, value] of [
      ["version", "0.2.0"],
      ["type", "tarball"],
      ["layer", "optional"],
      ["owner", "fracta"],
    ] as const) {
      const facts = await formalScopeFacts();
      memberOf(facts, "@sothoth/planning")[field] = value;
      expect(checkPreDesign(facts).issues).toContainEqual({
        code: "sothoth.pre-design/scope-bom-invalid",
        subject: `@sothoth/planning:${field}`,
      });
    }

    const unknownFacts = await formalScopeFacts();
    memberOf(unknownFacts, "@sothoth/sdk").tarballDigest = "sha256:0000";
    expect(checkPreDesign(unknownFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "@sothoth/sdk:tarballDigest",
    });

    const duplicateFacts = await formalScopeFacts();
    duplicateFacts.scopeBom.members.push(structuredClone(memberOf(duplicateFacts, "@sothoth/core")));
    expect(checkPreDesign(duplicateFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "@sothoth/core:member-duplicate",
    });
  });

  test("a release member outside the Design Scope Catalog fails closed", async () => {
    const facts = await formalScopeFacts();
    const clone = structuredClone(memberOf(facts, "@sothoth/graph"));
    clone.id = "@sothoth/extra-widget";
    facts.scopeBom.members.push(clone);
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-member-unknown",
      subject: "@sothoth/extra-widget",
    });
  });

  test("the FRACTA external companion is never an admissible required member", async () => {
    const facts = await formalScopeFacts();
    const clone = structuredClone(memberOf(facts, "@sothoth/graph"));
    clone.id = "@fracta/sothoth-profile";
    facts.scopeBom.members.push(clone);
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-member-unknown",
      subject: "@fracta/sothoth-profile",
    });
  });

  test("a dropped release member fails closed", async () => {
    const facts = await formalScopeFacts();
    facts.scopeBom.members = facts.scopeBom.members.filter((member: any) => member.id !== "@sothoth/sdk");
    const result = checkPreDesign(facts);
    expect(result.outcome).toBe("invalid");
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-member-missing",
      subject: "@sothoth/sdk",
    });
    expect(result.projection.admissible).toBe(false);
  });

  test("missing, unknown, duplicated, and unsorted gate criterion identities fail closed", async () => {
    const missingFacts = await formalScopeFacts();
    const missingGate = memberOf(missingFacts, "@sothoth/git").completionGates[0];
    missingGate.criterionIds = missingGate.criterionIds.slice(1);
    expect(checkPreDesign(missingFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-criterion-missing",
      subject: "@sothoth/git",
    });

    const unknownFacts = await formalScopeFacts();
    memberOf(unknownFacts, "@sothoth/git").completionGates[0].criterionIds.push("git-unknown-criterion");
    expect(checkPreDesign(unknownFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-criterion-unknown",
      subject: "@sothoth/git:git-unknown-criterion",
    });

    const duplicateFacts = await formalScopeFacts();
    const gates = memberOf(duplicateFacts, "@sothoth/git").completionGates;
    gates.push({
      gateId: "git-extra-gate",
      criterionIds: [gates[0].criterionIds[0]],
    });
    expect(checkPreDesign(duplicateFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-criterion-duplicate",
      subject: `@sothoth/git:${gates[0].criterionIds[0]}`,
    });

    const unsortedFacts = await formalScopeFacts();
    const unsortedIds = memberOf(unsortedFacts, "@sothoth/contracts").completionGates[0].criterionIds;
    unsortedIds.reverse();
    expect(checkPreDesign(unsortedFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-criterion-order",
      subject: "@sothoth/contracts:contracts-dossier-criteria",
    });
  });

  test("invalid, duplicated, and unsorted gate identities fail closed", async () => {
    const malformedFacts = await formalScopeFacts();
    delete memberOf(malformedFacts, "@sothoth/planning").completionGates[0].criterionIds;
    expect(checkPreDesign(malformedFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-gate-invalid",
      subject: "@sothoth/planning:planning-dossier-criteria",
    });

    const duplicateFacts = await formalScopeFacts();
    const gates = memberOf(duplicateFacts, "@sothoth/planning").completionGates;
    gates.push(structuredClone(gates[0]));
    expect(checkPreDesign(duplicateFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-gate-duplicate",
      subject: "@sothoth/planning:planning-dossier-criteria",
    });

    const unsortedFacts = await formalScopeFacts();
    const gate = memberOf(unsortedFacts, "@sothoth/git").completionGates[0];
    const ids = gate.criterionIds;
    gate.gateId = "git-zeta-gate";
    gate.criterionIds = [ids[1], ids[4]];
    unsortedFacts.scopeBom.members
      .find((member: any) => member.id === "@sothoth/git")
      .completionGates.push({ gateId: "git-dossier-criteria", criterionIds: [ids[0], ids[2], ids[3]] });
    const result = checkPreDesign(unsortedFacts);
    expect(result.issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-gate-order",
      subject: "@sothoth/git",
    });

    const emptyGateFacts = await formalScopeFacts();
    memberOf(emptyGateFacts, "@sothoth/git").completionGates.push({
      gateId: "git-alpha-gate",
      criterionIds: [],
    });
    expect(checkPreDesign(emptyGateFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-gate-invalid",
      subject: "@sothoth/git:git-alpha-gate",
    });
  });

  test("empty or missing completion gates fail closed", async () => {
    const emptyFacts = await formalScopeFacts();
    memberOf(emptyFacts, "@sothoth/profile-sdk").completionGates = [];
    expect(checkPreDesign(emptyFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "@sothoth/profile-sdk:completionGates",
    });

    const missingFacts = await formalScopeFacts();
    delete memberOf(missingFacts, "@sothoth/profile-sdk").completionGates;
    expect(checkPreDesign(missingFacts).issues).toContainEqual({
      code: "sothoth.pre-design/scope-bom-invalid",
      subject: "@sothoth/profile-sdk:completionGates",
    });
  });

  test("an unresolved or cross-component designRef fails closed and projects unresolved members", async () => {
    const unresolvedFacts = await formalScopeFacts();
    memberOf(unresolvedFacts, "@sothoth/core").designRef.designRevision = 7;
    const unresolvedResult = checkPreDesign(unresolvedFacts);
    expect(unresolvedResult.issues).toContainEqual({
      code: "sothoth.pre-design/design-ref-unresolved",
      subject: "@sothoth/core",
    });

    const crossFacts = await formalScopeFacts();
    memberOf(crossFacts, "@sothoth/sdk").designRef = structuredClone(memberOf(crossFacts, "@sothoth/core").designRef);
    const crossResult = checkPreDesign(crossFacts);
    expect(crossResult.issues).toContainEqual({
      code: "sothoth.pre-design/design-ref-component-mismatch",
      subject: "@sothoth/sdk",
    });
    const projected = crossResult.projection.members.find((member: any) => member.componentId === "@sothoth/sdk");
    expect(projected.designRefResolved).toBe(false);
  });

  test("diagnostics, projection bytes, and the source-facts digest ignore Baseline and BOM member input order", async () => {
    const facts = await formalScopeFacts();
    const first = checkPreDesign(facts);
    expect(first.projection.sourceFactsDigest).toMatch(DIGEST_PATTERN);
    const reversed = structuredClone(facts);
    reversed.architectureBaseline.members.reverse();
    reversed.scopeBom.members.reverse();
    const second = checkPreDesign(reversed);
    expect(second.issues).toEqual(first.issues);
    expect(second.projection.sourceFactsDigest).toBe(first.projection.sourceFactsDigest);
    expect(canonicalJsonStringify(second.projection)).toBe(canonicalJsonStringify(first.projection));
  });
});

describe("committed scope Source Facts", () => {
  test("the committed registrations record exactly eleven accepted registrations", async () => {
    const registrations = await readJson(REGISTRATIONS_PATH);
    expect(registrations.registrations.length).toBe(11);
    for (const registration of registrations.registrations) {
      expect(registration.status).toBe("accepted");
      const expectedSupersedes =
        registration.componentId === "@sothoth/graph" ? "SOTHOTH-GRAPH-DOSSIER@1"
        : registration.componentId === "@sothoth/document-index" ? "SOTHOTH-DOCUMENT-INDEX-DOSSIER@1"
        : null;
      expect(registration.supersedes).toBe(expectedSupersedes);
    }
  });

  test("the committed Architecture Baseline records the human acceptance fact exactly", async () => {
    const baseline = await readJson(BASELINE_PATH);
    expect(Object.keys(baseline).sort(codePointCompare)).toEqual(sortedCodePoint(BASELINE_FIELDS));
    expect(baseline.schema).toBe(BASELINE_SCHEMA);
    expect(baseline.baselineId).toBe(BASELINE_ID);
    expect(baseline.baselineRevision).toBe(3);
    expect(baseline.targetRelease).toBe(TARGET_RELEASE);
    expect(baseline.status).toBe("accepted");
    expect(baseline.acceptedBy).toEqual(COMMITTED_PRINCIPAL);
    expect(baseline.acceptedAt).toBe(COMMITTED_ACCEPTED_AT);
    expect(baseline.members.map((member: any) => member.componentId)).toEqual(
      sortedCodePoint(baseline.members.map((member: any) => member.componentId)),
    );
    expect(baseline.members.length).toBe(11);
  });

  test("each committed Baseline member binds its own registration, document reference, and Dossier digest", async () => {
    const baseline = await readJson(BASELINE_PATH);
    const registrations = await readJson(REGISTRATIONS_PATH);
    const registry = await readJson(REGISTRY_PATH);
    const byComponent = new Map(registrations.registrations.map((registration: any) => [registration.componentId, registration]));
    const byDocument = new Map(registry.documents.map((entry: any) => [entry.documentId, entry]));
    for (const member of baseline.members) {
      expect(Object.keys(member).sort(codePointCompare)).toEqual(sortedCodePoint(BASELINE_MEMBER_FIELDS));
      const registration = byComponent.get(member.componentId);
      expect(registration.status).toBe("accepted");
      expect(member.designId).toBe(registration.designId);
      expect(member.designRevision).toBe(registration.designRevision);
      expect(member.documentRef).toEqual(registration.documentRef);
      const entry = byDocument.get(member.documentRef.documentId);
      expect(member.documentRef.documentRevision).toBe(entry.documentRevision);
      const bytes = await readFile(`${root}/${entry.path}`, "utf8");
      expect(member.dossierDigest).toBe(sha256OfUtf8(bytes));
      expect(member.dossierDigest).toMatch(DIGEST_PATTERN);
    }
  });

  test("the committed release Scope BOM is the closed formal shape with one criteria gate per member", async () => {
    const bom = await readJson(BOM_PATH);
    const registrations = await readJson(REGISTRATIONS_PATH);
    const byComponent = new Map(registrations.registrations.map((registration: any) => [registration.componentId, registration]));
    expect(Object.keys(bom).sort(codePointCompare)).toEqual(sortedCodePoint(BOM_FIELDS));
    expect(bom.schema).toBe(BOM_SCHEMA);
    expect(bom.bomId).toBe(BOM_ID);
    expect(bom.bomRevision).toBe(3);
    expect(bom.targetRelease).toBe(TARGET_RELEASE);
    expect(bom.members.map((member: any) => member.id)).toEqual(
      sortedCodePoint(bom.members.map((member: any) => member.id)),
    );
    expect(bom.members.length).toBe(11);
    for (const member of bom.members) {
      expect(Object.keys(member).sort(codePointCompare)).toEqual(sortedCodePoint(BOM_MEMBER_FIELDS));
      expect(member.version).toBe(TARGET_RELEASE);
      expect(member.type).toBe("npm-package");
      expect(member.layer).toBe("required");
      expect(member.owner).toBe("sothoth");
      expect(member.designRef.architectureBaselineId).toBe(BASELINE_ID);
      expect(member.designRef.architectureBaselineRevision).toBe(3);
      const registration = byComponent.get(member.id);
      expect(member.designRef.designId).toBe(registration.designId);
      expect(member.designRef.designRevision).toBe(registration.designRevision);
      expect(member.completionGates.length).toBe(1);
      const gate = member.completionGates[0];
      expect(Object.keys(gate).sort(codePointCompare)).toEqual(sortedCodePoint(GATE_FIELDS));
      expect(gate.gateId).toBe(`${unscopedName(member.id)}-dossier-criteria`);
      expect(gate.criterionIds).toEqual(
        sortedCodePoint(registration.acceptanceCriteria.map((criterion: any) => criterion.criterionId)),
      );
    }
    expect(bom.members.map((member: any) => member.id)).not.toContain("@fracta/sothoth-profile");
  });
});

describe("scope CLI defaults and explicit overrides", () => {
  test("the default scope phase loads the repository Baseline and Scope BOM and admits the scope", async () => {
    const run = await runCli("node", [`${root}/scripts/check-pre-design.mjs`, "--phase", "scope"]).catch(
      (error: any) => error,
    );
    expect(exitCodeOf(run)).toBe(0);
    const parsed = JSON.parse(run.stdout);
    expect(parsed.phase).toBe("scope");
    expect(parsed.outcome).toBe("valid");
    expect(parsed.issues).toEqual([]);
    expect(parsed.projection.admissible).toBe(true);
    expect(parsed.projection.memberCount).toBe(11);
    expect(parsed.projection.architectureBaseline).toEqual({
      baselineId: BASELINE_ID,
      baselineRevision: 3,
      status: "accepted",
    });
    expect(parsed.projection.scopeBom).toEqual({ bomId: BOM_ID, bomRevision: 3, targetRelease: TARGET_RELEASE });
    expect(`${canonicalJsonStringify(parsed)}\n`).toBe(run.stdout);
  });

  test("explicit --baseline and --scope-bom flags override the repository defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sothoth-scope-override-"));
    try {
      const facts = await formalScopeFacts();
      facts.architectureBaseline.baselineId = "FIXTURE-BASELINE";
      for (const member of facts.scopeBom.members) {
        member.designRef.architectureBaselineId = "FIXTURE-BASELINE";
      }
      const baselinePath = join(dir, "baseline.json");
      const bomPath = join(dir, "bom.json");
      await writeFile(baselinePath, `${JSON.stringify(facts.architectureBaseline, null, 2)}\n`);
      await writeFile(bomPath, `${JSON.stringify(facts.scopeBom, null, 2)}\n`);
      const run = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "scope",
        "--baseline",
        baselinePath,
        "--scope-bom",
        bomPath,
      ]).catch((error: any) => error);
      expect(exitCodeOf(run)).toBe(0);
      const parsed = JSON.parse(run.stdout);
      expect(parsed.outcome).toBe("valid");
      expect(parsed.issues).toEqual([]);
      expect(parsed.projection.admissible).toBe(true);
      expect(parsed.projection.architectureBaseline.baselineId).toBe("FIXTURE-BASELINE");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("two fresh default scope invocations are byte-identical with identical SHA-256", async () => {
    const firstDir = await mkdtemp(join(tmpdir(), "sothoth-scope-run-a-"));
    const secondDir = await mkdtemp(join(tmpdir(), "sothoth-scope-run-b-"));
    try {
      const firstPath = join(firstDir, "admissibility.json");
      const secondPath = join(secondDir, "admissibility.json");
      const first = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "scope",
        "--output",
        firstPath,
      ]).catch((error: any) => error);
      const second = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "scope",
        "--output",
        secondPath,
      ]).catch((error: any) => error);
      expect(exitCodeOf(first)).toBe(0);
      expect(exitCodeOf(second)).toBe(0);
      expect(second.stdout).toBe(first.stdout);
      const firstBytes = await readFile(firstPath, "utf8");
      const secondBytes = await readFile(secondPath, "utf8");
      expect(secondBytes).toBe(firstBytes);
      expect(firstBytes).toBe(first.stdout);
      expect(sha256OfUtf8(firstBytes)).toBe(sha256OfUtf8(secondBytes));
    } finally {
      await rm(firstDir, { recursive: true, force: true });
      await rm(secondDir, { recursive: true, force: true });
    }
  });

  test("an explicit --baseline flag pointing at a missing file still fails closed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sothoth-scope-missing-"));
    try {
      const run = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "scope",
        "--baseline",
        join(dir, "no-such-baseline.json"),
      ]).catch((error: any) => error);
      expect(run.code).toBe(2);
      const parsed = JSON.parse(run.stdout);
      expect(parsed.outcome).toBe("invalid-input");
      expect(parsed.issues[0].code).toBe("sothoth.pre-design/source-unreadable");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
