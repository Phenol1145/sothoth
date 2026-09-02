import { describe, expect, test } from "vitest";
import { isDiagnosticCodeV1, validateExactRecordV1 } from "../../packages/contracts/src/index.js";

describe("closed contracts", () => {
  test.each([
    ["sothoth.input/invalid-json", true],
    ["fracta.release-bom/design-ref-missing", true],
    ["Sothoth.input/invalid-json", false],
    ["sothoth/invalid-json", false],
    ["sothoth.input/invalid_json", false],
  ])("validates diagnostic code %s", (candidate, expected) => {
    expect(isDiagnosticCodeV1(candidate)).toBe(expected);
  });

  test("reports unknown fields without reading accessor values", () => {
    let calls = 0;
    const value = { known: 1 } as Record<string, unknown>;
    Object.defineProperty(value, "surprise", {
      enumerable: true,
      get() {
        calls += 1;
        return true;
      },
    });

    expect(validateExactRecordV1(value, ["known"], "fixture")).toEqual([
      { code: "sothoth.contracts/unknown-field", subject: "fixture.surprise" },
    ]);
    expect(calls).toBe(0);
  });
});
