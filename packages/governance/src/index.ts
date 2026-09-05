/**
 * Internal shared unit of `@project-sothoth/governance`.
 *
 * This module is NOT a public subpath: the accepted Dossier's public-surface
 * declaration lists seven public modules and no root `.` or `./index`
 * entry, so everything here is internal machinery shared by those modules —
 * the two declared diagnostic identities, the Structured Diagnostic draft
 * builder, outcome folding through `@project-sothoth/core`, code-point ordering, the
 * small closed-value predicates every validator reuses, and the shared
 * envelope shape validators for the Document Contract, Design Scope Catalog,
 * Registry, and Artifact Design registrations.
 *
 * The package emits projections only: nothing here reads a clock, a
 * filesystem, the network, or any process state, and nothing writes a Source
 * Fact back. Canonical bytes, digests, and outcome aggregation are owned by
 * `@project-sothoth/core` (`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`) and are
 * consumed directly, never re-implemented.
 */

import type {
  CompilationOutcomeKindV1,
  ContractIssueV1,
  DiagnosticCategoryV1,
  DiagnosticDraftV1,
  DiagnosticVerdictV1,
  StructuredDiagnosticV1,
} from "@project-sothoth/contracts";
import { EXACT_REFERENCE_PATTERN, SECTION_ID_PATTERN } from "@project-sothoth/contracts";
import { finalizeDiagnostics } from "@project-sothoth/core/diagnostics";
import { aggregateOutcome } from "@project-sothoth/core/outcome";
import type { DocumentEntryV1 } from "@project-sothoth/document-index/index";

/** The declared diagnostic identity for pre-design closure and admissibility findings. */
export const PRE_DESIGN_DIAGNOSTIC_IDENTITY_V1 = "sothoth.governance/pre-design-diagnostic@1";

/** The declared diagnostic identity for Registry, Ledger, Traceability, and Manifest findings. */
export const DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1 =
  "sothoth.governance/document-governance-diagnostic@1";

/** The closed phases governance compilations report. */
export type GovernancePhaseV1 =
  | "document-contract"
  | "registry"
  | "ledger"
  | "gate-macros"
  | "pre-design"
  | "change-plan";

/** One internal `{code, subject}` finding before it becomes a structured diagnostic. */
export type PlainFindingV1 = ContractIssueV1;

/** The finding classes a compilation distinguishes; they fold to different outcomes. */
export type FindingClassV1 = "input" | "gates" | "evidence";

const CATEGORY_BY_CLASS: Readonly<Record<FindingClassV1, DiagnosticCategoryV1>> = {
  input: "input",
  gates: "gates",
  evidence: "evidence",
};

const VERDICT_BY_CLASS: Readonly<Record<FindingClassV1, DiagnosticVerdictV1>> = {
  input: "fail",
  gates: "fail",
  evidence: "unresolved",
};

/**
 * Builds one Structured Diagnostic draft under one of the two declared
 * diagnostic identities. The rule identity is the code; the subject is the
 * exact identity the finding is about.
 */
export function findingDraft(
  code: string,
  subject: string,
  phase: GovernancePhaseV1,
  identity: string,
  findingClass: FindingClassV1,
): DiagnosticDraftV1 {
  return {
    code,
    origin: identity,
    category: CATEGORY_BY_CLASS[findingClass],
    phase,
    verdict: VERDICT_BY_CLASS[findingClass],
    severity: "error",
    ruleId: code,
    location: null,
    subjects: [subject],
    parameters: {},
    causes: [],
    help: [],
  };
}

/** Finalizes drafts into the ordered, deduplicated diagnostic set of one compilation. */
export function finalizeFindings(
  drafts: readonly DiagnosticDraftV1[],
): readonly StructuredDiagnosticV1[] {
  return finalizeDiagnostics(drafts);
}

/** Folds finalized diagnostics into the single outcome through Core's aggregation. */
export function outcomeOf(diagnostics: readonly StructuredDiagnosticV1[]): CompilationOutcomeKindV1 {
  return aggregateOutcome(diagnostics).outcome;
}

/** Compares two strings by Unicode code point (never UTF-16 unit order). */
export function compareCodePointOrder(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

/** Sorts plain findings by code, then subject, in Unicode code-point order. */
export function sortFindings(findings: readonly PlainFindingV1[]): readonly PlainFindingV1[] {
  return [...findings].sort(
    (left, right) =>
      compareCodePointOrder(left.code, right.code) ||
      compareCodePointOrder(String(left.subject), String(right.subject)),
  );
}

/** True for a non-null, non-array object (the closed-value object check). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True for a non-empty string. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** True for a positive integer. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Exact array equality; non-array candidates are never equal. */
export function arraysEqual(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

/** True when the values are already in Unicode code-point ascending order. */
export function isSortedCodePoint(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || compareCodePointOrder(values[index - 1]!, value) <= 0,
  );
}

/** Own key names of `record` outside the closed `allowedFields` set. */
export function unknownFieldNames(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
): readonly string[] {
  const allowed = new Set(allowedFields);
  return Object.keys(record).filter((field) => !allowed.has(field));
}

/** True when `value`'s own keys are exactly `fields` (as a set). */
export function keysExactly(value: unknown, fields: readonly string[]): boolean {
  if (!isPlainObject(value)) return false;
  const expected = [...fields].sort(compareCodePointOrder);
  const actual = Object.keys(value).sort(compareCodePointOrder);
  return arraysEqual(actual, expected);
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a `YYYY-MM-DD` calendar date without reading any clock. */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const utc = Date.UTC(year!, month! - 1, day!);
  return (
    Number.isSafeInteger(utc) &&
    new Date(utc).getUTCFullYear() === year &&
    new Date(utc).getUTCMonth() === month! - 1 &&
    new Date(utc).getUTCDate() === day
  );
}

/** The stable section identities of one index entry, in document order. */
export function sectionIdsOfEntry(entry: DocumentEntryV1): readonly string[] {
  return entry.sections.map((section) => section.sectionId);
}

/** True when the candidate matches the exact-reference grammar `<identity>@<positive integer>`. */
export function isExactReference(value: unknown): value is string {
  return typeof value === "string" && EXACT_REFERENCE_PATTERN.test(value);
}

/** True when the candidate is a stable section identity per the shared pattern. */
export function isSectionId(value: unknown): value is string {
  return typeof value === "string" && SECTION_ID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Shared envelope shape validators (closed field sets, fail-closed)
// ---------------------------------------------------------------------------

const CONTRACT_FIELDS = [
  "schema",
  "contractId",
  "contractRevision",
  "description",
  "documentKind",
  "sections",
  "topics",
  "references",
  "criteria",
] as const;

const DOCUMENT_CONTRACT_SCHEMA = "sothoth.document-contract/v1";
const TOPIC_RESOLUTIONS = ["local", "inherited", "not-applicable"] as const;
const TOPIC_INHERITANCE_APPLICABILITY = ["adopts", "narrows", "specializes"] as const;
const REFERENCE_FIELDS = ["documentId", "documentRevision", "sectionId", "applicability"] as const;
const CRITERION_FIELDS = ["criterionId", "sectionId"] as const;

/**
 * Validates a `sothoth.document-contract/v1` envelope as a closed object.
 * Revision 1 interprets exactly one section ordering — `exact` — and pins
 * the closed topic resolution and applicability vocabularies plus the exact
 * reference and criterion field sets; any other declaration fails closed.
 */
export function validateDocumentContractShape(candidate: unknown): readonly PlainFindingV1[] {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(candidate)) {
    return [{ code: "sothoth.governance/contract-invalid", subject: "contract" }];
  }
  for (const field of unknownFieldNames(candidate, CONTRACT_FIELDS)) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: field });
  }
  if (candidate.schema !== DOCUMENT_CONTRACT_SCHEMA) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(candidate.contractId)) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "contractId" });
  }
  if (!isPositiveInteger(candidate.contractRevision)) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "contractRevision" });
  }
  if (!isNonEmptyString(candidate.description) || !isNonEmptyString(candidate.documentKind)) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "description" });
  }
  const sections = candidate.sections;
  if (!isPlainObject(sections) || sections.ordering !== "exact") {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "sections.ordering" });
  } else if (
    !Array.isArray(sections.requiredSectionIds) ||
    sections.requiredSectionIds.length === 0 ||
    !sections.requiredSectionIds.every((id) => isSectionId(id)) ||
    new Set(sections.requiredSectionIds).size !== sections.requiredSectionIds.length
  ) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "sections.requiredSectionIds" });
  }
  const topics = candidate.topics;
  if (!isPlainObject(topics)) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "topics" });
  } else {
    if (
      !Array.isArray(topics.closedSet) ||
      topics.closedSet.length === 0 ||
      !topics.closedSet.every((topic) => isSectionId(topic)) ||
      new Set(topics.closedSet).size !== topics.closedSet.length
    ) {
      findings.push({ code: "sothoth.governance/contract-invalid", subject: "topics.closedSet" });
    }
    if (!arraysEqual(topics.resolutions, TOPIC_RESOLUTIONS)) {
      findings.push({ code: "sothoth.governance/contract-invalid", subject: "topics.resolutions" });
    }
    if (
      !Array.isArray(topics.inheritanceApplicability) ||
      topics.inheritanceApplicability.length === 0 ||
      new Set(topics.inheritanceApplicability).size !== topics.inheritanceApplicability.length ||
      !topics.inheritanceApplicability.every((kind) =>
        (TOPIC_INHERITANCE_APPLICABILITY as readonly string[]).includes(kind),
      )
    ) {
      findings.push({
        code: "sothoth.governance/contract-invalid",
        subject: "topics.inheritanceApplicability",
      });
    }
  }
  const references = candidate.references;
  if (!isPlainObject(references) || !arraysEqual(references.exactFields, REFERENCE_FIELDS)) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "references.exactFields" });
  }
  const criteria = candidate.criteria;
  if (
    !isPlainObject(criteria) ||
    !isPositiveInteger(criteria.minimumPerRegistration) ||
    !arraysEqual(criteria.fields, CRITERION_FIELDS)
  ) {
    findings.push({ code: "sothoth.governance/contract-invalid", subject: "criteria" });
  }
  return sortFindings(findings);
}

const CATALOG_FIELDS = [
  "schema",
  "catalogId",
  "catalogRevision",
  "targetReleaseIntent",
  "status",
  "candidates",
  "externalRelations",
  "deferredCapabilities",
] as const;

const CATALOG_RELEASE_ONLY_FIELDS = [
  "release",
  "license",
  "members",
  "gates",
  "completionGates",
  "candidateDigest",
  "tarball",
  "provenance",
] as const;

const CATALOG_CANDIDATE_FIELDS = [
  "componentId",
  "designId",
  "artifactType",
  "designRequirement",
  "coverage",
  "owner",
] as const;

const DESIGN_REQUIREMENTS = ["full", "projection", "compatibility"] as const;

/**
 * Validates a Design Scope Catalog as a closed, revisable candidate
 * inventory: a catalog is never release membership, so the release-only
 * field family fails closed here, and candidates must be unique by both
 * component and design identity.
 */
export function validateCatalogShape(candidate: unknown): readonly PlainFindingV1[] {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(candidate)) {
    return [{ code: "sothoth.governance/catalog-invalid", subject: "catalog" }];
  }
  for (const field of unknownFieldNames(candidate, CATALOG_FIELDS)) {
    if ((CATALOG_RELEASE_ONLY_FIELDS as readonly string[]).includes(field)) {
      findings.push({ code: "sothoth.governance/catalog-release-field-forbidden", subject: field });
    } else {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: field });
    }
  }
  if (candidate.schema !== "sothoth.design-scope-catalog/v1") {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(candidate.catalogId)) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "catalogId" });
  }
  if (!isPositiveInteger(candidate.catalogRevision)) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "catalogRevision" });
  }
  if (!isNonEmptyString(candidate.targetReleaseIntent)) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "targetReleaseIntent" });
  }
  if (!isNonEmptyString(candidate.status)) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "status" });
  }
  if (!Array.isArray(candidate.candidates)) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "candidates" });
    return sortFindings(findings);
  }
  const seenComponents = new Set<string>();
  const seenDesignIds = new Set<string>();
  for (const entry of candidate.candidates) {
    if (!isPlainObject(entry)) {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: "candidates" });
      continue;
    }
    const componentId = isNonEmptyString(entry.componentId) ? entry.componentId : "candidates";
    for (const field of unknownFieldNames(entry, CATALOG_CANDIDATE_FIELDS)) {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: `${componentId}:${field}` });
    }
    if (seenComponents.has(componentId)) {
      findings.push({ code: "sothoth.governance/catalog-candidate-duplicate", subject: componentId });
    }
    seenComponents.add(componentId);
    if (!isNonEmptyString(entry.designId)) {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: `${componentId}:designId` });
    } else if (seenDesignIds.has(entry.designId)) {
      findings.push({ code: "sothoth.governance/catalog-design-id-duplicate", subject: componentId });
    } else {
      seenDesignIds.add(entry.designId);
    }
    if (!isNonEmptyString(entry.artifactType)) {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: `${componentId}:artifactType` });
    }
    if (!(DESIGN_REQUIREMENTS as readonly string[]).includes(entry.designRequirement as string)) {
      findings.push({
        code: "sothoth.governance/catalog-invalid",
        subject: `${componentId}:designRequirement`,
      });
    }
    if (!isNonEmptyString(entry.coverage)) {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: `${componentId}:coverage` });
    }
    if (!isNonEmptyString(entry.owner)) {
      findings.push({ code: "sothoth.governance/catalog-invalid", subject: `${componentId}:owner` });
    }
  }
  if (!Array.isArray(candidate.externalRelations)) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "externalRelations" });
  }
  const deferred = candidate.deferredCapabilities;
  if (
    !Array.isArray(deferred) ||
    !deferred.every((entry) => isNonEmptyString(entry))
  ) {
    findings.push({ code: "sothoth.governance/catalog-invalid", subject: "deferredCapabilities" });
  }
  return sortFindings(findings);
}

const REGISTRY_FIELDS = ["schema", "registryId", "registryRevision", "documents"] as const;
const REGISTRY_DOCUMENT_FIELDS = [
  "documentId",
  "documentRevision",
  "path",
  "status",
  "sectionIds",
] as const;
const DOCUMENT_STATUSES = ["proposed", "accepted", "superseded"] as const;

/** Validates a `sothoth.design-document-registry/v1` envelope as a closed object. */
export function validateRegistryShape(candidate: unknown): readonly PlainFindingV1[] {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(candidate)) {
    return [{ code: "sothoth.governance/registry-invalid", subject: "registry" }];
  }
  for (const field of unknownFieldNames(candidate, REGISTRY_FIELDS)) {
    findings.push({ code: "sothoth.governance/registry-invalid", subject: field });
  }
  if (candidate.schema !== "sothoth.design-document-registry/v1") {
    findings.push({ code: "sothoth.governance/registry-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(candidate.registryId)) {
    findings.push({ code: "sothoth.governance/registry-invalid", subject: "registryId" });
  }
  if (!isPositiveInteger(candidate.registryRevision)) {
    findings.push({ code: "sothoth.governance/registry-invalid", subject: "registryRevision" });
  }
  if (!Array.isArray(candidate.documents)) {
    findings.push({ code: "sothoth.governance/registry-invalid", subject: "documents" });
    return sortFindings(findings);
  }
  const seenDocumentIds = new Set<string>();
  for (const entry of candidate.documents) {
    if (!isPlainObject(entry)) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: "documents" });
      continue;
    }
    const documentId = isNonEmptyString(entry.documentId) ? entry.documentId : null;
    for (const field of unknownFieldNames(entry, REGISTRY_DOCUMENT_FIELDS)) {
      findings.push({
        code: "sothoth.governance/registry-invalid",
        subject: `${documentId ?? "documents"}:${field}`,
      });
    }
    if (!documentId) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: "documents:documentId" });
      continue;
    }
    if (seenDocumentIds.has(documentId)) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: `${documentId}:duplicate` });
    }
    seenDocumentIds.add(documentId);
    if (!isPositiveInteger(entry.documentRevision)) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: `${documentId}:documentRevision` });
    }
    if (!isNonEmptyString(entry.path)) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: `${documentId}:path` });
    }
    if (!(DOCUMENT_STATUSES as readonly string[]).includes(entry.status as string)) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: `${documentId}:status` });
    }
    if (
      !Array.isArray(entry.sectionIds) ||
      entry.sectionIds.length === 0 ||
      !entry.sectionIds.every((id) => isSectionId(id)) ||
      new Set(entry.sectionIds).size !== entry.sectionIds.length
    ) {
      findings.push({ code: "sothoth.governance/registry-invalid", subject: `${documentId}:sectionIds` });
    }
  }
  return sortFindings(findings);
}

const REGISTRATIONS_WRAPPER_FIELDS = [
  "schema",
  "collectionId",
  "collectionRevision",
  "registrations",
] as const;

/** Validates the Artifact Design registrations envelope as a closed object. */
export function validateRegistrationsWrapperShape(candidate: unknown): readonly PlainFindingV1[] {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(candidate)) {
    return [{ code: "sothoth.governance/registrations-invalid", subject: "registrations" }];
  }
  for (const field of unknownFieldNames(candidate, REGISTRATIONS_WRAPPER_FIELDS)) {
    findings.push({ code: "sothoth.governance/registrations-invalid", subject: field });
  }
  if (candidate.schema !== "sothoth.artifact-design-registrations/v1") {
    findings.push({ code: "sothoth.governance/registrations-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(candidate.collectionId)) {
    findings.push({ code: "sothoth.governance/registrations-invalid", subject: "collectionId" });
  }
  if (!isPositiveInteger(candidate.collectionRevision)) {
    findings.push({ code: "sothoth.governance/registrations-invalid", subject: "collectionRevision" });
  }
  if (!Array.isArray(candidate.registrations)) {
    findings.push({ code: "sothoth.governance/registrations-invalid", subject: "registrations" });
  }
  return sortFindings(findings);
}
