/**
 * Public module `@project-sothoth/governance/traceability`: Document Contract
 * validation and exact-section conformance.
 *
 * A Document Contract is a consumer-neutral constraint over parsed
 * CommonMark structure: section identity, ordering, the closed topic set,
 * exact reference fields, and criterion cardinality. `validateDocumentContractV1`
 * validates one `sothoth.document-contract/v1` value as a closed object and
 * stops there — it never inspects prose, never parses markdown, and never
 * rewrites a document. Structural conformance of an indexed document is
 * evaluated against the structural facts of
 * `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`: sections and headings come from the
 * index entries, so this module imports `DocumentIndexProjectionV1` and
 * `DocumentEntryV1` as types only and re-derives nothing.
 *
 * Emissions carry the declared `sothoth.governance/document-governance-diagnostic@1`
 * identity under the Structured Diagnostic vocabulary; outcomes fold through
 * `@project-sothoth/core`. A failed validation leaves no contract value.
 */

import type {
  CompilationOutcomeKindV1,
  DocumentContractV1,
  StructuredDiagnosticV1,
} from "@project-sothoth/contracts";
import type { DocumentEntryV1 } from "@project-sothoth/document-index/index";
import {
  DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
  finalizeFindings,
  findingDraft,
  outcomeOf,
  arraysEqual,
  validateDocumentContractShape,
} from "./index.js";

/** The result envelope of one Document Contract compilation. */
export interface DocumentContractCompilationV1 {
  readonly schema: "sothoth.governance/document-contract-compilation@1";
  readonly phase: "document-contract";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The validated contract value, or null when validation failed. */
  readonly contract: DocumentContractV1 | null;
}

/**
 * Validates a `sothoth.document-contract/v1` value fail-closed. Unknown
 * fields, a foreign schema identity, a non-exact section ordering at v1,
 * duplicate or pattern-invalid section identities, a topic set outside the
 * closed resolution and applicability vocabularies, a non-exact reference
 * field list, or a non-positive criterion cardinality each yield a typed
 * `sothoth.governance/contract-invalid` finding and an `invalid-input`
 * outcome.
 */
export function validateDocumentContractV1(candidate: unknown): DocumentContractCompilationV1 {
  const shapeFindings = validateDocumentContractShape(candidate);
  if (shapeFindings.length > 0) {
    const diagnostics = finalizeFindings(
      shapeFindings.map((finding) =>
        findingDraft(
          finding.code,
          finding.subject,
          "document-contract",
          DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
          "input",
        ),
      ),
    );
    return {
      schema: "sothoth.governance/document-contract-compilation@1",
      phase: "document-contract",
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      contract: null,
    };
  }
  return {
    schema: "sothoth.governance/document-contract-compilation@1",
    phase: "document-contract",
    outcome: "valid",
    diagnostics: [],
    diagnosticCount: 0,
    contract: candidate as DocumentContractV1,
  };
}

/** The exact-section conformance of one indexed document under one contract. */
export interface DocumentSectionConformanceV1 {
  /** True when the entry's stable sections equal the required list in order. */
  readonly conforms: boolean;
  /** The entry's stable section identities, in document order. */
  readonly sectionIds: readonly string[];
}

/**
 * Evaluates exact-section conformance of one index entry under a validated
 * contract: the entry's stable sections, in document order, must equal the
 * contract's required section list exactly. Heading wording is never read.
 */
export function evaluateDocumentSectionsConformanceV1(
  contract: DocumentContractV1,
  entry: DocumentEntryV1,
): DocumentSectionConformanceV1 {
  const sectionIds = entry.sections.map((section) => section.sectionId);
  return {
    conforms: arraysEqual(sectionIds, contract.sections.requiredSectionIds),
    sectionIds,
  };
}
