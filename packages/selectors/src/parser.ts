/**
 * Public module `@sothoth/selectors/parse`: turns hostile selector source
 * into the canonical AST or a typed rejection within the hostile-input
 * budget. A selector arrives as declarative data — never as an executable —
 * and compiles once into a canonical, deeply frozen AST: a selector
 * compiled twice from the same source is the identical canonical AST, byte
 * for byte. A rejected selector leaves no half-built AST. Every rejection
 * carries the closed `sothoth.selectors/invalid-selector` code with an
 * exact root-relative subject, no field getter of a hostile object ever
 * executes, and nothing throws outward. The typed Selector terms, the
 * issue shapes, and the zero-match diagnostic identity are expressed in the
 * `CONTRACT/SOTHOTH/SCHEMAS@1` vocabulary of `@sothoth/contracts` (the
 * diagnostic-code grammar is consumed directly, never reimplemented or
 * widened). The shared hostile compiler and the glob matcher live in the
 * package's internal machinery unit.
 */

import type { SelectorV1 } from "./index.js";
import { compileSelectorDataV1 } from "./glob.js";

/** The closed selector issue-code vocabulary. */
export type SelectorIssueCodeV1 =
  | "sothoth.selectors/invalid-selector"
  | "sothoth.selectors/zero-match-diagnostic";

/** One typed selector issue with its exact root-relative subject. */
export interface SelectorIssueV1 {
  readonly code: SelectorIssueCodeV1;
  readonly subject: string;
}

/** The typed rejection envelope of `parseSelectorV1`. */
export type SelectorParseResultV1 =
  | { readonly ok: true; readonly ast: SelectorV1 }
  | { readonly ok: false; readonly issues: readonly SelectorIssueV1[] };

/**
 * Deterministic hostile-input budgets. Positive integers declared per call
 * as data; nothing is read from environment variables, flags, or state.
 */
export interface SelectorBudgetsV1 {
  readonly maxSourceCodeUnits: number;
  readonly maxDepth: number;
  readonly maxPatternCodeUnits: number;
  readonly maxGlobStates: number;
}

/** The frozen default budgets of the engine. */
export const DEFAULT_SELECTOR_BUDGETS_V1: Readonly<SelectorBudgetsV1> = Object.freeze({
  maxSourceCodeUnits: 100_000,
  maxDepth: 64,
  maxPatternCodeUnits: 4_096,
  maxGlobStates: 4_000_000,
} as const);

/** Iterative deep freeze for engine-built plain values (acyclic by construction). */
function deepFreezeValue(root: unknown): void {
  if (root === null || typeof root !== "object") {
    return;
  }
  const stack: object[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    Object.freeze(current);
    for (const name of Object.getOwnPropertyNames(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor === undefined || !("value" in descriptor)) {
        continue;
      }
      const value = descriptor.value;
      if (value !== null && typeof value === "object") {
        stack.push(value as object);
      }
    }
  }
}

/**
 * Parses one hostile selector source into the canonical AST or a typed
 * rejection. Unknown operators, empty boolean groups, invalid cardinality,
 * absolute paths, `..` segments, NUL, and unsupported glob syntax return
 * `sothoth.selectors/invalid-selector` with an exact subject. The result is
 * deeply frozen and shares no mutable reference with the input.
 */
export function parseSelectorV1(
  source: unknown,
  budgets?: SelectorBudgetsV1 | undefined,
): SelectorParseResultV1 {
  const compiled = compileSelectorDataV1(
    source,
    budgets === undefined ? DEFAULT_SELECTOR_BUDGETS_V1 : budgets,
  );
  if (!compiled.ok) {
    return compiled;
  }
  deepFreezeValue(compiled.compiled.ast);
  return { ok: true, ast: compiled.compiled.ast };
}
