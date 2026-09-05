// Task 7 / Planning — the closed scheduling compilation (plan Steps 1 and 3;
// hand-derived inline fixtures per Controller Ruling E). This file owns
// `compileDependencyScheduleV1` and `assignDependencyWavesV1` evidence for
// Dossier criteria `planning-dependency-wave-only` (dependency validation and
// deterministic topological Wave assignment solve, nothing else — every other
// active dimension fails closed as `sothoth.planning/unsupported-dimension`)
// and `planning-single-schedule-solution` (one digest-bearing Schedule
// Solution identity; the wave view is a projection of that same solution, and
// unsupported axes never mint an independent wave truth). Wave literals use
// the shared `GraphNodeWaveV1` vocabulary owned by `@project-sothoth/contracts`.

import { describe, expect, test } from "vitest";
import {
  SCHEDULE_SOLUTION_IDENTITY_V1,
  UNSUPPORTED_SCHEDULING_DIMENSIONS_V1,
} from "@project-sothoth/contracts";
import {
  assignDependencyWavesV1,
  compileDependencyScheduleV1,
} from "../../packages/planning/src/schedule.js";
import type {
  ScheduleSolutionV1,
} from "../../packages/planning/src/schedule.js";
import type {
  SchedulingBudgetsV1,
  SchedulingProblemV1,
  SchedulingTaskV1,
} from "../../packages/planning/src/plan-graph.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

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

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

describe("compileDependencyScheduleV1 emits one solution with dependency and wave projections", () => {
  test("the plan example: A then B, one satisfied dependency constraint", () => {
    const solution = compileDependencyScheduleV1(problem([task("A"), task("B", ["A"])]));
    expect(solution.waves).toEqual([[{ nodeId: "A", wave: 0 }], [{ nodeId: "B", wave: 1 }]]);
    expect(solution.satisfiedConstraintIds).toEqual(["dependency:A->B"]);
    expect(solution.outcome).toBe("valid");
    expect(solution.diagnostics).toEqual([]);
    expect(solution.diagnosticCount).toBe(0);
  });

  test("the solution identity is exactly the shared Schedule Solution identity", () => {
    const solution = compileDependencyScheduleV1(problem([task("A"), task("B", ["A"])]));
    expect(solution.solutionIdentity).toBe(SCHEDULE_SOLUTION_IDENTITY_V1);
    expect(solution.solutionIdentity).toBe("sothoth.planning/schedule-solution@1");
  });

  test("a hand-derived diamond compiles to three canonical waves", () => {
    const solution = compileDependencyScheduleV1(
      problem([task("A"), task("B", ["A"]), task("C", ["A"]), task("D", ["B", "C"])]),
    );
    expect(solution.outcome).toBe("valid");
    expect(solution.waves).toEqual([
      [{ nodeId: "A", wave: 0 }],
      [
        { nodeId: "B", wave: 1 },
        { nodeId: "C", wave: 1 },
      ],
      [{ nodeId: "D", wave: 2 }],
    ]);
    expect(solution.satisfiedConstraintIds).toEqual([
      "dependency:A->B",
      "dependency:A->C",
      "dependency:B->D",
      "dependency:C->D",
    ]);
    expect(solution.taskCount).toBe(4);
    expect(solution.dependencyCount).toBe(4);
  });

  test("intra-wave order is canonical regardless of input order", () => {
    const solution = compileDependencyScheduleV1(
      problem([task("C"), task("B"), task("A", ["B", "C"])]),
    );
    expect(solution.waves).toEqual([
      [
        { nodeId: "B", wave: 0 },
        { nodeId: "C", wave: 0 },
      ],
      [{ nodeId: "A", wave: 1 }],
    ]);
  });

  test("independent tasks share wave 0 and the empty problem compiles to zero waves", () => {
    expect(compileDependencyScheduleV1(problem([task("B"), task("A")])).waves).toEqual([
      [
        { nodeId: "A", wave: 0 },
        { nodeId: "B", wave: 0 },
      ],
    ]);
    const empty = compileDependencyScheduleV1(problem([]));
    expect(empty.outcome).toBe("valid");
    expect(empty.waves).toEqual([]);
    expect(empty.satisfiedConstraintIds).toEqual([]);
  });

  test("the solution is digest-bearing over canonical bytes and records its facts digest", () => {
    const solution = compileDependencyScheduleV1(problem([task("A"), task("B", ["A"])]));
    expect(solution.digest).toMatch(DIGEST_PATTERN);
    expect(solution.sourceFactsDigest).toMatch(DIGEST_PATTERN);
    const record = { ...solution } as Partial<ScheduleSolutionV1>;
    delete record.digest;
    // The digest is the sha256 of the canonical JSON of the record without
    // its digest field, so it is rebuildable by any auditor.
    expect(solution.digest).toBe(sha256Digest(canonicalJson(record)));
    expect(solution.activeDimensions).toEqual(["dependency"]);
  });
});

describe("compileDependencyScheduleV1 fails closed on dependency-order violations", () => {
  test("a two-task cycle fails closed through the deterministic graph witness", () => {
    const solution = compileDependencyScheduleV1(problem([task("A", ["B"]), task("B", ["A"])]));
    expect(solution.outcome).toBe("invalid");
    expect(solution.diagnostics).toHaveLength(1);
    expect(solution.diagnostics[0]?.code).toBe("sothoth.planning/dependency-cycle");
    expect(solution.diagnostics[0]?.subjects).toEqual(["A"]);
    expect(solution.diagnostics[0]?.category).toBe("gates");
    expect(solution.diagnostics[0]?.phase).toBe("schedule");
    expect(solution.waves).toEqual([]);
    expect(solution.satisfiedConstraintIds).toEqual([]);
  });

  test("a longer cycle fails closed even when unrelated tasks are acyclic", () => {
    const solution = compileDependencyScheduleV1(
      problem([
        task("D"),
        task("C", ["A"]),
        task("A", ["B"]),
        task("B", ["C"]),
      ]),
    );
    expect(solution.outcome).toBe("invalid");
    expect(solution.diagnostics[0]?.code).toBe("sothoth.planning/dependency-cycle");
    expect(solution.diagnostics[0]?.subjects).toEqual(["A"]);
    expect(solution.waves).toEqual([]);
  });

  test("a self-dependency fails closed as an input violation before any wave assignment", () => {
    const solution = compileDependencyScheduleV1(problem([task("A", ["A"])]));
    expect(solution.outcome).toBe("invalid-input");
    expect(solution.diagnostics[0]?.code).toBe("sothoth.planning/dependency-self");
    expect(solution.waves).toEqual([]);
  });

  test("duplicate tasks, missing references, and duplicate declarations fail closed", () => {
    expect(
      compileDependencyScheduleV1(problem([task("A"), task("A")])).diagnostics[0]?.code,
    ).toBe("sothoth.planning/task-duplicate");
    expect(
      compileDependencyScheduleV1(problem([task("B", ["Z"])])).diagnostics[0]?.code,
    ).toBe("sothoth.planning/dependency-unresolved");
    expect(
      compileDependencyScheduleV1(problem([task("A"), task("B", ["A", "A"])])).diagnostics[0]?.code,
    ).toBe("sothoth.planning/dependency-duplicate");
    const failed = compileDependencyScheduleV1(problem([task("A"), task("A")]));
    expect(failed.outcome).toBe("invalid-input");
    expect(failed.satisfiedConstraintIds).toEqual([]);
    expect(failed.digest).toMatch(DIGEST_PATTERN);
  });

  test("budget exhaustion fails closed", () => {
    const solution = compileDependencyScheduleV1(
      problem([task("A"), task("B", ["A"])], undefined, { maxTasks: 1, maxDependencies: 1 }),
    );
    expect(solution.outcome).toBe("invalid-input");
    expect(solution.diagnostics[0]?.code).toBe("sothoth.planning/budget-exhausted");
    expect(solution.diagnostics[0]?.subjects).toEqual(["tasks"]);
    expect(solution.waves).toEqual([]);
  });
});

describe("planning-dependency-wave-only: every other active dimension fails closed", () => {
  test.each([...UNSUPPORTED_SCHEDULING_DIMENSIONS_V1])(
    "an active %s dimension is reported unsupported and never solved",
    (dimension) => {
      const solution = compileDependencyScheduleV1(
        problem([task("A"), task("B", ["A"])], ["dependency", dimension]),
      );
      expect(solution.outcome).toBe("invalid-input");
      expect(solution.diagnostics).toHaveLength(1);
      expect(solution.diagnostics[0]?.code).toBe("sothoth.planning/unsupported-dimension");
      expect(solution.diagnostics[0]?.subjects).toEqual([dimension]);
      expect(solution.waves).toEqual([]);
      expect(solution.satisfiedConstraintIds).toEqual([]);
      expect(solution.activeDimensions).toEqual(["dependency", dimension].sort());
    },
  );

  test("an unsupported dimension fails closed even when the dependency graph alone is solvable", () => {
    const solution = compileDependencyScheduleV1(problem([task("A")], ["resource"]));
    expect(solution.outcome).toBe("invalid-input");
    expect(solution.diagnostics[0]?.subjects).toEqual(["resource"]);
    expect(solution.waves).toEqual([]);
  });

  test("the dependency dimension alone stays the solved closed capability", () => {
    const solution = compileDependencyScheduleV1(problem([task("A"), task("B", ["A"])], ["dependency"]));
    expect(solution.outcome).toBe("valid");
    expect(solution.satisfiedConstraintIds).toEqual(["dependency:A->B"]);
  });

  test("an unknown dimension name is an invalid problem, not an unsupported axis", () => {
    const solution = compileDependencyScheduleV1(problem([task("A")], ["calendar"]));
    expect(solution.outcome).toBe("invalid-input");
    expect(solution.diagnostics[0]?.code).toBe("sothoth.planning/dimension-unknown");
    expect(solution.diagnostics[0]?.subjects).toEqual(["calendar"]);
  });
});

describe("planning-single-schedule-solution: waves are a projection of the one solution", () => {
  test("the wave view exposes exactly the solution's waves under the same identity", () => {
    const facts = problem([task("A"), task("B", ["A"]), task("C", ["A"]), task("D", ["B", "C"])]);
    const solution = compileDependencyScheduleV1(facts);
    const waveView = assignDependencyWavesV1(facts);
    expect(waveView.outcome).toBe("valid");
    expect(waveView.diagnostics).toEqual([]);
    expect(waveView.waves).toEqual(solution.waves);
    expect(solution.solutionIdentity).toBe(SCHEDULE_SOLUTION_IDENTITY_V1);
  });

  test("the wave view fails closed on cycles and unsupported axes without minting wave truth", () => {
    const cyclic = assignDependencyWavesV1(problem([task("A", ["B"]), task("B", ["A"])]));
    expect(cyclic.outcome).toBe("invalid");
    expect(cyclic.waves).toEqual([]);
    const unsupported = assignDependencyWavesV1(problem([task("A")], ["time"]));
    expect(unsupported.outcome).toBe("invalid-input");
    expect(unsupported.diagnostics[0]?.code).toBe("sothoth.planning/unsupported-dimension");
    expect(unsupported.waves).toEqual([]);
  });
});

describe("deterministic projection and read-only facts", () => {
  test("repeated and reordered compilations rebuild identical bytes and digests", () => {
    const facts = problem([task("A"), task("B", ["A"]), task("C", ["A"]), task("D", ["C", "B"])]);
    const first = compileDependencyScheduleV1(facts);
    const second = compileDependencyScheduleV1(facts);
    const reversed = compileDependencyScheduleV1(
      problem([task("D", ["C", "B"]), task("C", ["A"]), task("B", ["A"]), task("A")]),
    );
    expect(canonicalJson(second)).toBe(canonicalJson(first));
    expect(second.digest).toBe(first.digest);
    expect(canonicalJson(reversed)).toBe(canonicalJson(first));
    expect(reversed.digest).toBe(first.digest);
    expect(reversed.sourceFactsDigest).toBe(first.sourceFactsDigest);
  });

  test("a deeply frozen problem compiles without mutation, success or failure", () => {
    const okFacts = deepFreeze(problem([task("B", ["A"]), task("A")]));
    const okBefore = canonicalJson(okFacts);
    expect(() => compileDependencyScheduleV1(okFacts)).not.toThrow();
    expect(canonicalJson(okFacts)).toBe(okBefore);

    const badFacts = deepFreeze(problem([task("A", ["A"]), task("B", ["Z"])]));
    const badBefore = canonicalJson(badFacts);
    const failed = compileDependencyScheduleV1(badFacts);
    expect(failed.outcome).toBe("invalid-input");
    expect(canonicalJson(badFacts)).toBe(badBefore);
  });

  test("the compiled solution is deeply frozen immutable output", () => {
    const solution = compileDependencyScheduleV1(problem([task("A"), task("B", ["A"])]));
    expect(Object.isFrozen(solution)).toBe(true);
    expect(Object.isFrozen(solution.waves)).toBe(true);
    expect(Object.isFrozen(solution.waves[0])).toBe(true);
    expect(Object.isFrozen(solution.satisfiedConstraintIds)).toBe(true);
  });
});
