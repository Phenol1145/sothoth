/**
 * Unicode code-point ordering and canonical rank for `@sothoth/graph`.
 *
 * Internal responsibility unit of the package: never re-exported from any
 * public subpath. This module owns the single ordering primitive every
 * output derives from — canonical node order, canonical edge order, canonical
 * issue order, and the deterministic topological order — so UTF-16 code-unit
 * ordering, locale collation, and insertion order can never leak into a
 * result.
 */

/**
 * Compares two strings by Unicode code point.
 *
 * Iteration walks code points (a surrogate pair counts once), so an astral
 * character such as U+1F600 sorts after every Basic Multilingual Plane
 * character, including the private-use range that shares its lead-surrogate
 * ordering under naive code-unit comparison. When a common code-point prefix
 * is exhausted, the shorter string orders first; two strings can compare
 * equal only when their code-point sequences are identical.
 */
export function compareCodePointOrder(a: string, b: string): number {
  let aIndex = 0;
  let bIndex = 0;
  while (aIndex < a.length && bIndex < b.length) {
    const aPoint = a.codePointAt(aIndex)!;
    const bPoint = b.codePointAt(bIndex)!;
    if (aPoint !== bPoint) {
      return aPoint - bPoint;
    }
    aIndex += aPoint > 0xffff ? 2 : 1;
    bIndex += bPoint > 0xffff ? 2 : 1;
  }
  return a.length - aIndex - (b.length - bIndex);
}
