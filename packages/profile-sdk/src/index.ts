/**
 * Internal shared unit of `@sothoth/profile-sdk`.
 *
 * This module is NOT a public subpath: the accepted Dossier's public-surface
 * declaration lists exactly five public modules —
 * `@sothoth/profile-sdk/conformance`, `/contract-composition`, `/load`,
 * `/recommendations`, and `/relation-roles` — and no root `.` or `./index`
 * entry, so everything here is internal machinery shared by those modules:
 * the single declared profile-diagnostic identity, the Structured Diagnostic
 * draft builder, diagnostic finalization and outcome folding through
 * `@sothoth/core` (`CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`), code-point
 * ordering, the closed-value predicates every validator reuses, and the deep
 * freeze that makes emitted values immutable.
 *
 * The package is a pure conformance boundary: nothing here reads a clock, a
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
import type {
  ConsumerProfileV1,
  ProfileRelationKindV1,
  ProfileRelationRoleV1,
} from "./profile.js";

/**
 * The one observation identity every profile diagnostic carries, exactly as
 * the Dossier declares it: `sothoth.profile-sdk/profile-diagnostic@1`.
 */
export const PROFILE_DIAGNOSTIC_IDENTITY_V1 = "sothoth.profile-sdk/profile-diagnostic@1";

/**
 * The closed phases a profile compilation reports: `load` for shape findings
 * at the caller-value boundary and `conformance` for semantic findings.
 */
export type ProfilePhaseV1 = "load" | "conformance";

/**
 * The phase each validation code reports under. Shape codes (the shared
 * `sothoth.contracts` field vocabulary and the invalid-record code) belong to
 * `load`; every semantic profile code belongs to `conformance`.
 */
const PHASE_BY_CODE: Readonly<Record<string, ProfilePhaseV1>> = {
  "sothoth.profile/invalid-profile": "load",
  "sothoth.contracts/unknown-field": "load",
  "sothoth.contracts/missing-field": "load",
  "sothoth.contracts/invalid-field": "load",
  "sothoth.skills/invalid-catalog": "load",
};

/** The phase one validation code reports under; semantic codes conform. */
export function phaseForCode(code: string): ProfilePhaseV1 {
  return PHASE_BY_CODE[code] ?? "conformance";
}

/**
 * Builds one Structured Diagnostic draft under the declared
 * profile-diagnostic identity. The rule identity is the code; the subject is
 * the exact identity the finding is about (a field path, a reference, or a
 * mapping identity). Consumer-authored help lines from a well-formed profile
 * are merged in by the caller.
 */
export function findingDraft(
  code: string,
  subject: string,
  help: readonly string[] = [],
): DiagnosticDraftV1 {
  return {
    code,
    origin: PROFILE_DIAGNOSTIC_IDENTITY_V1,
    category: "input",
    phase: phaseForCode(code),
    verdict: "fail",
    severity: "error",
    ruleId: code,
    location: null,
    subjects: [subject],
    parameters: {},
    causes: [],
    help: [...help],
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

/** Sorts validation issues by code, then subject, in Unicode code-point order. */
export function sortIssues(issues: readonly ContractIssueV1[]): readonly ContractIssueV1[] {
  return [...issues].sort(
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

/**
 * Canonicalizes one already-validated profile record into a fresh
 * `ConsumerProfileV1`: every array is a fresh copy sorted in Unicode
 * code-point order (references and help lines as strings; mappings by
 * mapping identity; help entries by code; module locks by module identity),
 * so identical facts always canonicalize to identical bytes regardless of
 * the caller's array order. The caller's value is never mutated or aliased.
 */
export function canonicalizeProfileV1(candidate: Record<string, unknown>): ConsumerProfileV1 {
  const sortedStrings = (values: unknown): readonly string[] =>
    [...(values as readonly string[])].sort(compareCodePointOrder);
  const mappings = (candidate.relationRoleMappings as readonly Record<string, unknown>[])
    .map((entry) => ({
      mappingId: entry.mappingId as string,
      mappingRevision: entry.mappingRevision as number,
      relationKind: entry.relationKind as ProfileRelationKindV1,
      assignedRole: entry.assignedRole as ProfileRelationRoleV1,
      explanation: entry.explanation as string,
    }))
    .sort((left, right) => compareCodePointOrder(left.mappingId, right.mappingId));
  const diagnosticHelp = (candidate.diagnosticHelp as readonly Record<string, unknown>[])
    .map((entry) => ({
      code: entry.code as string,
      help: [...(entry.help as readonly string[])].sort(compareCodePointOrder),
    }))
    .sort((left, right) => compareCodePointOrder(left.code, right.code));
  const moduleLocks = (candidate.moduleLocks as readonly Record<string, unknown>[])
    .map((entry) => ({
      moduleId: entry.moduleId as string,
      lockedRevision: entry.lockedRevision as string,
    }))
    .sort((left, right) => compareCodePointOrder(left.moduleId, right.moduleId));
  return {
    schema: candidate.schema as ConsumerProfileV1["schema"],
    profileId: candidate.profileId as string,
    profileRevision: candidate.profileRevision as number,
    documentContracts: sortedStrings(candidate.documentContracts),
    gateMacros: sortedStrings(candidate.gateMacros),
    relationRoleMappings: mappings,
    diagnosticHelp,
    moduleLocks,
  };
}

/**
 * Freezes a profile-sdk-built value tree in place. Called only on values the
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
