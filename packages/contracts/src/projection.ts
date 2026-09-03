/**
 * Projection envelopes and their digest fields.
 *
 * Public family `@sothoth/contracts/projection`. Projections are
 * non-authoritative, disposable, and rebuildable from exact input identities;
 * these types declare the envelope shapes the governance compiler emits and
 * the digest fields that make a projection exactly referenceable. The types
 * mirror the accepted pre-design bootstrap projections.
 */

import type { CompilationOutcomeKindV1 } from "./diagnostics.js";
import type { DigestV1 } from "./identity.js";
import type { ContractIssueV1, ExactDesignDocumentRefV1 } from "./schema.js";

/** The closed pre-design check phases. */
export const PRE_DESIGN_PHASES_V1 = ["dossiers", "closure", "scope"] as const;

/** A pre-design phase member of `PRE_DESIGN_PHASES_V1`. */
export type PreDesignPhaseV1 = (typeof PRE_DESIGN_PHASES_V1)[number];

/** Per-member closure summary of a design-closure projection. */
export interface DesignClosureMemberSummaryV1 {
  readonly componentId: string;
  readonly designId: string;
  readonly designRevision: number;
  readonly documentRef: ExactDesignDocumentRefV1;
  readonly registrationStatus: string;
  readonly criteria: number;
  readonly localTopics: number;
  readonly inheritedTopics: number;
  readonly notApplicableTopics: number;
}

/**
 * The design-closure projection: non-authoritative evidence that every
 * retained candidate holds an accepted Dossier, one exact registration, and a
 * closed cross-artifact edge review.
 */
export interface DesignClosureProjectionV1 {
  readonly schema: "sothoth.design-closure-projection/v1";
  readonly phase: "closure";
  readonly outcome: CompilationOutcomeKindV1;
  readonly issues: readonly ContractIssueV1[];
  readonly catalogId: string;
  readonly catalogRevision: number;
  readonly contractId: string;
  readonly contractRevision: number;
  readonly registryId: string;
  readonly registryRevision: number;
  readonly registrationsCollectionId: string;
  readonly registrationsCollectionRevision: number;
  readonly memberCount: number;
  readonly diagnosticCount: number;
  readonly readyForAcceptance: boolean;
  readonly sourceFactsDigest: DigestV1;
  readonly members: readonly DesignClosureMemberSummaryV1[];
}

/** Per-member admissibility summary of a scope-BOM admissibility projection. */
export interface ScopeBomAdmissibilityMemberV1 {
  readonly componentId: string;
  readonly designId: string;
  readonly designRevision: number;
  readonly documentRef: ExactDesignDocumentRefV1;
  readonly registrationStatus: string;
  readonly baselineMemberResolved: boolean;
  readonly designRefResolved: boolean;
  readonly completionCriteriaResolved: boolean;
}

/**
 * The scope-BOM admissibility projection: non-authoritative evidence that a
 * formal Scope BOM may exist for the target release. The outcome category of
 * the projection envelope reuses the closed diagnostic category vocabulary.
 */
export interface ScopeBomAdmissibilityProjectionV1 {
  readonly schema: "sothoth.scope-bom-admissibility-projection/v1";
  readonly phase: "scope";
  readonly outcome: CompilationOutcomeKindV1;
  readonly issues: readonly ContractIssueV1[];
  readonly admissible: boolean;
  readonly catalogId: string;
  readonly catalogRevision: number;
  readonly contractId: string;
  readonly contractRevision: number;
  readonly registryId: string;
  readonly registryRevision: number;
  readonly registrationsCollectionId: string;
  readonly registrationsCollectionRevision: number;
  readonly memberCount: number;
  readonly diagnosticCount: number;
  readonly sourceFactsDigest: DigestV1;
  readonly architectureBaseline: {
    readonly baselineId: string;
    readonly baselineRevision: number;
    readonly status: string;
  };
  readonly scopeBom: {
    readonly bomId: string;
    readonly bomRevision: number;
    readonly targetRelease: string;
  };
  readonly members: readonly ScopeBomAdmissibilityMemberV1[];
}
