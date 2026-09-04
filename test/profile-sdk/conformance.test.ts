// Task 8 / Profile SDK — conformance compilation (`/conformance`) and the
// Recommended Skill Catalog (`/recommendations`). This file owns
// `profile-fail-closed-conformance`, `profile-impact-no-ordering`, and
// `profile-skills-curated-exact-only` evidence: the non-authoritative
// conformance Projection with its Structured Diagnostics, the rule that an
// impact relation never becomes an ordering edge without an explicit
// versioned mapping, and the curated-exact-only catalog boundary including
// the plan's verbatim unlocked-recommendation example. The committed
// `catalog/recommended-skills.json` is validated from disk here: tests may
// read the catalog file; the package never does.

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  RECOMMENDED_SKILL_CATALOG_FIELDS_V1,
  RECOMMENDED_SKILL_CATALOG_SCHEMA_V1,
  SKILL_PROHIBITED_OPERATIONS_V1,
  runProfileConformanceV1,
  validateRecommendedSkillCatalogV1,
} from "../../packages/profile-sdk/src/conformance.js";
import { CONSUMER_PROFILE_SCHEMA_V1 } from "../../packages/profile-sdk/src/profile.js";
import type { RelationRoleMappingV1 } from "../../packages/profile-sdk/src/profile.js";

function mapping(overrides: Partial<RelationRoleMappingV1> = {}): RelationRoleMappingV1 {
  return {
    mappingId: "impact-review-scope",
    mappingRevision: 1,
    relationKind: "impact",
    assignedRole: "review-scope",
    explanation: "Impact relations expand review scope only.",
    ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: CONSUMER_PROFILE_SCHEMA_V1,
    profileId: "EXAMPLE-CONSUMER-PROFILE",
    profileRevision: 1,
    documentContracts: ["DOC-SOTHOTH-PROFILE-SDK-DOSSIER@1"],
    gateMacros: ["EXAMPLE-GATE-MACRO@1"],
    relationRoleMappings: [mapping()],
    diagnosticHelp: [],
    moduleLocks: [{ moduleId: "@sothoth/contracts", lockedRevision: "CONTRACT/SOTHOTH/SCHEMAS@1" }],
    ...overrides,
  };
}

function recommendation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "applicable-diagnostic": "sothoth.profile/unknown-mapping",
    digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "exact-commit-or-tag": "0000000000000000000000000000000000000000",
    license: "MIT",
    path: "domain-modeling",
    "source-repository": "mattpocock/skills",
    ...overrides,
  };
}

function catalog(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: RECOMMENDED_SKILL_CATALOG_SCHEMA_V1,
    catalogId: "EXAMPLE-SKILL-CATALOG",
    catalogRevision: 1,
    automaticDiscovery: false,
    recommendations: [recommendation()],
    ...overrides,
  };
}

describe("runProfileConformanceV1 fails closed", () => {
  test("a valid profile conforms with an empty diagnostic set and full echoes", () => {
    const result = runProfileConformanceV1(profile());
    expect(result.schema).toBe("sothoth.profile-sdk/conformance-result@1");
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.diagnosticCount).toBe(0);
    expect(result.profileDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.documentContractRefs).toEqual(["DOC-SOTHOTH-PROFILE-SDK-DOSSIER@1"]);
    expect(result.gateMacroRefs).toEqual(["EXAMPLE-GATE-MACRO@1"]);
    expect(result.moduleLocks).toEqual([
      { moduleId: "@sothoth/contracts", lockedRevision: "CONTRACT/SOTHOTH/SCHEMAS@1" },
    ]);
    expect(result.relationRoleAssignments).toEqual([mapping()]);
    expect(result.diagnosticHelp).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  test("a non-object profile is an invalid-input compilation", () => {
    const result = runProfileConformanceV1(42);
    expect(result.outcome).toBe("invalid-input");
    expect(result.diagnosticCount).toBe(1);
    expect(result.diagnostics[0]?.code).toBe("sothoth.profile/invalid-profile");
    expect(result.diagnostics[0]?.category).toBe("input");
    expect(result.diagnostics[0]?.verdict).toBe("fail");
    expect(result.diagnostics[0]?.origin).toBe("sothoth.profile-sdk/profile-diagnostic@1");
    expect(result.profileDigest).toBeNull();
    expect(result.relationRoleAssignments).toEqual([]);
  });

  test("an unknown field folds to the invalid-input outcome", () => {
    const result = runProfileConformanceV1(profile({ consumerPolicy: true }));
    expect(result.outcome).toBe("invalid-input");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "sothoth.contracts/unknown-field",
    ]);
  });

  test("an incompatible schema revision is reported and fails closed", () => {
    const result = runProfileConformanceV1(profile({ schema: "sothoth.profile/consumer-profile@2" }));
    expect(result.outcome).toBe("invalid-input");
    expect(result.diagnostics[0]?.code).toBe("sothoth.profile/incompatible-revision");
    expect(result.diagnostics[0]?.subjects).toEqual(["profile.schema"]);
  });

  test("diagnostics are finalized Structured Diagnostics in canonical order", () => {
    const result = runProfileConformanceV1(
      profile({ documentContracts: ["floating"], gateMacros: ["also-floating"] }),
    );
    expect(result.outcome).toBe("invalid-input");
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(diagnostic.ruleId).toBe(diagnostic.code);
      expect(diagnostic.severity).toBe("error");
    }
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect([...codes].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))).toEqual(
      codes,
    );
  });

  test("profile-authored diagnostic help is surfaced on matching profile diagnostics", () => {
    const result = runProfileConformanceV1(
      profile({
        relationRoleMappings: [mapping({ relationKind: "consumes" })],
        diagnosticHelp: [
          { code: "sothoth.profile/unknown-mapping", help: ["Curate the mapping explicitly."] },
        ],
      }),
    );
    expect(result.outcome).toBe("invalid-input");
    const unknown = result.diagnostics.find(
      (diagnostic) => diagnostic.code === "sothoth.profile/unknown-mapping",
    );
    expect(unknown?.help).toEqual(["Curate the mapping explicitly."]);
  });

  test("identical facts compiled twice produce identical bytes", () => {
    const first = runProfileConformanceV1(profile());
    const second = runProfileConformanceV1(profile());
    expect(second).toEqual(first);
  });
});

describe("impact never becomes ordering without an explicit versioned mapping", () => {
  test("an impact mapping assigned review-scope yields no ordering relation kinds", () => {
    const result = runProfileConformanceV1(profile({ relationRoleMappings: [mapping()] }));
    expect(result.outcome).toBe("valid");
    expect(result.orderingRelationKinds).toEqual([]);
    expect(result.relationRoleAssignments[0]?.assignedRole).toBe("review-scope");
  });

  test("a profile with no mappings orders nothing", () => {
    const result = runProfileConformanceV1(profile({ relationRoleMappings: [] }));
    expect(result.outcome).toBe("valid");
    expect(result.orderingRelationKinds).toEqual([]);
    expect(result.relationRoleAssignments).toEqual([]);
  });

  test("only an explicit versioned ordering-edge mapping classifies impact as ordering", () => {
    const result = runProfileConformanceV1(
      profile({
        relationRoleMappings: [mapping({ assignedRole: "ordering-edge", mappingRevision: 3 })],
      }),
    );
    expect(result.outcome).toBe("valid");
    expect(result.orderingRelationKinds).toEqual(["impact"]);
    expect(result.relationRoleAssignments[0]?.mappingRevision).toBe(3);
  });

  test("the conformance result never mints graph edges, waves, or schedule output", () => {
    const result = runProfileConformanceV1(
      profile({ relationRoleMappings: [mapping({ assignedRole: "ordering-edge" })] }),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('"edges"');
    expect(serialized).not.toContain('"waves"');
    expect(serialized).not.toContain('"orderingEdge"');
    expect(serialized).not.toContain('"waveIndex"');
  });

  test("mapping visibility: assignments echo exactly the declared versioned mappings", () => {
    const result = runProfileConformanceV1(
      profile({
        relationRoleMappings: [
          mapping({ mappingId: "zeta", assignedRole: "ordering-edge" }),
          mapping({ mappingId: "alpha" }),
        ],
      }),
    );
    expect(result.relationRoleAssignments).toEqual([
      mapping({ mappingId: "alpha" }),
      mapping({ mappingId: "zeta", assignedRole: "ordering-edge" }),
    ]);
  });
});

describe("the closed Recommended Skill Catalog vocabulary", () => {
  test("the catalog field set is exactly the five closed fields, frozen", () => {
    expect([...RECOMMENDED_SKILL_CATALOG_FIELDS_V1]).toEqual([
      "schema",
      "catalogId",
      "catalogRevision",
      "automaticDiscovery",
      "recommendations",
    ]);
    expect(Object.isFrozen(RECOMMENDED_SKILL_CATALOG_FIELDS_V1)).toBe(true);
  });

  test("the prohibited operations are exactly the seven declared", () => {
    expect([...SKILL_PROHIBITED_OPERATIONS_V1]).toEqual([
      "crawl",
      "discover",
      "download",
      "host",
      "install",
      "invoke",
      "search",
    ]);
    expect(Object.isFrozen(SKILL_PROHIBITED_OPERATIONS_V1)).toBe(true);
  });

  test("a valid curated catalog validates without issues", () => {
    expect(validateRecommendedSkillCatalogV1(catalog())).toEqual([]);
  });

  test("a non-object catalog is rejected as an invalid catalog", () => {
    expect(validateRecommendedSkillCatalogV1("nope")).toEqual([
      { code: "sothoth.skills/invalid-catalog", subject: "catalog" },
    ]);
  });
});

describe("recommendations come only from a curated exact-only catalog", () => {
  const unlockedCatalog = catalog({
    recommendations: [
      recommendation({ "exact-commit-or-tag": null, digest: null }),
    ],
  });

  test("rejects a recommendation without an exact upstream commit and digest", () => {
    expect(validateRecommendedSkillCatalogV1(unlockedCatalog)).toContainEqual(
      expect.objectContaining({
        code: "sothoth.skills/unlocked-recommendation",
      }),
    );
  });

  test("a floating branch revision is an unlocked recommendation", () => {
    const issues = validateRecommendedSkillCatalogV1(
      catalog({ recommendations: [recommendation({ "exact-commit-or-tag": "main" })] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.skills/unlocked-recommendation",
      subject: "catalog.recommendations[0].exact-commit-or-tag",
    });
  });

  test("a malformed digest is an unlocked recommendation", () => {
    const issues = validateRecommendedSkillCatalogV1(
      catalog({ recommendations: [recommendation({ digest: "sha256:zz" })] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.skills/unlocked-recommendation",
      subject: "catalog.recommendations[0].digest",
    });
  });

  test("a recommendation field outside the allowed set fails closed", () => {
    const issues = validateRecommendedSkillCatalogV1(
      catalog({ recommendations: [recommendation({ "auto-install": true })] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.contracts/unknown-field",
      subject: "catalog.recommendations[0].auto-install",
    });
  });

  test("a missing allowed field fails closed", () => {
    const withoutLicense = recommendation();
    delete withoutLicense.license;
    const issues = validateRecommendedSkillCatalogV1(
      catalog({ recommendations: [withoutLicense] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "catalog.recommendations[0].license",
    });
  });

  test("declared automatic discovery is rejected", () => {
    expect(
      validateRecommendedSkillCatalogV1(catalog({ automaticDiscovery: true })),
    ).toContainEqual({
      code: "sothoth.skills/automatic-discovery",
      subject: "catalog.automaticDiscovery",
    });
  });

  test("a schema revision other than v1 is an incompatible revision", () => {
    expect(
      validateRecommendedSkillCatalogV1(
        catalog({ schema: "sothoth.profile/recommended-skill-catalog@2" }),
      ),
    ).toEqual([{ code: "sothoth.skills/incompatible-revision", subject: "catalog.schema" }]);
  });

  test("duplicate recommendation identities fail closed", () => {
    const issues = validateRecommendedSkillCatalogV1(
      catalog({ recommendations: [recommendation(), recommendation({ digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111" })] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.skills/duplicate-identity",
      subject: "catalog.recommendations[1]",
    });
  });

  test("an invalid applicable-diagnostic code is an invalid field", () => {
    const issues = validateRecommendedSkillCatalogV1(
      catalog({ recommendations: [recommendation({ "applicable-diagnostic": "nope" })] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "catalog.recommendations[0].applicable-diagnostic",
    });
  });
});

describe("the committed recommended skill catalog", () => {
  const committed = JSON.parse(
    readFileSync(new URL("../../catalog/recommended-skills.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;

  test("passes validateRecommendedSkillCatalogV1 without issues", () => {
    expect(validateRecommendedSkillCatalogV1(committed)).toEqual([]);
  });

  test("curates exactly the named domain-modeling candidate from mattpocock/skills", () => {
    const recommendations = committed.recommendations as Record<string, unknown>[];
    expect(recommendations.length).toBe(1);
    expect(recommendations[0]?.["source-repository"]).toBe("mattpocock/skills");
    expect(recommendations[0]?.path).toBe("skills/engineering/domain-modeling");
    expect(recommendations[0]?.["exact-commit-or-tag"]).toMatch(/^[0-9a-f]{40}$/);
    expect(recommendations[0]?.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(typeof recommendations[0]?.license).toBe("string");
    expect((recommendations[0]?.license as string).length).toBeGreaterThan(0);
  });

  test("pins the Controller Ruling F verified lock facts for the domain-modeling skill", () => {
    const locked = (committed.recommendations as Record<string, unknown>[])[0];
    expect(locked?.["exact-commit-or-tag"]).toBe(
      "3cca18b368ae95cdbdebbff572ccafa662551015",
    );
    expect(locked?.digest).toBe(
      "sha256:327a2b50620e2fd70abc6893cd6965e76b20f8d0adb0dc2c8d5eb3845efb643e",
    );
    expect(locked?.license).toBe("MIT");
    expect(locked?.["applicable-diagnostic"]).toBe("sothoth.profile/unknown-mapping");
  });
});
