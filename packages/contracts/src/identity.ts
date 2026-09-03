/**
 * Canonical identity grammars and exact reference forms for Sothoth.
 *
 * Public family `@sothoth/contracts/identity`. This module declares the
 * JSON-value grammar, the exact reference grammar
 * `<identity>@<positive integer revision>`, and the digest form. It owns types
 * and constants only; it declares no executable behavior. Bare names, `latest`
 * pointers, implicit-current references, and revision `0` are inexpressible
 * under this grammar.
 */

/** The closed JSON-compatible value grammar owned by `@sothoth/contracts`. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** A JSON object with closed string keys. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** A JSON array preserving its declared element order. */
export type JsonArray = readonly JsonValue[];

/**
 * The exact reference grammar declared by the Contracts Dossier. The last `@`
 * separates the identity from a positive integer revision; no other reference
 * spelling is representable at revision 1.
 */
export const EXACT_REFERENCE_GRAMMAR = "<identity>@<positive integer revision>" as const;

/** Matches the exact reference grammar `EXACT_REFERENCE_GRAMMAR`. */
export const EXACT_REFERENCE_PATTERN = /^(.+)@([1-9][0-9]*)$/;

/** The digest form `sha256:` followed by 64 lowercase hex characters. */
export const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** A `sha256:`-prefixed lowercase hex digest conforming to `DIGEST_PATTERN`. */
export type DigestV1 = string;

/** An exact reference split at its final `@` into identity and revision. */
export interface ExactDesignReferenceV1 {
  readonly identity: string;
  readonly revision: number;
}
