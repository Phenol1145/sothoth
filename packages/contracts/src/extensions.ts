/**
 * Extension and evidence contracts: Gate Macros, Trusted Rule Modules, and
 * Evidence Checks.
 *
 * Public family `@sothoth/contracts/extension`. Gate Macros are declarative
 * templates that expand to acyclic exact Check References; Trusted Rule
 * Modules are explicitly installed, allowlisted, integrity-locked code;
 * Evidence Checks run outside Sothoth, which validates only the report's
 * snapshot, check-definition, and result bindings. Extensions can never
 * choose process exits or top-level outcomes.
 */

import type { DiagnosticVerdictV1 } from "./diagnostics.js";
import type { DigestV1, JsonValue } from "./identity.js";

export { DIAGNOSTIC_VERDICTS_V1 as CHECK_VERDICTS_V1 } from "./diagnostics.js";
export type { DiagnosticVerdictV1 as CheckVerdictV1 } from "./diagnostics.js";

/** An exact reference to an evidence check definition. */
export interface EvidenceCheckReferenceV1 {
  readonly checkId: string;
  readonly checkRevision: number;
}

/**
 * A declarative gate template. `expandsTo` is the acyclic exact Check
 * Reference set the macro expands to; a macro may compose rules, parameters,
 * dependencies, scope, and severity policy, but never embeds executable
 * content.
 */
export interface GateMacroV1 {
  readonly macroId: string;
  readonly expandsTo: readonly EvidenceCheckReferenceV1[];
  readonly parameters: Readonly<Record<string, JsonValue>>;
}

/** An explicitly installed, allowlisted, integrity-locked rule module. */
export interface TrustedRuleModuleV1 {
  readonly moduleId: string;
  readonly moduleRevision: number;
  readonly integrityDigest: DigestV1;
}

/** An evidence check report validated by Sothoth and executed outside it. */
export interface EvidenceCheckReportV1 {
  readonly checkReference: EvidenceCheckReferenceV1;
  readonly snapshotIdentity: string;
  readonly verdict: DiagnosticVerdictV1;
}
