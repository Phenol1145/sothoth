/**
 * Public module `@sothoth/governance/gate-macros`: static Gate Macro
 * expansion and Evidence Report validation.
 *
 * A Gate Macro is a declarative template that expands to an acyclic set of
 * exact Check References. Expansion is deterministic and total: parameters
 * are bound closed-JSON values, references resolve inside the supplied
 * macro library, macro references inline recursively with acyclicity and a
 * closed expansion bound proven, and nothing is ever executed — embedded
 * shell operators, JavaScript, or network references fail closed as invalid
 * input before any expansion step runs. Trusted Rule Modules are never
 * discovered, downloaded, or installed here.
 *
 * Evidence Checks run outside this package. `validateEvidenceReportV1`
 * validates a report's check-definition binding and snapshot binding and
 * treats the verdict as data; a required check whose verdict is still
 * `unresolved` yields an invalid outcome. No process is ever started.
 */

import type {
  CompilationOutcomeKindV1,
  EvidenceCheckReferenceV1,
  EvidenceCheckReportV1,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
import { CHECK_VERDICTS_V1 } from "@sothoth/contracts";
import {
  DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
  compareCodePointOrder,
  finalizeFindings,
  findingDraft,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  keysExactly,
  outcomeOf,
  sortFindings,
  unknownFieldNames,
} from "./index.js";
import type { PlainFindingV1 } from "./index.js";

/**
 * The closed expansion bound: the maximum number of macro expansions one
 * compilation may perform. Exceeding it fails closed; the bound is a fixed
 * declared constant, never an environment value.
 */
export const MAX_GATE_MACRO_EXPANSION_STEPS_V1 = 1000;

/**
 * The closed executable-content token list. Any occurrence in any string of
 * a macro — identity, check references, or parameter names and values —
 * fails the whole macro library closed as executable content.
 */
const EXECUTABLE_CONTENT_TOKENS: readonly string[] = [
  ";",
  "|",
  "&",
  "`",
  "$(",
  "${",
  "<",
  ">",
  "javascript:",
  "eval(",
  "require(",
  "import(",
  "process.",
  "function(",
  "=>",
  "http://",
  "https://",
  "ftp://",
  "ws://",
  "wss://",
  "file://",
  "node:",
];

const MACRO_FIELDS = ["macroId", "expandsTo", "parameters"] as const;
const CHECK_REFERENCE_FIELDS = ["checkId", "checkRevision"] as const;
const REPORT_FIELDS = ["checkReference", "snapshotIdentity", "verdict"] as const;

/** The input of one Gate Macro expansion. */
export interface GateMacroExpansionInputV1 {
  /** The macro library under validation; order is insignificant. */
  readonly macros: readonly unknown[];
  /** The identity of the macro to expand. */
  readonly entryMacroId: string;
}

/** The result envelope of one Gate Macro expansion. */
export interface GateExpansionV1 {
  readonly schema: "sothoth.governance/gate-expansion@1";
  readonly phase: "gate-macros";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The expanded entry macro identity. */
  readonly macroId: string;
  /** The expanded exact Check References in canonical order. */
  readonly checkReferences: readonly EvidenceCheckReferenceV1[];
  /** How many distinct macros the expansion visited (0 on failure). */
  readonly expandedMacroCount: number;
}

/** The input of one Evidence Report validation. */
export interface EvidenceReportValidationInputV1 {
  readonly report: unknown;
  /** The declared check definitions the report must bind to. */
  readonly checkDefinitions: readonly EvidenceCheckReferenceV1[];
  /** The snapshot identity the report must have been executed against. */
  readonly expectedSnapshotIdentity: string;
  /** Whether the check's evidence is required for the consuming gate. */
  readonly required: boolean;
}

/** The result envelope of one Evidence Report validation. */
export interface EvidenceReportValidationV1 {
  readonly schema: "sothoth.governance/evidence-report-validation@1";
  readonly phase: "gate-macros";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The validated report value, or null when validation failed. */
  readonly report: EvidenceCheckReportV1 | null;
  /** True when the report's check reference binds a declared definition. */
  readonly bound: boolean;
  /** True when the report's snapshot identity binds the expected snapshot. */
  readonly snapshotBound: boolean;
}

function containsExecutableToken(value: string): boolean {
  return EXECUTABLE_CONTENT_TOKENS.some((token) => value.includes(token));
}

function stringsOfJsonValue(value: unknown, sink: string[]): void {
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) stringsOfJsonValue(entry, sink);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    sink.push(key);
    stringsOfJsonValue(record[key], sink);
  }
}

/** True for a closed JSON value: finite numbers, no functions, dense arrays. */
function isClosedJsonValue(value: unknown, depth: number): boolean {
  if (depth > 64) return false;
  if (value === null) return true;
  switch (typeof value) {
    case "boolean":
    case "string":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      if (Array.isArray(value)) {
        return value.every((entry) => isClosedJsonValue(entry, depth + 1));
      }
      if (!isPlainObject(value)) return false;
      return Object.keys(value).every((key) => isClosedJsonValue((value as Record<string, unknown>)[key], depth + 1));
    default:
      return false;
  }
}

interface ValidatedMacro {
  readonly macroId: string;
  readonly expandsTo: readonly EvidenceCheckReferenceV1[];
  readonly parameters: Readonly<Record<string, unknown>>;
}

function validateMacros(
  macros: readonly unknown[],
): { inputFindings: readonly PlainFindingV1[]; library: ReadonlyMap<string, ValidatedMacro> } {
  const findings: PlainFindingV1[] = [];
  const library = new Map<string, ValidatedMacro>();
  for (const candidate of macros) {
    if (!isPlainObject(candidate)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: "macros" });
      continue;
    }
    const macroId = isNonEmptyString(candidate.macroId) ? candidate.macroId : "macros";
    for (const field of unknownFieldNames(candidate, MACRO_FIELDS)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:${field}` });
    }
    if (!isNonEmptyString(candidate.macroId)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:macroId` });
      continue;
    }
    if (library.has(candidate.macroId)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:duplicate` });
      continue;
    }
    const expandsTo = candidate.expandsTo;
    const references: EvidenceCheckReferenceV1[] = [];
    if (!Array.isArray(expandsTo)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:expandsTo` });
    } else {
      for (const reference of expandsTo) {
        if (
          !isPlainObject(reference) ||
          !keysExactly(reference, CHECK_REFERENCE_FIELDS) ||
          !isNonEmptyString(reference.checkId) ||
          !isPositiveInteger(reference.checkRevision)
        ) {
          findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:expandsTo` });
        } else {
          references.push({ checkId: reference.checkId, checkRevision: reference.checkRevision });
        }
      }
    }
    const parameters = candidate.parameters;
    let validatedParameters: Readonly<Record<string, unknown>> = {};
    if (!isPlainObject(parameters)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:parameters` });
    } else if (!isClosedJsonValue(parameters, 0)) {
      findings.push({ code: "sothoth.governance/gate-macro-invalid", subject: `${macroId}:parameters` });
    } else if (
      stringsOfJsonValueToArray(parameters).some((string) => containsExecutableToken(string)) ||
      containsExecutableToken(candidate.macroId) ||
      references.some((reference) => containsExecutableToken(reference.checkId))
    ) {
      findings.push({ code: "sothoth.governance/gate-macro-executable-content", subject: macroId });
    } else {
      validatedParameters = parameters;
    }
    library.set(candidate.macroId, {
      macroId: candidate.macroId,
      expandsTo: references,
      parameters: validatedParameters,
    });
  }
  return { inputFindings: sortFindings(findings), library };
}

function stringsOfJsonValueToArray(parameters: Readonly<Record<string, unknown>>): string[] {
  const sink: string[] = [];
  stringsOfJsonValue(parameters, sink);
  return sink;
}

function toDiagnostics(
  findings: readonly PlainFindingV1[],
  findingClass: "input" | "gates" | "evidence",
): readonly StructuredDiagnosticV1[] {
  return finalizeFindings(
    findings.map((finding) =>
      findingDraft(
        finding.code,
        finding.subject,
        "gate-macros",
        DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
        findingClass,
      ),
    ),
  );
}

/**
 * Expands one Gate Macro statically over a supplied macro library. A macro
 * reference is an `expandsTo` entry whose `checkId` names another macro of
 * the library; references inline recursively, cycles fail closed as
 * `gate-macro-cycle`, and the closed expansion bound fails closed as
 * `gate-macro-bound-exhausted`. The result is the deduplicated exact Check
 * Reference set in canonical (identity, revision) order.
 */
export function expandGateMacroV1(input: GateMacroExpansionInputV1): GateExpansionV1 {
  const envelope = {
    schema: "sothoth.governance/gate-expansion@1" as const,
    phase: "gate-macros" as const,
  };
  const failure = (findings: readonly PlainFindingV1[], findingClass: "input" | "gates") => {
    const diagnostics = toDiagnostics(findings, findingClass);
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      macroId: input.entryMacroId,
      checkReferences: [],
      expandedMacroCount: 0,
    };
  };

  if (!Array.isArray(input.macros)) {
    return failure([{ code: "sothoth.governance/gate-macro-invalid", subject: "macros" }], "input");
  }
  if (!isNonEmptyString(input.entryMacroId)) {
    return failure([{ code: "sothoth.governance/gate-macro-invalid", subject: "entryMacroId" }], "input");
  }

  const { inputFindings, library } = validateMacros(input.macros);
  if (inputFindings.length > 0) {
    return failure(inputFindings, "input");
  }
  const entry = library.get(input.entryMacroId);
  if (entry === undefined) {
    return failure(
      [{ code: "sothoth.governance/gate-macro-unresolved", subject: input.entryMacroId }],
      "input",
    );
  }

  const collected = new Map<string, EvidenceCheckReferenceV1>();
  const visited = new Set<string>();
  const path = new Set<string>();
  let steps = 0;
  let cycle: string | null = null;
  let exhausted = false;

  const visit = (macro: ValidatedMacro): void => {
    if (cycle !== null || exhausted) return;
    if (path.has(macro.macroId)) {
      cycle = macro.macroId;
      return;
    }
    path.add(macro.macroId);
    visited.add(macro.macroId);
    steps += 1;
    if (steps > MAX_GATE_MACRO_EXPANSION_STEPS_V1) {
      exhausted = true;
      path.delete(macro.macroId);
      return;
    }
    for (const reference of macro.expandsTo) {
      const nested = library.get(reference.checkId);
      if (nested === undefined) {
        collected.set(`${reference.checkId}@${reference.checkRevision}`, reference);
        continue;
      }
      visit(nested);
      if (cycle !== null || exhausted) break;
    }
    path.delete(macro.macroId);
  };

  visit(entry);

  if (cycle !== null) {
    return failure([{ code: "sothoth.governance/gate-macro-cycle", subject: cycle }], "gates");
  }
  if (exhausted) {
    return failure(
      [{ code: "sothoth.governance/gate-macro-bound-exhausted", subject: input.entryMacroId }],
      "input",
    );
  }

  const checkReferences = [...collected.values()].sort(
    (left, right) =>
      compareCodePointOrder(left.checkId, right.checkId) || left.checkRevision - right.checkRevision,
  );
  return {
    ...envelope,
    outcome: "valid",
    diagnostics: [],
    diagnosticCount: 0,
    macroId: entry.macroId,
    checkReferences,
    expandedMacroCount: visited.size,
  };
}

function referenceKey(reference: EvidenceCheckReferenceV1): string {
  return `${reference.checkId}@${reference.checkRevision}`;
}

/**
 * Validates one Evidence Check Report as a bound result contract: the check
 * reference must bind a declared definition exactly, the snapshot identity
 * must bind the expected snapshot, and the verdict must be a member of the
 * closed verdict vocabulary. A required check whose verdict is `unresolved`
 * yields an `invalid` outcome; the package never executes the check itself.
 */
export function validateEvidenceReportV1(input: EvidenceReportValidationInputV1): EvidenceReportValidationV1 {
  const envelope = {
    schema: "sothoth.governance/evidence-report-validation@1" as const,
    phase: "gate-macros" as const,
  };
  const shapeFindings: PlainFindingV1[] = [];
  const report = input.report;

  if (!Array.isArray(input.checkDefinitions)) {
    shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "checkDefinitions" });
  } else {
    const seen = new Set<string>();
    for (const definition of input.checkDefinitions) {
      if (
        !isPlainObject(definition) ||
        !keysExactly(definition, CHECK_REFERENCE_FIELDS) ||
        !isNonEmptyString(definition.checkId) ||
        !isPositiveInteger(definition.checkRevision)
      ) {
        shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "checkDefinitions" });
        continue;
      }
      const key = referenceKey(definition as unknown as EvidenceCheckReferenceV1);
      if (seen.has(key)) {
        shapeFindings.push({
          code: "sothoth.governance/evidence-report-invalid",
          subject: `${key}:duplicate`,
        });
      }
      seen.add(key);
    }
  }
  if (!isNonEmptyString(input.expectedSnapshotIdentity)) {
    shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "expectedSnapshotIdentity" });
  }
  if (typeof input.required !== "boolean") {
    shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "required" });
  }

  let bound = false;
  let snapshotBound = false;
  if (!isPlainObject(report)) {
    shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "report" });
  } else {
    for (const field of unknownFieldNames(report, REPORT_FIELDS)) {
      shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: field });
    }
    const checkReference = report.checkReference;
    if (
      !isPlainObject(checkReference) ||
      !keysExactly(checkReference, CHECK_REFERENCE_FIELDS) ||
      !isNonEmptyString(checkReference.checkId) ||
      !isPositiveInteger(checkReference.checkRevision)
    ) {
      shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "checkReference" });
    } else if (!isNonEmptyString(report.snapshotIdentity)) {
      shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "snapshotIdentity" });
    } else if (
      typeof report.verdict !== "string" ||
      !(CHECK_VERDICTS_V1 as readonly string[]).includes(report.verdict)
    ) {
      shapeFindings.push({ code: "sothoth.governance/evidence-report-invalid", subject: "verdict" });
    }
  }

  if (shapeFindings.length > 0) {
    const diagnostics = toDiagnostics(sortFindings(shapeFindings), "input");
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      report: null,
      bound: false,
      snapshotBound: false,
    };
  }

  const validReport = report as EvidenceCheckReportV1;
  const key = referenceKey(validReport.checkReference);
  const ruleFindings: PlainFindingV1[] = [];
  if (Array.isArray(input.checkDefinitions)) {
    const declared = new Set(
      input.checkDefinitions
        .filter((definition) => isPlainObject(definition) && isNonEmptyString(definition.checkId) && isPositiveInteger(definition.checkRevision))
        .map((definition) => referenceKey(definition as unknown as EvidenceCheckReferenceV1)),
    );
    if (!declared.has(key)) {
      ruleFindings.push({ code: "sothoth.governance/evidence-check-unbound", subject: key });
    } else {
      bound = true;
    }
  }
  if (validReport.snapshotIdentity === input.expectedSnapshotIdentity) {
    snapshotBound = true;
  } else {
    ruleFindings.push({ code: "sothoth.governance/evidence-snapshot-mismatch", subject: key });
  }
  const unresolved = validReport.verdict === "unresolved";
  if (unresolved && input.required) {
    ruleFindings.push({ code: "sothoth.governance/evidence-unresolved", subject: key });
  }

  if (ruleFindings.length > 0) {
    const diagnostics = toDiagnostics(ruleFindings, unresolved ? "evidence" : "gates");
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      report: null,
      bound,
      snapshotBound,
    };
  }

  return {
    ...envelope,
    outcome: "valid",
    diagnostics: [],
    diagnosticCount: 0,
    report: validReport,
    bound: true,
    snapshotBound: true,
  };
}
