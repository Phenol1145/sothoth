/**
 * Public module `@sothoth/planning/constraints`: the closed planning-problem
 * vocabulary and dependency-constraint validation
 * (`CONTRACT/SOTHOTH/PLANNING@1`).
 *
 * The caller supplies the exact planning facts: tasks identified by exact
 * string identities, dependency constraints as prerequisite references, and
 * the declared active scheduling dimensions. This module validates those
 * dependency constraints fail-closed — closed field sets, duplicate task
 * identities, self-dependencies, missing prerequisite references, duplicate
 * constraint declarations, and the declared budgets — and returns the exact
 * identities of every satisfied dependency constraint. It reads and rejects;
 * it never repairs, defaults, or writes back any fact. Cycles are not
 * constraint violations: each cyclic constraint is individually resolvable,
 * and the impossible order is detected at wave assignment in
 * `@sothoth/planning/waves` through the generic graph package.
 *
 * Dependency constraint identities are exactly `dependency:<prerequisite>
 * -><dependent>`; satisfied identities, findings, and every canonical order
 * in this package sort in Unicode code-point order.
 */

import type { CompilationOutcomeKindV1, StructuredDiagnosticV1 } from "@sothoth/contracts";
import {
  compareCodePointOrder,
  findingDraft,
  finalizeFindings,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  outcomeOf,
  sortFindings,
  unknownFieldNames,
} from "./index.js";
import type { PlainFindingV1 } from "./index.js";

/**
 * The closed scheduling-dimension vocabulary of `0.1.0`: the solved
 * `dependency` axis plus the six axes that stay explicitly unsupported. The
 * unsupported members mirror `UNSUPPORTED_SCHEDULING_DIMENSIONS_V1` from
 * `@sothoth/contracts`; `workstream` and `organization` remain navigation
 * dimensions and are not scheduling dimensions.
 */
export const SCHEDULING_DIMENSIONS_V1 = [
  "dependency",
  "assignment",
  "gate",
  "placement",
  "release-train",
  "resource",
  "time",
] as const;

/** A member of `SCHEDULING_DIMENSIONS_V1`. */
export type SchedulingDimensionV1 = (typeof SCHEDULING_DIMENSIONS_V1)[number];

/** The only solved scheduling dimensions at `0.1.0`. */
export const IMPLEMENTED_SCHEDULING_DIMENSIONS_V1 = ["dependency"] as const;

/** Deterministic compilation budgets. Positive integers; no time dimension exists. */
export interface SchedulingBudgetsV1 {
  readonly maxTasks: number;
  readonly maxDependencies: number;
}

/** The default budgets every compilation uses when the caller declares none. */
export const DEFAULT_SCHEDULING_BUDGETS_V1: Readonly<SchedulingBudgetsV1> = Object.freeze({
  maxTasks: 10_000,
  maxDependencies: 100_000,
} as const);

/** One caller-supplied task: an exact identity plus its declared prerequisites. */
export interface SchedulingTaskV1 {
  readonly taskId: string;
  readonly dependsOn: readonly string[];
}

/** The exact caller-supplied planning facts one compilation consumes. */
export interface SchedulingProblemV1 {
  readonly tasks: readonly SchedulingTaskV1[];
  readonly activeDimensions?: readonly SchedulingDimensionV1[] | undefined;
  readonly budgets?: SchedulingBudgetsV1 | undefined;
}

/** The exact identity of one dependency constraint: `dependency:<prerequisite>-><dependent>`. */
export function dependencyConstraintIdV1(prerequisiteId: string, dependentId: string): string {
  return `dependency:${prerequisiteId}->${dependentId}`;
}

/** The dependency-constraint validation result of one plan graph. */
export interface PlanGraphValidationV1 {
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  readonly satisfiedConstraintIds: readonly string[];
  readonly taskCount: number;
  readonly dependencyCount: number;
}

/** The canonical, order-independent form of one validated problem's facts. */
export interface CanonicalPlanningFactsV1 {
  /** Tasks sorted by task identity, each with sorted prerequisites. */
  readonly tasks: readonly SchedulingTaskV1[];
  /** The effective active dimensions in canonical order (defaults to dependency-only). */
  readonly activeDimensions: readonly SchedulingDimensionV1[];
  /** The effective budgets (caller-declared or defaults). */
  readonly budgets: SchedulingBudgetsV1;
}

/** The shared internal validation outcome; internal to the package's compilations. */
export interface ValidatedProblemV1 {
  /** True when the problem shape parsed completely (fields, entries, budgets). */
  readonly shapeOk: boolean;
  /** Input-class findings: shape, duplicate, self, unresolved, duplicate-constraint, budget. */
  readonly findings: readonly PlainFindingV1[];
  /** Canonical order-independent facts, or null when the shape did not parse. */
  readonly canonicalFacts: CanonicalPlanningFactsV1 | null;
  /** Declared task count (0 when the task list did not parse). */
  readonly taskCount: number;
  /** Declared dependency-constraint count (0 when not countable). */
  readonly dependencyCount: number;
}

const PROBLEM_FIELDS = ["tasks", "activeDimensions", "budgets"] as const;
const TASK_FIELDS = ["taskId", "dependsOn"] as const;
const BUDGET_FIELDS = ["maxTasks", "maxDependencies"] as const;

const DIMENSION_SET: ReadonlySet<string> = new Set(SCHEDULING_DIMENSIONS_V1);

/** Type guard for the closed scheduling-dimension vocabulary. */
function isSchedulingDimension(value: unknown): value is SchedulingDimensionV1 {
  return typeof value === "string" && DIMENSION_SET.has(value);
}

/**
 * Validates the caller's planning facts fail-closed and derives their
 * canonical, order-independent form. Unknown fields, malformed values,
 * duplicate task identities, self-dependencies, missing prerequisite
 * references, duplicate constraint declarations, and exhausted budgets all
 * produce input-class findings; when the shape does not parse at all, no
 * canonical facts are derived. Semantic checks run only on a fully parsed
 * problem, so findings always describe real declared values. The input is
 * never mutated: canonical facts are fresh copies.
 */
export function validatePlanningProblemV1(problem: unknown): ValidatedProblemV1 {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(problem)) {
    return {
      shapeOk: false,
      findings: [{ code: "sothoth.planning/problem-invalid", subject: "problem" }],
      canonicalFacts: null,
      taskCount: 0,
      dependencyCount: 0,
    };
  }
  for (const field of unknownFieldNames(problem, PROBLEM_FIELDS)) {
    findings.push({ code: "sothoth.planning/problem-invalid", subject: field });
  }

  // Tasks: dense list of closed task entries.
  let entries: SchedulingTaskV1[] | null = null;
  const tasksField = problem.tasks;
  if (!Array.isArray(tasksField)) {
    findings.push({ code: "sothoth.planning/problem-invalid", subject: "tasks" });
  } else {
    const parsed: SchedulingTaskV1[] = [];
    let entriesOk = true;
    for (let index = 0; index < tasksField.length; index += 1) {
      const candidate = tasksField[index];
      if (!isPlainObject(candidate)) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: `tasks[${index}]` });
        entriesOk = false;
        continue;
      }
      for (const field of unknownFieldNames(candidate, TASK_FIELDS)) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: `tasks[${index}].${field}` });
      }
      const taskId = isNonEmptyString(candidate.taskId) ? candidate.taskId : null;
      if (taskId === null) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: `tasks[${index}].taskId` });
      }
      const dependsOn =
        Array.isArray(candidate.dependsOn) && candidate.dependsOn.every(isNonEmptyString)
          ? (candidate.dependsOn as readonly string[])
          : null;
      if (dependsOn === null) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: `tasks[${index}].dependsOn` });
      }
      if (taskId !== null && dependsOn !== null) {
        parsed.push({ taskId, dependsOn: [...dependsOn] });
      } else {
        entriesOk = false;
      }
    }
    entries = entriesOk ? parsed : null;
  }

  // Active dimensions: closed vocabulary, no duplicates, at least the solved
  // axis. An empty declaration names no active dimension and fails closed.
  let activeDimensions: SchedulingDimensionV1[] | null = null;
  if (problem.activeDimensions === undefined) {
    activeDimensions = ["dependency"];
  } else if (!Array.isArray(problem.activeDimensions)) {
    findings.push({ code: "sothoth.planning/problem-invalid", subject: "activeDimensions" });
  } else {
    const dimensions: SchedulingDimensionV1[] = [];
    const seen = new Set<string>();
    for (const candidate of problem.activeDimensions) {
      if (!isSchedulingDimension(candidate)) {
        findings.push({ code: "sothoth.planning/dimension-unknown", subject: String(candidate) });
        continue;
      }
      if (seen.has(candidate)) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: "activeDimensions" });
        continue;
      }
      seen.add(candidate);
      dimensions.push(candidate);
    }
    if (problem.activeDimensions.length === 0) {
      findings.push({ code: "sothoth.planning/problem-invalid", subject: "activeDimensions" });
    }
    activeDimensions = dimensions;
  }

  // Budgets: closed positive-integer shape; defaults when absent.
  let budgets: SchedulingBudgetsV1 = DEFAULT_SCHEDULING_BUDGETS_V1;
  if (problem.budgets !== undefined) {
    const declared = problem.budgets;
    if (!isPlainObject(declared)) {
      findings.push({ code: "sothoth.planning/problem-invalid", subject: "budgets" });
    } else {
      for (const field of unknownFieldNames(declared, BUDGET_FIELDS)) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: `budgets.${field}` });
      }
      if (!isPositiveInteger(declared.maxTasks)) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: "budgets.maxTasks" });
      }
      if (!isPositiveInteger(declared.maxDependencies)) {
        findings.push({ code: "sothoth.planning/problem-invalid", subject: "budgets.maxDependencies" });
      }
      if (isPositiveInteger(declared.maxTasks) && isPositiveInteger(declared.maxDependencies)) {
        budgets = { maxTasks: declared.maxTasks, maxDependencies: declared.maxDependencies };
      }
    }
  }

  const shapeOk = findings.length === 0;
  const taskCount = Array.isArray(tasksField) ? tasksField.length : 0;

  if (!shapeOk || entries === null || activeDimensions === null) {
    return {
      shapeOk: false,
      findings: sortFindings(findings),
      canonicalFacts: null,
      taskCount,
      dependencyCount: 0,
    };
  }

  // Semantic checks over the fully parsed declarations.
  const taskIds = new Set(entries.map((entry) => entry.taskId));
  const seenTasks = new Set<string>();
  for (const entry of entries) {
    if (seenTasks.has(entry.taskId)) {
      findings.push({ code: "sothoth.planning/task-duplicate", subject: entry.taskId });
    }
    seenTasks.add(entry.taskId);
  }
  let dependencyCount = 0;
  const seenConstraints = new Set<string>();
  for (const entry of entries) {
    for (const prerequisiteId of entry.dependsOn) {
      dependencyCount += 1;
      const constraintId = dependencyConstraintIdV1(prerequisiteId, entry.taskId);
      if (prerequisiteId === entry.taskId) {
        findings.push({ code: "sothoth.planning/dependency-self", subject: constraintId });
        continue;
      }
      if (!taskIds.has(prerequisiteId)) {
        findings.push({ code: "sothoth.planning/dependency-unresolved", subject: constraintId });
        continue;
      }
      if (seenConstraints.has(constraintId)) {
        findings.push({ code: "sothoth.planning/dependency-duplicate", subject: constraintId });
      }
      seenConstraints.add(constraintId);
    }
  }

  // Budget enforcement over the exact declared counts.
  if (entries.length > budgets.maxTasks) {
    findings.push({ code: "sothoth.planning/budget-exhausted", subject: "tasks" });
  }
  if (dependencyCount > budgets.maxDependencies) {
    findings.push({ code: "sothoth.planning/budget-exhausted", subject: "dependencies" });
  }

  const canonicalTasks = entries
    .map((entry) => ({ taskId: entry.taskId, dependsOn: [...entry.dependsOn].sort(compareCodePointOrder) }))
    .sort((left, right) => compareCodePointOrder(left.taskId, right.taskId));

  return {
    shapeOk: findings.length === 0,
    findings: sortFindings(findings),
    canonicalFacts: {
      tasks: canonicalTasks,
      activeDimensions: [...activeDimensions].sort(compareCodePointOrder),
      budgets,
    },
    taskCount: entries.length,
    dependencyCount,
  };
}

/** The satisfied constraint identities of canonical facts, in canonical order. */
function satisfiedConstraintIdsOf(facts: CanonicalPlanningFactsV1): readonly string[] {
  const identities: string[] = [];
  for (const entry of facts.tasks) {
    for (const prerequisiteId of entry.dependsOn) {
      identities.push(dependencyConstraintIdV1(prerequisiteId, entry.taskId));
    }
  }
  return identities.sort(compareCodePointOrder);
}

/**
 * Validates the dependency constraints of one plan graph. Every input-class
 * violation fails closed as `invalid-input` with an exact subject and an
 * empty satisfied-identity list; a valid graph returns exactly its satisfied
 * dependency constraint identities in canonical order. The problem is read
 * only; nothing is mutated, repaired, or defaulted.
 */
export function validatePlanGraphV1(problem: SchedulingProblemV1): PlanGraphValidationV1 {
  const validated = validatePlanningProblemV1(problem);
  const diagnostics = finalizeFindings(
    validated.findings.map((finding) =>
      findingDraft(finding.code, finding.subject, "plan-graph", "input"),
    ),
  );
  const satisfied =
    diagnostics.length === 0 && validated.canonicalFacts !== null
      ? satisfiedConstraintIdsOf(validated.canonicalFacts)
      : [];
  return {
    outcome: outcomeOf(diagnostics),
    diagnostics,
    diagnosticCount: diagnostics.length,
    satisfiedConstraintIds: satisfied,
    taskCount: validated.taskCount,
    dependencyCount: validated.dependencyCount,
  };
}
