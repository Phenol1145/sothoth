import { describe, expect, test } from "vitest";
import {
  aggregateOutcome,
  finalizeDiagnostics,
  SothothInputError,
} from "../../packages/core/src/index.js";
import type { DiagnosticDraftV1 } from "../../packages/contracts/src/index.js";

function draft(overrides: Partial<DiagnosticDraftV1> = {}): DiagnosticDraftV1 {
  return {
    code: "sothoth.evidence/unresolved",
    origin: "@sothoth/core",
    category: "evidence",
    phase: "validation",
    verdict: "unresolved",
    severity: "error",
    ruleId: "required-evidence",
    location: null,
    subjects: ["evidence:test"],
    parameters: {},
    causes: [],
    help: [],
    ...overrides,
  };
}

describe("diagnostic finalization", () => {
  test("assigns the hand-derived digest of the canonical diagnostic record", () => {
    const [diagnostic] = finalizeDiagnostics([draft()]);
    expect(diagnostic?.digest).toBe(
      "sha256:c8207b53cbf76d2de8a733d80514b97262c9775a13e8e10931715309b855e478",
    );
  });

  test("sorts subjects by Unicode code point", () => {
    const [diagnostic] = finalizeDiagnostics([
      draft({ subjects: ["\u{1F600}", "zz", "\uE000", "aa"] }),
    ]);
    expect(diagnostic?.subjects).toEqual(["aa", "zz", "\uE000", "\u{1F600}"]);
  });

  test("coalesces drafts that differ only in array order", () => {
    const finalized = finalizeDiagnostics([
      draft({ subjects: ["z", "a"], causes: ["b", "a"] }),
      draft({ subjects: ["a", "z"], causes: ["a", "b"] }),
    ]);
    expect(finalized).toHaveLength(1);
  });

  test("deduplicates identical diagnostics", () => {
    const finalized = finalizeDiagnostics([draft(), draft(), draft()]);
    expect(finalized).toHaveLength(1);
  });

  test("orders diagnostics by code, then subjects, then digest", () => {
    const finalized = finalizeDiagnostics([
      draft({ code: "sothoth.gates/failed", category: "gates", verdict: "fail" }),
      draft({ code: "sothoth.evidence/unresolved", subjects: ["z"] }),
      draft({ code: "sothoth.evidence/unresolved", subjects: ["a"] }),
    ]);
    expect(finalized.map((entry) => entry.code)).toEqual([
      "sothoth.evidence/unresolved",
      "sothoth.evidence/unresolved",
      "sothoth.gates/failed",
    ]);
    expect(finalized.map((entry) => entry.subjects[0])).toEqual(["a", "z", "evidence:test"]);
  });

  test("is deterministic across input order permutations", () => {
    const first = finalizeDiagnostics([
      draft({ code: "sothoth.a/x", subjects: ["s2"] }),
      draft({ code: "sothoth.a/x", subjects: ["s1"] }),
    ]);
    const second = finalizeDiagnostics([
      draft({ code: "sothoth.a/x", subjects: ["s1"] }),
      draft({ code: "sothoth.a/x", subjects: ["s2"] }),
    ]);
    expect(second.map((entry) => entry.digest)).toEqual(first.map((entry) => entry.digest));
  });

  test("rejects an invalid draft fail closed", () => {
    expect(() => finalizeDiagnostics([draft({ code: "not-a-code" as DiagnosticDraftV1["code"] })]))
      .toThrowError();
    expect(() =>
      finalizeDiagnostics([draft({ verdict: "catastrophe" as DiagnosticDraftV1["verdict"] })]),
    ).toThrowError();
    expect(() => finalizeDiagnostics([{ ...draft(), surprise: true } as DiagnosticDraftV1]))
      .toThrowError();
  });

  test("finalization fails closed on a top-level known-field accessor without executing it", () => {
    let calls = 0;
    const candidate = draft() as Record<string, unknown>;
    Object.defineProperty(candidate, "code", {
      enumerable: true,
      get() {
        calls += 1;
        return "sothoth.evidence/unresolved";
      },
    });

    let thrown: unknown;
    try {
      finalizeDiagnostics([candidate as unknown as DiagnosticDraftV1]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SothothInputError);
    expect(thrown).toHaveProperty("code", "sothoth.input/invalid-diagnostic-draft");
    expect(calls).toBe(0);
  });

  test("finalization fails closed on a nested subjects accessor without executing it", () => {
    let calls = 0;
    const subjects = ["evidence:test"];
    Object.defineProperty(subjects, 0, {
      enumerable: true,
      get() {
        calls += 1;
        return "evidence:test";
      },
    });
    const candidate = draft({ subjects });

    let thrown: unknown;
    try {
      finalizeDiagnostics([candidate]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SothothInputError);
    expect(thrown).toHaveProperty("code", "sothoth.input/invalid-diagnostic-draft");
    expect(calls).toBe(0);
  });

  test("finalization fails closed on a nested parameters accessor without executing it", () => {
    let calls = 0;
    const parameters = { budget: 3 };
    Object.defineProperty(parameters, "budget", {
      enumerable: true,
      get() {
        calls += 1;
        return 3;
      },
    });
    const candidate = draft({ parameters });

    let thrown: unknown;
    try {
      finalizeDiagnostics([candidate]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SothothInputError);
    expect(thrown).toHaveProperty("code", "sothoth.input/invalid-diagnostic-draft");
    expect(calls).toBe(0);
  });
});

describe("outcome aggregation closure", () => {
  test("an empty diagnostic set is valid exit 0", () => {
    expect(aggregateOutcome([])).toEqual({ outcome: "valid", exitCode: 0 });
  });

  test("passing and warning verdicts stay valid exit 0", () => {
    expect(
      aggregateOutcome(finalizeDiagnostics([draft({ verdict: "pass", severity: "warning" })])),
    ).toEqual({ outcome: "valid", exitCode: 0 });
  });

  test("a failed gate is invalid exit 1", () => {
    expect(
      aggregateOutcome(finalizeDiagnostics([draft({ verdict: "fail", category: "gates" })])),
    ).toEqual({ outcome: "invalid", exitCode: 1 });
  });

  test("unresolved required evidence is invalid exit 1", () => {
    expect(aggregateOutcome(finalizeDiagnostics([draft()]))).toEqual({
      outcome: "invalid",
      exitCode: 1,
    });
  });

  test("an input diagnostic is invalid-input exit 2 and outranks gate failure", () => {
    expect(
      aggregateOutcome(
        finalizeDiagnostics([
          draft({ verdict: "fail", category: "gates" }),
          draft({ code: "sothoth.input/invalid-json", category: "input", verdict: "fail" }),
        ]),
      ),
    ).toEqual({ outcome: "invalid-input", exitCode: 2 });
  });

  test("an extension diagnostic is extension-error exit 3 and outranks invalid input", () => {
    expect(
      aggregateOutcome(
        finalizeDiagnostics([
          draft({ verdict: "fail", category: "gates" }),
          draft({ code: "sothoth.input/invalid-json", category: "input", verdict: "fail" }),
          draft({
            code: "sothoth.extension/protocol-violation",
            category: "extension",
            verdict: "fail",
          }),
        ]),
      ),
    ).toEqual({ outcome: "extension-error", exitCode: 3 });
  });

  test("an internal diagnostic is internal-error exit 4 and outranks every other class", () => {
    expect(
      aggregateOutcome(
        finalizeDiagnostics([
          draft({ verdict: "fail", category: "gates" }),
          draft({ code: "sothoth.input/invalid-json", category: "input", verdict: "fail" }),
          draft({
            code: "sothoth.extension/protocol-violation",
            category: "extension",
            verdict: "fail",
          }),
          draft({
            code: "sothoth.internal/budget-exhausted",
            category: "internal",
            verdict: "fail",
          }),
        ]),
      ),
    ).toEqual({ outcome: "internal-error", exitCode: 4 });
  });

  test("aggregates drafts that were not finalized yet", () => {
    expect(aggregateOutcome([draft({ verdict: "pass" })])).toEqual({
      outcome: "valid",
      exitCode: 0,
    });
  });
});
