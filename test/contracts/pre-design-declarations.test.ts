import { describe, expect, test } from "vitest";
import {
  DOSSIER_DECLARATION_KINDS_V1,
  DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1,
  DOSSIER_DECLARATION_REQUIRED_FIELDS_V1,
  DOSSIER_DOCUMENT_CONTRACT_V1,
  DOSSIER_TOPICS_V1,
  TOPIC_INHERITANCE_APPLICABILITY_V1,
  TOPIC_RESOLUTIONS_V1,
  validateDossierDeclarationV1,
} from "../../packages/contracts/src/index.js";

type Sample = Record<string, unknown>;

const EXPECTED_KINDS = [
  "sothoth-dossier/cli-command-declaration@1",
  "sothoth-dossier/cli-exit-declaration@1",
  "sothoth-dossier/cli-input-declaration@1",
  "sothoth-dossier/cli-output-declaration@1",
  "sothoth-dossier/cli-stream-declaration@1",
  "sothoth-dossier/dependency-declaration@1",
  "sothoth-dossier/determinism-declaration@1",
  "sothoth-dossier/domain-semantics-declaration@1",
  "sothoth-dossier/facade-capability-declaration@1",
  "sothoth-dossier/forbidden-capability-declaration@1",
  "sothoth-dossier/git-budget-declaration@1",
  "sothoth-dossier/git-path-declaration@1",
  "sothoth-dossier/git-process-declaration@1",
  "sothoth-dossier/git-provenance-declaration@1",
  "sothoth-dossier/profile-boundary-declaration@1",
  "sothoth-dossier/profile-failure-declaration@1",
  "sothoth-dossier/public-surface-declaration@1",
  "sothoth-dossier/schedule-solution-declaration@1",
  "sothoth-dossier/sdk-outcome-declaration@1",
  "sothoth-dossier/skill-recommendation-declaration@1",
  "sothoth-dossier/truth-ownership-declaration@1",
  "sothoth-dossier/verification-criteria@1",
] as const;

const SAMPLES: Record<(typeof EXPECTED_KINDS)[number], Sample> = {
  "sothoth-dossier/cli-command-declaration@1": {
    kind: "sothoth-dossier/cli-command-declaration@1",
    packageId: "@sothoth/cli",
    surfaceKind: "explicit-command-surface",
    commands: ["check"],
    hiddenCommands: [],
    unknownCommandOutcome: "invalid-input",
  },
  "sothoth-dossier/cli-exit-declaration@1": {
    kind: "sothoth-dossier/cli-exit-declaration@1",
    packageId: "@sothoth/cli",
    exitMap: {
      "0": "valid",
      "1": "invalid",
      "2": "invalid-input",
      "3": "extension-error",
      "4": "internal-error",
    },
    ownsExitCodeMapping: true,
    extensionExitOverride: "forbidden",
  },
  "sothoth-dossier/cli-input-declaration@1": {
    kind: "sothoth-dossier/cli-input-declaration@1",
    packageId: "@sothoth/cli",
    explicitInputSources: ["argv-flags"],
    implicitScanning: "forbidden",
    environmentVariableSemantics: "forbidden",
    implicitDefaultProfile: "forbidden",
  },
  "sothoth-dossier/cli-output-declaration@1": {
    kind: "sothoth-dossier/cli-output-declaration@1",
    packageId: "@sothoth/cli",
    defaultOutput: "stdout",
    writeStrategy: "same-directory-temp-then-replace",
    atomicExplicitWrites: true,
    partialTargetFiles: "forbidden",
    unwritableDestinationOutcome: "invalid-input",
    unwritableDestinationDiagnostic: "sothoth.pre-design/output-unwritable",
    stagedGeneratedFiles: "forbidden",
  },
  "sothoth-dossier/cli-stream-declaration@1": {
    kind: "sothoth-dossier/cli-stream-declaration@1",
    packageId: "@sothoth/cli",
    stdoutContract: "exactly-one-machine-document",
    stdoutContamination: "forbidden",
    operationalNarration: "stderr-only",
  },
  "sothoth-dossier/dependency-declaration@1": {
    kind: "sothoth-dossier/dependency-declaration@1",
    packageId: "@sothoth/contracts",
    runtimeImportAllowlist: [],
    providedContracts: [],
    requiredContracts: [],
  },
  "sothoth-dossier/determinism-declaration@1": {
    kind: "sothoth-dossier/determinism-declaration@1",
    packageId: "@sothoth/contracts",
    byteStableOutputs: true,
    stringOrdering: "unicode-code-point",
    tieBreaking: "declared-enumeration-order",
  },
  "sothoth-dossier/domain-semantics-declaration@1": {
    kind: "sothoth-dossier/domain-semantics-declaration@1",
    packageId: "@sothoth/graph",
    ownedDomainSemantics: [],
    interpretedEdgeRoles: [],
    semanticsDeferredTo: "consuming-domain-package",
  },
  "sothoth-dossier/facade-capability-declaration@1": {
    kind: "sothoth-dossier/facade-capability-declaration@1",
    packageId: "@sothoth/sdk",
    facadeKind: "aggregate-public-library-facade",
    solePublicLibraryFacade: true,
    secondCore: false,
    ownsDomainTruth: false,
    wrapsGenericGraph: false,
    exposesPrivateCoreCapability: false,
    delegatesSemanticOperations: true,
    delegatesTo: [],
    nonDelegatedSemanticOperations: [],
  },
  "sothoth-dossier/forbidden-capability-declaration@1": {
    kind: "sothoth-dossier/forbidden-capability-declaration@1",
    packageId: "@sothoth/contracts",
    capabilityClasses: { filesystem: "forbidden" },
  },
  "sothoth-dossier/git-budget-declaration@1": {
    kind: "sothoth-dossier/git-budget-declaration@1",
    packageId: "@sothoth/git",
    enforcedBudgets: ["file-count"],
    exhaustionPolicy: "fail-closed",
    truncationPolicy: "forbidden",
  },
  "sothoth-dossier/git-path-declaration@1": {
    kind: "sothoth-dossier/git-path-declaration@1",
    packageId: "@sothoth/git",
    normalization: "repository-relative-posix",
    ambiguousRefPolicy: "reject",
    rejectedPathClasses: ["absolute-path"],
  },
  "sothoth-dossier/git-process-declaration@1": {
    kind: "sothoth-dossier/git-process-declaration@1",
    packageId: "@sothoth/git",
    executableSubcommands: ["status"],
    argumentStyle: "fixed-argument-array",
    shellInvocation: "forbidden",
    environmentVariableSemantics: "forbidden",
    mutationSubcommands: ["push"],
    mutationCapability: "forbidden",
  },
  "sothoth-dossier/git-provenance-declaration@1": {
    kind: "sothoth-dossier/git-provenance-declaration@1",
    packageId: "@sothoth/git",
    workspaceMasqueradesAsCommit: false,
    provenanceIdentitySeparation: "strict",
    modes: [
      {
        mode: "commit",
        binding: "exact-commit-tree-blob",
        intendedUse: "ci-release-immutable-evidence",
      },
    ],
    workspaceByteClasses: ["head"],
  },
  "sothoth-dossier/profile-boundary-declaration@1": {
    kind: "sothoth-dossier/profile-boundary-declaration@1",
    packageId: "@sothoth/profile-sdk",
    compositionMode: "caller-owned-exact-reference-data",
    ownsConsumerIdentity: false,
    ownsConsumerPolicy: false,
    ownsFractaIdentity: false,
    ownsFractaPolicy: false,
    ownsFractaReleaseRules: false,
    ownsRegistryTruth: false,
    ownsPlanGraphTruth: false,
    ownsTaskStateTruth: false,
    ownsCapacityPolicyTruth: false,
    ownsEvidenceTruth: false,
    ownsReleaseBomTruth: false,
    importsDomainImplementations: false,
    impactPromotedToOrderingEdge: false,
  },
  "sothoth-dossier/profile-failure-declaration@1": {
    kind: "sothoth-dossier/profile-failure-declaration@1",
    packageId: "@sothoth/profile-sdk",
    conformanceResult: "non-authoritative-projection-or-diagnostic",
    failClosedConditions: ["unknown-field"],
    profileMutation: "forbidden",
  },
  "sothoth-dossier/public-surface-declaration@1": {
    kind: "sothoth-dossier/public-surface-declaration@1",
    packageId: "@sothoth/contracts",
    publicModules: [],
    surfaceKind: "types-and-validation-only",
  },
  "sothoth-dossier/schedule-solution-declaration@1": {
    kind: "sothoth-dossier/schedule-solution-declaration@1",
    packageId: "@sothoth/planning",
    solutionIdentity: "sothoth.planning/schedule-solution@1",
    authority: "non-authoritative-projection",
    implementedCapabilities: ["dependency-constraint-validation"],
    unsupportedDimensions: ["time"],
    waveTruthIdentities: [],
  },
  "sothoth-dossier/sdk-outcome-declaration@1": {
    kind: "sothoth-dossier/sdk-outcome-declaration@1",
    packageId: "@sothoth/sdk",
    outcomeEnvelope: "closed-typed-outcome-with-diagnostics",
    selectsProcessExitCode: false,
    extensionSelectsOutcome: false,
    failClosedConditions: ["unknown-field"],
  },
  "sothoth-dossier/skill-recommendation-declaration@1": {
    kind: "sothoth-dossier/skill-recommendation-declaration@1",
    packageId: "@sothoth/profile-sdk",
    sourceKind: "caller-supplied-curated-versioned-catalog",
    automaticDiscovery: false,
    revisionLocking: "exact-only",
    allowedFields: ["digest"],
    prohibitedOperations: ["crawl"],
    namedCandidate: { sourceRepository: "mattpocock/skills", path: "domain-modeling" },
    lockedRevision: null,
    lockedDigest: null,
  },
  "sothoth-dossier/truth-ownership-declaration@1": {
    kind: "sothoth-dossier/truth-ownership-declaration@1",
    packageId: "@sothoth/contracts",
    producedStateRefs: [],
    issuedAuthorityRefs: [],
    effectOwnership: "declarative-only",
  },
  "sothoth-dossier/verification-criteria@1": {
    kind: "sothoth-dossier/verification-criteria@1",
    packageId: "@sothoth/contracts",
    criteria: [
      {
        criterionId: "contracts-schema-closure",
        sectionId: "verification-and-acceptance-criteria",
      },
    ],
  },
};

describe("dossier declaration-kind vocabulary (M-4)", () => {
  test("owns exactly the declaration kinds used by the accepted Dossiers", () => {
    expect([...DOSSIER_DECLARATION_KINDS_V1]).toEqual([...EXPECTED_KINDS]);
  });

  test("declares required and optional field sets for every kind", () => {
    expect(Object.keys(DOSSIER_DECLARATION_REQUIRED_FIELDS_V1).sort()).toEqual(
      [...EXPECTED_KINDS],
    );
    expect(Object.keys(DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1).sort()).toEqual(
      [...EXPECTED_KINDS],
    );
    for (const kind of EXPECTED_KINDS) {
      expect(DOSSIER_DECLARATION_REQUIRED_FIELDS_V1[kind].length).toBeGreaterThan(0);
      for (const field of DOSSIER_DECLARATION_REQUIRED_FIELDS_V1[kind]) {
        expect(DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1[kind]).not.toContain(field);
      }
    }
  });

  test.each(Object.entries(SAMPLES))("accepts a well-formed %s", (_kind, sample) => {
    expect(validateDossierDeclarationV1(sample)).toEqual([]);
  });

  test.each(Object.entries(SAMPLES))("fails closed on an unknown key in %s", (_kind, sample) => {
    expect(validateDossierDeclarationV1({ ...sample, surprise: true })).toContainEqual({
      code: "sothoth.contracts/unknown-field",
      subject: "declaration.surprise",
    });
  });

  test.each(Object.entries(SAMPLES))(
    "fails closed on a missing required key in %s",
    (kind, sample) => {
      for (const field of DOSSIER_DECLARATION_REQUIRED_FIELDS_V1[
        kind as (typeof EXPECTED_KINDS)[number]
      ]) {
        const mutated: Sample = { ...sample };
        delete mutated[field];
        expect(validateDossierDeclarationV1(mutated)).toContainEqual({
          code: "sothoth.contracts/missing-field",
          subject: `declaration.${field}`,
        });
      }
    },
  );

  test("truth-ownership optional keys are accepted but never required", () => {
    const base = SAMPLES["sothoth-dossier/truth-ownership-declaration@1"];
    expect(DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1["sothoth-dossier/truth-ownership-declaration@1"])
      .toEqual(["emittedObservationRefs", "ownsAcceptance", "ownsCompilationSemantics", "ownsDomainTruth"]);
    for (const optionalField of [
      "emittedObservationRefs",
      "ownsAcceptance",
      "ownsCompilationSemantics",
      "ownsDomainTruth",
    ]) {
      expect(
        validateDossierDeclarationV1({ ...base, [optionalField]: [] }),
      ).toEqual([]);
    }
  });

  test("samples carry no keys outside the declared field sets", () => {
    for (const [kind, sample] of Object.entries(SAMPLES)) {
      const allowed = new Set([
        ...DOSSIER_DECLARATION_REQUIRED_FIELDS_V1[kind as (typeof EXPECTED_KINDS)[number]],
        ...DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1[kind as (typeof EXPECTED_KINDS)[number]],
      ]);
      for (const key of Object.keys(sample)) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });

  test("rejects an unknown declaration kind", () => {
    expect(
      validateDossierDeclarationV1({
        kind: "sothoth-dossier/surprise-declaration@1",
        packageId: "@sothoth/contracts",
      }),
    ).toContainEqual({
      code: "sothoth.contracts/unknown-declaration-kind",
      subject: "declaration.kind",
    });
  });

  test("rejects a declaration without a kind", () => {
    expect(validateDossierDeclarationV1({ packageId: "@sothoth/contracts" })).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "declaration.kind",
    });
  });

  test("rejects non-object candidates", () => {
    expect(validateDossierDeclarationV1(null)).toContainEqual({
      code: "sothoth.contracts/invalid-declaration",
      subject: "declaration",
    });
    expect(validateDossierDeclarationV1("sothoth-dossier/dependency-declaration@1"))
      .toContainEqual({
        code: "sothoth.contracts/invalid-declaration",
        subject: "declaration",
      });
  });

  test("reports unknown keys without reading accessor values", () => {
    let calls = 0;
    const sample = {
      ...SAMPLES["sothoth-dossier/dependency-declaration@1"],
    } as Sample;
    Object.defineProperty(sample, "surprise", {
      enumerable: true,
      get() {
        calls += 1;
        return true;
      },
    });

    expect(validateDossierDeclarationV1(sample)).toContainEqual({
      code: "sothoth.contracts/unknown-field",
      subject: "declaration.surprise",
    });
    expect(calls).toBe(0);
  });
});

describe("dossier topic vocabulary", () => {
  test("owns the closed eighteen-topic set in contract order", () => {
    expect([...DOSSIER_TOPICS_V1]).toHaveLength(18);
    expect(DOSSIER_TOPICS_V1[0]).toBe("identity");
    expect(DOSSIER_TOPICS_V1[17]).toBe("future-compatibility");
  });

  test("owns the closed resolution and applicability kinds", () => {
    expect([...TOPIC_RESOLUTIONS_V1]).toEqual(["local", "inherited", "not-applicable"]);
    expect([...TOPIC_INHERITANCE_APPLICABILITY_V1]).toEqual(["adopts", "narrows", "specializes"]);
  });

  test("pins the dossier document contract identity", () => {
    expect(DOSSIER_DOCUMENT_CONTRACT_V1).toBe("sothoth.design-dossier/full/v1");
  });
});
