/**
 * Public modules `@sothoth/planning/schedule`, `@sothoth/planning/solution`,
 * and `@sothoth/planning/waves`: the closed scheduling compilation of
 * `0.1.0` (`CONTRACT/SOTHOTH/PLANNING@1`).
 *
 * `compileDependencyScheduleV1` drives the whole compilation: dependency
 * constraints are validated fail-closed, the ordering graph is assembled over
 * the generic graph package (`CONTRACT/SOTHOTH/GENERIC-GRAPH@1`), waves are
 * assigned deterministically, and exactly one digest-bearing Schedule
 * Solution under the shared identity
 * `SCHEDULE_SOLUTION_IDENTITY_V1` is emitted — canonical bytes and digests
 * through `@sothoth/core`. `0.1.0` solves only the dependency dimension:
 * any active `time`, `resource`, `assignment`, `placement`, `gate`, or
 * `release-train` dimension fails closed as
 * `sothoth.planning/unsupported-dimension` naming the axis identity and is
 * never silently ignored or partially solved. Here `gate` is a scheduling
 * dimension and is distinct from Governance's declarative Gate Macro.
 *
 * `assignDependencyWavesV1` exposes the wave view of that same single
 * solution: it is a projection, never an independent wave truth. A failed
 * compilation leaves no partial solution: waves and satisfied identities are
 * empty and the outcome carries the folded diagnostics. Nothing persists
 * between calls and no input is ever mutated; the emitted solution is deeply
 * frozen.
 */

import type {
  CompilationOutcomeKindV1,
  DigestV1,
  GraphNodeWaveV1,
  ScheduleSolutionV1 as ContractScheduleSolutionV1,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
import { SCHEDULE_SOLUTION_IDENTITY_V1 } from "@sothoth/contracts";
import { canonicalJson } from "@sothoth/core/canonical-json";
import { sha256Digest } from "@sothoth/core/digest";
import { createCanonicalGraphV1 } from "@sothoth/graph/digraph";
import type { DirectedMultigraphDeclarationV1 } from "@sothoth/graph/digraph";
import { topologicalWavesV1 } from "@sothoth/graph/waves";
import { compareCodePointOrder, deepFreezeInPlace, findingDraft, finalizeFindings, outcomeOf } from "./index.js";
import type { PlainFindingV1 } from "./index.js";
import {
  IMPLEMENTED_SCHEDULING_DIMENSIONS_V1,
  dependencyConstraintIdV1,
  validatePlanningProblemV1,
} from "./plan-graph.js";
import type {
  CanonicalPlanningFactsV1,
  SchedulingDimensionV1,
  SchedulingProblemV1,
  ValidatedProblemV1,
} from "./plan-graph.js";

/**
 * The single Schedule Solution of one scheduling compilation. It extends the
 * shared, contracts-owned solution shape (solution identity plus waves in
 * the shared `GraphNodeWaveV1` vocabulary) with the digest-bearing envelope:
 * the canonical-bytes digest of the solution record, the digest of the
 * canonical planning facts it derived from (null only when the problem shape
 * never parsed), the folded outcome and diagnostics, the exact satisfied
 * constraint identities, and the compilation's dimension and count summary.
 * On failure the outcome is not `valid`, waves and satisfied identities are
 * empty, and no partial solution exists.
 */
export interface ScheduleSolutionV1 extends ContractScheduleSolutionV1 {
  readonly outcome: CompilationOutcomeKindV1;
  readonly digest: DigestV1;
  readonly sourceFactsDigest: DigestV1 | null;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  readonly satisfiedConstraintIds: readonly string[];
  readonly activeDimensions: readonly SchedulingDimensionV1[];
  readonly taskCount: number;
  readonly dependencyCount: number;
}

/** The wave projection of the one Schedule Solution: never a second truth. */
export interface DependencyWaveProjectionV1 {
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly waves: readonly (readonly GraphNodeWaveV1[])[];
}

/**
 * Every active dimension outside the implemented set fails closed, naming
 * the axis identity exactly.
 */
function unsupportedDimensionFindings(
  activeDimensions: readonly SchedulingDimensionV1[],
): readonly PlainFindingV1[] {
  const findings: PlainFindingV1[] = [];
  for (const dimension of activeDimensions) {
    if (!(IMPLEMENTED_SCHEDULING_DIMENSIONS_V1 as readonly string[]).includes(dimension)) {
      findings.push({ code: "sothoth.planning/unsupported-dimension", subject: dimension });
    }
  }
  return findings;
}

/** The canonical facts digest of one validated problem (facts only, never budgets). */
function sourceFactsDigestOf(facts: CanonicalPlanningFactsV1): string {
  return sha256Digest(
    canonicalJson({ activeDimensions: facts.activeDimensions, tasks: facts.tasks }),
  );
}

/** Builds the ordering-graph declaration: one node per task, one `prerequisite -> dependent` edge per constraint. */
function planGraphDeclarationOf(facts: CanonicalPlanningFactsV1): DirectedMultigraphDeclarationV1 {
  const edges = [];
  for (const entry of facts.tasks) {
    for (const prerequisiteId of entry.dependsOn) {
      const constraintId = dependencyConstraintIdV1(prerequisiteId, entry.taskId);
      edges.push({
        id: constraintId,
        edge: { role: "dependency", fromNodeId: prerequisiteId, toNodeId: entry.taskId },
        sortKey: constraintId,
      });
    }
  }
  return {
    nodes: facts.tasks.map((entry) => ({ node: { id: entry.taskId }, sortKey: entry.taskId })),
    edges,
  };
}

/** The digest-free form of one solution record; the digest is derived over it. */
type SolutionRecordV1 = Omit<ScheduleSolutionV1, "digest">;

/** Runs pre-validation plus the unsupported-dimension fence of the compilation. */
function prevalidate(problem: SchedulingProblemV1): {
  readonly validated: ValidatedProblemV1;
  readonly findings: readonly PlainFindingV1[];
} {
  const validated = validatePlanningProblemV1(problem);
  const active = validated.canonicalFacts?.activeDimensions ?? [];
  return { validated, findings: [...validated.findings, ...unsupportedDimensionFindings(active)] };
}

/**
 * The deterministic topological Wave assignment over the plan graph, through
 * the generic graph package. Input violations fail closed as `invalid-input`
 * with empty waves; a dependency cycle fails closed as `invalid` through the
 * graph package's deterministic cycle witness. The result is the wave
 * projection of the single Schedule Solution — never an independent wave
 * truth.
 */
export function assignDependencyWavesV1(problem: SchedulingProblemV1): DependencyWaveProjectionV1 {
  const { validated, findings } = prevalidate(problem);
  if (findings.length > 0) {
    const diagnostics = finalizeFindings(
      findings.map((finding) => findingDraft(finding.code, finding.subject, "schedule", "input")),
    );
    return { outcome: outcomeOf(diagnostics), diagnostics, waves: [] };
  }
  const facts = validated.canonicalFacts!;
  const graph = createCanonicalGraphV1(planGraphDeclarationOf(facts));
  if (!graph.ok) {
    const diagnostics = finalizeFindings(
      graph.issues.map((issue) =>
        findingDraft("sothoth.planning/dependency-graph-invalid", issue.subject, "schedule", "gates"),
      ),
    );
    return { outcome: outcomeOf(diagnostics), diagnostics, waves: [] };
  }
  const assignment = topologicalWavesV1(graph);
  if (!assignment.ok) {
    const diagnostics = finalizeFindings([
      findingDraft("sothoth.planning/dependency-cycle", assignment.issues[0]?.subject ?? "", "schedule", "gates"),
    ]);
    return { outcome: outcomeOf(diagnostics), diagnostics, waves: [] };
  }
  const waves = assignment.waves.map((wave, index) =>
    wave.map((nodeId) => ({ nodeId, wave: index })),
  );
  return { outcome: "valid", diagnostics: [], waves };
}

/**
 * Compiles the single Schedule Solution of one scheduling compilation: a
 * pure function of the caller's exact planning facts. Identical facts — in
 * any input order — rebuild identical canonical bytes, the same solution
 * digest, and the same satisfied constraint identities; only the dependency
 * dimension is solved, and every other active dimension fails closed. The
 * input is read only and the emitted solution is deeply frozen.
 */
export function compileDependencyScheduleV1(problem: SchedulingProblemV1): ScheduleSolutionV1 {
  const { validated, findings } = prevalidate(problem);
  const activeDimensions = validated.canonicalFacts?.activeDimensions ?? [];

  const failure = (
    diagnostics: readonly StructuredDiagnosticV1[],
  ): ScheduleSolutionV1 => {
    const record: SolutionRecordV1 = {
      solutionIdentity: SCHEDULE_SOLUTION_IDENTITY_V1,
      outcome: outcomeOf(diagnostics),
      sourceFactsDigest:
        validated.canonicalFacts === null ? null : sourceFactsDigestOf(validated.canonicalFacts),
      diagnostics,
      diagnosticCount: diagnostics.length,
      satisfiedConstraintIds: [],
      activeDimensions,
      taskCount: validated.taskCount,
      dependencyCount: validated.dependencyCount,
      waves: [],
    };
    return deepFreezeInPlace({ ...record, digest: sha256Digest(canonicalJson(record)) });
  };

  if (findings.length > 0) {
    const diagnostics = finalizeFindings(
      findings.map((finding) => findingDraft(finding.code, finding.subject, "schedule", "input")),
    );
    return failure(diagnostics);
  }

  const facts = validated.canonicalFacts!;
  const graph = createCanonicalGraphV1(planGraphDeclarationOf(facts));
  if (!graph.ok) {
    const diagnostics = finalizeFindings(
      graph.issues.map((issue) =>
        findingDraft("sothoth.planning/dependency-graph-invalid", issue.subject, "schedule", "gates"),
      ),
    );
    return failure(diagnostics);
  }
  const assignment = topologicalWavesV1(graph);
  if (!assignment.ok) {
    const diagnostics = finalizeFindings([
      findingDraft("sothoth.planning/dependency-cycle", assignment.issues[0]?.subject ?? "", "schedule", "gates"),
    ]);
    return failure(diagnostics);
  }

  const waves = assignment.waves.map((wave, index) =>
    wave.map((nodeId) => ({ nodeId, wave: index })),
  );
  const satisfiedConstraintIds: string[] = [];
  for (const entry of facts.tasks) {
    for (const prerequisiteId of entry.dependsOn) {
      satisfiedConstraintIds.push(dependencyConstraintIdV1(prerequisiteId, entry.taskId));
    }
  }
  satisfiedConstraintIds.sort(compareCodePointOrder);

  const record: SolutionRecordV1 = {
    solutionIdentity: SCHEDULE_SOLUTION_IDENTITY_V1,
    outcome: "valid",
    sourceFactsDigest: sourceFactsDigestOf(facts),
    diagnostics: [],
    diagnosticCount: 0,
    satisfiedConstraintIds,
    activeDimensions,
    taskCount: validated.taskCount,
    dependencyCount: validated.dependencyCount,
    waves,
  };
  return deepFreezeInPlace({ ...record, digest: sha256Digest(canonicalJson(record)) });
}
