/**
 * `@sothoth/contracts` public root entry.
 *
 * Aggregates the accepted public families — `identity`, `schema`,
 * `diagnostic`, `projection`, `pre-design`, and `extension` — plus the
 * document, graph, and planning contract families they close over. The root
 * re-export adds no name and no behavior that the families do not already
 * declare.
 */

export * from "./identity.js";
export * from "./schema.js";
export * from "./diagnostics.js";
export * from "./documents.js";
export * from "./projection.js";
export * from "./pre-design.js";
export * from "./graphs.js";
export * from "./planning.js";
export * from "./extensions.js";
