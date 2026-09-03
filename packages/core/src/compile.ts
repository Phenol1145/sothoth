/**
 * The pure compilation primitives of the Sothoth kernel, assembled.
 *
 * Public module `@sothoth/core/compile`. This module organizes and re-exports
 * the authorized pure compilation primitives — canonical bytes, digests,
 * diagnostic finalization, and outcome aggregation — together with the
 * contract types they consume. It deliberately declares no new callable and
 * no new behavior: everything reachable from here is reachable from the
 * module that owns it.
 */

export { canonicalJson, SothothInputError } from "./canonical-json.js";
export { sha256Digest } from "./digests.js";
export { finalizeDiagnostics } from "./diagnostics.js";
export { aggregateOutcome } from "./outcome.js";
export type {
  CompilationOutcomeV1,
  DiagnosticDraftV1,
  JsonValue,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
