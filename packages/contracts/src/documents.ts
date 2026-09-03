/**
 * Document contract and stable section identity declarations.
 *
 * Internal implementation file of the accepted `@sothoth/contracts/schema`
 * family, re-exported by `schema.ts` and never exposed under its own
 * subpath. A stable section marker is an HTML comment of the exact form
 * `<!-- sothoth:section id="purpose" -->`; section identity is closed over
 * the marker grammar and never derived from heading prose.
 */

/** Matches a stable section identity. */
export const SECTION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** A stable section identity conforming to `SECTION_ID_PATTERN`. */
export type SectionIdV1 = string;

/** Matches the exact stable-section marker form recognized in CommonMark. */
export const SECTION_MARKER_PATTERN = /^<!-- sothoth:section id="([a-z][a-z0-9-]*)" -->$/;

/** Section identity, cardinality, and ordering rules of a document contract. */
export interface DocumentContractSectionRulesV1 {
  readonly ordering: string;
  readonly requiredSectionIds: readonly string[];
}

/** The closed topic set and resolution kinds a document contract declares. */
export interface DocumentContractTopicRulesV1 {
  readonly closedSet: readonly string[];
  readonly resolutions: readonly string[];
  readonly inheritanceApplicability: readonly string[];
}

/** The exact field set an explicit document reference may carry. */
export interface DocumentContractReferenceRulesV1 {
  readonly exactFields: readonly string[];
}

/** Criterion cardinality and field rules of a document contract. */
export interface DocumentContractCriterionRulesV1 {
  readonly minimumPerRegistration: number;
  readonly fields: readonly string[];
}

/** A consumer-neutral document contract over parsed CommonMark structure. */
export interface DocumentContractV1 {
  readonly schema: string;
  readonly contractId: string;
  readonly contractRevision: number;
  readonly description: string;
  readonly documentKind: string;
  readonly sections: DocumentContractSectionRulesV1;
  readonly topics: DocumentContractTopicRulesV1;
  readonly references: DocumentContractReferenceRulesV1;
  readonly criteria: DocumentContractCriterionRulesV1;
}
