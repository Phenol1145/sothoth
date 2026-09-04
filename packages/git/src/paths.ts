/**
 * Public module `@sothoth/git/path`: repository-relative POSIX path
 * normalization and the closed rejection classes.
 *
 * Normalization is pure: no filesystem access, no process, no environment.
 * A path is normalizable exactly when it is a relative POSIX path whose `.`
 * segments collapse and whose `//` separators merge into one non-empty
 * repository-relative path that does not end in a separator. The closed
 * rejection classes are `absolute-path`, `nul-byte`, `parent-escape`,
 * `repository-escape`, and `unnormalizable-path`; repository escape by
 * symlink resolution is detected lexically by
 * `symlinkTargetEscapesRepositoryV1` so the adapter can fail closed on a
 * committed symlink whose target leaves the repository.
 */

/** The closed path rejection classes of the path declaration. */
export type GitPathRejectionClassV1 =
  | "absolute-path"
  | "nul-byte"
  | "parent-escape"
  | "repository-escape"
  | "unnormalizable-path";

/** A normalized path, or the closed class it was rejected under. */
export type NormalizedGitPathV1 =
  | { readonly ok: true; readonly path: string }
  | {
      readonly ok: false;
      readonly rejectedClass: GitPathRejectionClassV1;
      readonly reason: string;
    };

/** Matches Windows-style drive-letter absolute paths. */
const ABSOLUTE_DRIVE_PATTERN = /^[A-Za-z]:/;

/**
 * Normalizes one candidate into a repository-relative POSIX path or rejects
 * it under exactly one closed class. Absolute paths, NUL bytes, `..`
 * segments, and names that cannot normalize (empty, `.`, trailing
 * separator) fail closed; `.` segments and `//` separators collapse.
 */
export function normalizeGitPathV1(candidate: string): NormalizedGitPathV1 {
  if (candidate.includes("\0")) {
    return {
      ok: false,
      rejectedClass: "nul-byte",
      reason: "path contains a NUL byte",
    };
  }
  if (candidate.startsWith("/") || ABSOLUTE_DRIVE_PATTERN.test(candidate)) {
    return {
      ok: false,
      rejectedClass: "absolute-path",
      reason: "path is absolute; only repository-relative POSIX paths are normalizable",
    };
  }
  if (candidate.split("/").includes("..")) {
    return {
      ok: false,
      rejectedClass: "parent-escape",
      reason: "path contains a `..` segment",
    };
  }
  if (candidate.endsWith("/")) {
    return {
      ok: false,
      rejectedClass: "unnormalizable-path",
      reason: "path ends in a separator; a bound file path never does",
    };
  }
  const segments: string[] = [];
  for (const segment of candidate.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    segments.push(segment);
  }
  if (segments.length === 0) {
    return {
      ok: false,
      rejectedClass: "unnormalizable-path",
      reason: "path normalizes to the empty repository-relative path",
    };
  }
  return { ok: true, path: segments.join("/") };
}

/**
 * Decides lexically whether the target of a symlink committed at
 * `symlinkPath` resolves outside the repository root. Absolute targets and
 * targets whose `..` segments climb past the root are escapes; everything
 * else stays inside. A target containing a NUL byte is treated as an escape
 * so the caller fails closed.
 */
export function symlinkTargetEscapesRepositoryV1(symlinkPath: string, target: string): boolean {
  if (target.includes("\0")) {
    return true;
  }
  if (target.startsWith("/")) {
    return true;
  }
  const base = symlinkPath.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (base.pop() === undefined) {
        return true;
      }
      continue;
    }
    base.push(segment);
  }
  return false;
}
