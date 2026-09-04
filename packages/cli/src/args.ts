/**
 * Public module `@sothoth/cli/input`: strict, explicit argv parsing.
 *
 * Input is argv flags and explicitly named path arguments ONLY. There is no
 * implicit filesystem scanning, no environment-variable semantics, no
 * implicit default profile, and no hidden command: an unknown command, an
 * unknown option, a missing explicit value, or a stray positional argument
 * is invalid input. Nothing outside `argv` is ever consulted.
 */

import { parseArgs } from "node:util";

/** The closed command surface: exactly the eight documented commands. */
export const CLI_COMMANDS_V1: readonly string[] = Object.freeze([
  "change-plan",
  "check",
  "compile governance",
  "compile planning",
  "explain",
  "index",
  "select",
  "verify-projection",
]);

export type CliCommandV1 = (typeof CLI_COMMANDS_V1)[number];

/** The closed machine/human format set. */
export const CLI_FORMATS_V1: readonly string[] = Object.freeze(["json", "sarif", "terminal"]);

export type CliFormatV1 = (typeof CLI_FORMATS_V1)[number];

/** One parsed explicit invocation. */
export interface CliInvocationV1 {
  readonly command: CliCommandV1;
  readonly format: CliFormatV1;
  readonly inputPath: string | null;
  readonly outputPath: string | null;
}

/** One typed input failure: a closed code plus an exact subject. */
export interface CliInputIssueV1 {
  readonly code: string;
  readonly subject: string;
}

export type CliInputResultV1 =
  | { readonly ok: true; readonly help: boolean; readonly invocation: CliInvocationV1 | null }
  | { readonly ok: false; readonly issues: readonly CliInputIssueV1[] };

const SINGLE_WORD_COMMANDS: readonly string[] = Object.freeze([
  "change-plan",
  "check",
  "explain",
  "index",
  "select",
  "verify-projection",
]);

const KNOWN_FLAGS: readonly string[] = Object.freeze(["--format", "--input", "--output", "--help", "-h"]);

function issue(code: string, subject: string): CliInputIssueV1 {
  return { code, subject };
}

/** The first argv token after the command words that is not a known flag or
 *  that flag's value slot. Deterministic for a given argv: node's own error
 *  texts are never used as subjects. */
function firstOffendingToken(args: readonly string[]): string {
  let index = 0;
  // Skip the command words (at most two: "compile" plus its phase).
  while (index < args.length && !args[index]!.startsWith("-")) {
    index += 1;
  }
  for (; index < args.length; index += 1) {
    const token = args[index]!;
    if (token === "--") {
      return token;
    }
    if (KNOWN_FLAGS.includes(token)) {
      // A value-consuming flag skips its value; --help/-h consume none.
      if (token === "--format" || token === "--input" || token === "--output") {
        index += 1;
      }
      continue;
    }
    if (token.startsWith("--") && token.includes("=")) {
      return token.split("=")[0]!;
    }
    return token;
  }
  return "argv";
}

function commandOf(positionals: readonly string[]): { command: CliCommandV1 } | { issue: CliInputIssueV1 } {
  const [first, second] = positionals;
  if (first === "compile") {
    if ((second === "governance" || second === "planning") && positionals.length === 2) {
      return { command: `compile ${second}` as CliCommandV1 };
    }
    if (second !== undefined && positionals.length >= 2) {
      return { issue: issue("sothoth.input/unknown-command", `compile ${second}`) };
    }
    return { issue: issue("sothoth.input/unknown-command", "compile") };
  }
  if (first !== undefined && positionals.length === 1 && SINGLE_WORD_COMMANDS.includes(first)) {
    return { command: first as CliCommandV1 };
  }
  if (first === undefined) {
    return { issue: issue("sothoth.input/unknown-command", "argv") };
  }
  if (positionals.length > 1) {
    return { issue: issue("sothoth.input/unexpected-argument", positionals.slice(1).join(" ")) };
  }
  return { issue: issue("sothoth.input/unknown-command", first) };
}

/**
 * Parses one explicit argv (excluding the executable and script path).
 * `--help` short-circuits to the documented help text before any command
 * validation; every other malformed input fails closed as invalid input.
 */
export function parseCliArgumentsV1(args: readonly string[]): CliInputResultV1 {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...args],
      options: {
        format: { type: "string" },
        input: { type: "string" },
        output: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch {
    const token = firstOffendingToken(args);
    const code = token.startsWith("-") ? "sothoth.input/unknown-option" : "sothoth.input/invalid-option";
    return { ok: false, issues: [issue(code, token)] };
  }
  if (parsed.values.help === true) {
    return { ok: true, help: true, invocation: null };
  }
  const format = parsed.values.format;
  if (format === undefined) {
    return { ok: false, issues: [issue("sothoth.input/missing-option", "--format")] };
  }
  if (typeof format !== "string" || !CLI_FORMATS_V1.includes(format)) {
    return { ok: false, issues: [issue("sothoth.input/invalid-option-value", `--format ${String(format)}`)] };
  }
  const command = commandOf(parsed.positionals);
  if ("issue" in command) {
    return { ok: false, issues: [command.issue] };
  }
  return {
    ok: true,
    help: false,
    invocation: Object.freeze({
      command: command.command,
      format: format as CliFormatV1,
      inputPath: typeof parsed.values.input === "string" ? parsed.values.input : null,
      outputPath: typeof parsed.values.output === "string" ? parsed.values.output : null,
    }),
  };
}

/** The documented help text: exactly the eight commands and the flags. */
export const CLI_HELP_TEXT_V1: string = [
  "sothoth 0.1.0 — explicit command surface (CONTRACT/SOTHOTH/CLI-IO@1)",
  "",
  "commands (exactly eight):",
  "  change-plan          change-plan projection",
  "  check                pre-design Design Closure checking",
  "  compile governance   Scope BOM Admissibility compilation",
  "  compile planning     dependency schedule compilation",
  "  explain              selector evaluation explanation",
  "  index                document index compilation",
  "  select               selector resolution over an index",
  "  verify-projection    projection digest verification",
  "",
  "options:",
  "  --format <json|sarif|terminal>   output document format (required)",
  "  --input <path>                   explicit request path (default: stdin)",
  "  --output <path>                  explicit output path (default: stdout; atomic)",
  "  --help                           this help",
  "",
].join("\n");
