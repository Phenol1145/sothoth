/**
 * Public module `@project-sothoth/selectors/ast`: the closed canonical form of the
 * selector algebra — combinators `all`/`any`/`not`, exact identity terms,
 * normalized path globs, kind/status/owner/tag set terms, explicit
 * reference and traceability terms, diagnostic identity and namespace
 * terms, and the root cardinality bounds. The module is type-only
 * vocabulary: the runtime namespace is empty, the form is produced by
 * `@project-sothoth/selectors/parse`, and every runtime rule lives in the parse and
 * match units. This type-only module adds no callable to the accepted
 * public surface.
 */

/** A closed `{ any: [...] }` membership set over non-empty strings. */
export interface SelectorSetV1 {
  readonly any: readonly string[];
}

/** Exact artifact identity term: matches the canonical artifact identity. */
export interface SelectorArtifactIdTermV1 {
  readonly artifactId: string;
}

/** Normalized POSIX-path glob term: literals, `?`, `*`, whole-segment `**`. */
export interface SelectorPathTermV1 {
  readonly path: string;
}

/** Kind set term. */
export interface SelectorKindTermV1 {
  readonly kind: SelectorSetV1;
}

/** Status set term. */
export interface SelectorStatusTermV1 {
  readonly status: SelectorSetV1;
}

/** Owner set term. */
export interface SelectorOwnerTermV1 {
  readonly owner: SelectorSetV1;
}

/** Tag set term. */
export interface SelectorTagTermV1 {
  readonly tag: SelectorSetV1;
}

/** The closed target shape of one relation term. */
export interface SelectorRelationTargetV1 {
  readonly target: string;
  readonly role?: string | undefined;
}

/** Explicit reference relation term; `role` narrows by the declared role. */
export interface SelectorReferenceTermV1 {
  readonly reference: SelectorRelationTargetV1;
}

/** Explicit traceability relation term. */
export interface SelectorTraceabilityTermV1 {
  readonly traceability: SelectorRelationTargetV1;
}

/** Diagnostic identity term: one declared diagnostic code. */
export interface SelectorDiagnosticTermV1 {
  readonly diagnostic: string;
}

/** Diagnostic namespace term: one declared diagnostic namespace. */
export interface SelectorNamespaceTermV1 {
  readonly namespace: string;
}

/** The `all` combinator: every child must admit the candidate. */
export interface SelectorAllV1 {
  readonly all: readonly SelectorV1[];
}

/** The `any` combinator: at least one child must admit the candidate. */
export interface SelectorAnyV1 {
  readonly any: readonly SelectorV1[];
}

/** The `not` combinator: the child must reject the candidate. */
export interface SelectorNotV1 {
  readonly not: SelectorV1;
}

/**
 * One closed selector term of the canonical form. Boolean groups are never
 * empty, set terms are never empty, and cardinality bounds are legal only
 * beside the root selector key; the runtime rejects every other shape as
 * `sothoth.selectors/invalid-selector` with an exact subject.
 */
export type SelectorV1 =
  | SelectorAllV1
  | SelectorAnyV1
  | SelectorNotV1
  | SelectorArtifactIdTermV1
  | SelectorPathTermV1
  | SelectorKindTermV1
  | SelectorStatusTermV1
  | SelectorOwnerTermV1
  | SelectorTagTermV1
  | SelectorReferenceTermV1
  | SelectorTraceabilityTermV1
  | SelectorDiagnosticTermV1
  | SelectorNamespaceTermV1;

/**
 * The root-only cardinality bounds of a selection declaration. Bounds are
 * non-negative integers with `min <= max`; a negatively expressed bound or
 * otherwise invalid cardinality is a typed parse rejection. An explicitly
 * declared `min: 0` is the opt-out from the default zero-match diagnostic.
 */
export interface SelectorCardinalityV1 {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}
