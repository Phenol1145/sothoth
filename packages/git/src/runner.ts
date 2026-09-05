/**
 * Public module `@project-sothoth/git/process`: the closed read-only Git process
 * boundary.
 *
 * This is the only module in the repository allowed to start a process, and
 * it starts exactly `git` through `node:child_process` `execFile` with a
 * fixed argument array — never a shell, never a concatenated command string.
 * The executable subcommand set is closed to `diff`, `ls-tree`, `rev-parse`,
 * `show`, and `status`; the eighteen declared mutation subcommands, every
 * other subcommand, and option-shaped first arguments are rejected
 * synchronously BEFORE any process is created. The child receives exactly a
 * PATH entry as its environment so no caller-controlled `GIT_*` variable can
 * change adapter semantics, every invocation carries the global
 * `--no-optional-locks` option so `status` and `diff` never take the index
 * lock or refresh the index, and every run is bounded by the process-output
 * budget: a run whose output would exceed the budget fails closed instead of
 * yielding truncated bytes.
 */

import { execFile } from "node:child_process";
import type { JsonValue } from "@project-sothoth/contracts";
import { GitSourceAdapterError, gitFindingDraftV1 } from "./snapshot.js";

/** The closed executable subcommand set. */
export type GitExecutableSubcommandV1 = "diff" | "ls-tree" | "rev-parse" | "show" | "status";

/** The executable subcommands, in Unicode code-point order. */
export const GIT_EXECUTABLE_SUBCOMMANDS_V1: readonly GitExecutableSubcommandV1[] = [
  "diff",
  "ls-tree",
  "rev-parse",
  "show",
  "status",
];

/** The eighteen declared mutation subcommands, always rejected. */
export const GIT_MUTATION_SUBCOMMANDS_V1: readonly string[] = [
  "add",
  "checkout",
  "cherry-pick",
  "clean",
  "clone",
  "commit",
  "config",
  "fetch",
  "merge",
  "pull",
  "push",
  "rebase",
  "reset",
  "rm",
  "stash",
  "switch",
  "tag",
  "worktree",
];

const EXECUTABLE_SUBCOMMANDS: ReadonlySet<string> = new Set(GIT_EXECUTABLE_SUBCOMMANDS_V1);
const MUTATION_SUBCOMMANDS: ReadonlySet<string> = new Set(GIT_MUTATION_SUBCOMMANDS_V1);

/** One read request: the repository root, the fixed argument array, and the
 *  process-output budget that bounds the run. */
export interface GitProcessRequestV1 {
  readonly repositoryRoot: string;
  readonly arguments: readonly string[];
  readonly processOutputBudget: number;
}

/** One completed allowlisted run: its subcommand, raw stdout bytes, and stderr. */
export interface GitProcessOutputV1 {
  readonly subcommand: GitExecutableSubcommandV1;
  readonly stdout: Buffer;
  readonly stderr: string;
}

function failClosed(
  code: string,
  category: "input" | "internal",
  subject: string,
  parameters: Readonly<Record<string, JsonValue>>,
  causes: readonly string[],
  help: readonly string[],
): never {
  const draft = gitFindingDraftV1({ code, category, subject, parameters, causes, help });
  throw new GitSourceAdapterError([draft], `${code}: ${causes.join("; ")}`);
}

/**
 * Validates one read request synchronously. Every rejection here happens
 * before `execFile` is ever called, so no process is created: a caller
 * observing a synchronous throw knows nothing was spawned.
 */
function validateGitReadRequestV1(request: GitProcessRequestV1): GitExecutableSubcommandV1 {
  if (typeof request !== "object" || request === null) {
    failClosed(
      "sothoth.git/invalid-request",
      "input",
      "process-request",
      {},
      ["the process request must be an object"],
      ["Pass a GitProcessRequestV1 with repositoryRoot, arguments, and processOutputBudget."],
    );
  }
  const record = request as { repositoryRoot?: unknown; arguments?: unknown; processOutputBudget?: unknown };
  if (typeof record.repositoryRoot !== "string" || record.repositoryRoot.length === 0) {
    failClosed(
      "sothoth.git/invalid-request",
      "input",
      "process-request.repositoryRoot",
      {},
      ["repositoryRoot must be a non-empty string"],
      ["Pass the absolute path of the repository root."],
    );
  }
  if (!Array.isArray(record.arguments) || record.arguments.some((argument) => typeof argument !== "string")) {
    failClosed(
      "sothoth.git/invalid-request",
      "input",
      "process-request.arguments",
      {},
      ["arguments must be an array of strings"],
      ["Pass one fixed argument array beginning with an allowlisted subcommand."],
    );
  }
  const arguments_ = record.arguments as readonly string[];
  if (
    typeof record.processOutputBudget !== "number" ||
    !Number.isInteger(record.processOutputBudget) ||
    record.processOutputBudget <= 0
  ) {
    failClosed(
      "sothoth.git/invalid-budgets",
      "input",
      "process-request.processOutputBudget",
      {},
      ["processOutputBudget must be a positive integer"],
      ["Pass a positive integer bounding the output of every Git process."],
    );
  }
  const first = arguments_[0];
  if (typeof first !== "string" || first.length === 0 || first.startsWith("-")) {
    failClosed(
      "sothoth.git/disallowed-subcommand",
      "input",
      typeof first === "string" && first.length > 0 ? first : "<empty>",
      {},
      ["the first argument must name an allowlisted subcommand, not an option"],
      [`Allowlisted subcommands are exactly: ${GIT_EXECUTABLE_SUBCOMMANDS_V1.join(", ")}.`],
    );
  }
  if (!EXECUTABLE_SUBCOMMANDS.has(first)) {
    const mutation = MUTATION_SUBCOMMANDS.has(first) ? " (a declared mutation subcommand)" : "";
    failClosed(
      "sothoth.git/disallowed-subcommand",
      "input",
      first,
      { subcommand: first, mutation },
      [`subcommand "${first}" is outside the executable allowlist${mutation}`],
      [`Allowlisted subcommands are exactly: ${GIT_EXECUTABLE_SUBCOMMANDS_V1.join(", ")}.`],
    );
  }
  if (arguments_.some((argument) => argument.includes("\0"))) {
    failClosed(
      "sothoth.git/invalid-request",
      "input",
      "process-request.arguments",
      {},
      ["arguments must not contain NUL bytes"],
      ["Pass fixed argument arrays without NUL bytes."],
    );
  }
  // The allowlist membership check above has already confined `first` to the
  // closed executable set.
  return first as GitExecutableSubcommandV1;
}

/** Classifies a failing or over-budget run into the closed diagnostic set. */
function classifyFailureV1(
  subcommand: GitExecutableSubcommandV1,
  error: NodeJS.ErrnoException & { code?: unknown },
  stderr: string,
): GitSourceAdapterError {
  if (/maxBuffer/i.test(error.message)) {
    return new GitSourceAdapterError(
      [
        gitFindingDraftV1({
          code: "sothoth.git/budget-exceeded",
          category: "input",
          subject: subcommand,
          parameters: { budget: "process-output" },
          causes: [`output of "${subcommand}" exceeded the process-output budget`],
          help: ["Raise the processOutput budget or narrow the request; output is never truncated."],
        }),
      ],
      `sothoth.git/budget-exceeded: ${subcommand} output exceeded the process-output budget`,
    );
  }
  if (typeof error.code === "number") {
    // The process ran and exited non-zero: git's own diagnostics decide.
    if (/refname '.*' is ambiguous/.test(stderr)) {
      return new GitSourceAdapterError(
        [
          gitFindingDraftV1({
            code: "sothoth.git/ambiguous-ref",
            category: "input",
            subject: subcommand,
            parameters: {},
            causes: ["git reported an ambiguous refname"],
            help: ["Pass an unambiguous exact ref, for example a full commit identity."],
          }),
        ],
        "sothoth.git/ambiguous-ref: git reported an ambiguous refname",
      );
    }
    if (/not a git repository/.test(stderr)) {
      return new GitSourceAdapterError(
        [
          gitFindingDraftV1({
            code: "sothoth.git/repository-unreachable",
            category: "input",
            subject: subcommand,
            parameters: {},
            causes: ["the directory is not inside a Git repository"],
            help: ["Pass the root of an existing Git repository."],
          }),
        ],
        "sothoth.git/repository-unreachable: the directory is not inside a Git repository",
      );
    }
    if (subcommand === "rev-parse" || subcommand === "diff") {
      return new GitSourceAdapterError(
        [
          gitFindingDraftV1({
            code: "sothoth.git/unknown-ref",
            category: "input",
            subject: subcommand,
            parameters: {},
            causes: [stderr.trim() || "git could not resolve the exact ref"],
            help: ["Pass an exact ref that resolves to exactly one object."],
          }),
        ],
        `sothoth.git/unknown-ref: ${stderr.trim()}`,
      );
    }
    return new GitSourceAdapterError(
      [
        gitFindingDraftV1({
          code: "sothoth.git/missing-object",
          category: "input",
          subject: subcommand,
          parameters: {},
          causes: [stderr.trim() || "git could not read the requested object"],
          help: ["Pass a ref whose tree- and blob-level objects are all present."],
        }),
      ],
      `sothoth.git/missing-object: ${stderr.trim()}`,
    );
  }
  return new GitSourceAdapterError(
    [
      gitFindingDraftV1({
        code: "sothoth.git/process-failure",
        category: "internal",
        subject: subcommand,
        parameters: {},
        causes: [error.message],
        help: ["The git process could not be executed at all."],
      }),
    ],
    `sothoth.git/process-failure: ${error.message}`,
  );
}

/**
 * Executes one allowlisted read-only Git subcommand with a fixed argument
 * array. Validation is synchronous: a disallowed subcommand, a malformed
 * request, or a malformed budget throws before any process is created. The
 * child runs with cwd at the repository root, exactly a PATH environment
 * entry, and `--no-optional-locks` prepended so no invocation ever takes the
 * index lock; an over-budget output rejects instead of truncating.
 */
export function runGitReadV1(request: GitProcessRequestV1): Promise<GitProcessOutputV1> {
  const subcommand = validateGitReadRequestV1(request);
  return new Promise<GitProcessOutputV1>((resolve, reject) => {
    execFile(
      "git",
      ["--no-optional-locks", ...(request.arguments as readonly string[])],
      {
        cwd: request.repositoryRoot,
        env: { PATH: process.env.PATH ?? "" },
        encoding: "buffer",
        maxBuffer: request.processOutputBudget,
      },
      (error, stdout, stderr) => {
        const stderrText = Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr ?? "");
        if (error !== null) {
          reject(classifyFailureV1(subcommand, error as never, stderrText));
          return;
        }
        // A successful run may still carry the ambiguity warning; that is a
        // fail-closed condition, not a usable resolution.
        if (/refname '.*' is ambiguous/.test(stderrText)) {
          reject(
            new GitSourceAdapterError(
              [
                gitFindingDraftV1({
                  code: "sothoth.git/ambiguous-ref",
                  category: "input",
                  subject: subcommand,
                  parameters: {},
                  causes: ["git reported an ambiguous refname"],
                  help: ["Pass an unambiguous exact ref, for example a full commit identity."],
                }),
              ],
              "sothoth.git/ambiguous-ref: git reported an ambiguous refname",
            ),
          );
          return;
        }
        const stdoutBuffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from([]);
        if (stdoutBuffer.byteLength > request.processOutputBudget) {
          reject(
            new GitSourceAdapterError(
              [
                gitFindingDraftV1({
                  code: "sothoth.git/budget-exceeded",
                  category: "input",
                  subject: subcommand,
                  parameters: { budget: "process-output" },
                  causes: [`output of "${subcommand}" exceeded the process-output budget`],
                  help: ["Raise the processOutput budget or narrow the request; output is never truncated."],
                }),
              ],
              `sothoth.git/budget-exceeded: ${subcommand} output exceeded the process-output budget`,
            ),
          );
          return;
        }
        resolve({ subcommand, stdout: stdoutBuffer, stderr: stderrText });
      },
    );
  });
}
