/**
 * The Dossier pre-design vocabulary: topics, resolutions, applicability
 * kinds, and the closed `sothoth-dossier/*@1` declaration-kind registry.
 *
 * Public family `@project-sothoth/contracts/pre-design`. This module is the single
 * shipped owner of every declaration kind used by the accepted Dossiers: no
 * other package may re-declare, extend, or partially mirror this vocabulary.
 * The registry below was derived from the declaration blocks of the eleven
 * accepted Dossiers at revision 1; it declares only kinds that actually occur
 * there and adds none. Every declaration is validated as a closed object:
 * an unknown key fails closed exactly like a missing, unknown, or accessor
 * kind, and known fields are read only through own-property descriptors, so
 * hostile accessors never run.
 */

import { sortContractIssues } from "./code-point-order.js";
import { readOwnDataField } from "./own-data.js";
import { validateExactRecordV1 } from "./schema.js";
import type { ContractIssueV1 } from "./schema.js";

/** The Dossier document contract this vocabulary closes over. */
export const DOSSIER_DOCUMENT_CONTRACT_V1 = "sothoth.design-dossier/full/v1";

/** The closed eighteen-topic set, in contract-declared order. */
export const DOSSIER_TOPICS_V1 = [
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
] as const;

/** A topic member of `DOSSIER_TOPICS_V1`. */
export type ArtifactDesignTopicV1 = (typeof DOSSIER_TOPICS_V1)[number];

/** The closed topic resolution kinds. */
export const TOPIC_RESOLUTIONS_V1 = ["local", "inherited", "not-applicable"] as const;

/** A resolution member of `TOPIC_RESOLUTIONS_V1`. */
export type TopicResolutionV1 = (typeof TOPIC_RESOLUTIONS_V1)[number];

/** The closed inheritance applicability kinds. */
export const TOPIC_INHERITANCE_APPLICABILITY_V1 = ["adopts", "narrows", "specializes"] as const;

/** An applicability member of `TOPIC_INHERITANCE_APPLICABILITY_V1`. */
export type ApplicabilityV1 = (typeof TOPIC_INHERITANCE_APPLICABILITY_V1)[number];

/** An exact reference to the section that resolves one inherited topic. */
export interface ExactDesignSectionRefV1 {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly sectionId: string;
  readonly applicability: ApplicabilityV1;
}

/** The closed field set of a topic-coverage entry. */
export const TOPIC_COVERAGE_ENTRY_FIELDS_V1 = [
  "resolution",
  "sectionId",
  "refs",
  "reason",
] as const;

/** How one closed topic is resolved by a Dossier or registration. */
export interface TopicCoverageEntryV1 {
  readonly resolution: TopicResolutionV1;
  readonly sectionId: string | null;
  readonly refs: readonly ExactDesignSectionRefV1[];
  readonly reason: string | null;
}

/**
 * Every `sothoth-dossier/*@1` declaration kind used by the accepted
 * Dossiers, in Unicode code-point order. The set is closed: a declaration of
 * any other kind is a schema violation, not an extension point.
 */
export const DOSSIER_DECLARATION_KINDS_V1 = [
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

/** A declaration kind member of `DOSSIER_DECLARATION_KINDS_V1`. */
export type DossierDeclarationKindV1 = (typeof DOSSIER_DECLARATION_KINDS_V1)[number];

/**
 * The required field set of each declaration kind: the keys every accepted
 * instance of that kind carries. Field order follows the Dossier prose.
 */
export const DOSSIER_DECLARATION_REQUIRED_FIELDS_V1: Readonly<
  Record<DossierDeclarationKindV1, readonly string[]>
> = {
  "sothoth-dossier/cli-command-declaration@1": [
    "kind",
    "packageId",
    "surfaceKind",
    "commands",
    "hiddenCommands",
    "unknownCommandOutcome",
  ],
  "sothoth-dossier/cli-exit-declaration@1": [
    "kind",
    "packageId",
    "exitMap",
    "ownsExitCodeMapping",
    "extensionExitOverride",
  ],
  "sothoth-dossier/cli-input-declaration@1": [
    "kind",
    "packageId",
    "explicitInputSources",
    "implicitScanning",
    "environmentVariableSemantics",
    "implicitDefaultProfile",
  ],
  "sothoth-dossier/cli-output-declaration@1": [
    "kind",
    "packageId",
    "defaultOutput",
    "writeStrategy",
    "atomicExplicitWrites",
    "partialTargetFiles",
    "unwritableDestinationOutcome",
    "unwritableDestinationDiagnostic",
    "stagedGeneratedFiles",
  ],
  "sothoth-dossier/cli-stream-declaration@1": [
    "kind",
    "packageId",
    "stdoutContract",
    "stdoutContamination",
    "operationalNarration",
  ],
  "sothoth-dossier/dependency-declaration@1": [
    "kind",
    "packageId",
    "runtimeImportAllowlist",
    "providedContracts",
    "requiredContracts",
  ],
  "sothoth-dossier/determinism-declaration@1": [
    "kind",
    "packageId",
    "byteStableOutputs",
    "stringOrdering",
    "tieBreaking",
  ],
  "sothoth-dossier/domain-semantics-declaration@1": [
    "kind",
    "packageId",
    "ownedDomainSemantics",
    "interpretedEdgeRoles",
    "semanticsDeferredTo",
  ],
  "sothoth-dossier/facade-capability-declaration@1": [
    "kind",
    "packageId",
    "facadeKind",
    "solePublicLibraryFacade",
    "secondCore",
    "ownsDomainTruth",
    "wrapsGenericGraph",
    "exposesPrivateCoreCapability",
    "delegatesSemanticOperations",
    "delegatesTo",
    "nonDelegatedSemanticOperations",
  ],
  "sothoth-dossier/forbidden-capability-declaration@1": [
    "kind",
    "packageId",
    "capabilityClasses",
  ],
  "sothoth-dossier/git-budget-declaration@1": [
    "kind",
    "packageId",
    "enforcedBudgets",
    "exhaustionPolicy",
    "truncationPolicy",
  ],
  "sothoth-dossier/git-path-declaration@1": [
    "kind",
    "packageId",
    "normalization",
    "ambiguousRefPolicy",
    "rejectedPathClasses",
  ],
  "sothoth-dossier/git-process-declaration@1": [
    "kind",
    "packageId",
    "executableSubcommands",
    "argumentStyle",
    "shellInvocation",
    "environmentVariableSemantics",
    "mutationSubcommands",
    "mutationCapability",
  ],
  "sothoth-dossier/git-provenance-declaration@1": [
    "kind",
    "packageId",
    "workspaceMasqueradesAsCommit",
    "provenanceIdentitySeparation",
    "modes",
    "workspaceByteClasses",
  ],
  "sothoth-dossier/profile-boundary-declaration@1": [
    "kind",
    "packageId",
    "compositionMode",
    "ownsConsumerIdentity",
    "ownsConsumerPolicy",
    "ownsFractaIdentity",
    "ownsFractaPolicy",
    "ownsFractaReleaseRules",
    "ownsRegistryTruth",
    "ownsPlanGraphTruth",
    "ownsTaskStateTruth",
    "ownsCapacityPolicyTruth",
    "ownsEvidenceTruth",
    "ownsReleaseBomTruth",
    "importsDomainImplementations",
    "impactPromotedToOrderingEdge",
  ],
  "sothoth-dossier/profile-failure-declaration@1": [
    "kind",
    "packageId",
    "conformanceResult",
    "failClosedConditions",
    "profileMutation",
  ],
  "sothoth-dossier/public-surface-declaration@1": [
    "kind",
    "packageId",
    "publicModules",
    "surfaceKind",
  ],
  "sothoth-dossier/schedule-solution-declaration@1": [
    "kind",
    "packageId",
    "solutionIdentity",
    "authority",
    "implementedCapabilities",
    "unsupportedDimensions",
    "waveTruthIdentities",
  ],
  "sothoth-dossier/sdk-outcome-declaration@1": [
    "kind",
    "packageId",
    "outcomeEnvelope",
    "selectsProcessExitCode",
    "extensionSelectsOutcome",
    "failClosedConditions",
  ],
  "sothoth-dossier/skill-recommendation-declaration@1": [
    "kind",
    "packageId",
    "sourceKind",
    "automaticDiscovery",
    "revisionLocking",
    "allowedFields",
    "prohibitedOperations",
    "namedCandidate",
    "lockedRevision",
    "lockedDigest",
  ],
  "sothoth-dossier/truth-ownership-declaration@1": [
    "kind",
    "packageId",
    "producedStateRefs",
    "issuedAuthorityRefs",
    "effectOwnership",
  ],
  "sothoth-dossier/verification-criteria@1": ["kind", "packageId", "criteria"],
};

/**
 * The optional field set of each declaration kind: keys that occur on some
 * accepted instances of the kind but not on all of them. Only the
 * truth-ownership declaration has optional keys at revision 1.
 */
export const DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1: Readonly<
  Record<DossierDeclarationKindV1, readonly string[]>
> = {
  "sothoth-dossier/cli-command-declaration@1": [],
  "sothoth-dossier/cli-exit-declaration@1": [],
  "sothoth-dossier/cli-input-declaration@1": [],
  "sothoth-dossier/cli-output-declaration@1": [],
  "sothoth-dossier/cli-stream-declaration@1": [],
  "sothoth-dossier/dependency-declaration@1": [],
  "sothoth-dossier/determinism-declaration@1": [],
  "sothoth-dossier/domain-semantics-declaration@1": [],
  "sothoth-dossier/facade-capability-declaration@1": [],
  "sothoth-dossier/forbidden-capability-declaration@1": [],
  "sothoth-dossier/git-budget-declaration@1": [],
  "sothoth-dossier/git-path-declaration@1": [],
  "sothoth-dossier/git-process-declaration@1": [],
  "sothoth-dossier/git-provenance-declaration@1": [],
  "sothoth-dossier/profile-boundary-declaration@1": [],
  "sothoth-dossier/profile-failure-declaration@1": [],
  "sothoth-dossier/public-surface-declaration@1": [],
  "sothoth-dossier/schedule-solution-declaration@1": [],
  "sothoth-dossier/sdk-outcome-declaration@1": [],
  "sothoth-dossier/skill-recommendation-declaration@1": [],
  "sothoth-dossier/truth-ownership-declaration@1": [
    "emittedObservationRefs",
    "ownsAcceptance",
    "ownsCompilationSemantics",
    "ownsDomainTruth",
  ],
  "sothoth-dossier/verification-criteria@1": [],
};

const DECLARATION_KIND_SET: ReadonlySet<string> = new Set(DOSSIER_DECLARATION_KINDS_V1);

/**
 * Validates one Dossier declaration as a closed object.
 *
 * The candidate must be a non-array object whose `kind` is an own data
 * property holding a member of `DOSSIER_DECLARATION_KINDS_V1`; every own key
 * must belong to the kind's required or optional field set; every required
 * key must be present as an own data property; and every present required or
 * optional known field must itself be an own data property — an own accessor
 * fails closed as `sothoth.contracts/invalid-field` without its getter ever
 * executing, and inherited fields never masquerade as present own fields.
 * This validator closes the object shape only — value typing of declaration
 * fields stays with the governance compiler that consumes whole Dossiers.
 * Issues are ordered by code and then subject in Unicode code-point order,
 * and no property value is ever read through plain property access.
 */
export function validateDossierDeclarationV1(candidate: unknown): readonly ContractIssueV1[] {
  const subject = "declaration";
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return [{ code: "sothoth.contracts/invalid-declaration", subject }];
  }
  const record = candidate as Record<string, unknown>;
  const kindField = readOwnDataField(record, "kind");
  if (kindField.state === "missing") {
    return sortContractIssues([
      { code: "sothoth.contracts/missing-field", subject: `${subject}.kind` },
    ]);
  }
  if (kindField.state === "accessor") {
    return sortContractIssues([
      { code: "sothoth.contracts/invalid-field", subject: `${subject}.kind` },
    ]);
  }
  const kind = kindField.value;
  if (typeof kind !== "string" || !DECLARATION_KIND_SET.has(kind)) {
    return sortContractIssues([
      { code: "sothoth.contracts/unknown-declaration-kind", subject: `${subject}.kind` },
    ]);
  }
  const required = DOSSIER_DECLARATION_REQUIRED_FIELDS_V1[kind as DossierDeclarationKindV1];
  const optional = DOSSIER_DECLARATION_OPTIONAL_FIELDS_V1[kind as DossierDeclarationKindV1];
  const issues: ContractIssueV1[] = [
    ...validateExactRecordV1(record, [...required, ...optional], subject),
  ];
  for (const field of required) {
    const fieldState = readOwnDataField(record, field);
    if (fieldState.state === "missing") {
      issues.push({ code: "sothoth.contracts/missing-field", subject: `${subject}.${field}` });
    } else if (fieldState.state === "accessor") {
      issues.push({ code: "sothoth.contracts/invalid-field", subject: `${subject}.${field}` });
    }
  }
  for (const field of optional) {
    if (readOwnDataField(record, field).state === "accessor") {
      issues.push({ code: "sothoth.contracts/invalid-field", subject: `${subject}.${field}` });
    }
  }
  return sortContractIssues(issues);
}
