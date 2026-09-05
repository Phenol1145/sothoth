/**
 * Terminal renderer: the human channel. The machine summary line goes to
 * stdout; human diagnostic lines go to stderr — and ONLY in terminal mode.
 * Machine formats never write diagnostics to stderr. All output is derived
 * from the invocation record alone: byte-identical across invocations.
 */

import type { CompilationOutcomeKindV1, StructuredDiagnosticV1 } from "@project-sothoth/sdk/diagnostics";
import type { CliCommandLabelV1 } from "./render-json.js";

/** The single human summary line for stdout. */
export function renderTerminalSummaryV1(
  command: CliCommandLabelV1,
  outcome: CompilationOutcomeKindV1,
  exitCode: number,
): string {
  return `sothoth ${command}: ${outcome} (exit ${exitCode})\n`;
}

/** The human diagnostic lines for stderr (terminal mode only). */
export function renderTerminalDiagnosticsV1(
  diagnostics: readonly StructuredDiagnosticV1[],
): string {
  return diagnostics
    .map((diagnostic) => `${diagnostic.severity} ${diagnostic.code}: ${diagnostic.subjects.join(", ")}\n`)
    .join("");
}
