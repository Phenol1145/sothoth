/**
 * Diagnostic finalization: ordering, deduplication, and digesting.
 *
 * Public module `@sothoth/core/diagnostics`. Finalization validates every
 * draft against the closed `@sothoth/contracts` diagnostic contract, then
 * consumes the draft only through an accessor-free, identity-preserving
 * data snapshot — every field, and every nested container inside
 * `subjects`, `parameters`, `causes`, `help`, and `location`, is read
 * through own-property descriptors, so a hostile accessor never executes
 * and fails closed instead, and every own data key is defined on the copy
 * with `Object.defineProperty`, so even an own `__proto__` data key is
 * preserved verbatim instead of tripping the inherited prototype setter.
 * On the snapshot, finalization sorts each diagnostic's subjects, causes,
 * and help in Unicode code-point order, assigns the deterministic digest
 * of the canonical record, coalesces duplicates by digest, and orders the
 * result by code, then subjects, then digest. Accessor violations fail
 * closed as `sothoth.input/invalid-diagnostic-draft`; JSON value grammar
 * violations inside a draft's containers — cyclic structures (detected
 * path-scoped, so shared acyclic references stay legal), sparse or
 * decorated arrays, symbol keys, and non-JSON values — fail closed as
 * `sothoth.input/invalid-json-value`, the same code the canonical-JSON
 * gate that owns the JSON grammar would raise. Drafts that violate the
 * contract fail closed instead of being silently coerced.
 */

import { validateDiagnosticDraftV1, DIAGNOSTIC_DRAFT_FIELDS_V1 } from "@sothoth/contracts";
import type { DiagnosticDraftV1, StructuredDiagnosticV1 } from "@sothoth/contracts";
import { canonicalJson, SothothInputError } from "./canonical-json.js";
import { compareCodePointOrder, compareStringArrays } from "./code-point-order.js";
import { sha256Digest } from "./digests.js";

function invalidDraft(reason: string): never {
  throw new SothothInputError("sothoth.input/invalid-diagnostic-draft", reason);
}

function invalidJson(reason: string): never {
  throw new SothothInputError("sothoth.input/invalid-json-value", reason);
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
 * never carries an accessor and never executes one. Every own data key is
 * defined on the copy with `Object.defineProperty`: plain assignment would
 * route an own `__proto__` data key through the inherited prototype setter
 * and silently lose the key. Ancestor tracking is path-scoped — a value on
 * the current recursion path is a cyclic structure and fails closed as
 * such, while a shared acyclic reference reached twice is simply copied
 * twice, preserving the input's canonical bytes. Sparse or decorated arrays
 * and symbol keys are JSON value grammar failures and fail closed here with
 * the canonical-JSON code; non-plain objects pass through untouched for the
 * canonical-JSON gate to reject.
 */
function snapshotValue(value: unknown, ancestors: Set<object>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (ancestors.has(value)) {
    return invalidJson("cyclic structures are not JSON values");
  }
  if (Array.isArray(value)) {
    const indexNames = Object.getOwnPropertyNames(value).filter((name) => name !== "length");
    if (indexNames.length !== value.length || Object.getOwnPropertySymbols(value).length > 0) {
      return invalidJson("sparse arrays and arrays with extra properties are not JSON values");
    }
    ancestors.add(value);
    const copy = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      copy[index] = snapshotValue(ownDataValue(value, String(index)), ancestors);
    }
    ancestors.delete(value);
    return copy;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) {
    return value;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return invalidJson("symbol keys are not JSON values");
  }
  ancestors.add(value);
  const copy: Record<string, unknown> = {};
  for (const name of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor === undefined || !("value" in descriptor)) {
      return invalidDraft(`diagnostic draft property "${name}" is not an own data property`);
    }
    Object.defineProperty(copy, name, {
      value: snapshotValue(descriptor.value, ancestors),
      writable: descriptor.writable === true,
      enumerable: descriptor.enumerable === true,
      configurable: descriptor.configurable === true,
    });
  }
  ancestors.delete(value);
  return copy;
}

/**
 * Snapshots a validated draft into an accessor-free plain record. Validation
 * has already guaranteed the twelve top-level fields are own data
 * properties; the descriptor reads here keep that guarantee local, so
 * ordering, canonicalization, and digesting never touch the hostile object
 * again. Each field is snapshotted along its own fresh ancestor path — a
 * cycle always closes inside one field's reachable graph.
 */
function snapshotDraft(draft: DiagnosticDraftV1): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of DIAGNOSTIC_DRAFT_FIELDS_V1) {
    snapshot[field] = snapshotValue(ownDataValue(draft, field), new Set());
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
 * closed diagnostic contract — including a draft carrying an own accessor
 * on a known field or inside a nested container — and with code
 * `sothoth.input/invalid-json-value` when a nested value breaks the JSON
 * value grammar: a cyclic structure, a sparse or decorated array, a symbol
 * key, or any non-JSON value the canonical-JSON gate rejects. Accessors
 * never execute: they are detected through property descriptors and fail
 * closed.
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
