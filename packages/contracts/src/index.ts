/**
 * `@sothoth/contracts` public root entry.
 *
 * Aggregates exactly the six accepted public families — `identity`,
 * `schema`, `diagnostic`, `projection`, `pre-design`, and `extension` — and
 * adds no name and no behavior beyond their union. The document and graph
 * contract names are owned by the `schema` family; the planning and
 * schedule-solution contract names are owned by the `projection` family.
 */

export * from "./identity.js";
export * from "./schema.js";
export * from "./diagnostics.js";
export * from "./projection.js";
export * from "./pre-design.js";
export * from "./extensions.js";
