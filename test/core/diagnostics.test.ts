import { describe, expect, test } from "vitest";
import { aggregateOutcome, finalizeDiagnostics } from "../../packages/core/src/index.js";
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

describe("structured diagnostics", () => {
  test("sorts subjects and assigns a deterministic digest", () => {
    const [diagnostic] = finalizeDiagnostics([draft({ subjects: ["z", "a"] })]);
    expect(diagnostic?.subjects).toEqual(["a", "z"]);
    expect(diagnostic?.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(finalizeDiagnostics([draft({ subjects: ["a", "z"] })])[0]?.digest).toBe(diagnostic?.digest);
  });

  test("maps unresolved required evidence to invalid exit 1", () => {
    expect(aggregateOutcome(finalizeDiagnostics([draft()]))).toEqual({ outcome: "invalid", exitCode: 1 });
  });

  test("gives invalid input precedence over a gate failure", () => {
    const diagnostics = finalizeDiagnostics([
      draft({ verdict: "fail", code: "sothoth.gates/failed" }),
      draft({ verdict: "fail", code: "sothoth.input/invalid-json", category: "input" }),
    ]);
    expect(aggregateOutcome(diagnostics)).toEqual({ outcome: "invalid-input", exitCode: 2 });
  });
});
