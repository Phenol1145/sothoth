/**
 * Internal Unicode code-point ordering helpers for `@sothoth/contracts`.
 *
 * The Contracts Dossier pins `stringOrdering: "unicode-code-point"` with
 * `tieBreaking: "declared-enumeration-order"`: every ordered list this package
 * emits is ordered by Unicode code point, never by locale collation or UTF-16
 * code-unit comparison. This module is an internal helper of the package; it is
 * deliberately not re-exported from the public root entry and owns no public
 * callable.
 */

import type { ContractIssueV1 } from "./schema.js";

/**
 * Compares two strings by Unicode code point.
 *
 * Comparing via `Array.from` iterates code points rather than UTF-16 code
 * units, so an astral character such as U+1F600 correctly sorts after every
 * Basic Multilingual Plane character, including the private-use range that
 * shares its lead-surrogate ordering under naive code-unit comparison.
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

/** Orders validation issues by code, then subject, in Unicode code-point order. */
export function sortContractIssues(
  issues: readonly ContractIssueV1[],
): readonly ContractIssueV1[] {
  return [...issues].sort((left, right) => {
    const byCode = compareCodePointOrder(left.code, right.code);
    if (byCode !== 0) {
      return byCode;
    }
    return compareCodePointOrder(left.subject, right.subject);
  });
}
