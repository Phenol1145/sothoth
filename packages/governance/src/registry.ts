/**
 * Public module `@project-sothoth/governance/registry` (also served at
 * `@project-sothoth/governance/manifest`): Registry lifecycle compilation.
 *
 * The registry is the manifest of registered design documents. Compilation
 * validates the `sothoth.design-document-registry/v1` envelope as a closed
 * object, compiles the lifecycle bindings of every registered document, and
 * evaluates section conformance against the structural facts of
 * `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`: a registry document binds to an index
 * entry by exact artifact identity, and its declared stable sections must
 * equal the indexed sections in document order. Marker parsing, anchors, and
 * relation extraction are the Document Index's truths — `DocumentIndexProjectionV1`
 * and `DocumentEntryV1` are consumed as types only here.
 *
 * The compiler reads and rejects; it never repairs a registry, never writes
 * one back, and never changes a document status. Emissions carry the
 * declared `sothoth.governance/document-governance-diagnostic@1` identity.
 */

import type {
  CompilationOutcomeKindV1,
  DesignDocumentRegistryV1,
  StructuredDiagnosticV1,
} from "@project-sothoth/contracts";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
} from "@project-sothoth/document-index/index";
import {
  DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
  arraysEqual,
  compareCodePointOrder,
  finalizeFindings,
  findingDraft,
  outcomeOf,
  sectionIdsOfEntry,
  sortFindings,
  validateRegistryShape,
} from "./index.js";
import type { PlainFindingV1 } from "./index.js";

/** The input of one Registry compilation. */
export interface RegistryValidationInputV1 {
  /** The Registry Source Fact under validation. */
  readonly registry: unknown;
  /** The structural document facts the registry is conformed against. */
  readonly documentIndex: DocumentIndexProjectionV1;
}

/** The compiled lifecycle binding of one registered document. */
export interface RegistryDocumentCompilationV1 {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly path: string;
  readonly status: string;
  /** The sections the registry declares, in declared order. */
  readonly declaredSectionIds: readonly string[];
  /** The indexed sections in document order, or null when no index entry binds. */
  readonly indexedSectionIds: readonly string[] | null;
  /** True when the declared sections equal the indexed sections. */
  readonly sectionsConform: boolean;
}

/** The result envelope of one Registry compilation. */
export interface RegistryCompilationV1 {
  readonly schema: "sothoth.governance/registry-compilation@1";
  readonly phase: "registry";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The validated registry value, or null when the envelope shape failed. */
  readonly registry: DesignDocumentRegistryV1 | null;
  /** The per-document lifecycle compilations, ordered by document identity. */
  readonly documents: readonly RegistryDocumentCompilationV1[];
}

/**
 * Compiles lifecycle bindings from Registry facts. Shape violations yield
 * typed `sothoth.governance/registry-invalid` findings and an
 * `invalid-input` outcome with no registry value; a registry document that
 * no index entry binds fails as `registry-document-unindexed`, and declared
 * sections that differ from the indexed sections fail as
 * `document-sections-mismatch`.
 */
export function validateRegistryV1(input: RegistryValidationInputV1): RegistryCompilationV1 {
  const shapeFindings = validateRegistryShape(input.registry);
  const envelope: Omit<RegistryCompilationV1, "outcome" | "diagnostics" | "diagnosticCount" | "registry" | "documents"> =
    { schema: "sothoth.governance/registry-compilation@1", phase: "registry" };
  if (shapeFindings.length > 0) {
    const diagnostics = finalizeFindings(
      shapeFindings.map((finding) =>
        findingDraft(
          finding.code,
          finding.subject,
          "registry",
          DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
          "input",
        ),
      ),
    );
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      registry: null,
      documents: [],
    };
  }

  const registry = input.registry as DesignDocumentRegistryV1;
  const indexedByArtifact = new Map<string, DocumentEntryV1>();
  for (const entry of input.documentIndex.documents) {
    indexedByArtifact.set(entry.artifactId, entry);
  }

  const findings: PlainFindingV1[] = [];
  const documents: RegistryDocumentCompilationV1[] = registry.documents.map((entry) => {
    const indexed = indexedByArtifact.get(entry.documentId) ?? null;
    const indexedSectionIds = indexed === null ? null : sectionIdsOfEntry(indexed);
    if (indexed === null) {
      findings.push({
        code: "sothoth.governance/registry-document-unindexed",
        subject: entry.documentId,
      });
    } else if (!arraysEqual(indexedSectionIds!, entry.sectionIds)) {
      findings.push({
        code: "sothoth.governance/document-sections-mismatch",
        subject: entry.documentId,
      });
    }
    return {
      documentId: entry.documentId,
      documentRevision: entry.documentRevision,
      path: entry.path,
      status: entry.status,
      declaredSectionIds: entry.sectionIds,
      indexedSectionIds,
      sectionsConform: indexedSectionIds !== null && arraysEqual(indexedSectionIds, entry.sectionIds),
    };
  });
  documents.sort((left, right) => compareCodePointOrder(left.documentId, right.documentId));

  const diagnostics = finalizeFindings(
    sortFindings(findings).map((finding) =>
      findingDraft(
        finding.code,
        finding.subject,
        "registry",
        DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
        "gates",
      ),
    ),
  );
  return {
    ...envelope,
    outcome: outcomeOf(diagnostics),
    diagnostics,
    diagnosticCount: diagnostics.length,
    registry,
    documents,
  };
}
