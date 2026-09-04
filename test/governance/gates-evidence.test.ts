// Task 6 / Governance Compilation — Gate Macro static expansion and Evidence
// Report validation (plan Step 1). Gate Macros expand deterministically to
// acyclic exact Check References: parameters are bound closed-JSON values,
// references resolve inside the macro library, acyclicity and expansion
// bounds are proven, and embedded shell, JavaScript, or network content
// fails closed — the package never executes a macro. Evidence Checks are
// consumed only as bound result contracts executed externally: the report's
// check-definition and snapshot bindings are validated, and required
// unresolved evidence yields an invalid outcome.

import { describe, expect, test } from "vitest";
import {
  expandGateMacroV1,
  validateEvidenceReportV1,
} from "../../packages/governance/src/gates.js";

function code(result: { diagnostics: ReadonlyArray<{ code: string; subjects: readonly string[] }> }) {
  return result.diagnostics.map((diagnostic) => `${diagnostic.code}|${diagnostic.subjects.join(",")}`);
}

const CHECK_A = { checkId: "sothoth.check/typecheck", checkRevision: 1 };
const CHECK_B = { checkId: "sothoth.check/unit-tests", checkRevision: 2 };
const CHECK_C = { checkId: "sothoth.check/design-scope", checkRevision: 1 };

describe("expandGateMacroV1", () => {
  test("expands a flat macro to its exact check references in canonical order", () => {
    const result = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.standard",
          expandsTo: [CHECK_B, CHECK_A, CHECK_A],
          parameters: { release: "0.1.0" },
        },
      ],
      entryMacroId: "gate.standard",
    });
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.schema).toBe("sothoth.governance/gate-expansion@1");
    expect(result.macroId).toBe("gate.standard");
    expect(result.checkReferences).toEqual([CHECK_A, CHECK_B]);
    expect(result.expandedMacroCount).toBe(1);
  });

  test("inlines macro references recursively and keeps plain check references", () => {
    const result = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.root",
          expandsTo: [{ checkId: "gate.inner", checkRevision: 1 }, CHECK_C],
          parameters: {},
        },
        {
          macroId: "gate.inner",
          expandsTo: [CHECK_A, CHECK_B],
          parameters: {},
        },
      ],
      entryMacroId: "gate.root",
    });
    expect(result.outcome).toBe("valid");
    expect(result.checkReferences).toEqual([CHECK_C, CHECK_A, CHECK_B]);
    expect(result.expandedMacroCount).toBe(2);
  });

  test("a cyclic macro reference fails closed as gate-macro-cycle", () => {
    const result = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.a",
          expandsTo: [{ checkId: "gate.b", checkRevision: 1 }],
          parameters: {},
        },
        {
          macroId: "gate.b",
          expandsTo: [{ checkId: "gate.a", checkRevision: 1 }],
          parameters: {},
        },
      ],
      entryMacroId: "gate.a",
    });
    expect(result.outcome).toBe("invalid");
    expect(result.checkReferences).toEqual([]);
    expect(code(result)).toContain("sothoth.governance/gate-macro-cycle|gate.a");
  });

  test("a self-referencing macro fails closed as gate-macro-cycle", () => {
    const result = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.self",
          expandsTo: [{ checkId: "gate.self", checkRevision: 1 }, CHECK_A],
          parameters: {},
        },
      ],
      entryMacroId: "gate.self",
    });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/gate-macro-cycle|gate.self");
  });

  test("embedded shell operators in any macro string fail closed", () => {
    const result = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.shell",
          expandsTo: [{ checkId: "sothoth.check/ok", checkRevision: 1 }],
          parameters: { command: "rm -rf /; echo done" },
        },
      ],
      entryMacroId: "gate.shell",
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/gate-macro-executable-content|gate.shell");
  });

  test("embedded javascript and network references fail closed", () => {
    const javascript = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.js",
          expandsTo: [{ checkId: "javascript:alert(1)", checkRevision: 1 }],
          parameters: {},
        },
      ],
      entryMacroId: "gate.js",
    });
    expect(javascript.outcome).toBe("invalid-input");
    expect(code(javascript)).toContain(
      "sothoth.governance/gate-macro-executable-content|gate.js",
    );

    const network = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.net",
          expandsTo: [{ checkId: "sothoth.check/ok", checkRevision: 1 }],
          parameters: { fetch: "https://example.invalid/rule.js" },
        },
      ],
      entryMacroId: "gate.net",
    });
    expect(network.outcome).toBe("invalid-input");
    expect(code(network)).toContain("sothoth.governance/gate-macro-executable-content|gate.net");
  });

  test("non-JSON parameter values fail closed as gate-macro-invalid", () => {
    const result = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.dynamic",
          expandsTo: [CHECK_A],
          parameters: { expression: { computed: () => "dynamic" } },
        },
      ],
      entryMacroId: "gate.dynamic",
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/gate-macro-invalid|gate.dynamic:parameters");
  });

  test("an entry macro absent from the library fails closed as gate-macro-unresolved", () => {
    const result = expandGateMacroV1({
      macros: [
        { macroId: "gate.known", expandsTo: [CHECK_A], parameters: {} },
      ],
      entryMacroId: "gate.missing",
    });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/gate-macro-unresolved|gate.missing");
  });

  test("macro shape violations fail closed as gate-macro-invalid", () => {
    const unknownField = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.shape",
          expandsTo: [CHECK_A],
          parameters: {},
          runsOn: "shell",
        },
      ],
      entryMacroId: "gate.shape",
    });
    expect(unknownField.outcome).toBe("invalid-input");
    expect(code(unknownField)).toContain("sothoth.governance/gate-macro-invalid|gate.shape:runsOn");

    const badReference = expandGateMacroV1({
      macros: [
        {
          macroId: "gate.rev",
          expandsTo: [{ checkId: "sothoth.check/ok", checkRevision: 0 }],
          parameters: {},
        },
      ],
      entryMacroId: "gate.rev",
    });
    expect(badReference.outcome).toBe("invalid-input");
    expect(code(badReference)).toContain("sothoth.governance/gate-macro-invalid|gate.rev:expandsTo");
  });

  test("expansion beyond the closed bound fails closed deterministically", () => {
    const macros = [];
    for (let index = 0; index < 1200; index += 1) {
      macros.push({
        macroId: `gate.chain-${index}`,
        expandsTo:
          index === 1199
            ? [CHECK_A]
            : [{ checkId: `gate.chain-${index + 1}`, checkRevision: 1 }],
        parameters: {},
      });
    }
    const result = expandGateMacroV1({ macros, entryMacroId: "gate.chain-0" });
    expect(result.outcome).toBe("invalid-input");
    expect(code(result)).toContain("sothoth.governance/gate-macro-bound-exhausted|gate.chain-0");
  });

  test("expansion is a pure function of the macro library", () => {
    const macros = [
      { macroId: "gate.root", expandsTo: [CHECK_A, CHECK_B], parameters: { k: "v" } },
    ];
    const first = expandGateMacroV1({ macros, entryMacroId: "gate.root" });
    const second = expandGateMacroV1({
      macros: structuredClone(macros),
      entryMacroId: "gate.root",
    });
    expect(first).toEqual(second);
  });
});

describe("validateEvidenceReportV1", () => {
  const DEFINITIONS = [CHECK_A, CHECK_B, CHECK_C];

  test("accepts a bound, snapshot-matching, passing report", () => {
    const result = validateEvidenceReportV1({
      report: {
        checkReference: CHECK_A,
        snapshotIdentity: "sha256:" + "a".repeat(64),
        verdict: "pass",
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.schema).toBe("sothoth.governance/evidence-report-validation@1");
    expect(result.bound).toBe(true);
    expect(result.snapshotBound).toBe(true);
    expect(result.report?.verdict).toBe("pass");
  });

  test("a report whose check reference is not a declared definition fails closed", () => {
    const result = validateEvidenceReportV1({
      report: {
        checkReference: { checkId: "sothoth.check/unknown", checkRevision: 1 },
        snapshotIdentity: "sha256:" + "a".repeat(64),
        verdict: "pass",
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(result.outcome).toBe("invalid");
    expect(result.report).toBeNull();
    expect(code(result)).toContain(
      "sothoth.governance/evidence-check-unbound|sothoth.check/unknown@1",
    );
  });

  test("a snapshot identity that does not bind the expected snapshot fails closed", () => {
    const result = validateEvidenceReportV1({
      report: {
        checkReference: CHECK_B,
        snapshotIdentity: "sha256:" + "b".repeat(64),
        verdict: "pass",
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/evidence-snapshot-mismatch|sothoth.check/unit-tests@2");
  });

  test("required unresolved evidence yields an invalid outcome", () => {
    const result = validateEvidenceReportV1({
      report: {
        checkReference: CHECK_C,
        snapshotIdentity: "sha256:" + "a".repeat(64),
        verdict: "unresolved",
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain(
      "sothoth.governance/evidence-unresolved|sothoth.check/design-scope@1",
    );
    const unresolved = result.diagnostics.find(
      (diagnostic) => diagnostic.code === "sothoth.governance/evidence-unresolved",
    );
    expect(unresolved?.verdict).toBe("unresolved");
    expect(unresolved?.category).toBe("evidence");
  });

  test("optional unresolved evidence stays valid without a finding", () => {
    const result = validateEvidenceReportV1({
      report: {
        checkReference: CHECK_C,
        snapshotIdentity: "sha256:" + "a".repeat(64),
        verdict: "unresolved",
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: false,
    });
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
  });

  test("shape-invalid reports fail as invalid-input", () => {
    const badVerdict = validateEvidenceReportV1({
      report: {
        checkReference: CHECK_A,
        snapshotIdentity: "sha256:" + "a".repeat(64),
        verdict: "probably-fine",
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(badVerdict.outcome).toBe("invalid-input");
    expect(code(badVerdict)).toContain("sothoth.governance/evidence-report-invalid|verdict");

    const unknownField = validateEvidenceReportV1({
      report: {
        checkReference: CHECK_A,
        snapshotIdentity: "sha256:" + "a".repeat(64),
        verdict: "pass",
        exitCode: 0,
      },
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(unknownField.outcome).toBe("invalid-input");
    expect(code(unknownField)).toContain("sothoth.governance/evidence-report-invalid|exitCode");

    const badInput = validateEvidenceReportV1({
      report: null,
      checkDefinitions: DEFINITIONS,
      expectedSnapshotIdentity: "sha256:" + "a".repeat(64),
      required: true,
    });
    expect(badInput.outcome).toBe("invalid-input");
    expect(code(badInput)).toContain("sothoth.governance/evidence-report-invalid|report");
  });
});
