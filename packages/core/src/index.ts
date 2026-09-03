/**
 * `@sothoth/core` public root entry.
 *
 * Aggregates the accepted public modules — `canonical-json`, `digest`,
 * `compile`, `diagnostics`, and `outcome`. The root re-export adds no name
 * and no behavior that the modules do not already declare.
 */

export * from "./canonical-json.js";
export * from "./digests.js";
export * from "./diagnostics.js";
export * from "./outcome.js";
