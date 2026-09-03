import { describe, expect, test } from "vitest";
import * as contractsRoot from "@sothoth/contracts";
import * as contractsIdentity from "../../packages/contracts/src/identity.js";
import * as contractsSchema from "../../packages/contracts/src/schema.js";
import * as contractsDiagnostic from "../../packages/contracts/src/diagnostics.js";
import * as contractsProjection from "../../packages/contracts/src/projection.js";
import * as contractsPreDesign from "../../packages/contracts/src/pre-design.js";
import * as contractsExtension from "../../packages/contracts/src/extensions.js";

const familyModules = [
  contractsIdentity,
  contractsSchema,
  contractsDiagnostic,
  contractsProjection,
  contractsPreDesign,
  contractsExtension,
] as const;

describe("root/family export closure", () => {
  test("the root runtime export set equals the union of the six accepted families", () => {
    const familyUnion = new Set<string>();
    for (const family of familyModules) {
      for (const name of Object.keys(family)) {
        familyUnion.add(name);
      }
    }
    // Guard against a vacuous pass through empty sets on both sides.
    expect(familyUnion.size).toBeGreaterThan(30);

    const rootOnly = Object.keys(contractsRoot).filter((name) => !familyUnion.has(name));
    const familyOnly = [...familyUnion].filter((name) => !(name in contractsRoot));

    expect(rootOnly).toEqual([]);
    expect(familyOnly).toEqual([]);
  });

  test("document and graph contract names are owned by the schema family", () => {
    expect(contractsSchema.SECTION_ID_PATTERN).toBeInstanceOf(RegExp);
    expect(contractsSchema.SECTION_MARKER_PATTERN).toBeInstanceOf(RegExp);
    expect(contractsSchema.SECTION_MARKER_PATTERN.test('<!-- sothoth:section id="purpose" -->')).toBe(
      true,
    );
    expect(contractsSchema.SECTION_MARKER_PATTERN.test("## purpose")).toBe(false);
  });

  test("planning and schedule-solution contract names are owned by the projection family", () => {
    expect(contractsProjection.SCHEDULE_SOLUTION_IDENTITY_V1).toBe(
      "sothoth.planning/schedule-solution@1",
    );
    expect([...contractsProjection.UNSUPPORTED_SCHEDULING_DIMENSIONS_V1]).toEqual([
      "assignment",
      "gate",
      "placement",
      "release-train",
      "resource",
      "time",
    ]);
    expect([...contractsProjection.CHANGE_DISPOSITIONS_V1]).toEqual([
      "revise",
      "revalidate",
      "rebuild",
      "invalidate-evidence",
      "review-required",
      "unchanged",
    ]);
  });
});
