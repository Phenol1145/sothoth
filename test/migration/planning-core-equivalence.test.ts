// Task 7 / Planning — mandatory projection-equivalence proof (plan Step 4;
// Dossier criterion `planning-deterministic-projection`; Controller Ruling E).
// No fixture JSON files exist or may be created: the fixtures below are
// hand-derived inline, and this test proves the new package's Schedule
// Solution is byte-equal with the same projection digest under repeated
// compilation, permuted input orderings, and concurrent runs. The digest is
// recomputed auditor-side from the canonical bytes through the public Core
// digest module, so equality is proven over full records, not selected
// fields. This is implementation evidence only; it claims no acceptance
// authority.

import { describe, expect, test } from "vitest";
import { compileDependencyScheduleV1 } from "../../packages/planning/src/schedule.js";
import type {
  SchedulingProblemV1,
  SchedulingTaskV1,
} from "../../packages/planning/src/plan-graph.js";
import { validatePlanGraphV1 } from "../../packages/planning/src/plan-graph.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

function task(taskId: string, dependsOn: readonly string[] = []): SchedulingTaskV1 {
  return { taskId, dependsOn: [...dependsOn] };
}

// The hand-derived equivalence fixture: an eight-task scheduling problem
// with two independent roots sharing prerequisites, a join, and a tail.
// Hand-derived waves (prerequisite strictly before dependent, intra-wave
// order canonical):
//   wave 0: A
//   wave 1: B, C
//   wave 2: D, E, F
//   wave 3: G
//   wave 4: H
// Hand-derived satisfied constraints (ten, canonical order):
//   dependency:A->B, A->C, B->D, B->E, C->E, C->F, D->G, E->G, F->H, G->H
const FIXTURE_TASKS: readonly SchedulingTaskV1[] = [
  task("A"),
  task("B", ["A"]),
  task("C", ["A"]),
  task("D", ["B"]),
  task("E", ["B", "C"]),
  task("F", ["C"]),
  task("G", ["D", "E"]),
  task("H", ["F", "G"]),
];

const HAND_DERIVED_WAVES: readonly (readonly { nodeId: string; wave: number }[])[] = [
  [{ nodeId: "A", wave: 0 }],
  [
    { nodeId: "B", wave: 1 },
    { nodeId: "C", wave: 1 },
  ],
  [
    { nodeId: "D", wave: 2 },
    { nodeId: "E", wave: 2 },
    { nodeId: "F", wave: 2 },
  ],
  [{ nodeId: "G", wave: 3 }],
  [{ nodeId: "H", wave: 4 }],
];

const HAND_DERIVED_CONSTRAINTS = [
  "dependency:A->B",
  "dependency:A->C",
  "dependency:B->D",
  "dependency:B->E",
  "dependency:C->E",
  "dependency:C->F",
  "dependency:D->G",
  "dependency:E->G",
  "dependency:F->H",
  "dependency:G->H",
];

function problem(tasks: readonly SchedulingTaskV1[]): SchedulingProblemV1 {
  return { tasks: [...tasks] };
}

/** Reverses every dependsOn list too, so permutation reaches inner arrays. */
function withReversedDependencies(tasks: readonly SchedulingTaskV1[]): SchedulingTaskV1[] {
  return tasks.map((entry) => ({ taskId: entry.taskId, dependsOn: [...entry.dependsOn].reverse() }));
}

describe("the hand-derived fixture pins", () => {
  test("the straight-order compilation matches every hand-derived wave and constraint", () => {
    const solution = compileDependencyScheduleV1(problem(FIXTURE_TASKS));
    expect(solution.outcome).toBe("valid");
    expect(solution.waves).toEqual(HAND_DERIVED_WAVES);
    expect(solution.satisfiedConstraintIds).toEqual(HAND_DERIVED_CONSTRAINTS);
    expect(solution.taskCount).toBe(8);
    expect(solution.dependencyCount).toBe(10);
  });
});

describe("planning-deterministic-projection: repeated and permuted inputs", () => {
  test("repeated compilation of identical facts is byte-identical with the same digest", () => {
    const first = compileDependencyScheduleV1(problem(FIXTURE_TASKS));
    const second = compileDependencyScheduleV1(problem(FIXTURE_TASKS));
    const third = compileDependencyScheduleV1(problem(FIXTURE_TASKS));
    const bytes = canonicalJson(first);
    expect(canonicalJson(second)).toBe(bytes);
    expect(canonicalJson(third)).toBe(bytes);
    expect(second.digest).toBe(first.digest);
    expect(third.digest).toBe(first.digest);
    expect(third.sourceFactsDigest).toBe(first.sourceFactsDigest);
  });

  test("the digest is rebuildable from the canonical solution bytes by an auditor", () => {
    const solution = compileDependencyScheduleV1(problem(FIXTURE_TASKS));
    const record = { ...solution };
    delete (record as Partial<typeof record>).digest;
    expect(solution.digest).toBe(sha256Digest(canonicalJson(record)));
  });

  test("permuted task and dependency orderings rebuild identical solution bytes and digests", () => {
    const straight = compileDependencyScheduleV1(problem(FIXTURE_TASKS));

    const permutations: readonly SchedulingTaskV1[][] = [
      [...FIXTURE_TASKS].reverse(),
      withReversedDependencies([...FIXTURE_TASKS].reverse()),
      [FIXTURE_TASKS[3]!, FIXTURE_TASKS[7]!, FIXTURE_TASKS[0]!, FIXTURE_TASKS[5]!, FIXTURE_TASKS[2]!, FIXTURE_TASKS[6]!, FIXTURE_TASKS[1]!, FIXTURE_TASKS[4]!],
      [...FIXTURE_TASKS].sort((left, right) => (left.taskId < right.taskId ? 1 : -1)),
    ];
    for (const [index, tasks] of permutations.entries()) {
      const permuted = compileDependencyScheduleV1(problem(tasks));
      expect(permuted.outcome, `permutation ${index}`).toBe("valid");
      expect(canonicalJson(permuted), `permutation ${index}`).toBe(canonicalJson(straight));
      expect(permuted.digest, `permutation ${index}`).toBe(straight.digest);
      expect(permuted.sourceFactsDigest, `permutation ${index}`).toBe(straight.sourceFactsDigest);
      expect(permuted.waves, `permutation ${index}`).toEqual(HAND_DERIVED_WAVES);
      expect(permuted.satisfiedConstraintIds, `permutation ${index}`).toEqual(HAND_DERIVED_CONSTRAINTS);
    }
  });

  test("the source-facts digest is the canonical facts digest, recomputable by hand", () => {
    const solution = compileDependencyScheduleV1(problem(FIXTURE_TASKS));
    const canonicalFacts = {
      activeDimensions: ["dependency"],
      tasks: [...FIXTURE_TASKS]
        .map((entry) => ({ taskId: entry.taskId, dependsOn: [...entry.dependsOn].sort() }))
        .sort((left, right) => (left.taskId < right.taskId ? -1 : left.taskId > right.taskId ? 1 : 0)),
    };
    expect(solution.sourceFactsDigest).toBe(sha256Digest(canonicalJson(canonicalFacts)));
  });

  test("intra-wave node order and satisfied identities stay canonical under every permutation", () => {
    const reversed = compileDependencyScheduleV1(
      problem(withReversedDependencies([...FIXTURE_TASKS].reverse())),
    );
    for (const wave of reversed.waves) {
      const nodeIds = wave.map((node) => node.nodeId);
      const sorted = [...nodeIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
      expect(nodeIds).toEqual(sorted);
      expect(wave.every((node) => node.wave === wave[0]!.wave)).toBe(true);
    }
    const constraints = [...reversed.satisfiedConstraintIds];
    const sortedConstraints = [...constraints].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    expect(constraints).toEqual(sortedConstraints);
  });

  test("concurrent compilations of the same facts all produce the same bytes and digest", async () => {
    const runs = await Promise.all(
      Array.from({ length: 8 }, () => Promise.resolve().then(() => compileDependencyScheduleV1(problem(FIXTURE_TASKS)))),
    );
    const first = runs[0]!;
    for (const run of runs) {
      expect(canonicalJson(run)).toBe(canonicalJson(first));
      expect(run.digest).toBe(first.digest);
    }
    // A concurrent mix of permuted inputs still agrees on one projection.
    const mixed = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        Promise.resolve().then(() =>
          compileDependencyScheduleV1(
            problem(index % 2 === 0 ? FIXTURE_TASKS : [...FIXTURE_TASKS].reverse()),
          ),
        ),
      ),
    );
    for (const run of mixed) {
      expect(run.digest).toBe(first.digest);
    }
  });

  test("constraint validation is permutation-invariant too", () => {
    const straight = validatePlanGraphV1(problem(FIXTURE_TASKS));
    const permuted = validatePlanGraphV1(
      problem(withReversedDependencies([...FIXTURE_TASKS].reverse())),
    );
    expect(canonicalJson(permuted)).toBe(canonicalJson(straight));
    expect(permuted.satisfiedConstraintIds).toEqual(HAND_DERIVED_CONSTRAINTS);
  });

  test("failing compilations are equally deterministic under permutation", () => {
    const cyclic = [task("A", ["B"]), task("B", ["C"]), task("C", ["A"]), task("D")];
    const first = compileDependencyScheduleV1(problem(cyclic));
    const second = compileDependencyScheduleV1(problem([...cyclic].reverse()));
    expect(first.outcome).toBe("invalid");
    expect(canonicalJson(second)).toBe(canonicalJson(first));
    expect(second.digest).toBe(first.digest);

    const unsupportedStraight = compileDependencyScheduleV1({
      tasks: [task("B", ["A"]), task("A")],
      activeDimensions: ["dependency", "time"],
    });
    const unsupportedReversed = compileDependencyScheduleV1({
      tasks: [task("A"), task("B", ["A"])],
      activeDimensions: ["time", "dependency"],
    });
    expect(unsupportedStraight.outcome).toBe("invalid-input");
    expect(canonicalJson(unsupportedReversed)).toBe(canonicalJson(unsupportedStraight));
    expect(unsupportedReversed.digest).toBe(unsupportedStraight.digest);
  });
});
