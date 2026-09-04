/**
 * Public module `@sothoth/governance/pre-design`: Design Closure and Scope
 * BOM Admissibility compilation (`CONTRACT/SOTHOTH/PRE-DESIGN@1`).
 *
 * The compiler consumes exact Source Fact values — a Document Contract, a
 * Design Scope Catalog, a Registry, Artifact Design registrations, the
 * indexed structural facts of the registered documents, and, for
 * admissibility, an Architecture Baseline and a formal
 * `sothoth.release-bom/v1` Scope BOM — and emits the non-authoritative,
 * digest-bearing projections the method runs on. It validates
 * catalog/registration uniqueness, the contract's closed topic set,
 * exact-section inheritance, inheritance DAGs, Producer/Consumer contract
 * agreement, unique truth owners, criteria cardinality, external
 * acceptance, and Scope BOM designRefs; sections come from the Document
 * Index projection, markdown arrives as declared input data and only feeds
 * digest binding and Dossier digest verification.
 *
 * Every conclusion is a projection about the facts it was derived from:
 * the compiler never updates a `proposed | accepted` status, never creates
 * or stages a Source Fact, never synthesizes acceptance metadata, and never
 * emits an authoritative Scope BOM. Projections are byte-stable for
 * identical fact sets and deletable/rebuildable; the `sourceFactsDigest`
 * binds the normalized fact values through `@sothoth/core`'s canonical
 * bytes and digests. Emissions carry the declared
 * `sothoth.governance/pre-design-diagnostic@1` identity.
 */

import type {
  CompilationOutcomeKindV1,
  DesignScopeCatalogCandidateV1,
  DesignDocumentRecordV1,
  DesignDocumentRegistryV1,
  DesignScopeCatalogV1,
  DocumentContractV1,
  ExactDesignDocumentRefV1,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
import { EXACT_REFERENCE_PATTERN } from "@sothoth/contracts";
import { canonicalJson } from "@sothoth/core/canonical-json";
import { sha256Digest } from "@sothoth/core/digest";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
} from "@sothoth/document-index/index";
import {
  PRE_DESIGN_DIAGNOSTIC_IDENTITY_V1,
  arraysEqual,
  compareCodePointOrder,
  finalizeFindings,
  findingDraft,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  isSectionId,
  isSortedCodePoint,
  isValidCalendarDate,
  keysExactly,
  outcomeOf,
  sectionIdsOfEntry,
  sortFindings,
  unknownFieldNames,
  validateCatalogShape,
  validateDocumentContractShape,
  validateRegistrationsWrapperShape,
  validateRegistryShape,
} from "./index.js";
import type { PlainFindingV1 } from "./index.js";

// ---------------------------------------------------------------------------
// Input facts and result envelopes
// ---------------------------------------------------------------------------

/** The exact Source Fact values one Design Closure compilation consumes. */
export interface DesignClosureFactsV1 {
  /** The `sothoth.document-contract/v1` Source Fact. */
  readonly contract: unknown;
  /** The Design Scope Catalog Source Fact. */
  readonly catalog: unknown;
  /** The `sothoth.design-document-registry/v1` Source Fact. */
  readonly registry: unknown;
  /** The `sothoth.artifact-design-registrations/v1` Source Fact. */
  readonly registrations: unknown;
  /** The registered documents' exact bytes, keyed by document identity. */
  readonly documents: Readonly<Record<string, string | null>>;
  /** The structural facts of the registered documents. */
  readonly documentIndex: DocumentIndexProjectionV1;
}

/** The exact Source Fact values one Scope BOM Admissibility compilation adds. */
export interface ScopeBomAdmissibilityFactsV1 extends DesignClosureFactsV1 {
  /** The `sothoth.architecture-baseline/v1` Source Fact. */
  readonly architectureBaseline: unknown;
  /** The formal `sothoth.release-bom/v1` Source Fact. */
  readonly scopeBom: unknown;
}

/** One closure member summary; the document reference is null when no exact registration binds. */
export interface DesignClosureMemberSummaryValueV1 {
  readonly componentId: string;
  readonly designId: string;
  readonly registrationStatus: string;
  readonly designRevision: number;
  readonly documentRef: ExactDesignDocumentRefV1 | null;
  readonly localTopics: number;
  readonly inheritedTopics: number;
  readonly notApplicableTopics: number;
  readonly criteria: number;
}

/** One admissibility member summary; the document reference is null when unresolved. */
export interface ScopeBomAdmissibilityMemberValueV1 {
  readonly componentId: string;
  readonly designId: string | null;
  readonly designRevision: number;
  readonly registrationStatus: string;
  readonly documentRef: ExactDesignDocumentRefV1 | null;
  readonly baselineMemberResolved: boolean;
  readonly designRefResolved: boolean;
  readonly completionCriteriaResolved: boolean;
}

/** The Design Closure projection value: byte-stable and digest-bearing. */
export interface DesignClosureProjectionValueV1 {
  readonly schema: "sothoth.design-closure-projection/v1";
  readonly phase: "closure";
  readonly contractId: string;
  readonly contractRevision: number;
  readonly catalogId: string;
  readonly catalogRevision: number;
  readonly registryId: string;
  readonly registryRevision: number;
  readonly registrationsCollectionId: string;
  readonly registrationsCollectionRevision: number;
  readonly sourceFactsDigest: string;
  readonly outcome: CompilationOutcomeKindV1;
  readonly readyForAcceptance: boolean;
  readonly memberCount: number;
  readonly members: readonly DesignClosureMemberSummaryValueV1[];
  readonly diagnosticCount: number;
}

/** The Scope BOM Admissibility projection value: byte-stable and digest-bearing. */
export interface ScopeBomAdmissibilityProjectionValueV1 {
  readonly schema: "sothoth.scope-bom-admissibility-projection/v1";
  readonly phase: "scope";
  readonly contractId: string;
  readonly contractRevision: number;
  readonly catalogId: string;
  readonly catalogRevision: number;
  readonly registryId: string;
  readonly registryRevision: number;
  readonly registrationsCollectionId: string;
  readonly registrationsCollectionRevision: number;
  readonly sourceFactsDigest: string;
  readonly architectureBaseline: {
    readonly baselineId: string | null;
    readonly baselineRevision: number | null;
    readonly status: string;
  };
  readonly scopeBom: {
    readonly bomId: string | null;
    readonly bomRevision: number | null;
    readonly targetRelease: string | null;
  };
  readonly outcome: CompilationOutcomeKindV1;
  readonly admissible: boolean;
  readonly memberCount: number;
  readonly members: readonly ScopeBomAdmissibilityMemberValueV1[];
  readonly diagnosticCount: number;
}

/** The result envelope of one Design Closure compilation. */
export interface DesignClosureCompilationV1 {
  readonly schema: "sothoth.governance/design-closure-compilation@1";
  readonly phase: "closure";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The projection value, or null when the envelope shapes failed. */
  readonly projection: DesignClosureProjectionValueV1 | null;
}

/** The result envelope of one Scope BOM Admissibility compilation. */
export interface ScopeBomAdmissibilityCompilationV1 {
  readonly schema: "sothoth.governance/scope-bom-admissibility-compilation@1";
  readonly phase: "scope";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The projection value, or null when the envelope shapes failed. */
  readonly projection: ScopeBomAdmissibilityProjectionValueV1 | null;
}

// ---------------------------------------------------------------------------
// Closed field sets of the registration, baseline, and release-BOM facts
// ---------------------------------------------------------------------------

const REGISTRATION_FIELDS = [
  "designId",
  "componentId",
  "designRevision",
  "designRequirement",
  "status",
  "documentRef",
  "topicCoverage",
  "providedContractRefs",
  "requiredContractRefs",
  "producedStateRefs",
  "consumedStateRefs",
  "issuedAuthorityRefs",
  "requiredAuthorityRefs",
  "emittedObservationRefs",
  "deploymentDependencyRefs",
  "acceptanceCriteria",
  "supersedes",
] as const;

const STRING_ARRAY_FIELDS = [
  "providedContractRefs",
  "requiredContractRefs",
  "producedStateRefs",
  "consumedStateRefs",
  "issuedAuthorityRefs",
  "requiredAuthorityRefs",
  "emittedObservationRefs",
  "deploymentDependencyRefs",
] as const;

const CONTRACT_REF_FIELDS: ReadonlySet<string> = new Set([
  "providedContractRefs",
  "requiredContractRefs",
]);

const REFERENCE_FIELDS = ["documentId", "documentRevision", "sectionId", "applicability"] as const;
const CRITERION_FIELDS = ["criterionId", "sectionId"] as const;
const DOCUMENT_REF_FIELDS = ["documentId", "documentRevision"] as const;

const REGISTRATION_STATUSES = ["proposed", "accepted", "superseded"] as const;
const DESIGN_REQUIREMENTS = ["full", "projection", "compatibility"] as const;
const RESOLUTION_KINDS = ["local", "inherited", "not-applicable"] as const;

const ARCHITECTURE_BASELINE_FIELDS = [
  "schema",
  "baselineId",
  "baselineRevision",
  "targetRelease",
  "status",
  "acceptedBy",
  "acceptedAt",
  "members",
] as const;
const ACCEPTED_BY_FIELDS = ["principalType", "principalId"] as const;
const BASELINE_MEMBER_FIELDS = [
  "componentId",
  "designId",
  "designRevision",
  "documentRef",
  "dossierDigest",
] as const;
const DOSSIER_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

const RELEASE_BOM_FIELDS = ["schema", "bomId", "bomRevision", "targetRelease", "members"] as const;
const RELEASE_BOM_MEMBER_FIELDS = [
  "id",
  "version",
  "type",
  "layer",
  "owner",
  "designRef",
  "completionGates",
] as const;
const GATE_FIELDS = ["gateId", "criterionIds"] as const;
const DESIGN_REF_FIELDS = [
  "architectureBaselineId",
  "architectureBaselineRevision",
  "designId",
  "designRevision",
] as const;

// ---------------------------------------------------------------------------
// Compilation context
// ---------------------------------------------------------------------------

interface DocumentState {
  readonly entry: DesignDocumentRecordV1;
  readonly sectionIds: readonly string[];
  readonly markdown: string | null;
}

interface Registrationish {
  readonly designId: unknown;
  readonly componentId: unknown;
  readonly designRevision: unknown;
  readonly designRequirement: unknown;
  readonly status: unknown;
  readonly documentRef: unknown;
  readonly topicCoverage: unknown;
  readonly providedContractRefs: unknown;
  readonly requiredContractRefs: unknown;
  readonly producedStateRefs: unknown;
  readonly acceptanceCriteria: unknown;
  readonly supersedes: unknown;
  [key: string]: unknown;
}

interface CompilationContext {
  readonly catalog: DesignScopeCatalogV1;
  readonly candidates: readonly DesignScopeCatalogCandidateV1[];
  readonly candidatesByComponent: ReadonlyMap<string, DesignScopeCatalogCandidateV1>;
  readonly topicSet: ReadonlySet<string>;
  readonly topics: readonly string[];
  readonly applicabilitySet: ReadonlySet<string>;
  readonly requiredSectionIds: readonly string[];
  readonly minimumCriteria: number;
  readonly documents: Map<string, DocumentState>;
  readonly registrations: readonly Record<string, unknown>[];
  readonly registrationsByComponent: Map<string, Record<string, unknown>[]>;
  designIdOwner: ReadonlyMap<string, string>;
  scopeMemberResolution: Map<
    string,
    { designRefResolved: boolean; baselineMemberResolved: boolean; completionCriteriaResolved: boolean }
  >;
}

function isRegistrationish(value: unknown): value is Registrationish {
  return isPlainObject(value);
}

/** Resolves one design reference over all registrations (identity + revision). */
function resolveDesignRef(
  registrations: readonly Record<string, unknown>[],
  componentId: string,
  designRef: { designId: unknown; designRevision: unknown },
): { resolved: boolean; own: boolean } {
  if (!isPlainObject(designRef)) return { resolved: false, own: false };
  const matches = registrations.filter(
    (registration) =>
      isPlainObject(registration) &&
      registration.designId === designRef.designId &&
      registration.designRevision === designRef.designRevision,
  );
  return {
    resolved: matches.length > 0,
    own: matches.some((registration) => registration.componentId === componentId),
  };
}

/** The single retained (proposed | accepted) registration of a component, if exactly one. */
function retainedRegistrationOf(
  context: CompilationContext,
  componentId: string,
): Record<string, unknown> | null {
  const retained = (context.registrationsByComponent.get(componentId) ?? []).filter(
    (registration) =>
      isPlainObject(registration) &&
      (registration.status === "proposed" || registration.status === "accepted"),
  );
  return retained.length === 1 ? retained[0]! : null;
}

/** The exact document reference of a registration, or null when malformed. */
function registrationDocumentRef(
  registration: Record<string, unknown> | null,
): { documentId: string; documentRevision: number } | null {
  if (
    !isPlainObject(registration) ||
    !keysExactly(registration.documentRef, DOCUMENT_REF_FIELDS) ||
    !isNonEmptyString((registration.documentRef as Record<string, unknown>).documentId) ||
    !isPositiveInteger((registration.documentRef as Record<string, unknown>).documentRevision)
  ) {
    return null;
  }
  const documentRef = registration.documentRef as {
    documentId: string;
    documentRevision: number;
  };
  return { documentId: documentRef.documentId, documentRevision: documentRef.documentRevision };
}

/** Per-registration topic counts by resolution kind. */
function topicCounts(registration: Record<string, unknown> | null): {
  localTopics: number;
  inheritedTopics: number;
  notApplicableTopics: number;
} {
  const counts = { localTopics: 0, inheritedTopics: 0, notApplicableTopics: 0 };
  const coverage = isPlainObject(registration) ? registration.topicCoverage : null;
  if (!isPlainObject(coverage)) return counts;
  const fieldByResolution: Record<string, keyof typeof counts> = {
    local: "localTopics",
    inherited: "inheritedTopics",
    "not-applicable": "notApplicableTopics",
  };
  for (const topic of Object.keys(coverage)) {
    const resolution = coverage[topic];
    const field = isPlainObject(resolution)
      ? fieldByResolution[String(resolution.resolution)]
      : undefined;
    if (field) counts[field] += 1;
  }
  return counts;
}

/** Canonical entry strings: each value canonicalized, then code-point sorted. */
function canonicalEntryStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => canonicalJson(value)).sort(compareCodePointOrder);
}

/** The consumed documents map: registry documents keyed to their bytes or null. */
function consumedDocuments(
  registry: DesignDocumentRegistryV1,
  documents: Readonly<Record<string, string | null>>,
): Record<string, string | null> {
  const consumed: Record<string, string | null> = {};
  for (const entry of Array.isArray(registry.documents) ? registry.documents : []) {
    if (isPlainObject(entry) && isNonEmptyString(entry.documentId)) {
      const value = documents[entry.documentId];
      consumed[entry.documentId] = typeof value === "string" ? value : null;
    }
  }
  return consumed;
}

function sourceIdentity(
  facts: DesignClosureFactsV1,
  context: CompilationContext,
): {
  contractId: string;
  contractRevision: number;
  catalogId: string;
  catalogRevision: number;
  registryId: string;
  registryRevision: number;
  registrationsCollectionId: string;
  registrationsCollectionRevision: number;
} {
  const contract = facts.contract as DocumentContractV1;
  const registry = facts.registry as DesignDocumentRegistryV1;
  const registrations = facts.registrations as {
    collectionId: string;
    collectionRevision: number;
  };
  return {
    contractId: contract.contractId,
    contractRevision: contract.contractRevision,
    catalogId: context.catalog.catalogId,
    catalogRevision: context.catalog.catalogRevision,
    registryId: registry.registryId,
    registryRevision: registry.registryRevision,
    registrationsCollectionId: registrations.collectionId,
    registrationsCollectionRevision: registrations.collectionRevision,
  };
}

// ---------------------------------------------------------------------------
// Registration checking
// ---------------------------------------------------------------------------

function checkRegistration(
  registration: unknown,
  context: CompilationContext,
  findings: PlainFindingV1[],
): void {
  if (!isRegistrationish(registration)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: "registrations:registration",
    });
    return;
  }
  const componentId = isNonEmptyString(registration.componentId)
    ? registration.componentId
    : "registrations";
  for (const field of unknownFieldNames(registration, REGISTRATION_FIELDS)) {
    findings.push({
      code: "sothoth.governance/registration-field-unknown",
      subject: `${componentId}:${field}`,
    });
  }
  if (!isNonEmptyString(registration.designId)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:designId`,
    });
  }
  if (!isPositiveInteger(registration.designRevision)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:designRevision`,
    });
  }
  if (!(DESIGN_REQUIREMENTS as readonly string[]).includes(registration.designRequirement as string)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:designRequirement`,
    });
  }
  if (!(REGISTRATION_STATUSES as readonly string[]).includes(registration.status as string)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:status`,
    });
  }
  if (!(registration.supersedes === null || isNonEmptyString(registration.supersedes))) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:supersedes`,
    });
  }
  for (const field of STRING_ARRAY_FIELDS) {
    const value = registration[field];
    if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
      findings.push({
        code: "sothoth.governance/registration-field-invalid",
        subject: `${componentId}:${field}`,
      });
      continue;
    }
    for (const entry of value) {
      if (typeof entry === "string" && EXACT_REFERENCE_PATTERN.test(entry)) continue;
      if (CONTRACT_REF_FIELDS.has(field)) {
        findings.push({
          code: "sothoth.governance/contract-ref-not-exact",
          subject: `${componentId}:${entry}`,
        });
      } else {
        findings.push({
          code: "sothoth.governance/reference-not-exact",
          subject: `${componentId}:${field}:${entry}`,
        });
      }
    }
  }

  const documentRef = registration.documentRef;
  let dossierSectionIds: readonly string[] | null = null;
  if (!keysExactly(documentRef, DOCUMENT_REF_FIELDS)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:documentRef`,
    });
  } else {
    const ref = documentRef as { documentId: string; documentRevision: number };
    const state = context.documents.get(ref.documentId);
    if (
      !state ||
      state.entry.documentRevision !== ref.documentRevision ||
      !isPositiveInteger(ref.documentRevision)
    ) {
      findings.push({ code: "sothoth.governance/document-ref-unresolved", subject: componentId });
    } else {
      dossierSectionIds = state.sectionIds;
      if (!arraysEqual(dossierSectionIds, context.requiredSectionIds)) {
        findings.push({
          code: "sothoth.governance/contract-sections-mismatch",
          subject: ref.documentId,
        });
      }
    }
  }

  const coverage = registration.topicCoverage;
  if (!isPlainObject(coverage)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:topicCoverage`,
    });
  } else {
    for (const topic of Object.keys(coverage)) {
      if (!context.topicSet.has(topic)) {
        findings.push({ code: "sothoth.governance/topic-unknown", subject: `${componentId}:${topic}` });
      }
    }
    for (const topic of context.topics) {
      if (!(topic in coverage)) {
        findings.push({ code: "sothoth.governance/topic-missing", subject: `${componentId}:${topic}` });
      }
    }
    for (const topic of context.topics) {
      if (!(topic in coverage)) continue;
      const resolution = coverage[topic];
      if (
        !isPlainObject(resolution) ||
        !keysExactly(resolution, ["reason", "refs", "resolution", "sectionId"]) ||
        !(RESOLUTION_KINDS as readonly string[]).includes(String(resolution.resolution))
      ) {
        findings.push({
          code: "sothoth.governance/topic-resolution-invalid",
          subject: `${componentId}:${topic}`,
        });
        continue;
      }
      if (resolution.resolution === "local") {
        if (
          !isNonEmptyString(resolution.sectionId) ||
          !Array.isArray(resolution.refs) ||
          resolution.refs.length !== 0 ||
          resolution.reason !== null
        ) {
          findings.push({
            code: "sothoth.governance/topic-resolution-invalid",
            subject: `${componentId}:${topic}`,
          });
        } else if (dossierSectionIds && !dossierSectionIds.includes(resolution.sectionId)) {
          findings.push({
            code: "sothoth.governance/section-unresolved",
            subject: `${componentId}:${resolution.sectionId}`,
          });
        }
      } else if (resolution.resolution === "inherited") {
        if (
          resolution.sectionId !== null ||
          resolution.reason !== null ||
          !Array.isArray(resolution.refs) ||
          resolution.refs.length === 0
        ) {
          findings.push({
            code: "sothoth.governance/topic-resolution-invalid",
            subject: `${componentId}:${topic}`,
          });
          continue;
        }
        for (const reference of resolution.refs) {
          if (
            !isPlainObject(reference) ||
            !keysExactly(reference, REFERENCE_FIELDS) ||
            !isNonEmptyString(reference.documentId) ||
            !isPositiveInteger(reference.documentRevision) ||
            !isNonEmptyString(reference.sectionId)
          ) {
            findings.push({
              code: "sothoth.governance/reference-not-exact",
              subject: `${componentId}:${topic}`,
            });
            continue;
          }
          if (reference.applicability === "overrides") {
            findings.push({
              code: "sothoth.governance/inheritance-overrides-forbidden",
              subject: `${componentId}:${topic}`,
            });
          } else if (!context.applicabilitySet.has(String(reference.applicability))) {
            findings.push({
              code: "sothoth.governance/inheritance-applicability-invalid",
              subject: `${componentId}:${topic}`,
            });
          }
          const state = context.documents.get(reference.documentId);
          if (
            !state ||
            state.entry.documentRevision !== reference.documentRevision ||
            !state.sectionIds.includes(reference.sectionId)
          ) {
            findings.push({
              code: "sothoth.governance/reference-unresolved",
              subject: `${componentId}:${topic}`,
            });
          }
        }
      } else if (
        !isNonEmptyString(resolution.reason) ||
        resolution.sectionId !== null ||
        !Array.isArray(resolution.refs) ||
        resolution.refs.length !== 0
      ) {
        findings.push({
          code: "sothoth.governance/topic-resolution-invalid",
          subject: `${componentId}:${topic}`,
        });
      }
    }
  }

  if (!Array.isArray(registration.acceptanceCriteria)) {
    findings.push({
      code: "sothoth.governance/registration-field-invalid",
      subject: `${componentId}:acceptanceCriteria`,
    });
  } else {
    for (const criterion of registration.acceptanceCriteria) {
      if (
        !keysExactly(criterion, CRITERION_FIELDS) ||
        !isNonEmptyString((criterion as Record<string, unknown>).criterionId) ||
        !isNonEmptyString((criterion as Record<string, unknown>).sectionId)
      ) {
        findings.push({
          code: "sothoth.governance/registration-field-invalid",
          subject: `${componentId}:acceptanceCriteria`,
        });
      } else if (
        dossierSectionIds &&
        !dossierSectionIds.includes((criterion as Record<string, unknown>).sectionId as string)
      ) {
        findings.push({
          code: "sothoth.governance/criterion-unresolved",
          subject: `${componentId}:${(criterion as Record<string, unknown>).sectionId}`,
        });
      }
    }
  }

  const candidate = context.candidatesByComponent.get(componentId);
  if (!candidate) {
    findings.push({ code: "sothoth.governance/registration-orphan", subject: componentId });
  } else {
    if (registration.designId !== candidate.designId) {
      findings.push({ code: "sothoth.governance/design-id-mismatch", subject: componentId });
    }
    if (
      (DESIGN_REQUIREMENTS as readonly string[]).includes(registration.designRequirement as string) &&
      registration.designRequirement !== candidate.designRequirement
    ) {
      findings.push({
        code: "sothoth.governance/registration-field-invalid",
        subject: `${componentId}:designRequirement`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Closure facts
// ---------------------------------------------------------------------------

/** Finds every node on a cycle of the inheritance adjacency (deterministic DFS). */
function findCycleNodes(adjacency: Map<string, Set<string>>): Set<string> {
  const state = new Map<string, number>();
  const cyclic = new Set<string>();
  const stack: string[] = [];
  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    const targets = [...(adjacency.get(node) ?? [])].sort(compareCodePointOrder);
    for (const target of targets) {
      const targetState = state.get(target) ?? 0;
      if (targetState === 1) {
        const start = stack.lastIndexOf(target);
        for (let index = start; index < stack.length; index += 1) cyclic.add(stack[index]!);
      } else if (targetState === 0) {
        visit(target);
      }
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of [...adjacency.keys()].sort(compareCodePointOrder)) {
    if ((state.get(node) ?? 0) === 0) visit(node);
  }
  return cyclic;
}

function checkClosureFacts(
  facts: DesignClosureFactsV1,
  context: CompilationContext,
  findings: PlainFindingV1[],
): void {
  for (const candidate of context.candidates) {
    const registrationsForComponent = context.registrationsByComponent.get(candidate.componentId) ?? [];
    if (registrationsForComponent.length === 0) continue;
    const retained = registrationsForComponent.filter(
      (registration) => registration.status === "proposed" || registration.status === "accepted",
    );
    if (retained.length === 0) {
      findings.push({
        code: "sothoth.governance/registration-not-retained",
        subject: candidate.componentId,
      });
      continue;
    }
    if (retained.length === 1 && Array.isArray(retained[0]!.acceptanceCriteria)) {
      if (retained[0]!.acceptanceCriteria.length < context.minimumCriteria) {
        findings.push({
          code: "sothoth.governance/criterion-missing",
          subject: candidate.componentId,
        });
      }
    }
  }

  const contractIdentities = new Map<string, { provided: Set<string>; revisions: Set<string> }>();
  for (const registration of context.registrations) {
    if (!isPlainObject(registration)) continue;
    for (const field of ["providedContractRefs", "requiredContractRefs"]) {
      const refs = (registration as Record<string, unknown>)[field];
      if (!Array.isArray(refs)) continue;
      for (const ref of refs) {
        if (typeof ref !== "string") continue;
        const match = EXACT_REFERENCE_PATTERN.exec(ref);
        if (!match) continue;
        const identity = match[1]!;
        const record = contractIdentities.get(identity) ?? { provided: new Set<string>(), revisions: new Set<string>() };
        record.revisions.add(match[2]!);
        if (field === "providedContractRefs") record.provided.add(ref);
        contractIdentities.set(identity, record);
      }
    }
  }
  for (const identity of [...contractIdentities.keys()].sort(compareCodePointOrder)) {
    const record = contractIdentities.get(identity)!;
    if (record.revisions.size > 1) {
      findings.push({ code: "sothoth.governance/contract-revision-mismatch", subject: identity });
    }
  }
  const requiredRefs = new Set<string>();
  for (const registration of context.registrations) {
    if (!isPlainObject(registration) || !Array.isArray(registration.requiredContractRefs)) continue;
    for (const ref of registration.requiredContractRefs) {
      if (typeof ref === "string" && EXACT_REFERENCE_PATTERN.test(ref)) requiredRefs.add(ref);
    }
  }
  for (const ref of [...requiredRefs].sort(compareCodePointOrder)) {
    const match = EXACT_REFERENCE_PATTERN.exec(ref)!;
    const record = contractIdentities.get(match[1]!);
    if (!record || !record.provided.has(ref)) {
      findings.push({ code: "sothoth.governance/contract-edge-mismatch", subject: ref });
    }
  }

  const reportedTruth = new Set<string>();
  const truthOwners = new Map<string, string>();
  for (const registration of context.registrations) {
    if (!isPlainObject(registration) || !Array.isArray(registration.producedStateRefs)) continue;
    for (const stateRef of registration.producedStateRefs) {
      if (typeof stateRef !== "string") continue;
      if (truthOwners.has(stateRef) && !reportedTruth.has(stateRef)) {
        reportedTruth.add(stateRef);
        findings.push({ code: "sothoth.governance/truth-owner-duplicate", subject: stateRef });
      }
      truthOwners.set(stateRef, String(registration.componentId));
    }
  }

  const adjacency = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string): void => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
  };
  for (const registration of context.registrations) {
    if (!isPlainObject(registration)) continue;
    const documentRef = registration.documentRef;
    if (!isPlainObject(documentRef) || typeof documentRef.documentId !== "string") continue;
    const coverage = registration.topicCoverage;
    if (!isPlainObject(coverage)) continue;
    for (const topic of Object.keys(coverage)) {
      const resolution = coverage[topic];
      if (!isPlainObject(resolution) || resolution.resolution !== "inherited") continue;
      if (!Array.isArray(resolution.refs)) continue;
      for (const reference of resolution.refs) {
        if (isPlainObject(reference) && typeof reference.documentId === "string") {
          addEdge(documentRef.documentId, reference.documentId);
        }
      }
    }
  }
  for (const documentId of findCycleNodes(adjacency)) {
    findings.push({ code: "sothoth.governance/inheritance-cycle", subject: documentId });
  }
}

// ---------------------------------------------------------------------------
// Scope facts
// ---------------------------------------------------------------------------

function checkScopeFacts(
  facts: ScopeBomAdmissibilityFactsV1,
  context: CompilationContext,
  findings: PlainFindingV1[],
): void {
  const baseline = facts.architectureBaseline;
  const baselineRecord = isPlainObject(baseline) ? baseline : null;
  let baselineUsable = false;
  const baselineMembersByIdentity = new Map<string, { designId: unknown; designRevision: unknown }>();
  if (baselineRecord === null) {
    findings.push({ code: "sothoth.governance/baseline-missing", subject: "architectureBaseline" });
  } else {
    for (const field of unknownFieldNames(baselineRecord, ARCHITECTURE_BASELINE_FIELDS)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: field });
    }
    if (baselineRecord.schema !== "sothoth.architecture-baseline/v1") {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "schema" });
    }
    if (!isNonEmptyString(baselineRecord.baselineId)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "baselineId" });
    }
    if (!isPositiveInteger(baselineRecord.baselineRevision)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "baselineRevision" });
    }
    if (baselineRecord.targetRelease !== context.catalog.targetReleaseIntent) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "targetRelease" });
    }
    if (!(REGISTRATION_STATUSES as readonly string[]).includes(baselineRecord.status as string)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "status" });
    }
    const acceptedBy = baselineRecord.acceptedBy;
    if (!keysExactly(acceptedBy, ACCEPTED_BY_FIELDS)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "acceptedBy" });
    } else {
      const principal = acceptedBy as { principalType: string; principalId: string };
      if (principal.principalType !== "human") {
        findings.push({ code: "sothoth.governance/baseline-invalid", subject: "acceptedBy:principalType" });
      }
      if (!isNonEmptyString(principal.principalId)) {
        findings.push({ code: "sothoth.governance/baseline-invalid", subject: "acceptedBy:principalId" });
      }
    }
    if (!isValidCalendarDate(baselineRecord.acceptedAt)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "acceptedAt" });
    }
    if (!Array.isArray(baselineRecord.members)) {
      findings.push({ code: "sothoth.governance/baseline-invalid", subject: "members" });
    } else {
      const seenMembers = new Set<string>();
      for (const member of baselineRecord.members) {
        if (!isPlainObject(member)) {
          findings.push({ code: "sothoth.governance/baseline-member-invalid", subject: "members" });
          continue;
        }
        const componentId = isNonEmptyString(member.componentId) ? member.componentId : "members";
        for (const field of unknownFieldNames(member, BASELINE_MEMBER_FIELDS)) {
          findings.push({
            code: "sothoth.governance/baseline-member-invalid",
            subject: `${componentId}:${field}`,
          });
        }
        const missingFields = BASELINE_MEMBER_FIELDS.filter((field) => !(field in member));
        for (const field of missingFields) {
          findings.push({
            code: "sothoth.governance/baseline-member-invalid",
            subject: `${componentId}:${field}`,
          });
        }
        if (missingFields.length > 0) continue;
        if (!isNonEmptyString(member.designId) || !isPositiveInteger(member.designRevision)) {
          findings.push({
            code: "sothoth.governance/baseline-member-invalid",
            subject: `${componentId}:designId`,
          });
          continue;
        }
        if (
          !keysExactly(member.documentRef, DOCUMENT_REF_FIELDS) ||
          !isNonEmptyString((member.documentRef as Record<string, unknown>).documentId) ||
          !isPositiveInteger((member.documentRef as Record<string, unknown>).documentRevision)
        ) {
          findings.push({
            code: "sothoth.governance/baseline-member-invalid",
            subject: `${componentId}:documentRef`,
          });
          continue;
        }
        if (typeof member.dossierDigest !== "string" || !DOSSIER_DIGEST_PATTERN.test(member.dossierDigest)) {
          findings.push({
            code: "sothoth.governance/baseline-member-invalid",
            subject: `${componentId}:dossierDigest`,
          });
          continue;
        }
        if (seenMembers.has(componentId)) {
          findings.push({ code: "sothoth.governance/baseline-member-duplicate", subject: componentId });
          continue;
        }
        seenMembers.add(componentId);
        if (!context.candidatesByComponent.has(componentId)) {
          findings.push({ code: "sothoth.governance/baseline-member-unknown", subject: componentId });
          continue;
        }
        const registration = retainedRegistrationOf(context, componentId);
        const registrationDocument = registrationDocumentRef(registration);
        const designOwner = context.designIdOwner.get(member.designId);
        if (designOwner !== undefined && designOwner !== componentId) {
          findings.push({
            code: "sothoth.governance/baseline-member-component-mismatch",
            subject: componentId,
          });
          continue;
        }
        const memberDocumentRef = member.documentRef as {
          documentId: string;
          documentRevision: number;
        };
        if (
          !registration ||
          member.designId !== registration.designId ||
          member.designRevision !== registration.designRevision ||
          !registrationDocument ||
          memberDocumentRef.documentId !== registrationDocument.documentId ||
          memberDocumentRef.documentRevision !== registrationDocument.documentRevision
        ) {
          findings.push({
            code: "sothoth.governance/baseline-member-design-mismatch",
            subject: componentId,
          });
          continue;
        }
        const state = context.documents.get(memberDocumentRef.documentId);
        const markdown = state && typeof state.markdown === "string" ? state.markdown : null;
        if (markdown === null || sha256Digest(markdown) !== member.dossierDigest) {
          findings.push({
            code: "sothoth.governance/baseline-dossier-digest-mismatch",
            subject: componentId,
          });
          continue;
        }
        baselineMembersByIdentity.set(componentId, {
          designId: member.designId,
          designRevision: member.designRevision,
        });
      }
      for (const candidate of context.candidates) {
        if (!seenMembers.has(candidate.componentId)) {
          findings.push({
            code: "sothoth.governance/baseline-member-missing",
            subject: candidate.componentId,
          });
        }
      }
    }
    if (isNonEmptyString(baselineRecord.baselineId) && isPositiveInteger(baselineRecord.baselineRevision)) {
      if (baselineRecord.status !== "accepted") {
        findings.push({ code: "sothoth.governance/baseline-not-accepted", subject: baselineRecord.baselineId });
      } else {
        baselineUsable = true;
      }
    }
  }

  for (const candidate of context.candidates) {
    const registrationsForComponent = context.registrationsByComponent.get(candidate.componentId) ?? [];
    const retained = registrationsForComponent.filter(
      (registration) => registration.status === "proposed" || registration.status === "accepted",
    );
    if (retained.length === 1 && retained[0]!.status !== "accepted") {
      findings.push({
        code: "sothoth.governance/registration-not-accepted",
        subject: candidate.componentId,
      });
    }
  }

  const scopeBom = facts.scopeBom;
  if (!isPlainObject(scopeBom)) {
    findings.push({ code: "sothoth.governance/scope-bom-missing", subject: "scopeBom" });
    return;
  }
  for (const field of unknownFieldNames(scopeBom, RELEASE_BOM_FIELDS)) {
    findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: field });
  }
  if (scopeBom.schema !== "sothoth.release-bom/v1") {
    findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(scopeBom.bomId)) {
    findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: "bomId" });
  }
  if (!isPositiveInteger(scopeBom.bomRevision)) {
    findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: "bomRevision" });
  }
  if (scopeBom.targetRelease !== context.catalog.targetReleaseIntent) {
    findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: "targetRelease" });
  }
  if (!Array.isArray(scopeBom.members)) {
    findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: "members" });
    return;
  }
  const seenMembers = new Set<string>();
  const resolution = new Map<
    string,
    { designRefResolved: boolean; baselineMemberResolved: boolean; completionCriteriaResolved: boolean }
  >();
  for (const member of scopeBom.members) {
    if (!isPlainObject(member)) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: "members" });
      continue;
    }
    const id = isNonEmptyString(member.id) ? member.id : "members";
    for (const field of unknownFieldNames(member, RELEASE_BOM_MEMBER_FIELDS)) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:${field}` });
    }
    const missingFields = RELEASE_BOM_MEMBER_FIELDS.filter((field) => !(field in member));
    for (const field of missingFields) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:${field}` });
    }
    if (missingFields.length > 0) continue;
    if (member.version !== context.catalog.targetReleaseIntent) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:version` });
    }
    if (member.type !== "npm-package") {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:type` });
    }
    if (member.layer !== "required") {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:layer` });
    }
    if (member.owner !== "sothoth") {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:owner` });
    }
    if (seenMembers.has(id)) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:member-duplicate` });
      continue;
    }
    seenMembers.add(id);
    const designRef = member.designRef;
    if (
      !keysExactly(designRef, DESIGN_REF_FIELDS) ||
      !isNonEmptyString((designRef as Record<string, unknown>).designId) ||
      !isPositiveInteger((designRef as Record<string, unknown>).designRevision) ||
      !isNonEmptyString((designRef as Record<string, unknown>).architectureBaselineId) ||
      !isPositiveInteger((designRef as Record<string, unknown>).architectureBaselineRevision)
    ) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:designRef` });
      continue;
    }
    if (!context.candidatesByComponent.has(id)) {
      findings.push({ code: "sothoth.governance/scope-bom-member-unknown", subject: id });
      continue;
    }
    const binding = resolveDesignRef(
      context.registrations,
      id,
      designRef as { designId: unknown; designRevision: unknown },
    );
    if (!binding.resolved) {
      findings.push({ code: "sothoth.governance/design-ref-unresolved", subject: id });
    } else if (!binding.own) {
      findings.push({ code: "sothoth.governance/design-ref-component-mismatch", subject: id });
    }
    if (
      baselineUsable &&
      baselineRecord !== null &&
      ((designRef as Record<string, unknown>).architectureBaselineId !== baselineRecord.baselineId ||
        (designRef as Record<string, unknown>).architectureBaselineRevision !==
          baselineRecord.baselineRevision)
    ) {
      findings.push({ code: "sothoth.governance/design-ref-baseline-mismatch", subject: id });
    }
    const baselineMember = baselineMembersByIdentity.get(id);
    const baselineMemberResolved =
      baselineUsable &&
      baselineMember !== undefined &&
      baselineMember.designId === (designRef as Record<string, unknown>).designId &&
      baselineMember.designRevision === (designRef as Record<string, unknown>).designRevision;

    const gates = member.completionGates;
    let gatesValid = true;
    let completionCriteriaResolved = false;
    if (!Array.isArray(gates) || gates.length === 0) {
      findings.push({ code: "sothoth.governance/scope-bom-invalid", subject: `${id}:completionGates` });
      gatesValid = false;
    } else {
      const gateIds: string[] = [];
      const criterionIds: string[] = [];
      const duplicateGateIds = new Set<string>();
      const duplicateCriteria = new Set<string>();
      const seenCriteria = new Set<string>();
      for (const gate of gates) {
        if (
          !isPlainObject(gate) ||
          !keysExactly(gate, GATE_FIELDS) ||
          !isNonEmptyString(gate.gateId) ||
          !Array.isArray(gate.criterionIds) ||
          gate.criterionIds.length === 0 ||
          !gate.criterionIds.every(isNonEmptyString)
        ) {
          const subject = isPlainObject(gate) && isNonEmptyString(gate.gateId) ? gate.gateId : "completionGates";
          findings.push({ code: "sothoth.governance/scope-bom-gate-invalid", subject: `${id}:${subject}` });
          gatesValid = false;
          continue;
        }
        if (!isSortedCodePoint(gate.criterionIds as string[])) {
          findings.push({ code: "sothoth.governance/scope-bom-criterion-order", subject: `${id}:${gate.gateId}` });
          gatesValid = false;
        }
        if (gateIds.includes(gate.gateId)) duplicateGateIds.add(gate.gateId);
        gateIds.push(gate.gateId);
        for (const criterionId of gate.criterionIds as string[]) {
          if (seenCriteria.has(criterionId)) duplicateCriteria.add(criterionId);
          seenCriteria.add(criterionId);
          criterionIds.push(criterionId);
        }
      }
      for (const gateId of duplicateGateIds) {
        findings.push({ code: "sothoth.governance/scope-bom-gate-duplicate", subject: `${id}:${gateId}` });
        gatesValid = false;
      }
      if (!isSortedCodePoint(gateIds)) {
        findings.push({ code: "sothoth.governance/scope-bom-gate-order", subject: id });
        gatesValid = false;
      }
      for (const criterionId of duplicateCriteria) {
        findings.push({
          code: "sothoth.governance/scope-bom-criterion-duplicate",
          subject: `${id}:${criterionId}`,
        });
        gatesValid = false;
      }
      const registration = retainedRegistrationOf(context, id);
      const registrationCriteria = new Set(
        Array.isArray(registration?.acceptanceCriteria)
          ? registration.acceptanceCriteria
              .map((criterion) => (isPlainObject(criterion) ? criterion.criterionId : null))
              .filter(isNonEmptyString)
          : [],
      );
      for (const criterionId of seenCriteria) {
        if (!registrationCriteria.has(criterionId)) {
          findings.push({
            code: "sothoth.governance/scope-bom-criterion-unknown",
            subject: `${id}:${criterionId}`,
          });
          gatesValid = false;
        }
      }
      for (const criterionId of registrationCriteria) {
        if (!seenCriteria.has(criterionId)) {
          findings.push({ code: "sothoth.governance/scope-bom-criterion-missing", subject: id });
          gatesValid = false;
          break;
        }
      }
      completionCriteriaResolved =
        gatesValid && seenCriteria.size === registrationCriteria.size && criterionIds.length === seenCriteria.size;
    }
    resolution.set(id, {
      designRefResolved: binding.resolved && binding.own,
      baselineMemberResolved,
      completionCriteriaResolved,
    });
  }
  for (const candidate of context.candidates) {
    if (!seenMembers.has(candidate.componentId)) {
      findings.push({
        code: "sothoth.governance/scope-bom-member-missing",
        subject: candidate.componentId,
      });
    }
  }
  context.scopeMemberResolution = resolution;
}

// ---------------------------------------------------------------------------
// Projections and digests
// ---------------------------------------------------------------------------

function closureSourceFactsDigest(
  facts: DesignClosureFactsV1,
  context: CompilationContext,
): string {
  const registry = facts.registry as DesignDocumentRegistryV1;
  return sha256Digest(
    canonicalJson({
      phase: "closure",
      contract: facts.contract,
      catalog: context.catalog,
      registry: { ...registry, documents: canonicalEntryStrings(registry.documents) },
      documents: consumedDocuments(registry, facts.documents),
      registrations: canonicalEntryStrings(context.registrations),
    }),
  );
}

function scopeSourceFactsDigest(
  facts: ScopeBomAdmissibilityFactsV1,
  context: CompilationContext,
): string {
  const registry = facts.registry as DesignDocumentRegistryV1;
  const scopeBom = isPlainObject(facts.scopeBom)
    ? { ...facts.scopeBom, members: canonicalEntryStrings(facts.scopeBom.members) }
    : null;
  const architectureBaseline = isPlainObject(facts.architectureBaseline)
    ? { ...facts.architectureBaseline, members: canonicalEntryStrings(facts.architectureBaseline.members) }
    : null;
  return sha256Digest(
    canonicalJson({
      phase: "scope",
      contract: facts.contract,
      catalog: context.catalog,
      registry: { ...registry, documents: canonicalEntryStrings(registry.documents) },
      documents: consumedDocuments(registry, facts.documents),
      registrations: canonicalEntryStrings(context.registrations),
      architectureBaseline,
      scopeBom,
    }),
  );
}

function buildClosureProjection(
  facts: DesignClosureFactsV1,
  context: CompilationContext,
  outcome: CompilationOutcomeKindV1,
  findings: readonly PlainFindingV1[],
): DesignClosureProjectionValueV1 {
  const members: DesignClosureMemberSummaryValueV1[] = context.candidates.map((candidate) => {
    const registrationsForComponent = context.registrationsByComponent.get(candidate.componentId) ?? [];
    const registration = registrationsForComponent.length === 1 ? registrationsForComponent[0]! : null;
    const counts = topicCounts(registration);
    return {
      componentId: candidate.componentId,
      designId: candidate.designId,
      registrationStatus:
        registrationsForComponent.length === 1
          ? String(registration!.status)
          : registrationsForComponent.length === 0
            ? "missing"
            : "duplicate",
      designRevision:
        registrationsForComponent.length === 1
          ? (registration!.designRevision as number)
          : 0,
      documentRef: registrationDocumentRef(registration),
      localTopics: counts.localTopics,
      inheritedTopics: counts.inheritedTopics,
      notApplicableTopics: counts.notApplicableTopics,
      criteria:
        registrationsForComponent.length === 1 && Array.isArray(registration!.acceptanceCriteria)
          ? registration!.acceptanceCriteria.length
          : 0,
    };
  });
  return {
    schema: "sothoth.design-closure-projection/v1",
    phase: "closure",
    ...sourceIdentity(facts, context),
    sourceFactsDigest: closureSourceFactsDigest(facts, context),
    outcome,
    readyForAcceptance: outcome === "valid",
    memberCount: members.length,
    members,
    diagnosticCount: findings.length,
  };
}

function buildScopeProjection(
  facts: ScopeBomAdmissibilityFactsV1,
  context: CompilationContext,
  outcome: CompilationOutcomeKindV1,
  findings: readonly PlainFindingV1[],
): ScopeBomAdmissibilityProjectionValueV1 {
  const baseline = isPlainObject(facts.architectureBaseline) ? facts.architectureBaseline : null;
  const scopeBom = isPlainObject(facts.scopeBom) ? facts.scopeBom : null;
  const membersSource = Array.isArray(scopeBom?.members) ? scopeBom.members : [];
  const members: ScopeBomAdmissibilityMemberValueV1[] = membersSource
    .filter((member) => isPlainObject(member) && isNonEmptyString(member.id) && isPlainObject(member.designRef))
    .map((member) => {
      const designRef = member.designRef as { designId: unknown; designRevision: unknown };
      const binding = resolveDesignRef(context.registrations, member.id as string, designRef);
      const registration = retainedRegistrationOf(context, member.id as string);
      const resolution = context.scopeMemberResolution.get(member.id as string);
      return {
        componentId: member.id as string,
        designId: typeof designRef.designId === "string" ? designRef.designId : null,
        designRevision: isPositiveInteger(designRef.designRevision) ? designRef.designRevision : 0,
        registrationStatus: registration ? String(registration.status) : "unresolved",
        documentRef: registrationDocumentRef(registration),
        designRefResolved: binding.resolved && binding.own,
        baselineMemberResolved: resolution ? resolution.baselineMemberResolved : false,
        completionCriteriaResolved: resolution ? resolution.completionCriteriaResolved : false,
      };
    })
    .sort((left, right) => compareCodePointOrder(left.componentId, right.componentId));
  return {
    schema: "sothoth.scope-bom-admissibility-projection/v1",
    phase: "scope",
    ...sourceIdentity(facts, context),
    sourceFactsDigest: scopeSourceFactsDigest(facts, context),
    architectureBaseline: {
      baselineId: baseline && typeof baseline.baselineId === "string" ? baseline.baselineId : null,
      baselineRevision:
        baseline && isPositiveInteger(baseline.baselineRevision) ? baseline.baselineRevision : null,
      status: baseline && typeof baseline.status === "string" ? baseline.status : "missing",
    },
    scopeBom: {
      bomId: scopeBom && typeof scopeBom.bomId === "string" ? scopeBom.bomId : null,
      bomRevision: scopeBom && isPositiveInteger(scopeBom.bomRevision) ? scopeBom.bomRevision : null,
      targetRelease: scopeBom && typeof scopeBom.targetRelease === "string" ? scopeBom.targetRelease : null,
    },
    outcome,
    admissible: outcome === "valid",
    memberCount: members.length,
    members,
    diagnosticCount: findings.length,
  };
}

// ---------------------------------------------------------------------------
// The shared compilation pipeline
// ---------------------------------------------------------------------------

interface PreDesignOutcome {
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly context: CompilationContext | null;
  readonly ruleFindings: readonly PlainFindingV1[];
}

function runPreDesignPipeline(
  facts: DesignClosureFactsV1,
  phase: "closure" | "scope",
): PreDesignOutcome {
  const inputFailure = (findings: readonly PlainFindingV1[]): PreDesignOutcome => {
    const diagnostics = finalizeFindings(
      findings.map((finding) =>
        findingDraft(
          finding.code,
          finding.subject,
          "pre-design",
          PRE_DESIGN_DIAGNOSTIC_IDENTITY_V1,
          "input",
        ),
      ),
    );
    return { outcome: outcomeOf(diagnostics), diagnostics, context: null, ruleFindings: [] };
  };

  const contractFindings = validateDocumentContractShape(facts.contract);
  if (contractFindings.length > 0) return inputFailure(contractFindings);
  const catalogFindings = validateCatalogShape(facts.catalog);
  if (catalogFindings.length > 0) return inputFailure(catalogFindings);
  const registryFindings = validateRegistryShape(facts.registry);
  if (registryFindings.length > 0) return inputFailure(registryFindings);
  const wrapperFindings = validateRegistrationsWrapperShape(facts.registrations);
  if (wrapperFindings.length > 0) return inputFailure(wrapperFindings);

  const contract = facts.contract as DocumentContractV1;
  const catalog = facts.catalog as DesignScopeCatalogV1;
  const requiredSectionIds = contract.sections.requiredSectionIds as string[];
  const topics = contract.topics.closedSet as string[];
  const context: CompilationContext = {
    catalog,
    candidates: [...catalog.candidates].sort((left, right) =>
      compareCodePointOrder(left.componentId, right.componentId),
    ),
    candidatesByComponent: new Map(
      catalog.candidates.map((candidate) => [candidate.componentId, candidate]),
    ),
    topicSet: new Set(topics),
    topics,
    applicabilitySet: new Set(contract.topics.inheritanceApplicability as string[]),
    requiredSectionIds,
    minimumCriteria: contract.criteria.minimumPerRegistration,
    documents: new Map(),
    registrations: (facts.registrations as { registrations: Record<string, unknown>[] }).registrations,
    registrationsByComponent: new Map(),
    designIdOwner: new Map(),
    scopeMemberResolution: new Map(),
  };

  const findings: PlainFindingV1[] = [];
  const documentSources = isPlainObject(facts.documents) ? facts.documents : {};
  const indexedByArtifact = new Map<string, DocumentEntryV1>();
  for (const document of facts.documentIndex.documents) {
    indexedByArtifact.set(document.artifactId, document);
  }
  const registry = facts.registry as DesignDocumentRegistryV1;
  for (const entry of registry.documents) {
    const markdown: string | null =
      typeof documentSources[entry.documentId] === "string"
        ? (documentSources[entry.documentId] as string)
        : null;
    if (markdown === null) {
      findings.push({ code: "sothoth.governance/document-missing", subject: entry.documentId });
      context.documents.set(entry.documentId, { entry, sectionIds: [], markdown: null });
      continue;
    }
    const indexed = indexedByArtifact.get(entry.documentId);
    if (indexed === undefined) {
      findings.push({ code: "sothoth.governance/document-unindexed", subject: entry.documentId });
      context.documents.set(entry.documentId, { entry, sectionIds: [], markdown });
      continue;
    }
    const sectionIds = sectionIdsOfEntry(indexed);
    if (!arraysEqual(sectionIds, entry.sectionIds)) {
      findings.push({ code: "sothoth.governance/document-sections-mismatch", subject: entry.documentId });
    }
    context.documents.set(entry.documentId, { entry, sectionIds, markdown });
  }

  for (const registration of context.registrations) {
    checkRegistration(registration, context, findings);
    if (isPlainObject(registration) && isNonEmptyString(registration.componentId)) {
      const list = context.registrationsByComponent.get(registration.componentId) ?? [];
      list.push(registration);
      context.registrationsByComponent.set(registration.componentId, list);
    }
  }

  const designIdOwner = new Map<string, string>();
  for (const [componentId, registrations] of context.registrationsByComponent) {
    const retained = registrations.filter(
      (registration) => registration.status === "proposed" || registration.status === "accepted",
    );
    if (retained.length === 1 && isNonEmptyString(retained[0]!.designId)) {
      designIdOwner.set(String(retained[0]!.designId), componentId);
    }
  }
  context.designIdOwner = designIdOwner;

  for (const candidate of context.candidates) {
    const count = (context.registrationsByComponent.get(candidate.componentId) ?? []).length;
    if (count === 0) {
      findings.push({ code: "sothoth.governance/registration-missing", subject: candidate.componentId });
    } else if (count > 1) {
      findings.push({ code: "sothoth.governance/registration-duplicate", subject: candidate.componentId });
    }
  }

  checkClosureFacts(facts, context, findings);
  if (phase === "scope") {
    checkScopeFacts(facts as ScopeBomAdmissibilityFactsV1, context, findings);
  }

  return {
    outcome: findings.length === 0 ? "valid" : "invalid",
    diagnostics: [],
    context,
    ruleFindings: sortFindings(findings),
  };
}

function ruleDiagnostics(findings: readonly PlainFindingV1[]): readonly StructuredDiagnosticV1[] {
  return finalizeFindings(
    findings.map((finding) =>
      findingDraft(finding.code, finding.subject, "pre-design", PRE_DESIGN_DIAGNOSTIC_IDENTITY_V1, "gates"),
    ),
  );
}

/**
 * Compiles the Design Closure projection over the supplied facts. Envelope
 * shape violations yield `invalid-input` with no projection; every closure
 * rule violation yields a typed finding and an `invalid` projection that is
 * still byte-stable and digest-bearing. The compilation changes no status
 * and writes nothing back.
 */
export function compileDesignClosureV1(facts: DesignClosureFactsV1): DesignClosureCompilationV1 {
  const envelope = {
    schema: "sothoth.governance/design-closure-compilation@1" as const,
    phase: "closure" as const,
  };
  const pipeline = runPreDesignPipeline(facts, "closure");
  if (pipeline.context === null) {
    return {
      ...envelope,
      outcome: pipeline.outcome,
      diagnostics: pipeline.diagnostics,
      diagnosticCount: pipeline.diagnostics.length,
      projection: null,
    };
  }
  const diagnostics = ruleDiagnostics(pipeline.ruleFindings);
  const outcome = pipeline.ruleFindings.length === 0 ? "valid" : "invalid";
  return {
    ...envelope,
    outcome,
    diagnostics,
    diagnosticCount: diagnostics.length,
    projection: buildClosureProjection(facts, pipeline.context, outcome, pipeline.ruleFindings),
  };
}

/**
 * Compiles the Scope BOM Admissibility projection: the closure rules plus
 * Architecture Baseline acceptance and member binding, registration
 * acceptance, and the formal Scope BOM's exact identities, designRefs, and
 * completion gates. The projection is admissibility evidence about a
 * candidate BOM; it never replaces the candidate and never creates release
 * membership.
 */
export function compileScopeBomAdmissibilityV1(
  facts: ScopeBomAdmissibilityFactsV1,
): ScopeBomAdmissibilityCompilationV1 {
  const envelope = {
    schema: "sothoth.governance/scope-bom-admissibility-compilation@1" as const,
    phase: "scope" as const,
  };
  const pipeline = runPreDesignPipeline(facts, "scope");
  if (pipeline.context === null) {
    return {
      ...envelope,
      outcome: pipeline.outcome,
      diagnostics: pipeline.diagnostics,
      diagnosticCount: pipeline.diagnostics.length,
      projection: null,
    };
  }
  const diagnostics = ruleDiagnostics(pipeline.ruleFindings);
  const outcome = pipeline.ruleFindings.length === 0 ? "valid" : "invalid";
  return {
    ...envelope,
    outcome,
    diagnostics,
    diagnosticCount: diagnostics.length,
    projection: buildScopeProjection(facts, pipeline.context, outcome, pipeline.ruleFindings),
  };
}
