/**
 * Closed envelope schemas for catalog, registry, and registration facts.
 *
 * Public family `@sothoth/contracts/schema`. Every field set below is closed:
 * an envelope carrying a key outside its declared field set is a schema
 * violation, not a graceful extension point. Field sets are pinned as
 * constants so validators and tests share one declaration per fact shape.
 * The document and graph contract names are internal implementation files of
 * this family, so `@sothoth/contracts/schema` is their accepted public home.
 */

import { sortContractIssues } from "./code-point-order.js";
import type { JsonValue } from "./identity.js";
import type { TopicCoverageEntryV1 } from "./pre-design.js";

export * from "./documents.js";
export * from "./graphs.js";

/** A structured validation issue with a diagnostic code and an exact subject path. */
export interface ContractIssueV1 {
  readonly code: string;
  readonly subject: string;
}

/**
 * Reports unknown own keys of `record` against the closed `allowedFields` set.
 *
 * Keys are enumerated with `Object.getOwnPropertyNames`, which never executes
 * accessor property getters, so a hostile record is rejected without its
 * accessors ever running. Issues are ordered by code and then subject in
 * Unicode code-point order. This helper validates key closure only; presence
 * and value-shape rules belong to the per-family validators that call it.
 */
export function validateExactRecordV1(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
  subject: string,
): readonly ContractIssueV1[] {
  const allowed = new Set(allowedFields);
  const issues: ContractIssueV1[] = [];
  for (const key of Object.getOwnPropertyNames(record)) {
    if (!allowed.has(key)) {
      issues.push({ code: "sothoth.contracts/unknown-field", subject: `${subject}.${key}` });
    }
  }
  return sortContractIssues(issues);
}

/** Lifecycle statuses a registered design or document may hold. */
export type RegistrationStatusV1 = "proposed" | "accepted" | "superseded";

/** The closed design-requirement kinds a catalog candidate may declare. */
export type DesignRequirementV1 = "full" | "projection" | "compatibility";

/** Lifecycle statuses a registered design document may hold. */
export type DocumentStatusV1 = "proposed" | "accepted" | "superseded";

/** An exact reference to a design document at a positive integer revision. */
export interface ExactDesignDocumentRefV1 {
  readonly documentId: string;
  readonly documentRevision: number;
}

/** An acceptance-criterion reference inside a registration or dossier. */
export interface DesignCriterionRefV1 {
  readonly criterionId: string;
  readonly sectionId: string;
}

/** The closed field set of a Design Scope Catalog. */
export const DESIGN_SCOPE_CATALOG_FIELDS_V1 = [
  "schema",
  "catalogId",
  "catalogRevision",
  "targetReleaseIntent",
  "status",
  "candidates",
  "externalRelations",
  "deferredCapabilities",
] as const;

/** The closed field set of a Design Scope Catalog candidate. */
export const DESIGN_SCOPE_CATALOG_CANDIDATE_FIELDS_V1 = [
  "componentId",
  "designId",
  "artifactType",
  "designRequirement",
  "coverage",
  "owner",
] as const;

/** A provisional candidate recorded by a Design Scope Catalog. */
export interface DesignScopeCatalogCandidateV1 {
  readonly componentId: string;
  readonly designId: string;
  readonly artifactType: string;
  readonly designRequirement: DesignRequirementV1;
  readonly coverage: string;
  readonly owner: string;
}

/**
 * A revisable candidate inventory. A catalog is never release membership: it
 * carries no completion gates, member digests, tarball identities, or
 * provenance claims.
 */
export interface DesignScopeCatalogV1 {
  readonly schema: string;
  readonly catalogId: string;
  readonly catalogRevision: number;
  readonly targetReleaseIntent: string;
  readonly status: string;
  readonly candidates: readonly DesignScopeCatalogCandidateV1[];
  readonly externalRelations: readonly JsonValue[];
  readonly deferredCapabilities: readonly JsonValue[];
}

/** The closed field set of a design document registry. */
export const DESIGN_DOCUMENT_REGISTRY_FIELDS_V1 = [
  "schema",
  "registryId",
  "registryRevision",
  "documents",
] as const;

/** The closed field set of a registry document record. */
export const DESIGN_DOCUMENT_FIELDS_V1 = [
  "documentId",
  "documentRevision",
  "path",
  "status",
  "sectionIds",
] as const;

/** A registered design document and its declared stable section identities. */
export interface DesignDocumentRecordV1 {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly path: string;
  readonly status: DocumentStatusV1;
  readonly sectionIds: readonly string[];
}

/** The registry of design documents consumed by pre-design closure. */
export interface DesignDocumentRegistryV1 {
  readonly schema: string;
  readonly registryId: string;
  readonly registryRevision: number;
  readonly documents: readonly DesignDocumentRecordV1[];
}

/** The closed field set of an artifact design registration. */
export const ARTIFACT_DESIGN_REGISTRATION_FIELDS_V1 = [
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

/** The closed field set of an `ExactDesignDocumentRefV1`. */
export const EXACT_DESIGN_DOCUMENT_REF_FIELDS_V1 = ["documentId", "documentRevision"] as const;

/** The closed field set of a `DesignCriterionRefV1`. */
export const DESIGN_CRITERION_REF_FIELDS_V1 = ["criterionId", "sectionId"] as const;

/** An accepted registration binding one component design to one document. */
export interface ArtifactDesignRegistrationV1 {
  readonly designId: string;
  readonly componentId: string;
  readonly designRevision: number;
  readonly designRequirement: DesignRequirementV1;
  readonly status: RegistrationStatusV1;
  readonly documentRef: ExactDesignDocumentRefV1;
  readonly topicCoverage: Readonly<Record<string, TopicCoverageEntryV1>>;
  readonly providedContractRefs: readonly string[];
  readonly requiredContractRefs: readonly string[];
  readonly producedStateRefs: readonly string[];
  readonly consumedStateRefs: readonly string[];
  readonly issuedAuthorityRefs: readonly string[];
  readonly requiredAuthorityRefs: readonly string[];
  readonly emittedObservationRefs: readonly string[];
  readonly deploymentDependencyRefs: readonly string[];
  readonly acceptanceCriteria: readonly DesignCriterionRefV1[];
  readonly supersedes: string | null;
}
