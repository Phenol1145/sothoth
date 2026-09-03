/**
 * Outcome aggregation: folding diagnostics into the single process outcome.
 *
 * Public module `@sothoth/core/outcome`. The outcome set and its frozen exit
 * mapping are owned by `@sothoth/contracts`; this module owns the fold. An
 * `internal` diagnostic is a kernel defect and outranks every other class; an
 * `extension` diagnostic normalizes extension misbehavior; an `input`
 * diagnostic outranks rule failure; otherwise a `fail` or `unresolved`
 * verdict on a rule category folds to `invalid`. With no failing or
 * unresolved diagnostic the compilation is `valid` and exits `0`.
 */

import { COMPILATION_OUTCOMES_V1, OUTCOME_EXIT_CODES_V1 } from "@sothoth/contracts";
import type { CompilationOutcomeV1, DiagnosticDraftV1 } from "@sothoth/contracts";

function classExitCode(diagnostic: DiagnosticDraftV1): number {
  switch (diagnostic.category) {
    case "internal":
      return OUTCOME_EXIT_CODES_V1["internal-error"];
    case "extension":
      return OUTCOME_EXIT_CODES_V1["extension-error"];
    case "input":
      return OUTCOME_EXIT_CODES_V1["invalid-input"];
    default:
      return diagnostic.verdict === "fail" || diagnostic.verdict === "unresolved"
        ? OUTCOME_EXIT_CODES_V1.invalid
        : OUTCOME_EXIT_CODES_V1.valid;
  }
}

/**
 * Folds finalized diagnostics — or drafts, which carry the same fields — into
 * exactly one compilation outcome and its exit code.
 */
export function aggregateOutcome(
  diagnostics: readonly DiagnosticDraftV1[],
): CompilationOutcomeV1 {
  let exitCode = OUTCOME_EXIT_CODES_V1.valid;
  for (const diagnostic of diagnostics) {
    const candidate = classExitCode(diagnostic);
    if (candidate > exitCode) {
      exitCode = candidate;
    }
  }
  return { outcome: COMPILATION_OUTCOMES_V1[exitCode]!, exitCode };
}
