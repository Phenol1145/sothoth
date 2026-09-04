/**
 * Public modules `@sothoth/cli/write` and `@sothoth/cli/exit`: the terminal
 * process I/O boundary of the CLI.
 *
 * `write` performs atomic explicit output: a document destined for an
 * explicitly named path is written to a temporary file in the same directory
 * and replaces the target in one step, so a failed write can never leave a
 * partial target. A destination that cannot be written is invalid
 * configuration of the invocation itself: it fails closed with the
 * established `sothoth.pre-design/output-unwritable` diagnostic and no
 * partial file survives.
 *
 * `exit` applies the frozen outcome-to-exit mapping — the CLI alone owns it:
 * `valid` exits 0, `invalid` 1, `invalid-input` 2, `extension-error` 3,
 * `internal-error` 4. No other exit code exists, and the frozen table admits
 * no override by any extension or caller.
 */

import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { CompilationOutcomeKindV1 } from "@sothoth/sdk/diagnostics";

// ---------------------------------------------------------------------------
// exit (`@sothoth/cli/exit`)
// ---------------------------------------------------------------------------

/** The frozen outcome-to-exit table; owned by the CLI and by nothing else. */
export const CLI_EXIT_CODES_V1: Readonly<Record<CompilationOutcomeKindV1, number>> = Object.freeze({
  valid: 0,
  invalid: 1,
  "invalid-input": 2,
  "extension-error": 3,
  "internal-error": 4,
} as const);

/**
 * Applies the frozen mapping. An unknown outcome kind fails closed onto
 * `internal-error` (exit 4) — never onto a new exit code.
 */
export function exitCodeOfOutcomeV1(outcome: CompilationOutcomeKindV1): number {
  const code = (CLI_EXIT_CODES_V1 as Readonly<Record<string, number | undefined>>)[outcome];
  return code === undefined ? CLI_EXIT_CODES_V1["internal-error"]! : code;
}

// ---------------------------------------------------------------------------
// write (`@sothoth/cli/write`)
// ---------------------------------------------------------------------------

/** An explicit output destination that could not be written atomically. */
export class CliOutputUnwritableError extends Error {
  readonly targetPath: string;
  readonly reason: string;

  constructor(targetPath: string, reason: string) {
    super(`output unwritable: ${targetPath} (${reason})`);
    this.name = "CliOutputUnwritableError";
    this.targetPath = targetPath;
    this.reason = reason;
  }
}

/** An explicit input path that could not be read. */
export class CliInputUnreadableError extends Error {
  readonly inputPath: string;
  readonly reason: string;

  constructor(inputPath: string, reason: string) {
    super(`input unreadable: ${inputPath} (${reason})`);
    this.name = "CliInputUnreadableError";
    this.inputPath = inputPath;
    this.reason = reason;
  }
}

/**
 * Writes one document atomically: same-directory temporary file, then a
 * single rename over the target. On any failure the temporary file is
 * removed and the target is left exactly as it was — byte-for-byte.
 */
export function writeAtomicV1(targetPath: string, bytes: string): void {
  const directory = dirname(targetPath);
  const tempPath = join(directory, `.${basename(targetPath)}.sothoth-tmp-${process.pid.toString()}`);
  try {
    writeFileSync(tempPath, bytes, { flag: "wx" });
    renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temporary file never existed or is already gone: nothing to
      // clean and the target was never touched.
    }
    const reason = error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : "error";
    throw new CliOutputUnwritableError(targetPath, reason);
  }
}

/**
 * Reads the explicit request input: the named path when one is supplied,
 * standard input otherwise. No other source is ever consulted.
 */
export function readExplicitInputV1(inputPath: string | null): string {
  if (inputPath === null) {
    return readFileSync(0, "utf8");
  }
  try {
    return readFileSync(inputPath, "utf8");
  } catch (error) {
    const reason = error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : "error";
    throw new CliInputUnreadableError(inputPath, reason);
  }
}
