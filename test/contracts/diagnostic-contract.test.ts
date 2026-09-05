import { describe, expect, test } from "vitest";
import {
  COMPILATION_OUTCOMES_V1,
  DIAGNOSTIC_CATEGORIES_V1,
  DIAGNOSTIC_SEVERITIES_V1,
  DIAGNOSTIC_VERDICTS_V1,
  isDiagnosticCodeV1,
  OUTCOME_EXIT_CODES_V1,
  validateDiagnosticDraftV1,
} from "../../packages/contracts/src/index.js";
import type { DiagnosticDraftV1 } from "../../packages/contracts/src/index.js";

function draft(overrides: Partial<DiagnosticDraftV1> = {}): DiagnosticDraftV1 {
  return {
    code: "sothoth.evidence/unresolved",
    origin: "@project-sothoth/core",
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

describe("diagnostic code grammar", () => {
  test.each([
    ["sothoth.input/invalid-json", true],
    ["sothoth.evidence/unresolved", true],
    ["fracta.release-bom/design-ref-missing", true],
    ["sothoth.a.b.c/condition", true],
    ["a.b/c", true],
    ["Sothoth.input/invalid-json", false],
    ["sothoth/invalid-json", false],
    ["sothoth.input/invalid_json", false],
    ["sothoth.input/", false],
    ["/invalid-json", false],
    ["sothoth.input/A-condition", false],
    ["2sothoth.input/invalid-json", false],
  ])("validates diagnostic code %s", (candidate, expected) => {
    expect(isDiagnosticCodeV1(candidate)).toBe(expected);
  });

  test("rejects non-string candidates without throwing", () => {
    expect(isDiagnosticCodeV1(123)).toBe(false);
    expect(isDiagnosticCodeV1(null)).toBe(false);
    expect(isDiagnosticCodeV1(undefined)).toBe(false);
    expect(isDiagnosticCodeV1({ code: "sothoth.input/invalid-json" })).toBe(false);
  });
});

describe("closed diagnostic vocabulary", () => {
  test("declares the closed verdict set", () => {
    expect([...DIAGNOSTIC_VERDICTS_V1]).toEqual([
      "pass",
      "fail",
      "warning",
      "not-applicable",
      "unresolved",
    ]);
  });

  test("declares the closed severity set", () => {
    expect([...DIAGNOSTIC_SEVERITIES_V1]).toEqual(["error", "warning"]);
  });

  test("declares the closed category set", () => {
    expect([...DIAGNOSTIC_CATEGORIES_V1]).toEqual([
      "input",
      "evidence",
      "gates",
      "extension",
      "internal",
    ]);
  });

  test("declares the closed outcome-to-exit mapping 0 through 4", () => {
    expect({ ...OUTCOME_EXIT_CODES_V1 }).toEqual({
      valid: 0,
      invalid: 1,
      "invalid-input": 2,
      "extension-error": 3,
      "internal-error": 4,
    });
    expect([...COMPILATION_OUTCOMES_V1]).toEqual([
      "valid",
      "invalid",
      "invalid-input",
      "extension-error",
      "internal-error",
    ]);
  });
});

describe("diagnostic draft closure", () => {
  test("accepts a well-formed draft", () => {
    expect(validateDiagnosticDraftV1(draft())).toEqual([]);
  });

  test("fails closed on unknown draft fields without reading accessor values", () => {
    let calls = 0;
    const candidate = draft() as Record<string, unknown>;
    Object.defineProperty(candidate, "surprise", {
      enumerable: true,
      get() {
        calls += 1;
        return true;
      },
    });

    expect(validateDiagnosticDraftV1(candidate)).toEqual([
      { code: "sothoth.contracts/unknown-field", subject: "diagnostic.surprise" },
    ]);
    expect(calls).toBe(0);
  });

  test("fails closed on grammar and enumeration violations", () => {
    expect(validateDiagnosticDraftV1(draft({ code: "sothoth.input" as DiagnosticDraftV1["code"] })))
      .toContainEqual({ code: "sothoth.contracts/invalid-field", subject: "diagnostic.code" });
    expect(
      validateDiagnosticDraftV1(draft({ verdict: "maybe" as DiagnosticDraftV1["verdict"] })),
    ).toContainEqual({ code: "sothoth.contracts/invalid-field", subject: "diagnostic.verdict" });
    expect(
      validateDiagnosticDraftV1(draft({ severity: "fatal" as DiagnosticDraftV1["severity"] })),
    ).toContainEqual({ code: "sothoth.contracts/invalid-field", subject: "diagnostic.severity" });
    expect(
      validateDiagnosticDraftV1(draft({ category: "style" as DiagnosticDraftV1["category"] })),
    ).toContainEqual({ code: "sothoth.contracts/invalid-field", subject: "diagnostic.category" });
  });

  test("fails closed on missing required fields", () => {
    const candidate = draft() as Record<string, unknown>;
    delete candidate.ruleId;
    expect(validateDiagnosticDraftV1(candidate)).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "diagnostic.ruleId",
    });
  });

  const DRAFT_KNOWN_FIELDS = [
    "code",
    "origin",
    "category",
    "phase",
    "verdict",
    "severity",
    "ruleId",
    "location",
    "subjects",
    "parameters",
    "causes",
    "help",
  ] as const;

  test.each(DRAFT_KNOWN_FIELDS)("fails closed on a %s accessor without executing it", (field) => {
    let calls = 0;
    const validValue = (draft() as Record<string, unknown>)[field];
    const candidate = draft() as Record<string, unknown>;
    Object.defineProperty(candidate, field, {
      enumerable: true,
      get() {
        calls += 1;
        return validValue;
      },
    });

    expect(validateDiagnosticDraftV1(candidate)).toEqual([
      { code: "sothoth.contracts/invalid-field", subject: `diagnostic.${field}` },
    ]);
    expect(calls).toBe(0);
  });

  test("never string-coerces verdict, severity, or category values", () => {
    let coercionCalls = 0;
    const coercibleVerdict = {
      toString() {
        coercionCalls += 1;
        return "fail";
      },
    };

    expect(
      validateDiagnosticDraftV1(
        draft({ verdict: coercibleVerdict as unknown as DiagnosticDraftV1["verdict"] }),
      ),
    ).toEqual([{ code: "sothoth.contracts/invalid-field", subject: "diagnostic.verdict" }]);
    expect(
      validateDiagnosticDraftV1(
        draft({ severity: { toString: () => "error" } as unknown as DiagnosticDraftV1["severity"] }),
      ),
    ).toEqual([{ code: "sothoth.contracts/invalid-field", subject: "diagnostic.severity" }]);
    expect(
      validateDiagnosticDraftV1(
        draft({ category: { toString: () => "input" } as unknown as DiagnosticDraftV1["category"] }),
      ),
    ).toEqual([{ code: "sothoth.contracts/invalid-field", subject: "diagnostic.category" }]);
    expect(coercionCalls).toBe(0);
  });

  test("inherited known fields do not count as present own fields", () => {
    const candidate: Record<string, unknown> = Object.create(draft());

    const issues = validateDiagnosticDraftV1(candidate);
    expect(issues).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "diagnostic.code",
    });
    expect(issues).toContainEqual({
      code: "sothoth.contracts/missing-field",
      subject: "diagnostic.help",
    });
  });

  test("rejects non-object candidates", () => {
    expect(validateDiagnosticDraftV1(null)).toContainEqual({
      code: "sothoth.contracts/invalid-diagnostic",
      subject: "diagnostic",
    });
    expect(validateDiagnosticDraftV1("sothoth.input/invalid-json")).toContainEqual({
      code: "sothoth.contracts/invalid-diagnostic",
      subject: "diagnostic",
    });
  });
});
