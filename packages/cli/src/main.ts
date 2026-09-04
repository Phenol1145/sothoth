#!/usr/bin/env node
/**
 * Public module `@sothoth/cli/commands`: the executable command surface.
 *
 * One invocation is the only lifecycle: parse explicit argv, read the
 * explicit request (a named path or standard input), compose exactly one
 * facade composition through `@sothoth/sdk`, render exactly one machine
 * document (JSON or SARIF) or one human terminal rendering, write any
 * explicit output path atomically, and exit through the frozen table.
 * Nothing persists between invocations, nothing is staged, the working
 * repository is never scanned or modified, no environment variable carries
 * semantics, and the SDK never selects the exit — this module applies the
 * frozen mapping alone.
 */

import { writeSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  CLI_HELP_TEXT_V1,
  parseCliArgumentsV1,
  type CliFormatV1,
  type CliInputIssueV1,
} from "./args.js";
import {
  CliInputUnreadableError,
  CliOutputUnwritableError,
  exitCodeOfOutcomeV1,
  readExplicitInputV1,
  writeAtomicV1,
} from "./io.js";
import {
  invocationResultV1,
  renderJsonDocumentV1,
  type CliCommandLabelV1,
} from "./render-json.js";
import { renderSarifDocumentV1 } from "./render-sarif.js";
import { renderTerminalDiagnosticsV1, renderTerminalSummaryV1 } from "./render-terminal.js";
import { COMPILATION_OUTCOMES_V1, finalizeDiagnostics } from "@sothoth/sdk/diagnostics";
import type {
  CompilationOutcomeKindV1,
  DiagnosticDraftV1,
  JsonValue,
  StructuredDiagnosticV1,
} from "@sothoth/sdk/diagnostics";
import { createSothothV1 } from "@sothoth/sdk/documents";
import type { SothothFacadeResultV1, SothothV1 } from "@sothoth/sdk/documents";

/** One CLI-owned diagnostic draft in the closed diagnostic contract. */
function cliDraft(
  code: string,
  phase: string,
  subject: string,
  parameters: Readonly<Record<string, JsonValue>> = {},
): DiagnosticDraftV1 {
  return {
    code,
    origin: "sothoth.cli",
    category: "input",
    phase,
    verdict: "fail",
    severity: "error",
    ruleId: code,
    location: null,
    subjects: [subject],
    parameters,
    causes: [],
    help: [],
  };
}

/** The eight documented commands bound to their facade compositions. */
function compose(sothoth: SothothV1, command: string, request: unknown): SothothFacadeResultV1<unknown> {
  switch (command) {
    case "check":
      return sothoth.check.designClosure(request);
    case "compile governance":
      return sothoth.compile.governance(request);
    case "compile planning":
      return sothoth.compile.planning(request);
    case "change-plan":
      return sothoth.changePlan.compile(request);
    case "index":
      return sothoth.documents.buildIndex(request);
    case "select":
      return sothoth.documents.select(request);
    case "explain":
      return sothoth.documents.explain(request);
    case "verify-projection":
      return sothoth.verify.projectionDigest(request);
    default:
      // Unreachable: argv parsing admits only the eight commands.
      throw new Error(`unknown command: ${command}`);
  }
}

function renderMachineDocumentV1(
  format: CliFormatV1,
  command: CliCommandLabelV1,
  outcome: CompilationOutcomeKindV1,
  exitCode: number,
  diagnostics: readonly StructuredDiagnosticV1[],
  result: unknown,
): string {
  const document = invocationResultV1({ command, outcome, exitCode, diagnostics, result });
  return format === "sarif" ? renderSarifDocumentV1(document) : renderJsonDocumentV1(document);
}

/**
 * Emits one invocation: renders the document for the requested format,
 * writes it to the explicit output path atomically or to stdout, keeps human
 * diagnostics on stderr in terminal mode only, and returns the exit code.
 * An unwritable destination replaces the result: `invalid-input` with the
 * established diagnostic, no prior result emitted, and no partial file.
 */
function emitV1(document: {
  command: CliCommandLabelV1;
  outcome: CompilationOutcomeKindV1;
  diagnostics: readonly StructuredDiagnosticV1[];
  result: unknown;
  format: CliFormatV1;
  outputPath: string | null;
}): number {
  const exitCode = exitCodeOfOutcomeV1(document.outcome);
  if (document.outputPath !== null) {
    const bytes =
      document.format === "terminal"
        ? `${renderTerminalSummaryV1(document.command, document.outcome, exitCode)}${renderTerminalDiagnosticsV1(document.diagnostics)}`
        : renderMachineDocumentV1(
            document.format,
            document.command,
            document.outcome,
            exitCode,
            document.diagnostics,
            document.result,
          );
    try {
      writeAtomicV1(document.outputPath, bytes);
    } catch (error) {
      if (!(error instanceof CliOutputUnwritableError)) {
        throw error;
      }
      return emitV1({
        command: document.command,
        outcome: "invalid-input",
        diagnostics: finalizeDiagnostics([
          cliDraft("sothoth.pre-design/output-unwritable", "output", error.targetPath, {
            reason: error.reason,
          }),
        ]),
        result: null,
        format: document.format,
        outputPath: null,
      });
    }
    return exitCode;
  }
  if (document.format === "terminal") {
    writeSync(1, renderTerminalSummaryV1(document.command, document.outcome, exitCode));
    writeSync(2, renderTerminalDiagnosticsV1(document.diagnostics));
    return exitCode;
  }
  writeSync(
    1,
    renderMachineDocumentV1(
      document.format,
      document.command,
      document.outcome,
      exitCode,
      document.diagnostics,
      document.result,
    ),
  );
  return exitCode;
}

function failInputV1(
  command: CliCommandLabelV1,
  format: CliFormatV1,
  outputPath: string | null,
  issues: readonly (CliInputIssueV1 | DiagnosticDraftV1)[],
): number {
  const drafts = issues.map((entry) =>
    "subjects" in entry ? entry : cliDraft(entry.code, "input", entry.subject),
  );
  return emitV1({
    command,
    outcome: "invalid-input",
    diagnostics: finalizeDiagnostics(drafts),
    result: null,
    format,
    outputPath,
  });
}

/**
 * Runs one invocation and returns its process exit code (0–4 only). The
 * function performs the invocation's I/O exactly once each: one input read,
 * one facade composition, one document emission. An argv that never parsed
 * far enough to name a command or a format is reported as the `input`
 * command in JSON on stdout — the only fail-closed reporting default.
 */
export function runCliV1(argv: readonly string[]): number {
  const parsed = parseCliArgumentsV1(argv);
  if (!parsed.ok) {
    return failInputV1("input", "json", null, parsed.issues);
  }
  if (parsed.help) {
    writeSync(1, CLI_HELP_TEXT_V1);
    return 0;
  }
  const invocation = parsed.invocation!;
  const command = invocation.command;

  let requestText: string;
  try {
    requestText = readExplicitInputV1(invocation.inputPath);
  } catch (error) {
    if (error instanceof CliInputUnreadableError) {
      return failInputV1(command, invocation.format, invocation.outputPath, [
        { code: "sothoth.input/input-unreadable", subject: error.inputPath },
      ]);
    }
    throw error;
  }

  let request: unknown;
  try {
    request = JSON.parse(requestText);
  } catch {
    return failInputV1(command, invocation.format, invocation.outputPath, [
      { code: "sothoth.input/invalid-json", subject: invocation.inputPath ?? "stdin" },
    ]);
  }

  let facade: SothothFacadeResultV1<unknown>;
  try {
    facade = compose(createSothothV1(), command, request);
  } catch {
    // An unexpected throw is an internal failure of the composition: fail
    // closed onto internal-error with no nondeterministic bytes emitted.
    return emitV1({
      command,
      outcome: "internal-error",
      diagnostics: [],
      result: null,
      format: invocation.format,
      outputPath: invocation.outputPath,
    });
  }
  if (!(COMPILATION_OUTCOMES_V1 as readonly string[]).includes(facade.outcome)) {
    return emitV1({
      command,
      outcome: "internal-error",
      diagnostics: [],
      result: null,
      format: invocation.format,
      outputPath: invocation.outputPath,
    });
  }
  return emitV1({
    command,
    outcome: facade.outcome,
    diagnostics: facade.diagnostics,
    result: facade,
    format: invocation.format,
    outputPath: invocation.outputPath,
  });
}

const invokedAsMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsMain) {
  process.exit(runCliV1(process.argv.slice(2)));
}
