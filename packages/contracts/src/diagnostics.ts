/**
 * The Structured Diagnostic contract and the diagnostic code grammar.
 *
 * Public family `@sothoth/contracts/diagnostic`. Diagnostic codes use
 * `<owner>.<domain>/<condition>`: at least two dot-separated lowercase
 * segments before the slash and one lowercase condition after it. Codes omit
 * severity, phase, path, task identity, and package version. The compilation
 * outcome vocabulary and its frozen exit mapping are declared here because
 * every emitting package must produce comparable, deduplicatable records that
 * fold to exactly one process outcome.
 */

import { sortContractIssues } from "./code-point-order.js";
import type { DigestV1, JsonValue } from "./identity.js";
import { validateExactRecordV1 } from "./schema.js";
import type { ContractIssueV1 } from "./schema.js";

/** Matches the diagnostic code grammar `<owner>.<domain>/<condition>`. */
export const DIAGNOSTIC_CODE_PATTERN =
  /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+\/[a-z][a-z0-9-]*$/;

/** A diagnostic code conforming to `DIAGNOSTIC_CODE_PATTERN`. */
export type DiagnosticCodeV1 = string;

/** Type guard for the closed diagnostic code grammar. */
export function isDiagnosticCodeV1(candidate: unknown): candidate is DiagnosticCodeV1 {
  return typeof candidate === "string" && DIAGNOSTIC_CODE_PATTERN.test(candidate);
}

/** The closed verdict set a diagnostic may carry. */
export const DIAGNOSTIC_VERDICTS_V1 = [
  "pass",
  "fail",
  "warning",
  "not-applicable",
  "unresolved",
] as const;

/** A verdict member of `DIAGNOSTIC_VERDICTS_V1`. */
export type DiagnosticVerdictV1 = (typeof DIAGNOSTIC_VERDICTS_V1)[number];

/** The closed severity set a diagnostic may carry. */
export const DIAGNOSTIC_SEVERITIES_V1 = ["error", "warning"] as const;

/** A severity member of `DIAGNOSTIC_SEVERITIES_V1`. */
export type DiagnosticSeverityV1 = (typeof DIAGNOSTIC_SEVERITIES_V1)[number];

/**
 * The closed category set a diagnostic may carry. The three failure classes
 * `input`, `extension`, and `internal` map one-to-one onto the process
 * outcomes `invalid-input`, `extension-error`, and `internal-error`; the rule
 * categories `evidence` and `gates` fold to `invalid` through their verdicts.
 */
export const DIAGNOSTIC_CATEGORIES_V1 = [
  "input",
  "evidence",
  "gates",
  "extension",
  "internal",
] as const;

/** A category member of `DIAGNOSTIC_CATEGORIES_V1`. */
export type DiagnosticCategoryV1 = (typeof DIAGNOSTIC_CATEGORIES_V1)[number];

/** The closed compilation outcome set. */
export const COMPILATION_OUTCOMES_V1 = [
  "valid",
  "invalid",
  "invalid-input",
  "extension-error",
  "internal-error",
] as const;

/** An outcome member of `COMPILATION_OUTCOMES_V1`. */
export type CompilationOutcomeKindV1 = (typeof COMPILATION_OUTCOMES_V1)[number];

/**
 * The frozen outcome-to-exit mapping: `valid` exits 0, `invalid` exits 1,
 * `invalid-input` exits 2, `extension-error` exits 3, and `internal-error`
 * exits 4. No other exit code exists and no extension may override this
 * table. The tuple `COMPILATION_OUTCOMES_V1` is ordered so that its exit-code
 * index yields the outcome name.
 */
export const OUTCOME_EXIT_CODES_V1: Readonly<Record<CompilationOutcomeKindV1, number>> = {
  valid: 0,
  invalid: 1,
  "invalid-input": 2,
  "extension-error": 3,
  "internal-error": 4,
};

/** The single process outcome of one compilation. */
export interface CompilationOutcomeV1 {
  readonly outcome: CompilationOutcomeKindV1;
  readonly exitCode: number;
}

/** A precise source location inside a registered design document. */
export interface DiagnosticLocationV1 {
  readonly path: string;
  readonly sectionId?: string | undefined;
  readonly startLine?: number | undefined;
  readonly endLine?: number | undefined;
}

/**
 * A Structured Diagnostic before finalization. The kernel assigns the
 * deterministic digest; a draft carries every identity field the digest is
 * derived from.
 */
export interface DiagnosticDraftV1 {
  readonly code: DiagnosticCodeV1;
  readonly origin: string;
  readonly category: DiagnosticCategoryV1;
  readonly phase: string;
  readonly verdict: DiagnosticVerdictV1;
  readonly severity: DiagnosticSeverityV1;
  readonly ruleId: string;
  readonly location: DiagnosticLocationV1 | null;
  readonly subjects: readonly string[];
  readonly parameters: Readonly<Record<string, JsonValue>>;
  readonly causes: readonly string[];
  readonly help: readonly string[];
}

/** A finalized Structured Diagnostic bearing its deterministic digest. */
export interface StructuredDiagnosticV1 extends DiagnosticDraftV1 {
  readonly digest: DigestV1;
}

/** The closed field set of a `DiagnosticDraftV1`. */
export const DIAGNOSTIC_DRAFT_FIELDS_V1 = [
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

const DIAGNOSTIC_CATEGORY_SET: ReadonlySet<string> = new Set(DIAGNOSTIC_CATEGORIES_V1);
const DIAGNOSTIC_VERDICT_SET: ReadonlySet<string> = new Set(DIAGNOSTIC_VERDICTS_V1);
const DIAGNOSTIC_SEVERITY_SET: ReadonlySet<string> = new Set(DIAGNOSTIC_SEVERITIES_V1);

/**
 * Validates a Structured Diagnostic draft as a closed object: unknown fields
 * fail closed, missing fields fail closed, and the code grammar plus the
 * verdict, severity, and category enumerations are enforced. Validation never
 * reads property values of unknown fields, so hostile accessors never run.
 */
export function validateDiagnosticDraftV1(candidate: unknown): readonly ContractIssueV1[] {
  const subject = "diagnostic";
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return [{ code: "sothoth.contracts/invalid-diagnostic", subject }];
  }
  const record = candidate as Record<string, unknown>;
  const issues: ContractIssueV1[] = [
    ...validateExactRecordV1(record, DIAGNOSTIC_DRAFT_FIELDS_V1, subject),
  ];
  for (const field of DIAGNOSTIC_DRAFT_FIELDS_V1) {
    if (!(field in record)) {
      issues.push({ code: "sothoth.contracts/missing-field", subject: `${subject}.${field}` });
    }
  }
  if ("code" in record && !isDiagnosticCodeV1(record.code)) {
    issues.push({ code: "sothoth.contracts/invalid-field", subject: `${subject}.code` });
  }
  if ("verdict" in record && !DIAGNOSTIC_VERDICT_SET.has(String(record.verdict))) {
    issues.push({ code: "sothoth.contracts/invalid-field", subject: `${subject}.verdict` });
  }
  if ("severity" in record && !DIAGNOSTIC_SEVERITY_SET.has(String(record.severity))) {
    issues.push({ code: "sothoth.contracts/invalid-field", subject: `${subject}.severity` });
  }
  if ("category" in record && !DIAGNOSTIC_CATEGORY_SET.has(String(record.category))) {
    issues.push({ code: "sothoth.contracts/invalid-field", subject: `${subject}.category` });
  }
  return sortContractIssues(issues);
}
