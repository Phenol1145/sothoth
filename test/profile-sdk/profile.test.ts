// Task 8 / Profile SDK — the Consumer Profile contract (`/load`,
// `/contract-composition`, `/relation-roles`). This file owns
// `profile-consumer-neutral-boundary` evidence: the closed
// `ConsumerProfileV1` shape (exact identity, Document Contract and Gate
// Macro references, relation-role mappings, diagnostic help, module locks),
// mapping visibility, lock integrity, and the neutrality fence that rejects
// a fixture profile introducing a consumer term into core contracts.

import { describe, expect, test } from "vitest";
import {
  CONSUMER_PROFILE_FIELDS_V1,
  CONSUMER_PROFILE_SCHEMA_V1,
  CORE_DIAGNOSTIC_CODE_OWNERS_V1,
  PROFILE_RELATION_KINDS_V1,
  PROFILE_RELATION_ROLES_V1,
  defineProfileV1,
  validateProfileV1,
} from "../../packages/profile-sdk/src/profile.js";
import type {
  ConsumerProfileV1,
  DiagnosticHelpEntryV1,
  ModuleLockV1,
  RelationRoleMappingV1,
} from "../../packages/profile-sdk/src/profile.js";

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

function help(
  code = "consumer.tool/profile-check",
  lines: readonly string[] = ["Ask the profile owner to curate this mapping."],
): DiagnosticHelpEntryV1 {
  return { code, help: [...lines] };
}

function lock(moduleId = "@sothoth/contracts", lockedRevision = "CONTRACT/SOTHOTH/SCHEMAS@1"): ModuleLockV1 {
  return { moduleId, lockedRevision };
}

function profile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: CONSUMER_PROFILE_SCHEMA_V1,
    profileId: "EXAMPLE-CONSUMER-PROFILE",
    profileRevision: 1,
    documentContracts: ["DOC-SOTHOTH-PROFILE-SDK-DOSSIER@1", "sothoth.design-dossier/full/v1@1"],
    gateMacros: ["EXAMPLE-GATE-MACRO@1"],
    relationRoleMappings: [mapping()],
    diagnosticHelp: [help()],
    moduleLocks: [lock()],
    ...overrides,
  };
}

describe("the closed ConsumerProfileV1 vocabulary", () => {
  test("the profile field set is exactly the eight closed fields, frozen", () => {
    expect([...CONSUMER_PROFILE_FIELDS_V1]).toEqual([
      "schema",
      "profileId",
      "profileRevision",
      "documentContracts",
      "gateMacros",
      "relationRoleMappings",
      "diagnosticHelp",
      "moduleLocks",
    ]);
    expect(Object.isFrozen(CONSUMER_PROFILE_FIELDS_V1)).toBe(true);
  });

  test("the relation kinds are exactly impact at revision 1", () => {
    expect([...PROFILE_RELATION_KINDS_V1]).toEqual(["impact"]);
    expect(Object.isFrozen(PROFILE_RELATION_KINDS_V1)).toBe(true);
  });

  test("the assignable roles are exactly review-scope and ordering-edge", () => {
    expect([...PROFILE_RELATION_ROLES_V1]).toEqual(["ordering-edge", "review-scope"]);
    expect(Object.isFrozen(PROFILE_RELATION_ROLES_V1)).toBe(true);
  });

  test("the core-owned diagnostic code owners are exactly the kernel namespaces", () => {
    expect([...CORE_DIAGNOSTIC_CODE_OWNERS_V1]).toEqual([
      "sothoth.contracts",
      "sothoth.core",
      "sothoth.input",
    ]);
    expect(Object.isFrozen(CORE_DIAGNOSTIC_CODE_OWNERS_V1)).toBe(true);
  });

  test("the profile schema identity is the exact v1 reference", () => {
    expect(CONSUMER_PROFILE_SCHEMA_V1).toBe("sothoth.profile/consumer-profile@1");
  });
});

describe("validateProfileV1 fails closed on structure", () => {
  test("a non-object candidate is rejected as an invalid profile", () => {
    expect(validateProfileV1(null)).toEqual([
      { code: "sothoth.profile/invalid-profile", subject: "profile" },
    ]);
    expect(validateProfileV1(["not-a-profile"])).toEqual([
      { code: "sothoth.profile/invalid-profile", subject: "profile" },
    ]);
  });

  test("an unknown top-level field fails closed", () => {
    const issues = validateProfileV1(profile({ consumerPolicy: { defaults: true } }));
    expect(issues).toContainEqual({
      code: "sothoth.contracts/unknown-field",
      subject: "profile.consumerPolicy",
    });
  });

  test("a missing closed field fails closed", () => {
    const candidate = profile();
    delete candidate.moduleLocks;
    expect(validateProfileV1(candidate)).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "profile.moduleLocks",
    });
  });

  test("a schema revision other than v1 is an incompatible revision", () => {
    expect(validateProfileV1(profile({ schema: "sothoth.profile/consumer-profile@2" }))).toEqual([
      { code: "sothoth.profile/incompatible-revision", subject: "profile.schema" },
    ]);
  });

  test("a non-positive profile revision is an invalid field", () => {
    expect(validateProfileV1(profile({ profileRevision: 0 }))).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "profile.profileRevision",
    });
  });

  test("a non-array document contract list is an invalid field", () => {
    expect(validateProfileV1(profile({ documentContracts: "DOC-X@1" }))).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "profile.documentContracts",
    });
  });

  test("a non-string reference element is an invalid field with its exact index", () => {
    expect(validateProfileV1(profile({ gateMacros: [7] }))).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "profile.gateMacros[0]",
    });
  });

  test("a mapping that is not a plain object is an invalid field with its exact index", () => {
    expect(validateProfileV1(profile({ relationRoleMappings: ["nope"] }))).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "profile.relationRoleMappings[0]",
    });
  });
});

describe("exact-reference integrity of contracts, macros, and module locks", () => {
  test("a valid profile with exact references produces no issues", () => {
    expect(validateProfileV1(profile())).toEqual([]);
  });

  test("a floating branch reference is rejected", () => {
    expect(validateProfileV1(profile({ documentContracts: ["main"] }))).toContainEqual({
      code: "sothoth.profile/floating-ref",
      subject: "profile.documentContracts[0]",
    });
  });

  test("a reference without a positive integer revision is rejected", () => {
    expect(validateProfileV1(profile({ gateMacros: ["EXAMPLE-GATE-MACRO"] }))).toContainEqual({
      code: "sothoth.profile/floating-ref",
      subject: "profile.gateMacros[0]",
    });
  });

  test("a zero revision reference is rejected", () => {
    expect(validateProfileV1(profile({ gateMacros: ["EXAMPLE-GATE-MACRO@0"] }))).toContainEqual({
      code: "sothoth.profile/floating-ref",
      subject: "profile.gateMacros[0]",
    });
  });

  test("a floating module lock revision is rejected", () => {
    expect(
      validateProfileV1(profile({ moduleLocks: [lock("@sothoth/core", "latest")] })),
    ).toContainEqual({
      code: "sothoth.profile/floating-ref",
      subject: "profile.moduleLocks[0].lockedRevision",
    });
  });

  test("an unknown field on a module lock fails closed", () => {
    const candidate = profile({ moduleLocks: [{ ...lock(), range: "^0.1.0" }] });
    expect(validateProfileV1(candidate)).toContainEqual({
      code: "sothoth.contracts/unknown-field",
      subject: "profile.moduleLocks[0].range",
    });
  });

  test("duplicate document contract identities fail closed", () => {
    expect(
      validateProfileV1(
        profile({ documentContracts: ["DOC-X@1", "DOC-X@2", "DOC-X@1"] }),
      ),
    ).toContainEqual({
      code: "sothoth.profile/duplicate-identity",
      subject: "profile.documentContracts[2]",
    });
  });

  test("duplicate module ids fail closed", () => {
    expect(
      validateProfileV1({
        ...profile(),
        moduleLocks: [lock("@sothoth/contracts"), lock("@sothoth/contracts")],
      }),
    ).toContainEqual({
      code: "sothoth.profile/duplicate-identity",
      subject: "profile.moduleLocks[1].moduleId",
    });
  });
});

describe("relation-role mapping visibility", () => {
  test("an explicit versioned mapping is required to carry every field", () => {
    const withoutExplanation = { ...mapping() } as Record<string, unknown>;
    delete withoutExplanation.explanation;
    expect(
      validateProfileV1(profile({ relationRoleMappings: [withoutExplanation] })),
    ).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "profile.relationRoleMappings[0].explanation",
    });
  });

  test("an unknown relation kind is an unknown mapping, never silently ignored", () => {
    expect(
      validateProfileV1(profile({ relationRoleMappings: [mapping({ relationKind: "consumes" })] })),
    ).toContainEqual({
      code: "sothoth.profile/unknown-mapping",
      subject: "profile.relationRoleMappings[0].relationKind",
    });
  });

  test("an unknown assigned role is an unknown mapping", () => {
    expect(
      validateProfileV1(profile({ relationRoleMappings: [mapping({ assignedRole: "blocks" })] })),
    ).toContainEqual({
      code: "sothoth.profile/unknown-mapping",
      subject: "profile.relationRoleMappings[0].assignedRole",
    });
  });

  test("a non-positive mapping revision is an invalid field", () => {
    expect(
      validateProfileV1(profile({ relationRoleMappings: [mapping({ mappingRevision: 0 })] })),
    ).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "profile.relationRoleMappings[0].mappingRevision",
    });
  });

  test("duplicate mapping identities fail closed", () => {
    expect(
      validateProfileV1({
        ...profile(),
        relationRoleMappings: [mapping(), mapping({ mappingRevision: 2 })],
      }),
    ).toContainEqual({
      code: "sothoth.profile/duplicate-identity",
      subject: "profile.relationRoleMappings[1].mappingId",
    });
  });

  test("defineProfileV1 exposes every declared mapping in canonical mapping-id order", () => {
    const definition = defineProfileV1(
      profile({
        relationRoleMappings: [
          mapping({ mappingId: "zeta-mapping", assignedRole: "ordering-edge" }),
          mapping({ mappingId: "alpha-mapping" }),
        ],
      }),
    );
    expect(definition.issues).toEqual([]);
    expect(definition.profile?.relationRoleMappings.map((entry) => entry.mappingId)).toEqual([
      "alpha-mapping",
      "zeta-mapping",
    ]);
  });
});

describe("consumer neutrality of the core contract vocabulary", () => {
  test("a fixture profile introducing a consumer term into core contracts is rejected", () => {
    const issues = validateProfileV1(
      profile({ diagnosticHelp: [help("sothoth.contracts/unknown-field")] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.profile/consumer-term-in-core-contract",
      subject: "profile.diagnosticHelp[0].code",
    });
  });

  test("consumer help on a core input-diagnostic code is rejected too", () => {
    const issues = validateProfileV1(
      profile({ diagnosticHelp: [help("sothoth.input/invalid-json-value")] }),
    );
    expect(issues).toContainEqual({
      code: "sothoth.profile/consumer-term-in-core-contract",
      subject: "profile.diagnosticHelp[0].code",
    });
    expect(defineProfileV1(profile({ diagnosticHelp: [help("sothoth.input/invalid-json-value")] })).profile).toBeNull();
  });

  test("consumer help on a non-core diagnostic code is accepted", () => {
    expect(validateProfileV1(profile({ diagnosticHelp: [help("consumer.tool/profile-check")] }))).toEqual([]);
  });

  test("a help entry with an invalid diagnostic code is an invalid field", () => {
    expect(validateProfileV1(profile({ diagnosticHelp: [help("not-a-code")] }))).toContainEqual({
      code: "sothoth.contracts/invalid-field",
      subject: "profile.diagnosticHelp[0].code",
    });
  });

  test("duplicate help codes fail closed", () => {
    expect(
      validateProfileV1({
        ...profile(),
        diagnosticHelp: [help("consumer.tool/a"), help("consumer.tool/a")],
      }),
    ).toContainEqual({
      code: "sothoth.profile/duplicate-identity",
      subject: "profile.diagnosticHelp[1].code",
    });
  });

  test("help entries carry only the closed code and help fields", () => {
    const entry = { ...help(), severity: "warning" };
    expect(validateProfileV1(profile({ diagnosticHelp: [entry] }))).toContainEqual({
      code: "sothoth.contracts/unknown-field",
      subject: "profile.diagnosticHelp[0].severity",
    });
  });
});

describe("defineProfileV1 loads caller-owned values deterministically", () => {
  test("a valid profile is canonicalized, frozen, and digested", () => {
    const definition = defineProfileV1(profile());
    expect(definition.issues).toEqual([]);
    expect(definition.profile).not.toBeNull();
    expect(definition.profileDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.isFrozen(definition.profile)).toBe(true);
    expect(definition.profile?.schema).toBe(CONSUMER_PROFILE_SCHEMA_V1);
  });

  test("array order never changes the canonical digest", () => {
    const first = defineProfileV1(
      profile({
        documentContracts: ["DOC-A@1", "DOC-B@1"],
        gateMacros: ["MACRO-B@1", "MACRO-A@1"],
        moduleLocks: [lock("@sothoth/contracts"), lock("@sothoth/core")],
      }),
    );
    const second = defineProfileV1(
      profile({
        documentContracts: ["DOC-B@1", "DOC-A@1"],
        gateMacros: ["MACRO-A@1", "MACRO-B@1"],
        moduleLocks: [lock("@sothoth/core"), lock("@sothoth/contracts")],
      }),
    );
    expect(second.profileDigest).toBe(first.profileDigest);
  });

  test("different facts produce different digests", () => {
    const first = defineProfileV1(profile());
    const second = defineProfileV1(profile({ profileRevision: 2 }));
    expect(second.profileDigest).not.toBe(first.profileDigest);
  });

  test("an invalid profile loads to null with its issues", () => {
    const definition = defineProfileV1(profile({ gateMacros: ["floating"] }));
    expect(definition.profile).toBeNull();
    expect(definition.profileDigest).toBeNull();
    expect(definition.issues).not.toEqual([]);
  });

  test("a canonical profile satisfies the readonly ConsumerProfileV1 type", () => {
    const definition = defineProfileV1(profile());
    const canonical: ConsumerProfileV1 | null = definition.profile;
    expect(canonical?.relationRoleMappings[0]?.relationKind).toBe("impact");
  });
});
