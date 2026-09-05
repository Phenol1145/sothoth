/**
 * Public module `@project-sothoth/governance/change-plan`: change impact and change
 * planning (`CONTRACT/SOTHOTH/CHANGE-PLAN@1`).
 *
 * The compiler consumes the Document Index projection of the artifact
 * universe, an explicit versioned relation-role mapping (owned by Consumer
 * Profiles, never invented here), a change source — an exact list of
 * changed artifact identities or a changed-artifact Selector evaluated
 * through `CONTRACT/SOTHOTH/SELECTOR@1` — and optional evidence snapshot
 * bindings, and emits the non-authoritative change-plan projection.
 *
 * Ordering is explicit: only mapped `normative-dependency` and `derivation`
 * roles produce `prerequisite -> dependent` Ordering Edges, and every edge
 * records its originating relation and mapping rule. `impact` expands
 * review scope through the impact closure without creating any order, so
 * impact-only cycles stay legal, while ordering cycles fail closed through
 * `@project-sothoth/graph`'s deterministic cycle witness. Dispositions come from
 * the closed `CHANGE_DISPOSITIONS_V1` vocabulary: changed artifacts are
 * `revise`, derivation dependents `rebuild`, normative dependents
 * `revalidate`, artifacts with stale evidence snapshots
 * `invalidate-evidence`, impact-scope artifacts `review-required`, and the
 * rest `unchanged`. The compilation applies no edit and writes nothing
 * back; unmapped relations interpret to nothing.
 */

import type {
  ChangeDispositionV1,
  CompilationOutcomeKindV1,
  GraphNodeWaveV1,
  StructuredDiagnosticV1,
} from "@project-sothoth/contracts";
import { createCanonicalGraphV1 } from "@project-sothoth/graph/digraph";
import type { DirectedMultigraphDeclarationV1 } from "@project-sothoth/graph/digraph";
import { topologicalWavesV1 } from "@project-sothoth/graph/waves";
import { selectDocumentsV1 } from "@project-sothoth/selectors/match";
import type { DocumentIndexProjectionV1 } from "@project-sothoth/document-index/index";
import {
  DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
  compareCodePointOrder,
  finalizeFindings,
  findingDraft,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  keysExactly,
  outcomeOf,
  sortFindings,
  unknownFieldNames,
} from "./index.js";
import type { PlainFindingV1 } from "./index.js";

/** The closed generic edge-role vocabulary this package interprets. */
export const GENERIC_EDGE_ROLES_V1 = [
  "normative-dependency",
  "derivation",
  "validation",
  "history",
  "navigation",
  "impact",
] as const;

/** A member of `GENERIC_EDGE_ROLES_V1`. */
export type GenericEdgeRoleV1 = (typeof GENERIC_EDGE_ROLES_V1)[number];

/** The two generic roles that produce `prerequisite -> dependent` ordering. */
export const ORDERING_EDGE_ROLES_V1: readonly GenericEdgeRoleV1[] = [
  "normative-dependency",
  "derivation",
];

/** The schema identity of the relation-role mapping value. */
export const RELATION_ROLE_MAPPING_SCHEMA_V1 = "sothoth.governance/relation-role-mapping@1";

const MAPPING_FIELDS = ["schema", "mappingId", "mappingRevision", "entries"] as const;
const MAPPING_ENTRY_FIELDS = ["relationRole", "edgeRole"] as const;
const EVIDENCE_BINDING_FIELDS = ["artifactId", "snapshotIdentity"] as const;

/** One mapping entry: a domain relation name and the generic role it interprets to. */
export interface RelationRoleMappingEntryV1 {
  readonly relationRole: string;
  readonly edgeRole: GenericEdgeRoleV1;
}

/** An explicit, versioned mapping from domain relation names to generic edge roles. */
export interface RelationRoleMappingV1 {
  readonly schema: typeof RELATION_ROLE_MAPPING_SCHEMA_V1;
  readonly mappingId: string;
  readonly mappingRevision: number;
  readonly entries: readonly RelationRoleMappingEntryV1[];
}

/** One evidence snapshot binding: evidence recorded against an artifact state. */
export interface EvidenceBindingV1 {
  readonly artifactId: string;
  readonly snapshotIdentity: string;
}

/** The exact fact values one change-plan compilation consumes. */
export interface ChangePlanFactsV1 {
  readonly documentIndex: DocumentIndexProjectionV1;
  readonly roleMapping: unknown;
  /** A changed-artifact Selector; exactly one change source is required. */
  readonly selector?: unknown | undefined;
  /** Explicit changed artifact identities; exactly one change source is required. */
  readonly changedArtifactIds?: readonly string[] | undefined;
  readonly evidenceBindings?: readonly EvidenceBindingV1[] | undefined;
}

/** One produced Ordering Edge with its full explain record. */
export interface OrderingEdgeV1 {
  readonly prerequisiteId: string;
  readonly dependentId: string;
  readonly relationRole: string;
  readonly edgeRole: "normative-dependency" | "derivation";
  readonly mappingId: string;
  readonly mappingRevision: number;
  readonly originatingRelationId: string;
}

/** One artifact's change-plan conclusion. */
export interface ChangePlanArtifactV1 {
  readonly artifactId: string;
  readonly disposition: ChangeDispositionV1;
  readonly changed: boolean;
  readonly reviewScope: boolean;
}

/** The change-plan projection: non-authoritative, applies no edit. */
export interface ChangePlanProjectionV1 {
  readonly schema: "sothoth.governance/change-plan-projection@1";
  readonly phase: "change-plan";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  readonly mappingId: string;
  readonly mappingRevision: number;
  readonly artifactCount: number;
  readonly changedArtifactIds: readonly string[];
  readonly artifacts: readonly ChangePlanArtifactV1[];
  readonly orderingEdges: readonly OrderingEdgeV1[];
  readonly waves: readonly (readonly GraphNodeWaveV1[])[];
}

function toDiagnostics(
  findings: readonly PlainFindingV1[],
  findingClass: "input" | "gates",
): readonly StructuredDiagnosticV1[] {
  return finalizeFindings(
    findings.map((finding) =>
      findingDraft(
        finding.code,
        finding.subject,
        "change-plan",
        DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
        findingClass,
      ),
    ),
  );
}

function isGenericEdgeRole(value: unknown): value is GenericEdgeRoleV1 {
  return (
    typeof value === "string" &&
    (GENERIC_EDGE_ROLES_V1 as readonly string[]).includes(value)
  );
}

function validateRoleMapping(candidate: unknown): {
  findings: readonly PlainFindingV1[];
  mapping: RelationRoleMappingV1 | null;
} {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(candidate)) {
    return {
      findings: [{ code: "sothoth.governance/role-mapping-invalid", subject: "roleMapping" }],
      mapping: null,
    };
  }
  for (const field of unknownFieldNames(candidate, MAPPING_FIELDS)) {
    findings.push({ code: "sothoth.governance/role-mapping-invalid", subject: field });
  }
  if (candidate.schema !== RELATION_ROLE_MAPPING_SCHEMA_V1) {
    findings.push({ code: "sothoth.governance/role-mapping-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(candidate.mappingId)) {
    findings.push({ code: "sothoth.governance/role-mapping-invalid", subject: "mappingId" });
  }
  if (!isPositiveInteger(candidate.mappingRevision)) {
    findings.push({ code: "sothoth.governance/role-mapping-invalid", subject: "mappingRevision" });
  }
  const entries: RelationRoleMappingEntryV1[] = [];
  if (!Array.isArray(candidate.entries)) {
    findings.push({ code: "sothoth.governance/role-mapping-invalid", subject: "entries" });
  } else {
    const seenRoles = new Set<string>();
    for (const entry of candidate.entries) {
      if (
        !isPlainObject(entry) ||
        !keysExactly(entry, MAPPING_ENTRY_FIELDS) ||
        !isNonEmptyString(entry.relationRole)
      ) {
        findings.push({ code: "sothoth.governance/role-mapping-invalid", subject: "entries" });
        continue;
      }
      if (!isGenericEdgeRole(entry.edgeRole)) {
        findings.push({
          code: "sothoth.governance/mapping-role-unknown",
          subject: `${entry.relationRole}:${String(entry.edgeRole)}`,
        });
        continue;
      }
      if (seenRoles.has(entry.relationRole)) {
        findings.push({
          code: "sothoth.governance/mapping-entry-duplicate",
          subject: entry.relationRole,
        });
        continue;
      }
      seenRoles.add(entry.relationRole);
      entries.push({ relationRole: entry.relationRole, edgeRole: entry.edgeRole });
    }
  }
  if (findings.length > 0) return { findings: sortFindings(findings), mapping: null };
  return {
    findings: [],
    mapping: candidate as unknown as RelationRoleMappingV1 & { entries: readonly RelationRoleMappingEntryV1[] },
  };
}

/**
 * Compiles the change-plan projection. Input violations (a malformed
 * mapping, an ambiguous change source, an unresolvable changed identity or
 * evidence binding, or an ordering-mapped external relation) fold to
 * `invalid-input` with an empty work list; an ordering cycle folds to
 * `invalid` through the graph package's deterministic witness. The result
 * is a pure function of its inputs: identical facts compile to identical
 * bytes.
 */
export function compileChangePlanV1(facts: ChangePlanFactsV1): ChangePlanProjectionV1 {
  const envelope = {
    schema: "sothoth.governance/change-plan-projection@1" as const,
    phase: "change-plan" as const,
  };

  const inputFindings: PlainFindingV1[] = [];
  const ruleFindings: PlainFindingV1[] = [];

  const { findings: mappingFindings, mapping } = validateRoleMapping(facts.roleMapping);
  inputFindings.push(...mappingFindings);

  const artifacts = [...facts.documentIndex.documents]
    .map((document) => document.artifactId)
    .sort(compareCodePointOrder);
  const artifactSet = new Set(artifacts);

  const hasSelector = facts.selector !== undefined;
  const hasExplicitIds = facts.changedArtifactIds !== undefined;
  let changedIds: readonly string[] = [];
  if (hasSelector === hasExplicitIds) {
    inputFindings.push({ code: "sothoth.governance/changed-source-invalid", subject: "input" });
  } else if (hasSelector) {
    const selection = selectDocumentsV1(facts.documentIndex, facts.selector);
    if (!selection.ok) {
      inputFindings.push({ code: "sothoth.governance/changed-selector-invalid", subject: "selector" });
    } else {
      changedIds = selection.matches.map((match) => match.artifactId);
    }
  } else {
    const explicit = facts.changedArtifactIds as readonly string[];
    if (!Array.isArray(explicit) || !explicit.every(isNonEmptyString)) {
      inputFindings.push({ code: "sothoth.governance/changed-source-invalid", subject: "changedArtifactIds" });
    } else {
      for (const id of explicit) {
        if (!artifactSet.has(id)) {
          inputFindings.push({ code: "sothoth.governance/changed-artifact-unresolved", subject: id });
        }
      }
      changedIds = explicit;
    }
  }
  const changedSet = new Set(changedIds);

  const staleEvidence = new Set<string>();
  if (facts.evidenceBindings !== undefined) {
    if (!Array.isArray(facts.evidenceBindings)) {
      inputFindings.push({ code: "sothoth.governance/evidence-binding-invalid", subject: "evidenceBindings" });
    } else {
      for (const binding of facts.evidenceBindings) {
        if (
          !isPlainObject(binding) ||
          !keysExactly(binding, EVIDENCE_BINDING_FIELDS) ||
          !isNonEmptyString(binding.artifactId) ||
          !isNonEmptyString(binding.snapshotIdentity)
        ) {
          inputFindings.push({
            code: "sothoth.governance/evidence-binding-invalid",
            subject: "evidenceBindings",
          });
          continue;
        }
        if (!artifactSet.has(binding.artifactId)) {
          inputFindings.push({
            code: "sothoth.governance/evidence-binding-unresolved",
            subject: binding.artifactId,
          });
          continue;
        }
        const entry = facts.documentIndex.documents.find(
          (document) => document.artifactId === binding.artifactId,
        )!;
        if (entry.contentDigest !== binding.snapshotIdentity) {
          staleEvidence.add(binding.artifactId);
        }
      }
    }
  }

  const mappingByRelationRole = new Map<string, GenericEdgeRoleV1>();
  if (mapping !== null) {
    for (const entry of mapping.entries) {
      mappingByRelationRole.set(entry.relationRole, entry.edgeRole);
    }
  }

  const orderingEdges: OrderingEdgeV1[] = [];
  const impactAdjacency = new Map<string, string[]>();
  const inputEdgeFailures: PlainFindingV1[] = [];
  if (mapping !== null && inputFindings.length === 0) {
    for (const document of [...facts.documentIndex.documents].sort((left, right) =>
      compareCodePointOrder(left.artifactId, right.artifactId),
    )) {
      for (const relation of document.relations) {
        if (relation.role === null) continue;
        const edgeRole = mappingByRelationRole.get(relation.role);
        if (edgeRole === undefined) continue;
        if (
          (edgeRole === "impact" || ORDERING_EDGE_ROLES_V1.includes(edgeRole)) &&
          relation.target.external
        ) {
          inputEdgeFailures.push({
            code: "sothoth.governance/relation-target-external",
            subject: relation.relationId,
          });
          continue;
        }
        if (ORDERING_EDGE_ROLES_V1.includes(edgeRole)) {
          orderingEdges.push({
            prerequisiteId: relation.target.artifactId,
            dependentId: relation.fromArtifactId,
            relationRole: relation.role,
            edgeRole: edgeRole === "derivation" ? "derivation" : "normative-dependency",
            mappingId: mapping.mappingId,
            mappingRevision: mapping.mappingRevision,
            originatingRelationId: relation.relationId,
          });
        } else if (edgeRole === "impact") {
          const targets = impactAdjacency.get(relation.fromArtifactId) ?? [];
          targets.push(relation.target.artifactId);
          impactAdjacency.set(relation.fromArtifactId, targets);
        }
      }
    }
  }
  inputFindings.push(...inputEdgeFailures);
  orderingEdges.sort(
    (left, right) =>
      compareCodePointOrder(left.prerequisiteId, right.prerequisiteId) ||
      compareCodePointOrder(left.dependentId, right.dependentId) ||
      compareCodePointOrder(left.originatingRelationId, right.originatingRelationId),
  );

  const changedArtifactIds = [...changedSet].sort(compareCodePointOrder);

  const failure = (findingClass: "input" | "gates", findings: readonly PlainFindingV1[]) => {
    const diagnostics = toDiagnostics(findings, findingClass);
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      mappingId: mapping === null ? "" : mapping.mappingId,
      mappingRevision: mapping === null ? 0 : mapping.mappingRevision,
      artifactCount: artifacts.length,
      changedArtifactIds: [],
      artifacts: [],
      orderingEdges: [],
      waves: [],
    };
  };

  if (inputFindings.length > 0) {
    return failure("input", sortFindings(inputFindings));
  }

  // Dispositions over the affected closure.
  const dispositionOf = new Map<string, ChangeDispositionV1>();
  const reviewScope = new Set<string>();
  for (const artifactId of changedSet) dispositionOf.set(artifactId, "revise");

  const inboundOrdering = new Map<string, OrderingEdgeV1[]>();
  for (const edge of orderingEdges) {
    const list = inboundOrdering.get(edge.dependentId) ?? [];
    list.push(edge);
    inboundOrdering.set(edge.dependentId, list);
  }
  const orderingQueue = [...changedArtifactIds];
  const orderingSeen = new Set<string>(changedArtifactIds);
  for (let cursor = 0; cursor < orderingQueue.length; cursor += 1) {
    const current = orderingQueue[cursor]!;
    for (const edge of orderingEdges) {
      if (edge.prerequisiteId !== current) continue;
      if (!orderingSeen.has(edge.dependentId)) {
        orderingSeen.add(edge.dependentId);
        orderingQueue.push(edge.dependentId);
      }
    }
  }
  for (const artifactId of orderingSeen) {
    if (changedSet.has(artifactId)) continue;
    const entries = (inboundOrdering.get(artifactId) ?? []).filter((edge) =>
      orderingSeen.has(edge.prerequisiteId),
    );
    const rebuilds = entries.some((edge) => edge.edgeRole === "derivation");
    dispositionOf.set(artifactId, rebuilds ? "rebuild" : "revalidate");
  }

  for (const artifactId of staleEvidence) {
    if (!dispositionOf.has(artifactId)) dispositionOf.set(artifactId, "invalidate-evidence");
  }

  const impactQueue = [...changedArtifactIds];
  const impactSeen = new Set<string>(changedArtifactIds);
  for (let cursor = 0; cursor < impactQueue.length; cursor += 1) {
    const current = impactQueue[cursor]!;
    for (const target of (impactAdjacency.get(current) ?? []).sort(compareCodePointOrder)) {
      if (!impactSeen.has(target)) {
        impactSeen.add(target);
        impactQueue.push(target);
      }
    }
  }
  for (const artifactId of impactSeen) {
    if (dispositionOf.has(artifactId)) continue;
    dispositionOf.set(artifactId, "review-required");
    reviewScope.add(artifactId);
  }

  // Global acyclicity over every ordering edge, then waves over the induced
  // affected-closure subgraph — both through the generic graph package.
  const fullGraph = createCanonicalGraphV1({
    nodes: artifacts.map((artifactId) => ({ node: { id: artifactId }, sortKey: artifactId })),
    edges: orderingEdges.map((edge) => ({
      id: `${edge.prerequisiteId}->${edge.dependentId}:${edge.originatingRelationId}`,
      edge: {
        role: edge.edgeRole,
        fromNodeId: edge.prerequisiteId,
        toNodeId: edge.dependentId,
      },
      sortKey: `${edge.prerequisiteId}->${edge.dependentId}:${edge.originatingRelationId}`,
    })),
  } satisfies DirectedMultigraphDeclarationV1);
  if (!fullGraph.ok) {
    for (const issue of fullGraph.issues) {
      ruleFindings.push({ code: "sothoth.governance/ordering-graph-invalid", subject: issue.subject });
    }
    return failure("gates", sortFindings(ruleFindings));
  }
  const globalWaves = topologicalWavesV1(fullGraph);
  if (!globalWaves.ok) {
    for (const issue of globalWaves.issues) {
      ruleFindings.push({ code: "sothoth.governance/ordering-cycle", subject: issue.subject });
    }
    return failure("gates", sortFindings(ruleFindings));
  }

  const affected = artifacts.filter((artifactId) => orderingSeen.has(artifactId));
  const affectedSet = new Set(affected);
  const inducedEdges = orderingEdges.filter(
    (edge) => affectedSet.has(edge.prerequisiteId) && affectedSet.has(edge.dependentId),
  );
  let waves: readonly (readonly GraphNodeWaveV1[])[] = [];
  if (affected.length > 0) {
    const inducedGraph = createCanonicalGraphV1({
      nodes: affected.map((artifactId) => ({ node: { id: artifactId }, sortKey: artifactId })),
      edges: inducedEdges.map((edge) => ({
        id: `${edge.prerequisiteId}->${edge.dependentId}:${edge.originatingRelationId}`,
        edge: {
          role: edge.edgeRole,
          fromNodeId: edge.prerequisiteId,
          toNodeId: edge.dependentId,
        },
        sortKey: `${edge.prerequisiteId}->${edge.dependentId}:${edge.originatingRelationId}`,
      })),
    } satisfies DirectedMultigraphDeclarationV1);
    const inducedWaves = inducedGraph.ok ? topologicalWavesV1(inducedGraph) : null;
    if (inducedWaves === null || !inducedWaves.ok) {
      if (!inducedGraph.ok) {
        for (const issue of inducedGraph.issues) {
          ruleFindings.push({ code: "sothoth.governance/ordering-graph-invalid", subject: issue.subject });
        }
      }
      if (inducedWaves !== null && !inducedWaves.ok) {
        for (const issue of inducedWaves.issues) {
          ruleFindings.push({ code: "sothoth.governance/ordering-cycle", subject: issue.subject });
        }
      }
      return failure("gates", sortFindings(ruleFindings));
    }
    waves = inducedWaves.waves.map((wave, index) =>
      wave.map((nodeId) => ({ nodeId, wave: index })),
    );
  }

  const diagnostics = toDiagnostics(ruleFindings, "gates");
  return {
    ...envelope,
    outcome: ruleFindings.length === 0 ? "valid" : outcomeOf(diagnostics),
    diagnostics,
    diagnosticCount: diagnostics.length,
    mappingId: mapping!.mappingId,
    mappingRevision: mapping!.mappingRevision,
    artifactCount: artifacts.length,
    changedArtifactIds,
    artifacts: artifacts.map((artifactId) => ({
      artifactId,
      disposition: dispositionOf.get(artifactId) ?? "unchanged",
      changed: changedSet.has(artifactId),
      reviewScope: reviewScope.has(artifactId),
    })),
    orderingEdges,
    waves,
  };
}
