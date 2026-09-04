/**
 * Internal shared unit of `@sothoth/planning`.
 *
 * This module is NOT a public subpath: the accepted Dossier's public-surface
 * declaration lists exactly four public modules — `@sothoth/planning/
 * constraints`, `/schedule`, `/solution`, and `/waves` — and no root `.` or
 * `./index` entry, so everything here is internal machinery shared by those
 * modules: the single declared schedule-diagnostic identity, the Structured
 * Diagnostic draft builder, diagnostic finalization and outcome folding
 * through `@sothoth/core` (`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`),
 * code-point ordering, the closed-value predicates every validator reuses,
 * and the deep freeze that makes emitted values immutable.
 *
 * The package is a pure scheduling compiler: nothing here reads a clock, a
 * filesystem, the network, or any process state, and nothing writes a Source
 * Fact back. Canonicalization, digesting, diagnostic aggregation, and
 * outcome folding are owned by `@sothoth/core` and are consumed directly,
 * never re-implemented.
 */

import type {
  CompilationOutcomeKindV1,
  ContractIssueV1,
  DiagnosticCategoryV1,
  DiagnosticDraftV1,
  DiagnosticVerdictV1,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
import { finalizeDiagnostics } from "@sothoth/core/diagnostics";
import { aggregateOutcome } from "@sothoth/core/outcome";

/**
 * The one observation identity every planning diagnostic carries, exactly as
 * the Dossier declares it: `sothoth.planning/schedule-diagnostic@1`.
 */
export const SCHEDULE_DIAGNOSTIC_IDENTITY_V1 = "sothoth.planning/schedule-diagnostic@1";

/** The closed phases planning compilations report. */
export type PlanningPhaseV1 = "plan-graph" | "schedule";

/** One internal `{code, subject}` finding before it becomes a structured diagnostic. */
export type PlainFindingV1 = ContractIssueV1;

/** The finding classes a planning compilation distinguishes; both fail closed. */
export type FindingClassV1 = "input" | "gates";

const CATEGORY_BY_CLASS: Readonly<Record<FindingClassV1, DiagnosticCategoryV1>> = {
  input: "input",
  gates: "gates",
};

const VERDICT_BY_CLASS: Readonly<Record<FindingClassV1, DiagnosticVerdictV1>> = {
  input: "fail",
  gates: "fail",
};

/**
 * Builds one Structured Diagnostic draft under the declared
 * schedule-diagnostic identity. The rule identity is the code; the subject is
 * the exact identity the finding is about (a field path, a task identity, or
 * a full constraint identity).
 */
export function findingDraft(
  code: string,
  subject: string,
  phase: PlanningPhaseV1,
  findingClass: FindingClassV1,
): DiagnosticDraftV1 {
  return {
    code,
    origin: SCHEDULE_DIAGNOSTIC_IDENTITY_V1,
    category: CATEGORY_BY_CLASS[findingClass],
    phase,
    verdict: VERDICT_BY_CLASS[findingClass],
    severity: "error",
    ruleId: code,
    location: null,
    subjects: [subject],
    parameters: {},
    causes: [],
    help: [],
  };
}

/** Finalizes drafts into the ordered, deduplicated diagnostic set of one compilation. */
export function finalizeFindings(
  drafts: readonly DiagnosticDraftV1[],
): readonly StructuredDiagnosticV1[] {
  return finalizeDiagnostics(drafts);
}

/** Folds finalized diagnostics into the single outcome through Core's aggregation. */
export function outcomeOf(diagnostics: readonly StructuredDiagnosticV1[]): CompilationOutcomeKindV1 {
  return aggregateOutcome(diagnostics).outcome;
}

/** Compares two strings by Unicode code point (never UTF-16 unit order). */
export function compareCodePointOrder(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

/** Sorts plain findings by code, then subject, in Unicode code-point order. */
export function sortFindings(findings: readonly PlainFindingV1[]): readonly PlainFindingV1[] {
  return [...findings].sort(
    (left, right) =>
      compareCodePointOrder(left.code, right.code) ||
      compareCodePointOrder(String(left.subject), String(right.subject)),
  );
}

/** True for a non-null, non-array object (the closed-value object check). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True for a non-empty string. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** True for a positive integer. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Own key names of `record` outside the closed `allowedFields` set. */
export function unknownFieldNames(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
): readonly string[] {
  const allowed = new Set(allowedFields);
  return Object.keys(record).filter((field) => !allowed.has(field));
}

/**
 * Freezes a planning-built value tree in place. Called only on values the
 * package itself constructed this call; caller input is never frozen or
 * mutated.
 */
export function deepFreezeInPlace<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreezeInPlace((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
