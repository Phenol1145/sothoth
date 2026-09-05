/**
 * Public module `@project-sothoth/cli/render`: the JSON machine-document renderer.
 *
 * The machine document is one closed `sothoth.cli/cli-invocation-result@1`
 * value — the invocation record the CLI owns — serialized deterministically
 * with a fixed field order: byte-identical for identical invocations. It is
 * the only thing this channel ever writes; SARIF and terminal rendering are
 * separate renderer modules composed by `main`.
 */

import type { CompilationOutcomeKindV1, StructuredDiagnosticV1 } from "@project-sothoth/sdk/diagnostics";
import type { CliCommandV1 } from "./args.js";

/** What a document can report as its command: a real command, `help`, or
 *  `input` when the input never parsed far enough to name one. */
export type CliCommandLabelV1 = CliCommandV1 | "help" | "input";

/** The invocation record: command, outcome, diagnostics, and exit code. */
export interface CliInvocationResultV1 {
  readonly schema: "sothoth.cli/cli-invocation-result@1";
  readonly command: CliCommandLabelV1;
  readonly outcome: CompilationOutcomeKindV1;
  readonly exitCode: number;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  readonly result: unknown;
}

/** Builds the single machine document of one invocation. */
export function invocationResultV1(document: {
  command: CliCommandLabelV1;
  outcome: CompilationOutcomeKindV1;
  exitCode: number;
  diagnostics: readonly StructuredDiagnosticV1[];
  result: unknown;
}): CliInvocationResultV1 {
  return {
    schema: "sothoth.cli/cli-invocation-result@1",
    command: document.command,
    outcome: document.outcome,
    exitCode: document.exitCode,
    diagnostics: document.diagnostics,
    diagnosticCount: document.diagnostics.length,
    result: document.result,
  };
}

/** Renders the machine document: exactly one JSON value, newline-terminated. */
export function renderJsonDocumentV1(document: CliInvocationResultV1): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
