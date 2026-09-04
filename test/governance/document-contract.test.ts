// Task 6 / Governance Compilation — Document Contract validation (plan Step 1).
// `validateDocumentContractV1` validates a `sothoth.document-contract/v1` value
// as a closed object: exact section ordering at v1, unique pattern-valid
// required sections, the closed topic resolution and inheritance-applicability
// vocabularies, the exact reference field set, and criterion cardinality.
// Every rejection is a `sothoth.governance/contract-invalid` finding under the
// Structured Diagnostic vocabulary; a failed validation leaves no contract
// value (`contract: null`, outcome `invalid-input`).

import { describe, expect, test } from "vitest";
import { validateDocumentContractV1 } from "../../packages/governance/src/document-contract.js";

const VALID_CONTRACT = {
  schema: "sothoth.document-contract/v1",
  contractId: "test.design-dossier/full/v1",
  contractRevision: 1,
  description: "Consumer-neutral test contract.",
  documentKind: "test-dossier",
  sections: {
    ordering: "exact",
    requiredSectionIds: ["decision-summary", "verification"],
  },
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

function code(result: { diagnostics: ReadonlyArray<{ code: string; subjects: readonly string[] }> }) {
  return result.diagnostics.map((diagnostic) => `${diagnostic.code}|${diagnostic.subjects.join(",")}`);
}

describe("validateDocumentContractV1", () => {
  test("accepts a well-formed exact-ordering contract without findings", () => {
    const result = validateDocumentContractV1(VALID_CONTRACT);
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.diagnosticCount).toBe(0);
    expect(result.schema).toBe("sothoth.governance/document-contract-compilation@1");
    expect(result.phase).toBe("document-contract");
    expect(result.contract).not.toBeNull();
    expect(result.contract?.contractId).toBe("test.design-dossier/full/v1");
    expect(result.contract?.sections.requiredSectionIds).toEqual([
      "decision-summary",
      "verification",
    ]);
  });

  test("rejects an unknown top-level field fail-closed as invalid input", () => {
    const candidate = { ...VALID_CONTRACT, extra: true };
    const result = validateDocumentContractV1(candidate);
    expect(result.outcome).toBe("invalid-input");
    expect(result.contract).toBeNull();
    expect(code(result)).toContain("sothoth.governance/contract-invalid|extra");
  });

  test("rejects a contract whose schema identity is not the v1 document contract", () => {
    const candidate = { ...VALID_CONTRACT, schema: "sothoth.other/v2" };
    const result = validateDocumentContractV1(candidate);
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/contract-invalid|schema");
  });

  test("rejects a non-positive-integer contract revision", () => {
    const candidate = { ...VALID_CONTRACT, contractRevision: 0 };
    const result = validateDocumentContractV1(candidate);
    expect(code(result)).toContain("sothoth.governance/contract-invalid|contractRevision");
  });

  test("rejects every section ordering other than exact at v1", () => {
    const candidate = {
      ...VALID_CONTRACT,
      sections: { ordering: "lenient", requiredSectionIds: ["decision-summary"] },
    };
    const result = validateDocumentContractV1(candidate);
    expect(code(result)).toContain("sothoth.governance/contract-invalid|sections.ordering");
  });

  test("requires a non-empty, duplicate-free, pattern-valid required section list", () => {
    const empty = {
      ...VALID_CONTRACT,
      sections: { ordering: "exact", requiredSectionIds: [] },
    };
    expect(code(validateDocumentContractV1(empty))).toContain(
      "sothoth.governance/contract-invalid|sections.requiredSectionIds",
    );

    const duplicated = {
      ...VALID_CONTRACT,
      sections: { ordering: "exact", requiredSectionIds: ["alpha", "alpha"] },
    };
    expect(code(validateDocumentContractV1(duplicated))).toContain(
      "sothoth.governance/contract-invalid|sections.requiredSectionIds",
    );

    const invalidPattern = {
      ...VALID_CONTRACT,
      sections: { ordering: "exact", requiredSectionIds: ["Alpha_Cap"] },
    };
    expect(code(validateDocumentContractV1(invalidPattern))).toContain(
      "sothoth.governance/contract-invalid|sections.requiredSectionIds",
    );
  });

  test("requires the closed topic set, exact resolution kinds, and applicable inheritance kinds", () => {
    const badClosedSet = {
      ...VALID_CONTRACT,
      topics: { ...VALID_CONTRACT.topics, closedSet: [] },
    };
    expect(code(validateDocumentContractV1(badClosedSet))).toContain(
      "sothoth.governance/contract-invalid|topics.closedSet",
    );

    const badResolutions = {
      ...VALID_CONTRACT,
      topics: { ...VALID_CONTRACT.topics, resolutions: ["local", "inherited"] },
    };
    expect(code(validateDocumentContractV1(badResolutions))).toContain(
      "sothoth.governance/contract-invalid|topics.resolutions",
    );

    const badApplicability = {
      ...VALID_CONTRACT,
      topics: { ...VALID_CONTRACT.topics, inheritanceApplicability: ["overrides"] },
    };
    expect(code(validateDocumentContractV1(badApplicability))).toContain(
      "sothoth.governance/contract-invalid|topics.inheritanceApplicability",
    );
  });

  test("pins the exact reference fields and criterion fields", () => {
    const badReferences = {
      ...VALID_CONTRACT,
      references: { exactFields: ["documentId", "sectionId"] },
    };
    expect(code(validateDocumentContractV1(badReferences))).toContain(
      "sothoth.governance/contract-invalid|references.exactFields",
    );

    const badCriteria = {
      ...VALID_CONTRACT,
      criteria: { minimumPerRegistration: 1, fields: ["criterionId"] },
    };
    expect(code(validateDocumentContractV1(badCriteria))).toContain(
      "sothoth.governance/contract-invalid|criteria",
    );

    const badMinimum = {
      ...VALID_CONTRACT,
      criteria: { minimumPerRegistration: 0, fields: ["criterionId", "sectionId"] },
    };
    expect(code(validateDocumentContractV1(badMinimum))).toContain(
      "sothoth.governance/contract-invalid|criteria",
    );
  });

  test("rejects a non-object candidate with a single contract-invalid finding", () => {
    const result = validateDocumentContractV1("not-a-contract");
    expect(result.outcome).toBe("invalid-input");
    expect(result.contract).toBeNull();
    expect(code(result)).toEqual(["sothoth.governance/contract-invalid|contract"]);
  });

  test("compilations are pure: repeated validation returns equal results", () => {
    const first = validateDocumentContractV1(VALID_CONTRACT);
    const second = validateDocumentContractV1(VALID_CONTRACT);
    expect(first).toEqual(second);
  });
});
