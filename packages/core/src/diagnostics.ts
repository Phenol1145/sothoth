/**
 * Diagnostic finalization: ordering, deduplication, and digesting.
 *
 * Public module `@sothoth/core/diagnostics`. Finalization validates every
 * draft against the closed `@sothoth/contracts` diagnostic contract, then
 * consumes the draft only through an accessor-free data snapshot — every
 * field, and every nested container inside `subjects`, `parameters`,
 * `causes`, `help`, and `location`, is read through own-property
 * descriptors, so a hostile accessor never executes and fails closed
 * instead. On the snapshot, finalization sorts each diagnostic's subjects,
 * causes, and help in Unicode code-point order, assigns the deterministic
 * digest of the canonical record, coalesces duplicates by digest, and
 * orders the result by code, then subjects, then digest. Drafts that
 * violate the contract fail closed instead of being silently coerced.
 */

import { validateDiagnosticDraftV1, DIAGNOSTIC_DRAFT_FIELDS_V1 } from "@sothoth/contracts";
import type { DiagnosticDraftV1, StructuredDiagnosticV1 } from "@sothoth/contracts";
import { canonicalJson, SothothInputError } from "./canonical-json.js";
import { compareCodePointOrder, compareStringArrays } from "./code-point-order.js";
import { sha256Digest } from "./digests.js";

function invalidDraft(reason: string): never {
  throw new SothothInputError("sothoth.input/invalid-diagnostic-draft", reason);
}

/**
 * Reads one own data property without executing an accessor. A hostile
 * getter is never run: a value-less or missing descriptor fails closed
 * through the diagnostic-draft boundary instead.
 */
function ownDataValue(owner: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    return invalidDraft(`diagnostic draft field "${key}" is not an own data property`);
  }
  return descriptor.value;
}

/**
 * Deep-copies a JSON-shaped value through descriptors only, so the snapshot
 * never carries an accessor and never executes one. Sparse or decorated
 * arrays and symbol-keyed objects fail closed here rather than being
 * silently sanitized; non-plain objects pass through untouched for the
 * canonical-JSON gate to reject.
 */
function snapshotValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    const indexNames = Object.getOwnPropertyNames(value).filter((name) => name !== "length");
    if (indexNames.length !== value.length || Object.getOwnPropertySymbols(value).length > 0) {
      return invalidDraft("diagnostic draft carries a sparse or decorated array");
    }
    const copy = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      copy[index] = snapshotValue(ownDataValue(value, String(index)));
    }
    return copy;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) {
    return value;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return invalidDraft("diagnostic draft carries a symbol-keyed object");
  }
  const copy: Record<string, unknown> = {};
  for (const name of Object.getOwnPropertyNames(value)) {
    copy[name] = snapshotValue(ownDataValue(value, name));
  }
  return copy;
}

/**
 * Snapshots a validated draft into an accessor-free plain record. Validation
 * has already guaranteed the twelve top-level fields are own data
 * properties; the descriptor reads here keep that guarantee local, so
 * ordering, canonicalization, and digesting never touch the hostile object
 * again.
 */
function snapshotDraft(draft: DiagnosticDraftV1): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of DIAGNOSTIC_DRAFT_FIELDS_V1) {
    snapshot[field] = snapshotValue(ownDataValue(draft, field));
  }
  return snapshot;
}

function finalizeDraft(draft: DiagnosticDraftV1): StructuredDiagnosticV1 {
  const snapshotted = snapshotDraft(draft) as unknown as Omit<StructuredDiagnosticV1, "digest">;
  const record: Omit<StructuredDiagnosticV1, "digest"> = {
    ...snapshotted,
    subjects: [...snapshotted.subjects].sort(compareCodePointOrder),
    causes: [...snapshotted.causes].sort(compareCodePointOrder),
    help: [...snapshotted.help].sort(compareCodePointOrder),
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
 * closed diagnostic contract — including a draft carrying an own accessor on
 * a known field or inside a nested container — naming the offending subject
 * paths. Accessors never execute: they are detected through property
 * descriptors and fail closed.
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
