/**
 * SHA-256 digesting over canonical bytes.
 *
 * Public module `@sothoth/core/digest`. Digests are `sha256:`-prefixed
 * lowercase hex over the UTF-8 bytes of a raw string or of the canonical JSON
 * serialization of a JSON value. Deterministic Node standard-library
 * cryptography is the only capability used here; it is not an external
 * dependency.
 */

import { createHash } from "node:crypto";
import type { JsonValue } from "@sothoth/contracts";
import { canonicalJson } from "./canonical-json.js";

/**
 * Produces the `sha256:`-prefixed hex digest of a value.
 *
 * A string argument digests the string's UTF-8 bytes directly; any other
 * argument is canonicalized first, so hostile values fail closed through
 * `canonicalJson`.
 */
export function sha256Digest(value: JsonValue | string): string {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}
