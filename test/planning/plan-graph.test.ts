// Task 7 / Planning — plan graph validation and dependency constraints
// (plan Step 1; hand-derived inline fixtures per Controller Ruling E: no
// fixture JSON files exist or may be created — the PC0/PC1 allusion targets
// a superseded plan). This file owns `validatePlanGraphV1` evidence: the
// closed problem vocabulary, exact-reference dependency validation
// (duplicate tasks, self-dependencies, missing references, duplicate
// constraint declarations), budgets, and the exact satisfied constraint
// identities. Cycles are wave-order failures and belong to the schedule
// compilation, not to constraint validation.

import { describe, expect, test } from "vitest";
import {
  DEFAULT_SCHEDULING_BUDGETS_V1,
  SCHEDULING_DIMENSIONS_V1,
  dependencyConstraintIdV1,
  validatePlanGraphV1,
} from "../../packages/planning/src/plan-graph.js";
import type {
  SchedulingBudgetsV1,
  SchedulingProblemV1,
  SchedulingTaskV1,
} from "../../packages/planning/src/plan-graph.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";

function task(taskId: string, dependsOn: readonly string[] = []): SchedulingTaskV1 {
  return { taskId, dependsOn: [...dependsOn] };
}

function problem(
  tasks: readonly SchedulingTaskV1[],
  activeDimensions?: readonly string[],
  budgets?: SchedulingBudgetsV1,
): SchedulingProblemV1 {
  if (budgets !== undefined) {
    return { tasks: [...tasks], activeDimensions, budgets };
  }
  if (activeDimensions !== undefined) {
    return { tasks: [...tasks], activeDimensions };
  }
  return { tasks: [...tasks] };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

describe("the closed planning problem vocabulary", () => {
  test("the scheduling dimension set is exactly the solved axis plus the six unsupported axes", () => {
    expect([...SCHEDULING_DIMENSIONS_V1]).toEqual([
      "dependency",
      "assignment",
      "gate",
      "placement",
      "release-train",
      "resource",
      "time",
    ]);
  });

  test("a dependency constraint identity is exactly `dependency:<prerequisite>-><dependent>`", () => {
    expect(dependencyConstraintIdV1("A", "B")).toBe("dependency:A->B");
  });

  test("the default budgets are positive integers with no time dimension", () => {
    expect(DEFAULT_SCHEDULING_BUDGETS_V1.maxTasks).toBeGreaterThan(0);
    expect(DEFAULT_SCHEDULING_BUDGETS_V1.maxDependencies).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_SCHEDULING_BUDGETS_V1.maxTasks)).toBe(true);
    expect(Number.isInteger(DEFAULT_SCHEDULING_BUDGETS_V1.maxDependencies)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SCHEDULING_BUDGETS_V1)).toBe(true);
  });
});

describe("validatePlanGraphV1 satisfies exactly the declared dependency constraints", () => {
  test("the plan example validates one dependency between two tasks", () => {
    const validation = validatePlanGraphV1(problem([task("A"), task("B", ["A"])]));
    expect(validation.outcome).toBe("valid");
    expect(validation.diagnostics).toEqual([]);
    expect(validation.diagnosticCount).toBe(0);
    expect(validation.satisfiedConstraintIds).toEqual(["dependency:A->B"]);
    expect(validation.taskCount).toBe(2);
    expect(validation.dependencyCount).toBe(1);
  });

  test("a hand-derived diamond satisfies exactly its four constraints in canonical order", () => {
    const validation = validatePlanGraphV1(
      problem([
        task("D", ["B", "C"]),
        task("C", ["A"]),
        task("A"),
        task("B", ["A"]),
      ]),
    );
    expect(validation.outcome).toBe("valid");
    expect(validation.satisfiedConstraintIds).toEqual([
      "dependency:A->B",
      "dependency:A->C",
      "dependency:B->D",
      "dependency:C->D",
    ]);
  });

  test("an empty plan graph is a valid, constraint-free graph", () => {
    const validation = validatePlanGraphV1(problem([]));
    expect(validation.outcome).toBe("valid");
    expect(validation.satisfiedConstraintIds).toEqual([]);
    expect(validation.taskCount).toBe(0);
    expect(validation.dependencyCount).toBe(0);
  });

  test("a cyclic graph still has resolvable constraints: cycles are wave failures, not constraint failures", () => {
    const validation = validatePlanGraphV1(problem([task("A", ["B"]), task("B", ["A"])]));
    expect(validation.outcome).toBe("valid");
    expect(validation.satisfiedConstraintIds).toEqual(["dependency:A->B", "dependency:B->A"]);
  });
});

describe("validatePlanGraphV1 fails closed on malformed problems", () => {
  test("a non-object problem fails closed", () => {
    const validation = validatePlanGraphV1(null as never);
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "sothoth.planning/problem-invalid",
    ]);
    expect(validation.satisfiedConstraintIds).toEqual([]);
  });

  test("unknown problem fields fail closed", () => {
    const validation = validatePlanGraphV1({ tasks: [], calendar: "2026-09-02" } as never);
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/problem-invalid");
    expect(validation.diagnostics[0]?.subjects).toEqual(["calendar"]);
  });

  test("a task with a non-array dependsOn or an empty taskId fails closed", () => {
    const brokenTask = { taskId: "", dependsOn: "A" } as never;
    const validation = validatePlanGraphV1(problem([brokenTask as unknown as SchedulingTaskV1]));
    expect(validation.outcome).toBe("invalid-input");
    const codes = validation.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes.every((code) => code === "sothoth.planning/problem-invalid")).toBe(true);
    expect(codes.length).toBeGreaterThanOrEqual(2);
  });

  test("an unknown scheduling dimension name fails closed", () => {
    const validation = validatePlanGraphV1(problem([task("A")], ["calendar"]));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/dimension-unknown");
    expect(validation.diagnostics[0]?.subjects).toEqual(["calendar"]);
  });

  test("a declared dimension twice fails closed instead of being deduplicated silently", () => {
    const validation = validatePlanGraphV1(problem([task("A")], ["dependency", "dependency"]));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/problem-invalid");
    expect(validation.diagnostics[0]?.subjects).toEqual(["activeDimensions"]);
  });

  test("an empty dimension declaration names no active dimension and fails closed", () => {
    const validation = validatePlanGraphV1(problem([task("A")], []));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/problem-invalid");
    expect(validation.diagnostics[0]?.subjects).toEqual(["activeDimensions"]);
  });

  test("budgets must be positive integers", () => {
    const validation = validatePlanGraphV1(problem([task("A")], undefined, { maxTasks: 0, maxDependencies: 1 }));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/problem-invalid");
    expect(validation.diagnostics[0]?.subjects).toEqual(["budgets.maxTasks"]);
  });
});

describe("validatePlanGraphV1 fails closed on dependency-constraint violations", () => {
  test("a duplicate task identity fails closed", () => {
    const validation = validatePlanGraphV1(problem([task("A"), task("B"), task("A", ["B"])]));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/task-duplicate");
    expect(validation.diagnostics[0]?.subjects).toEqual(["A"]);
    expect(validation.satisfiedConstraintIds).toEqual([]);
  });

  test("a self-dependency fails closed on its exact constraint identity", () => {
    const validation = validatePlanGraphV1(problem([task("A", ["A"]), task("B", ["A"])]));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/dependency-self");
    expect(validation.diagnostics[0]?.subjects).toEqual(["dependency:A->A"]);
  });

  test("a missing prerequisite reference fails closed on its exact constraint identity", () => {
    const validation = validatePlanGraphV1(problem([task("A"), task("B", ["Z"])]));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/dependency-unresolved");
    expect(validation.diagnostics[0]?.subjects).toEqual(["dependency:Z->B"]);
  });

  test("a dependency declared twice fails closed instead of being collapsed silently", () => {
    const validation = validatePlanGraphV1(problem([task("A"), task("B", ["A", "A"])]));
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/dependency-duplicate");
    expect(validation.diagnostics[0]?.subjects).toEqual(["dependency:A->B"]);
  });

  test("every violation carries the declared schedule-diagnostic identity and its phase", () => {
    const validation = validatePlanGraphV1(problem([task("A", ["A"])]));
    expect(validation.diagnostics[0]?.origin).toBe("sothoth.planning/schedule-diagnostic@1");
    expect(validation.diagnostics[0]?.phase).toBe("plan-graph");
    expect(validation.diagnostics[0]?.category).toBe("input");
    expect(validation.diagnostics[0]?.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("validatePlanGraphV1 enforces the declared budgets", () => {
  test("more tasks than maxTasks exhausts the budget and fails closed", () => {
    const validation = validatePlanGraphV1(
      problem([task("A"), task("B", ["A"])], undefined, { maxTasks: 1, maxDependencies: 10 }),
    );
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/budget-exhausted");
    expect(validation.diagnostics[0]?.subjects).toEqual(["tasks"]);
    expect(validation.satisfiedConstraintIds).toEqual([]);
  });

  test("more dependency declarations than maxDependencies exhausts the budget", () => {
    const validation = validatePlanGraphV1(
      problem([task("A"), task("B", ["A"]), task("C", ["A", "B"])], undefined, {
        maxTasks: 10,
        maxDependencies: 2,
      }),
    );
    expect(validation.outcome).toBe("invalid-input");
    expect(validation.diagnostics[0]?.code).toBe("sothoth.planning/budget-exhausted");
    expect(validation.diagnostics[0]?.subjects).toEqual(["dependencies"]);
  });
});

describe("validatePlanGraphV1 never mutates the caller's planning facts", () => {
  test("a deeply frozen problem validates without any mutation", () => {
    const facts = deepFreeze(
      problem([task("D", ["B", "C"]), task("C", ["A"]), task("B", ["A"]), task("A")]),
    );
    const before = canonicalJson(facts);
    expect(() => validatePlanGraphV1(facts)).not.toThrow();
    const validation = validatePlanGraphV1(facts);
    expect(canonicalJson(facts)).toBe(before);
    expect(validation.outcome).toBe("valid");
  });

  test("a deeply frozen failing problem also stays byte-identical", () => {
    const facts = deepFreeze(problem([task("A"), task("B", ["Z"]), task("B")]));
    const before = canonicalJson(facts);
    const validation = validatePlanGraphV1(facts);
    expect(validation.outcome).toBe("invalid-input");
    expect(canonicalJson(facts)).toBe(before);
  });
});
