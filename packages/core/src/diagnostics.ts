/**
 * Diagnostic finalization: ordering, deduplication, and digesting.
 *
 * Public module `@sothoth/core/diagnostics`. Finalization validates every
 * draft against the closed `@sothoth/contracts` diagnostic contract, sorts
 * each diagnostic's subjects, causes, and help in Unicode code-point order,
 * assigns the deterministic digest of the canonical record, coalescles
 * duplicates by digest, and orders the result by code, then subjects, then
 * digest. Drafts that violate the contract fail closed instead of being
 * silently coerced.
 */

import { validateDiagnosticDraftV1 } from "@sothoth/contracts";
import type { DiagnosticDraftV1, StructuredDiagnosticV1 } from "@sothoth/contracts";
import { canonicalJson, SothothInputError } from "./canonical-json.js";
import { compareCodePointOrder, compareStringArrays } from "./code-point-order.js";
import { sha256Digest } from "./digests.js";

function finalizeDraft(draft: DiagnosticDraftV1): StructuredDiagnosticV1 {
  const record: Omit<StructuredDiagnosticV1, "digest"> = {
    code: draft.code,
    origin: draft.origin,
    category: draft.category,
    phase: draft.phase,
    verdict: draft.verdict,
    severity: draft.severity,
    ruleId: draft.ruleId,
    location: draft.location,
    subjects: [...draft.subjects].sort(compareCodePointOrder),
    parameters: draft.parameters,
    causes: [...draft.causes].sort(compareCodePointOrder),
    help: [...draft.help].sort(compareCodePointOrder),
  };
  return { ...record, digest: sha256Digest(canonicalJson(record)) };
}

function compareDiagnostics(
  left: StructuredDiagnosticV1,
  right: StructuredDiagnosticV1,
): number {
  const byCode = compareCodePointOrder(left.code, right.code);
  if (byCode !== 0) {
    return byCode;
  }
  const bySubjects = compareStringArrays(left.subjects, right.subjects);
  if (bySubjects !== 0) {
    return bySubjects;
  }
  return compareCodePointOrder(left.digest, right.digest);
}

/**
 * Finalizes drafts into the ordered, deduplicated diagnostic set of one
 * compilation.
 *
 * Throws `SothothInputError` with code
 * `sothoth.input/invalid-diagnostic-draft` when any draft violates the
 * closed diagnostic contract, naming the offending subject paths.
 */
export function finalizeDiagnostics(
  drafts: readonly DiagnosticDraftV1[],
): readonly StructuredDiagnosticV1[] {
  const byDigest = new Map<string, StructuredDiagnosticV1>();
  for (const draft of drafts) {
    const issues = validateDiagnosticDraftV1(draft);
    if (issues.length > 0) {
      const subjects = issues.map((issue) => issue.subject).join(", ");
      throw new SothothInputError(
        "sothoth.input/invalid-diagnostic-draft",
        `diagnostic draft violates the closed contract: ${subjects}`,
      );
    }
    const finalized = finalizeDraft(draft);
    if (!byDigest.has(finalized.digest)) {
      byDigest.set(finalized.digest, finalized);
    }
  }
  return [...byDigest.values()].sort(compareDiagnostics);
}
