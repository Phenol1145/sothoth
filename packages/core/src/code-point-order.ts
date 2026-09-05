/**
 * Internal Unicode code-point ordering for `@project-sothoth/core`.
 *
 * The Core Dossier pins `stringOrdering: "unicode-code-point"` with
 * `tieBreaking: "canonical-identity-then-code-point"`: canonical JSON keys,
 * diagnostic subjects, and diagnostic ordering all compare by Unicode code
 * point, never by locale collation or UTF-16 code-unit order. This module is
 * internal to the kernel; it is not re-exported from any public module and
 * owns no public callable.
 */

/**
 * Compares two strings by Unicode code point.
 *
 * Iterating via `Array.from` walks code points rather than UTF-16 code units,
 * so astral characters sort after every Basic Multilingual Plane character.
 */
export function compareCodePointOrder(a: string, b: string): number {
  const aPoints = Array.from(a);
  const bPoints = Array.from(b);
  const limit = Math.min(aPoints.length, bPoints.length);
  for (let index = 0; index < limit; index += 1) {
    const left = aPoints[index]!.codePointAt(0)!;
    const right = bPoints[index]!.codePointAt(0)!;
    if (left !== right) {
      return left - right;
    }
  }
  return aPoints.length - bPoints.length;
}

/** Compares two string arrays element-wise, then by length, by code point. */
export function compareStringArrays(a: readonly string[], b: readonly string[]): number {
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index += 1) {
    const ordering = compareCodePointOrder(a[index]!, b[index]!);
    if (ordering !== 0) {
      return ordering;
    }
  }
  return a.length - b.length;
}
