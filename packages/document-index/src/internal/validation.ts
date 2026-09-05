/**
 * Descriptor-only hostile-input validation, closed field grammars, and the
 * canonical issue machinery for `@project-sothoth/document-index`.
 *
 * Internal responsibility unit of the package: never re-exported from any
 * public subpath. This module owns the shared hostile machinery — known-field
 * descriptor reads (a getter never executes), closed-key checks, dense-array
 * checks, the exact §8.1 field grammars, the shared §8.1.2 stage-envelope
 * validator with its phase order and suppression cascade, cache container
 * validation (§8.8 phases 1–2), and issue coalescing and total ordering
 * (§9). All reads go through property descriptors; nothing is coerced; no
 * input is mutated. `canonicalJson` (`@project-sothoth/core/canonical-json`) is the
 * single owner of the JSON value grammar and `sha256Digest`
 * (`@project-sothoth/core/digest`) the single owner of digesting;
 * `SECTION_ID_PATTERN` (`@project-sothoth/contracts`) is consumed here inside
 * `src/internal/*` and never re-exported.
 */

import { SECTION_ID_PATTERN } from "@project-sothoth/contracts";
import { canonicalJson } from "@project-sothoth/core/canonical-json";
import { sha256Digest } from "@project-sothoth/core/digest";
import { createCanonicalGraphV1 } from "@project-sothoth/graph/digraph";
import type { DirectedMultigraphDeclarationV1 } from "@project-sothoth/graph/digraph";
import { compareCodePointOrder } from "./code-point.js";
import { deepFrozenCopy, deepFreezeInPlace } from "./immutable.js";
import type {
  DeclaredRelationV1,
  DocumentIndexBudgetsV1,
  HeadingDepthV1,
  ParsedBlockNodeV1,
  SourceSpanV1,
  StructuralIssueCodeV1,
  StructuralIssueLocationV1,
  StructuralIssueV1,
} from "../parse.js";
import type {
  ReferencesSuccessV1,
  ResolvedRelationRecordV1,
} from "../references.js";
import type { CompilerIdentityV1 } from "../index.js";

/** The closed fifteen-code Document Index structural-issue vocabulary (§9). */
export const ISSUE_CODES: ReadonlySet<string> = new Set([
  "sothoth.document-index/invalid-input",
  "sothoth.document-index/unknown-field",
  "sothoth.document-index/missing-field",
  "sothoth.document-index/invalid-field",
  "sothoth.document-index/budget-exhausted",
  "sothoth.document-index/duplicate-artifact-id",
  "sothoth.document-index/duplicate-path",
  "sothoth.document-index/content-digest-mismatch",
  "sothoth.document-index/unresolved-relation-target",
  "sothoth.document-index/external-target-contradiction",
  "sothoth.document-index/duplicate-relation",
  "sothoth.document-index/invalid-cache-key",
  "sothoth.document-index/cache-entry-corrupt",
  "sothoth.document-index/marker-not-followed-by-heading",
  "sothoth.document-index/duplicate-section-id",
]);

/** The two content-born codes whose issues carry an exact owning span (§9). */
const LOCATED_CODES: ReadonlySet<string> = new Set([
  "sothoth.document-index/marker-not-followed-by-heading",
  "sothoth.document-index/duplicate-section-id",
]);

const ROOT_BLOCK_KINDS: ReadonlySet<string> = new Set([
  "paragraph",
  "code",
  "list",
  "blockquote",
  "thematic-break",
  "definition",
]);

const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const BLOB_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const DRIVE_PREFIX = /^[A-Za-z]:/;
const HAS_BACKSLASH = /\\/;
const HAS_NUL = /\u0000/;
const INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

/** One typed rejection before it is coalesced, sorted, and frozen. */
export interface IssueDraft {
  readonly code: StructuralIssueCodeV1;
  readonly subject: string;
  readonly location: StructuralIssueLocationV1 | null;
}

export function draft(
  code: StructuralIssueCodeV1,
  subject: string,
  location: StructuralIssueLocationV1 | null = null,
): IssueDraft {
  return { code, subject, location };
}

type OwnField =
  | { readonly state: "missing" }
  | { readonly state: "accessor" }
  | { readonly state: "data"; readonly value: unknown };

/** Reads one own field through its descriptor; a getter never executes. */
export function readOwnField(owner: object, key: string): OwnField {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined) {
    return { state: "missing" };
  }
  if (!("value" in descriptor)) {
    return { state: "accessor" };
  }
  return { state: "data", value: descriptor.value };
}

/** True for a plain own-data-capable object: prototype `Object.prototype` or `null`. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * True for a dense, undecorated array: own enumerable keys are exactly the
 * canonical index names `"0"`..`"<length-1>"`, every slot is a data property,
 * and no symbol keys or extra own string names exist.
 */
export function isDenseArray(value: unknown): value is unknown[] {
  if (typeof value !== "object" || value === null || !Array.isArray(value)) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }
  const length = value.length;
  let indices = 0;
  for (const name of Object.getOwnPropertyNames(value)) {
    if (name === "length") {
      continue;
    }
    if (!INDEX_PATTERN.test(name) || Number(name) >= length) {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
    indices += 1;
  }
  return indices === length;
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/**
 * The normalized-path grammar (§8.1): non-empty; no NUL; no backslash; no
 * leading or trailing slash; no empty, `.`, or `..` segment; no Windows
 * drive prefix.
 */
export function isNormalizedPath(value: unknown): value is string {
  if (!nonEmptyString(value)) {
    return false;
  }
  if (DRIVE_PREFIX.test(value) || HAS_NUL.test(value)) {
    return false;
  }
  if (value.startsWith("/") || value.endsWith("/") || HAS_BACKSLASH.test(value)) {
    return false;
  }
  for (const segment of value.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      return false;
    }
  }
  return true;
}

/**
 * Flags every own key outside the closed set as `unknown-field` (whether a
 * data or accessor property) and every accessor on a closed key as
 * `invalid-field`, without executing any getter. `problems` may be null to
 * run quietly (the coarse cache grammar swallows fine-grained drafts).
 */
export function checkClosedKeys(
  owner: object,
  closedKeys: readonly string[],
  path: string,
  problems: IssueDraft[] | null,
): void {
  const closed = new Set(closedKeys);
  for (const name of Object.getOwnPropertyNames(owner)) {
    if (closed.has(name)) {
      continue;
    }
    problems?.push(draft("sothoth.document-index/unknown-field", `${path}.${name}`));
  }
  for (const symbol of Object.getOwnPropertySymbols(owner)) {
    problems?.push(
      draft("sothoth.document-index/unknown-field", `${path}[symbol:${symbol.description ?? ""}]`),
    );
  }
  for (const key of closedKeys) {
    if (readOwnField(owner, key).state === "accessor") {
      problems?.push(draft("sothoth.document-index/invalid-field", `${path}.${key}`));
    }
  }
}

/**
 * Coalesces byte-identical issues by their complete canonical value, then
 * applies the global total order: `(code, subject, canonicalJson(location))`
 * in Unicode code-point order, with the empty string for `null` locations.
 */
function canonicalIssueOrder(drafts: readonly IssueDraft[]): IssueDraft[] {
  const seen = new Set<string>();
  const unique: IssueDraft[] = [];
  for (const entry of drafts) {
    const key = canonicalJson({ code: entry.code, subject: entry.subject, location: entry.location });
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }
  return unique.sort((left, right) => {
    const byCode = compareCodePointOrder(left.code, right.code);
    if (byCode !== 0) {
      return byCode;
    }
    const bySubject = compareCodePointOrder(left.subject, right.subject);
    if (bySubject !== 0) {
      return bySubject;
    }
    const leftLocation = left.location === null ? "" : canonicalJson(left.location);
    const rightLocation = right.location === null ? "" : canonicalJson(right.location);
    return compareCodePointOrder(leftLocation, rightLocation);
  });
}

/**
 * Builds the frozen canonical failure envelope from raw issue drafts.
 * Drafts are created only through `draft()` at call sites that already know
 * the exact code/location correspondence, so the internal representation is
 * converted to the public discriminated union at this single point.
 */
export function finalizeFailure(drafts: readonly IssueDraft[]): {
  ok: false;
  issues: readonly StructuralIssueV1[];
} {
  const issues = canonicalIssueOrder(drafts).map(
    (entry) => deepFrozenCopy(entry) as StructuralIssueV1,
  );
  return deepFreezeInPlace({ ok: false as const, issues: Object.freeze(issues) });
}

/** The canonical bytes of a value through the single Core owner. */
export function canonicalBytes(value: unknown): string {
  return canonicalJson(value as never);
}

/** The `sha256:` digest of the canonical bytes of a value. */
export function digestOfValue(value: unknown): string {
  return sha256Digest(canonicalJson(value as never));
}

/** The `sha256:` digest of one exact content string (its UTF-8 bytes). */
export function digestOfContent(content: string): string {
  return sha256Digest(content);
}

/** Builds the normalized snapshot: tags code-point sorted, relations deep-copied. */
export function normalizedSnapshotOf(sourceShape: SourceShape): {
  artifactId: string;
  path: string;
  version: string;
  contentDigest: string;
  blobSha: string | null;
  kind: string;
  status: string;
  owner: string;
  tags: readonly string[];
  relations: DeclaredRelationV1[];
} {
  const tags = [...sourceShape.tags].sort(compareCodePointOrder);
  return {
    artifactId: sourceShape.artifactId,
    path: sourceShape.path,
    version: sourceShape.version,
    contentDigest: sourceShape.contentDigest,
    blobSha: sourceShape.blobSha,
    kind: sourceShape.kind,
    status: sourceShape.status,
    owner: sourceShape.owner,
    tags: deepFrozenCopy(tags) as readonly string[],
    // The runtime shape is exactly the declared union; the static cast only
    // reattaches the public identity.
    relations: deepFrozenCopy(sourceShape.references) as DeclaredRelationV1[],
  };
}

/**
 * Validates one `SourceSpanV1` per §8.1.2 phase 4: all six fields present,
 * safe integers, offsets ≥ 0, lines/columns ≥ 1, `startLine ≤ endLine`,
 * `startOffset ≤ endOffset`, and same-line implies `startColumn ≤ endColumn`.
 */
export function isValidSpan(span: unknown): span is SourceSpanV1 {
  if (!isPlainObject(span)) {
    return false;
  }
  const names = Object.getOwnPropertyNames(span).sort();
  if (
    names.length !== 6 ||
    names.some(
      (name, index) =>
        name !== [
          "endColumn",
          "endLine",
          "endOffset",
          "startColumn",
          "startLine",
          "startOffset",
        ][index],
    )
  ) {
    return false;
  }
  if (Object.getOwnPropertySymbols(span).length > 0) {
    return false;
  }
  const fields = ["startLine", "startColumn", "startOffset", "endLine", "endColumn", "endOffset"];
  const values: Record<string, number> = {};
  for (const field of fields) {
    const read = readOwnField(span, field);
    if (read.state !== "data" || typeof read.value !== "number" || !Number.isSafeInteger(read.value)) {
      return false;
    }
    values[field] = read.value;
  }
  if (values.startOffset! < 0 || values.endOffset! < 0) {
    return false;
  }
  if (values.startLine! < 1 || values.startColumn! < 1 || values.endLine! < 1 || values.endColumn! < 1) {
    return false;
  }
  if (values.startLine! > values.endLine! || values.startOffset! > values.endOffset!) {
    return false;
  }
  if (values.startLine === values.endLine && values.startColumn! > values.endColumn!) {
    return false;
  }
  return true;
}

export interface ValidatedRelation {
  readonly kind: "reference" | "supersession" | "traceability";
  readonly role: string | null;
  readonly target: {
    readonly artifactId: string;
    readonly revision: number | null;
    readonly external: boolean;
  };
}

function validateRelationTarget(path: string, value: unknown, drafts: IssueDraft[]): ValidatedRelation["target"] | null {
  if (!isPlainObject(value)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(value, ["artifactId", "revision", "external"], path, drafts);
  let artifactId: string | null = null;
  const artifactField = readOwnField(value, "artifactId");
  if (artifactField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.artifactId`));
  } else if (artifactField.state === "data") {
    if (nonEmptyString(artifactField.value)) {
      artifactId = artifactField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.artifactId`));
    }
  }
  let revision: number | null = null;
  let revisionOk = false;
  const revisionField = readOwnField(value, "revision");
  if (revisionField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.revision`));
  } else if (revisionField.state === "data") {
    const target = revisionField.value;
    if (target === null || isPositiveSafeInteger(target)) {
      revision = target;
      revisionOk = true;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.revision`));
    }
  }
  let external: boolean | null = null;
  const externalField = readOwnField(value, "external");
  if (externalField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.external`));
  } else if (externalField.state === "data") {
    const target = externalField.value;
    if (typeof target === "boolean") {
      external = target;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.external`));
    }
  }
  if (artifactId === null || !revisionOk || external === null) {
    return null;
  }
  return { artifactId, revision, external };
}

function validateRelation(path: string, value: unknown, drafts: IssueDraft[]): ValidatedRelation | null {
  if (!isPlainObject(value)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(value, ["kind", "role", "target"], path, drafts);
  let kind: ValidatedRelation["kind"] | null = null;
  const kindField = readOwnField(value, "kind");
  if (kindField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.kind`));
  } else if (kindField.state === "data") {
    const candidate = kindField.value;
    if (
      candidate === "reference" ||
      candidate === "supersession" ||
      candidate === "traceability"
    ) {
      kind = candidate;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.kind`));
    }
  }
  if (kind === null) {
    return null;
  }
  let role: string | null = null;
  const roleField = readOwnField(value, "role");
  if (kind === "reference") {
    if (roleField.state === "missing") {
      drafts.push(draft("sothoth.document-index/missing-field", `${path}.role`));
    } else if (roleField.state === "data") {
      if (nonEmptyString(roleField.value)) {
        role = roleField.value;
      } else {
        drafts.push(draft("sothoth.document-index/invalid-field", `${path}.role`));
      }
    }
    if (role === null) {
      return null;
    }
  } else {
    // Supersession and traceability carry no role: absent, or the normalized
    // `null` produced by this package's own snapshots, are the only accepted
    // forms; a declared role value fails closed.
    if (roleField.state === "data" && roleField.value !== null) {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.role`));
      return null;
    }
    if (roleField.state === "accessor") {
      return null;
    }
  }
  const targetField = readOwnField(value, "target");
  if (targetField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.target`));
    return null;
  }
  if (targetField.state === "accessor") {
    return null;
  }
  const target = validateRelationTarget(`${path}.target`, targetField.value, drafts);
  if (target === null) {
    return null;
  }
  return { kind, role, target };
}

/** Validates the dense, unique, non-empty `tags` container per §8.1. */
function validateTags(path: string, value: unknown, drafts: IssueDraft[]): boolean {
  if (!isDenseArray(value)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return false;
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (!nonEmptyString(entry)) {
      drafts.push(draft("sothoth.document-index/invalid-field", path));
      return false;
    }
    if (seen.has(entry)) {
      drafts.push(draft("sothoth.document-index/invalid-field", path));
      return false;
    }
    seen.add(entry);
  }
  return true;
}

/** The validated identity/metadata shape shared by sources and snapshots. */
export interface IdentityShape {
  readonly artifactId: string;
  readonly path: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly blobSha: string | null;
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];
}

const IDENTITY_FIELDS: readonly string[] = [
  "artifactId",
  "path",
  "version",
  "kind",
  "status",
  "owner",
];

/**
 * Validates the shared identity/metadata fields of a source or a normalized
 * snapshot under `path`. Returns null when any of those fields is invalid
 * (the drafts carry the exact issues); content-dependent checks stay with
 * the caller.
 */
function validateIdentityShape(
  container: Record<string, unknown>,
  path: string,
  drafts: IssueDraft[],
): IdentityShape | null {
  let ok = true;
  const fields: Record<string, string> = {};
  for (const field of IDENTITY_FIELDS) {
    const read = readOwnField(container, field);
    if (read.state === "missing") {
      drafts.push(draft("sothoth.document-index/missing-field", `${path}.${field}`));
      ok = false;
      continue;
    }
    if (read.state === "accessor") {
      ok = false;
      continue;
    }
    if (field === "path") {
      if (isNormalizedPath(read.value)) {
        fields[field] = read.value;
      } else {
        drafts.push(draft("sothoth.document-index/invalid-field", `${path}.path`));
        ok = false;
      }
      continue;
    }
    if (nonEmptyString(read.value)) {
      fields[field] = read.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.${field}`));
      ok = false;
    }
  }
  const digestField = readOwnField(container, "contentDigest");
  let contentDigest: string | null = null;
  if (digestField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.contentDigest`));
    ok = false;
  } else if (digestField.state === "data") {
    if (typeof digestField.value === "string" && SHA256_DIGEST_PATTERN.test(digestField.value)) {
      contentDigest = digestField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.contentDigest`));
      ok = false;
    }
  } else {
    ok = false;
  }
  const blobField = readOwnField(container, "blobSha");
  let blobSha: string | null = null;
  let blobOk = false;
  if (blobField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.blobSha`));
    ok = false;
  } else if (blobField.state === "data") {
    const candidate = blobField.value;
    if (
      candidate === null ||
      (typeof candidate === "string" && BLOB_SHA_PATTERN.test(candidate))
    ) {
      blobSha = candidate;
      blobOk = true;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.blobSha`));
      ok = false;
    }
  } else {
    ok = false;
  }
  const tagsField = readOwnField(container, "tags");
  let tags: readonly string[] = [];
  if (tagsField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.tags`));
    ok = false;
  } else if (tagsField.state === "data") {
    if (!validateTags(`${path}.tags`, tagsField.value, drafts)) {
      ok = false;
    } else {
      tags = tagsField.value as readonly string[];
    }
  } else {
    ok = false;
  }
  if (!ok || contentDigest === null || !blobOk) {
    return null;
  }
  return {
    artifactId: fields.artifactId!,
    path: fields.path!,
    version: fields.version!,
    contentDigest,
    blobSha,
    kind: fields.kind!,
    status: fields.status!,
    owner: fields.owner!,
    tags,
  };
}

export interface SourceShape extends IdentityShape {
  readonly content: string;
  readonly references: readonly ValidatedRelation[];
}

/**
 * Validates one hostile `DocumentSourceV1` descriptor-only: container shape,
 * closed keys, presence, and the §8.1 field grammars. Content-dependent
 * checks (length budget, digest verification, parse) stay with the caller in
 * the §8.1 stage-1 order.
 */
export function validateSourceShape(
  source: unknown,
  path: string,
  drafts: IssueDraft[],
): SourceShape | null {
  if (!isPlainObject(source)) {
    drafts.push(draft("sothoth.document-index/invalid-input", path));
    return null;
  }
  checkClosedKeys(
    source,
    [
      "artifactId",
      "path",
      "version",
      "content",
      "contentDigest",
      "blobSha",
      "kind",
      "status",
      "owner",
      "tags",
      "references",
    ],
    path,
    drafts,
  );
  const identity = validateIdentityShape(source, path, drafts);
  let content: string | null = null;
  const contentField = readOwnField(source, "content");
  if (contentField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.content`));
  } else if (contentField.state === "data") {
    if (typeof contentField.value === "string") {
      content = contentField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.content`));
    }
  }
  const referencesField = readOwnField(source, "references");
  const references: ValidatedRelation[] = [];
  let referencesOk = false;
  if (referencesField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.references`));
  } else if (referencesField.state === "data") {
    if (isDenseArray(referencesField.value)) {
      referencesOk = true;
      const list = referencesField.value;
      for (let index = 0; index < list.length; index += 1) {
        const relation = validateRelation(
          `${path}.references[${index}]`,
          list[index],
          drafts,
        );
        if (relation !== null) {
          references.push(relation);
        }
      }
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.references`));
    }
  }
  if (identity === null || content === null || !referencesOk) {
    return null;
  }
  return { ...identity, content, references };
}

/** The validated normalized snapshot of one parsed success payload. */
export interface SnapshotShape extends IdentityShape {
  readonly relations: readonly ValidatedRelation[];
}

/** Validates a `NormalizedSourceSnapshotV1` under `path` per §8.1.2 phase 4. */
export function validateSnapshotShape(
  snapshot: unknown,
  path: string,
  drafts: IssueDraft[],
): SnapshotShape | null {
  if (!isPlainObject(snapshot)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(
    snapshot,
    [
      "artifactId",
      "path",
      "version",
      "contentDigest",
      "blobSha",
      "kind",
      "status",
      "owner",
      "tags",
      "relations",
    ],
    path,
    drafts,
  );
  const identity = validateIdentityShape(snapshot, path, drafts);
  const relationsField = readOwnField(snapshot, "relations");
  const relations: ValidatedRelation[] = [];
  let relationsOk = false;
  if (relationsField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.relations`));
  } else if (relationsField.state === "data") {
    if (isDenseArray(relationsField.value)) {
      relationsOk = true;
      const list = relationsField.value;
      for (let index = 0; index < list.length; index += 1) {
        const relation = validateRelation(
          `${path}.relations[${index}]`,
          list[index],
          drafts,
        );
        if (relation !== null) {
          relations.push(relation);
        }
      }
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.relations`));
    }
  }
  if (identity === null || !relationsOk) {
    return null;
  }
  return { ...identity, relations };
}

/** The validated five-dimension budget shape; positive integers, no time. */
export interface BudgetShape extends DocumentIndexBudgetsV1 {}

const BUDGET_FIELDS: readonly string[] = [
  "maxContentCodeUnits",
  "maxDocuments",
  "maxAstNodes",
  "maxRelationsPerDocument",
  "maxHeadingTextCodeUnits",
];

export function validateBudgets(
  budgets: unknown,
  path: string,
  drafts: IssueDraft[],
): BudgetShape | null {
  if (!isPlainObject(budgets)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(budgets, BUDGET_FIELDS, path, drafts);
  let ok = true;
  const values: Record<string, number> = {};
  for (const field of BUDGET_FIELDS) {
    const read = readOwnField(budgets, field);
    if (read.state === "missing") {
      drafts.push(draft("sothoth.document-index/missing-field", `${path}.${field}`));
      ok = false;
      continue;
    }
    if (read.state === "accessor") {
      ok = false;
      continue;
    }
    if (isPositiveSafeInteger(read.value)) {
      values[field] = read.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.${field}`));
      ok = false;
    }
  }
  if (!ok) {
    return null;
  }
  if (values.maxDocuments! < 1) {
    drafts.push(draft("sothoth.document-index/invalid-field", `${path}.maxDocuments`));
    return null;
  }
  return {
    maxContentCodeUnits: values.maxContentCodeUnits!,
    maxDocuments: values.maxDocuments!,
    maxAstNodes: values.maxAstNodes!,
    maxRelationsPerDocument: values.maxRelationsPerDocument!,
    maxHeadingTextCodeUnits: values.maxHeadingTextCodeUnits!,
  };
}

export type CompilerShape = CompilerIdentityV1;

export function validateCompiler(
  compiler: unknown,
  path: string,
  drafts: IssueDraft[],
): CompilerShape | null {
  if (!isPlainObject(compiler)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(compiler, ["compilerId", "compilerRevision"], path, drafts);
  let compilerId: string | null = null;
  const idField = readOwnField(compiler, "compilerId");
  if (idField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.compilerId`));
  } else if (idField.state === "data") {
    if (nonEmptyString(idField.value)) {
      compilerId = idField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.compilerId`));
    }
  }
  let compilerRevision: number | null = null;
  const revisionField = readOwnField(compiler, "compilerRevision");
  if (revisionField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.compilerRevision`));
  } else if (revisionField.state === "data") {
    if (isPositiveSafeInteger(revisionField.value)) {
      compilerRevision = revisionField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.compilerRevision`));
    }
  }
  if (compilerId === null || compilerRevision === null) {
    return null;
  }
  return { compilerId, compilerRevision };
}

/** The validated payload of a supplied success envelope (§8.1.2 phase 4). */
export interface ValidatedSuccess {
  readonly artifactId: string;
  readonly path: string;
  readonly relations: readonly ValidatedRelation[];
  readonly nodes: readonly ParsedBlockNodeV1[];
}

export type StageOutcome =
  | { readonly kind: "failure"; readonly drafts: readonly IssueDraft[] }
  | { readonly kind: "success"; readonly value: ValidatedSuccess };

function validateHeadingDepth(
  path: string,
  value: unknown,
  problems: IssueDraft[] | null,
): boolean {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 6) {
    return true;
  }
  problems?.push(draft("sothoth.document-index/invalid-field", path));
  return false;
}

/** Validates one closed `ParsedBlockNodeV1` member under `path`. */
function validateBlockNode(
  path: string,
  node: unknown,
  problems: IssueDraft[] | null,
): boolean {
  if (!isPlainObject(node)) {
    problems?.push(draft("sothoth.document-index/invalid-field", path));
    return false;
  }
  const typeField = readOwnField(node, "type");
  if (typeField.state === "missing") {
    problems?.push(draft("sothoth.document-index/missing-field", `${path}.type`));
    return false;
  }
  if (typeField.state !== "data" || typeof typeField.value !== "string") {
    problems?.push(draft("sothoth.document-index/invalid-field", `${path}.type`));
    return false;
  }
  const type = typeField.value;
  let ok = true;
  if (type === "heading") {
    checkClosedKeys(node, ["type", "depth", "text", "span"], path, problems);
    const depthField = readOwnField(node, "depth");
    if (depthField.state === "missing") {
      problems?.push(draft("sothoth.document-index/missing-field", `${path}.depth`));
      ok = false;
    } else if (depthField.state === "data") {
      if (!validateHeadingDepth(`${path}.depth`, depthField.value, problems)) {
        ok = false;
      }
    } else {
      ok = false;
    }
    ok = validateStringField(node, "text", path, problems, true) && ok;
    ok = validateSpanField(node, path, problems) && ok;
    return ok;
  }
  if (type === "html") {
    checkClosedKeys(node, ["type", "value", "span"], path, problems);
    ok = validateStringField(node, "value", path, problems, true) && ok;
    ok = validateSpanField(node, path, problems) && ok;
    return ok;
  }
  if (type === "block") {
    checkClosedKeys(node, ["type", "blockKind", "span"], path, problems);
    const kindField = readOwnField(node, "blockKind");
    if (kindField.state === "missing") {
      problems?.push(draft("sothoth.document-index/missing-field", `${path}.blockKind`));
      ok = false;
    } else if (kindField.state === "data") {
      if (typeof kindField.value !== "string" || !ROOT_BLOCK_KINDS.has(kindField.value)) {
        problems?.push(draft("sothoth.document-index/invalid-field", `${path}.blockKind`));
        ok = false;
      }
    } else {
      ok = false;
    }
    ok = validateSpanField(node, path, problems) && ok;
    return ok;
  }
  problems?.push(draft("sothoth.document-index/invalid-field", `${path}.type`));
  return false;
}

/** Reads one required-or-optional string field and flags wrong types. */
function validateStringField(
  container: Record<string, unknown>,
  field: string,
  path: string,
  problems: IssueDraft[] | null,
  mayBeEmpty: boolean,
): boolean {
  const read = readOwnField(container, field);
  if (read.state === "missing") {
    problems?.push(draft("sothoth.document-index/missing-field", `${path}.${field}`));
    return false;
  }
  if (read.state === "accessor") {
    return false;
  }
  if (typeof read.value !== "string" || (!mayBeEmpty && read.value === "")) {
    problems?.push(draft("sothoth.document-index/invalid-field", `${path}.${field}`));
    return false;
  }
  return true;
}

/** Reads and validates the `span` field of a block node. */
function validateSpanField(
  container: Record<string, unknown>,
  path: string,
  problems: IssueDraft[] | null,
): boolean {
  const read = readOwnField(container, "span");
  if (read.state === "missing") {
    problems?.push(draft("sothoth.document-index/missing-field", `${path}.span`));
    return false;
  }
  if (read.state === "accessor") {
    return false;
  }
  if (!isValidSpan(read.value)) {
    problems?.push(draft("sothoth.document-index/invalid-field", `${path}.span`));
    return false;
  }
  return true;
}

/** Validates the `parsed` payload of a supplied success envelope. */
function validateParsedPayload(
  parsed: unknown,
  path: string,
  artifactId: string,
  drafts: IssueDraft[],
): ParsedBlockNodeV1[] | null {
  if (!isPlainObject(parsed)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(parsed, ["artifactId", "nodes"], path, drafts);
  let ok = true;
  const idField = readOwnField(parsed, "artifactId");
  if (idField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.artifactId`));
    ok = false;
  } else if (idField.state === "data") {
    if (!nonEmptyString(idField.value)) {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.artifactId`));
      ok = false;
    } else if (idField.value !== artifactId) {
      // Cross-field identity: a crafted success cannot masquerade as a
      // different artifact (§8.1.2 phase 4).
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.artifactId`));
      ok = false;
    }
  }
  const nodesField = readOwnField(parsed, "nodes");
  let nodes: ParsedBlockNodeV1[] = [];
  if (nodesField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.nodes`));
    ok = false;
  } else if (nodesField.state === "data") {
    if (isDenseArray(nodesField.value)) {
      const list = nodesField.value;
      for (let index = 0; index < list.length; index += 1) {
        if (!validateBlockNode(`${path}.nodes[${index}]`, list[index], drafts)) {
          ok = false;
        }
      }
      if (ok) {
        nodes = deepFrozenCopy(list) as ParsedBlockNodeV1[];
      }
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.nodes`));
      ok = false;
    }
  } else {
    ok = false;
  }
  return ok ? nodes : null;
}

function validateLocation(
  path: string,
  location: unknown,
  drafts: IssueDraft[],
): StructuralIssueLocationV1 | null {
  if (!isPlainObject(location)) {
    drafts.push(draft("sothoth.document-index/invalid-field", path));
    return null;
  }
  checkClosedKeys(location, ["artifactId", "span"], path, drafts);
  let ok = true;
  let artifactId: string | null = null;
  const idField = readOwnField(location, "artifactId");
  if (idField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.artifactId`));
    ok = false;
  } else if (idField.state === "data") {
    if (nonEmptyString(idField.value)) {
      artifactId = idField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.artifactId`));
      ok = false;
    }
  } else {
    ok = false;
  }
  const spanField = readOwnField(location, "span");
  let span: SourceSpanV1 | null = null;
  if (spanField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${path}.span`));
    ok = false;
  } else if (spanField.state === "data") {
    if (isValidSpan(spanField.value)) {
      span = spanField.value;
    } else {
      drafts.push(draft("sothoth.document-index/invalid-field", path));
      ok = false;
    }
  } else {
    ok = false;
  }
  if (!ok || artifactId === null || span === null) {
    return null;
  }
  return { artifactId, span };
}

function validateIssueEntry(
  path: string,
  entry: unknown,
  problems: IssueDraft[],
  accepted: IssueDraft[],
): void {
  if (!isPlainObject(entry)) {
    problems.push(draft("sothoth.document-index/invalid-field", path));
    return;
  }
  checkClosedKeys(entry, ["code", "subject", "location"], path, problems);
  let code: StructuralIssueCodeV1 | null = null;
  const codeField = readOwnField(entry, "code");
  if (codeField.state === "missing") {
    problems.push(draft("sothoth.document-index/missing-field", `${path}.code`));
  } else if (codeField.state === "data") {
    if (typeof codeField.value === "string" && ISSUE_CODES.has(codeField.value)) {
      code = codeField.value as StructuralIssueCodeV1;
    } else {
      problems.push(draft("sothoth.document-index/invalid-field", `${path}.code`));
    }
  }
  let subject: string | null = null;
  const subjectField = readOwnField(entry, "subject");
  if (subjectField.state === "missing") {
    problems.push(draft("sothoth.document-index/missing-field", `${path}.subject`));
  } else if (subjectField.state === "data") {
    if (nonEmptyString(subjectField.value)) {
      subject = subjectField.value;
    } else {
      problems.push(draft("sothoth.document-index/invalid-field", `${path}.subject`));
    }
  }
  if (code === null || subject === null) {
    return;
  }
  const locationField = readOwnField(entry, "location");
  if (locationField.state === "missing") {
    problems.push(draft("sothoth.document-index/missing-field", `${path}.location`));
    return;
  }
  if (locationField.state === "accessor") {
    problems.push(draft("sothoth.document-index/invalid-field", `${path}.location`));
    return;
  }
  if (LOCATED_CODES.has(code)) {
    const location = validateLocation(`${path}.location`, locationField.value, problems);
    if (location === null) {
      return;
    }
    accepted.push({ code, subject, location });
  } else {
    if (locationField.value !== null) {
      problems.push(draft("sothoth.document-index/invalid-field", `${path}.location`));
      return;
    }
    accepted.push({ code, subject, location: null });
  }
}

/**
 * The shared §8.1.2 hostile stage-envelope validator. Single-envelope stages
 * pass root `parsed`; the array stage validates each element with root
 * `parsed[k]`. Phases run in the exact §8.1.2 order with the documented
 * suppression cascade; a validated crafted failure forwards with canonical
 * value and bytes equal to its issues; a validated crafted success is
 * observationally indistinguishable from a produced one.
 */
export function validateStageEnvelope(input: unknown, root: string): StageOutcome {
  const drafts: IssueDraft[] = [];
  if (!isPlainObject(input)) {
    drafts.push(draft("sothoth.document-index/invalid-input", root));
    return { kind: "failure", drafts };
  }
  checkClosedKeys(input, ["ok", "source", "parsed", "issues"], root, drafts);
  const okField = readOwnField(input, "ok");
  if (okField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${root}.ok`));
    return { kind: "failure", drafts };
  }
  if (okField.state === "accessor") {
    return { kind: "failure", drafts };
  }
  if (typeof okField.value !== "boolean") {
    drafts.push(draft("sothoth.document-index/invalid-field", `${root}.ok`));
    return { kind: "failure", drafts };
  }
  const sourceField = readOwnField(input, "source");
  const parsedField = readOwnField(input, "parsed");
  const issuesField = readOwnField(input, "issues");
  if (okField.value) {
    if (issuesField.state !== "missing") {
      drafts.push(draft("sothoth.document-index/unknown-field", `${root}.issues`));
    }
    if (sourceField.state === "missing") {
      drafts.push(draft("sothoth.document-index/missing-field", `${root}.source`));
    }
    if (parsedField.state === "missing") {
      drafts.push(draft("sothoth.document-index/missing-field", `${root}.parsed`));
    }
    if (sourceField.state !== "data" || parsedField.state !== "data") {
      return { kind: "failure", drafts };
    }
    const snapshot = validateSnapshotShape(sourceField.value, `${root}.source`, drafts);
    if (snapshot === null) {
      return { kind: "failure", drafts };
    }
    const nodes = validateParsedPayload(
      parsedField.value,
      `${root}.parsed`,
      snapshot.artifactId,
      drafts,
    );
    if (nodes === null || drafts.length > 0) {
      return { kind: "failure", drafts };
    }
    return {
      kind: "success",
      value: {
        artifactId: snapshot.artifactId,
        path: snapshot.path,
        relations: snapshot.relations,
        nodes,
      },
    };
  }
  if (issuesField.state === "missing") {
    drafts.push(draft("sothoth.document-index/missing-field", `${root}.issues`));
    return { kind: "failure", drafts };
  }
  if (sourceField.state !== "missing") {
    drafts.push(draft("sothoth.document-index/unknown-field", `${root}.source`));
  }
  if (parsedField.state !== "missing") {
    drafts.push(draft("sothoth.document-index/unknown-field", `${root}.parsed`));
  }
  if (issuesField.state !== "data") {
    return { kind: "failure", drafts };
  }
  const list = issuesField.value;
  if (!isDenseArray(list) || list.length === 0) {
    drafts.push(draft("sothoth.document-index/invalid-field", `${root}.issues`));
    return { kind: "failure", drafts };
  }
  const problems: IssueDraft[] = [];
  const accepted: IssueDraft[] = [];
  for (let index = 0; index < list.length; index += 1) {
    validateIssueEntry(`${root}.issues[${index}]`, list[index], problems, accepted);
  }
  if (drafts.length > 0 || problems.length > 0) {
    return { kind: "failure", drafts: [...drafts, ...problems] };
  }
  return { kind: "failure", drafts: accepted };
}

/** The element array of the array stage must itself be dense and undecorated. */
export function validateStageArray(input: unknown): IssueDraft[] | null {
  if (!isDenseArray(input)) {
    return [draft("sothoth.document-index/invalid-input", "parsed")];
  }
  return null;
}

/** One structurally and integrity-valid cache candidate (§8.8 phases 1–2). */
export interface CacheCandidate {
  readonly index: number;
  readonly key: CompilerIdentityKey;
  readonly value: Record<string, unknown>;
}

export interface CompilerIdentityKey {
  readonly contentDigest: string;
  readonly compiler: CompilerIdentityV1;
}

function keyBytes(key: CompilerIdentityKey): string {
  return canonicalJson({
    contentDigest: key.contentDigest,
    compiler: { compilerId: key.compiler.compilerId, compilerRevision: key.compiler.compilerRevision },
  });
}

/**
 * Validates the caller-held cache container per §8.8 phases 1–2: entry,
 * key, and value shapes descriptor-only, then derivation-digest integrity
 * with any Core grammar exception normalized to the typed cache failure.
 * Duplicate or malformed keys fail closed as `invalid-cache-key` at
 * `cache[k].key`; structurally malformed values fail as
 * `cache-entry-corrupt` at `cache[k]`; zero getters execute anywhere.
 */
export function validateCacheContainer(
  cache: unknown,
  drafts: IssueDraft[],
): CacheCandidate[] {
  if (!isDenseArray(cache)) {
    drafts.push(draft("sothoth.document-index/invalid-input", "input.cache"));
    return [];
  }
  const candidates: CacheCandidate[] = [];
  const seenKeys = new Set<string>();
  for (let index = 0; index < cache.length; index += 1) {
    const entryPath = `cache[${index}]`;
    const entry = cache[index];
    if (!isPlainObject(entry)) {
      drafts.push(draft("sothoth.document-index/invalid-input", entryPath));
      continue;
    }
    const keyField = readOwnField(entry, "key");
    if (keyField.state !== "data") {
      drafts.push(draft("sothoth.document-index/invalid-cache-key", `${entryPath}.key`));
      continue;
    }
    const key = validateCacheKey(keyField.value, `${entryPath}.key`, drafts);
    if (key === null) {
      continue;
    }
    const keyId = keyBytes(key);
    if (seenKeys.has(keyId)) {
      drafts.push(draft("sothoth.document-index/invalid-cache-key", `${entryPath}.key`));
      continue;
    }
    seenKeys.add(keyId);
    const valueField = readOwnField(entry, "value");
    if (valueField.state !== "data") {
      drafts.push(draft("sothoth.document-index/cache-entry-corrupt", entryPath));
      continue;
    }
    const value = validateCacheValue(valueField.value, entryPath, drafts);
    if (value === null) {
      continue;
    }
    candidates.push({ index, key, value });
  }
  return candidates;
}

function validateCacheKey(
  key: unknown,
  path: string,
  drafts: IssueDraft[],
): CompilerIdentityKey | null {
  if (!isPlainObject(key)) {
    drafts.push(draft("sothoth.document-index/invalid-cache-key", path));
    return null;
  }
  const names = Object.getOwnPropertyNames(key);
  const present = new Set(names);
  if (names.length !== 2 || !present.has("contentDigest") || !present.has("compiler")) {
    drafts.push(draft("sothoth.document-index/invalid-cache-key", path));
    return null;
  }
  if (Object.getOwnPropertySymbols(key).length > 0) {
    drafts.push(draft("sothoth.document-index/invalid-cache-key", path));
    return null;
  }
  const digestField = readOwnField(key, "contentDigest");
  if (
    digestField.state !== "data" ||
    typeof digestField.value !== "string" ||
    !SHA256_DIGEST_PATTERN.test(digestField.value)
  ) {
    drafts.push(draft("sothoth.document-index/invalid-cache-key", path));
    return null;
  }
  const compilerField = readOwnField(key, "compiler");
  if (compilerField.state !== "data") {
    drafts.push(draft("sothoth.document-index/invalid-cache-key", path));
    return null;
  }
  const compiler = validateCompiler(compilerField.value, `${path}.compiler`, []);
  if (compiler === null) {
    drafts.push(draft("sothoth.document-index/invalid-cache-key", path));
    return null;
  }
  return { contentDigest: digestField.value, compiler };
}

const HEADING_FIELDS: readonly string[] = ["ordinal", "depth", "text", "anchor", "span"];
const SECTION_FIELDS: readonly string[] = ["sectionId", "markerSpan", "headingOrdinal", "headingSpan"];
const CACHE_VALUE_FIELDS: readonly string[] = [
  "schema",
  "contentDigest",
  "nodes",
  "headings",
  "sections",
  "derivationDigest",
];

const CACHE_SCHEMA = "sothoth.document-index/blob-cache-entry@1";

/** Validates one cached derivation value; any violation is a corrupt entry. */
function validateCacheValue(
  value: unknown,
  entryPath: string,
  drafts: IssueDraft[],
): Record<string, unknown> | null {
  // The cache grammar is coarse: every violation normalizes to the single
  // `cache-entry-corrupt` issue at the entry path, never to field-level
  // drafts (§8.8 phase 1).
  const corrupt = (): null => {
    drafts.push(draft("sothoth.document-index/cache-entry-corrupt", entryPath));
    return null;
  };
  if (!isPlainObject(value)) {
    return corrupt();
  }
  const names = Object.getOwnPropertyNames(value);
  const valueFields = new Set(names);
  if (names.length !== CACHE_VALUE_FIELDS.length || CACHE_VALUE_FIELDS.some((field) => !valueFields.has(field))) {
    return corrupt();
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return corrupt();
  }
  const schemaField = readOwnField(value, "schema");
  if (schemaField.state !== "data" || schemaField.value !== CACHE_SCHEMA) {
    return corrupt();
  }
  const digestField = readOwnField(value, "contentDigest");
  if (
    digestField.state !== "data" ||
    typeof digestField.value !== "string" ||
    !SHA256_DIGEST_PATTERN.test(digestField.value)
  ) {
    return corrupt();
  }
  const nodesField = readOwnField(value, "nodes");
  if (nodesField.state !== "data" || !isDenseArray(nodesField.value)) {
    return corrupt();
  }
  for (let index = 0; index < nodesField.value.length; index += 1) {
    if (!validateBlockNode(`${entryPath}.nodes[${index}]`, nodesField.value[index], null)) {
      return corrupt();
    }
  }
  const headingsField = readOwnField(value, "headings");
  if (headingsField.state !== "data" || !isDenseArray(headingsField.value)) {
    return corrupt();
  }
  const headingSpans = new Map<number, SourceSpanV1>();
  for (let index = 0; index < headingsField.value.length; index += 1) {
    const heading = headingsField.value[index];
    if (!isPlainObject(heading)) {
      return corrupt();
    }
    const headingNames = new Set(Object.getOwnPropertyNames(heading));
    if (headingNames.size !== 5 || !HEADING_FIELDS.every((field) => headingNames.has(field))) {
      return corrupt();
    }
    const ordinalField = readOwnField(heading, "ordinal");
    if (ordinalField.state !== "data" || !isPositiveSafeInteger(ordinalField.value)) {
      return corrupt();
    }
    const depthField = readOwnField(heading, "depth");
    if (depthField.state !== "data" || !validateHeadingDepth(`${entryPath}.depth`, depthField.value, null)) {
      return corrupt();
    }
    const textField = readOwnField(heading, "text");
    const anchorField = readOwnField(heading, "anchor");
    const spanField = readOwnField(heading, "span");
    if (
      textField.state !== "data" ||
      typeof textField.value !== "string" ||
      anchorField.state !== "data" ||
      typeof anchorField.value !== "string" ||
      spanField.state !== "data" ||
      !isValidSpan(spanField.value)
    ) {
      return corrupt();
    }
    headingSpans.set(ordinalField.value, spanField.value);
  }
  const sectionsField = readOwnField(value, "sections");
  if (sectionsField.state !== "data" || !isDenseArray(sectionsField.value)) {
    return corrupt();
  }
  for (let index = 0; index < sectionsField.value.length; index += 1) {
    const section = sectionsField.value[index];
    if (!isPlainObject(section)) {
      return corrupt();
    }
    const sectionNames = new Set(Object.getOwnPropertyNames(section));
    if (sectionNames.size !== 4 || !SECTION_FIELDS.every((field) => sectionNames.has(field))) {
      return corrupt();
    }
    const idField = readOwnField(section, "sectionId");
    if (
      idField.state !== "data" ||
      typeof idField.value !== "string" ||
      !SECTION_ID_PATTERN.test(idField.value)
    ) {
      return corrupt();
    }
    const ordinalField = readOwnField(section, "headingOrdinal");
    if (ordinalField.state !== "data" || !isPositiveSafeInteger(ordinalField.value)) {
      return corrupt();
    }
    const markerField = readOwnField(section, "markerSpan");
    const headingSpanField = readOwnField(section, "headingSpan");
    if (
      markerField.state !== "data" ||
      !isValidSpan(markerField.value) ||
      headingSpanField.state !== "data" ||
      !isValidSpan(headingSpanField.value)
    ) {
      return corrupt();
    }
    // Every section's headingOrdinal resolves to one cached heading whose
    // headingSpan agrees (§8.8).
    const linked = headingSpans.get(ordinalField.value);
    if (linked === undefined || canonicalJson(linked) !== canonicalJson(headingSpanField.value)) {
      return corrupt();
    }
  }
  const derivationField = readOwnField(value, "derivationDigest");
  if (derivationField.state !== "data" || typeof derivationField.value !== "string") {
    return corrupt();
  }
  // Integrity: recompute the derivation digest over the value minus its own
  // field. Any Core grammar exception (including a hostile deep nesting
  // RangeError) normalizes to the typed cache failure.
  try {
    const input = { ...value } as Record<string, unknown>;
    delete input.derivationDigest;
    const recomputed = sha256Digest(canonicalJson(input as never));
    if (recomputed !== derivationField.value) {
      return corrupt();
    }
  } catch {
    return corrupt();
  }
  return deepFrozenCopy(value) as Record<string, unknown>;
}

/** One emitter of declared relations plus its identity anchor. */
export interface RelationEmitter {
  readonly artifactId: string;
  readonly path: string;
  readonly relations: readonly ValidatedRelation[];
  /**
   * Original whole-input position. Index assembly resolves the shape-valid
   * subset of a mixed input, so its emitters carry their original `sources[i]`
   * positions; the `/references` stage omits the field and keeps dense array
   * positions (every element is valid by then).
   */
  readonly sourceIndex?: number;
}

/**
 * The shared §8.5 resolution core for the `/references` stage and the whole
 * index assembly, including the package's single Graph value import
 * (§6.1: the only `@project-sothoth/graph/digraph` import lives in the internal
 * modules; §8.6: exactly one Graph function is called, a runtime import of
 * `createCanonicalGraphV1`). `anchor` selects the subject root: `parsed[k]`
 * elements chain through `.source.relations[j]`; index assembly chains
 * `sources[i].references[j]`, with `i` the emitter's original whole-input
 * position (`sourceIndex`) so a mixed input's shape-valid subset keeps stable
 * subjects. Cross-source duplicate identities fail closed
 * per §8.1.1 (stage-agnostic §9 triggers); duplicates suppress the later
 * identities' universe participation but not their field validation. Returns
 * null exactly when `drafts` accumulated the failure.
 */
export function resolveRelations(
  emitters: readonly RelationEmitter[],
  anchor: "parsed" | "sources",
  drafts: IssueDraft[],
): ReferencesSuccessV1 | null {
  const seenArtifactIds = new Set<string>();
  const suppressedIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const emitter of emitters) {
    if (seenArtifactIds.has(emitter.artifactId)) {
      drafts.push(
        draft("sothoth.document-index/duplicate-artifact-id", emitter.artifactId),
      );
      suppressedIds.add(emitter.artifactId);
    }
    seenArtifactIds.add(emitter.artifactId);
    if (seenPaths.has(emitter.path)) {
      drafts.push(draft("sothoth.document-index/duplicate-path", emitter.path));
    }
    seenPaths.add(emitter.path);
  }
  const universe = new Set([...seenArtifactIds].filter((id) => !suppressedIds.has(id)));
  const records: ResolvedRelationRecordV1[] = [];
  for (let emitterIndex = 0; emitterIndex < emitters.length; emitterIndex += 1) {
    const emitter = emitters[emitterIndex]!;
    const firstIndexes = new Map<string, number>();
    for (let relationIndex = 0; relationIndex < emitter.relations.length; relationIndex += 1) {
      const relation = emitter.relations[relationIndex]!;
      const emitterIndexForPath = emitter.sourceIndex ?? emitterIndex;
      const path =
        anchor === "parsed"
          ? `parsed[${emitterIndex}].source.relations[${relationIndex}]`
          : `sources[${emitterIndexForPath}].references[${relationIndex}]`;
      const valueKey = canonicalJson({
        kind: relation.kind,
        role: relation.role,
        target: relation.target,
      });
      const firstIndex = firstIndexes.get(valueKey);
      if (firstIndex !== undefined) {
        const firstPath =
          anchor === "parsed"
            ? `parsed[${emitterIndex}].source.relations[${firstIndex}]`
            : `sources[${emitterIndexForPath}].references[${firstIndex}]`;
        drafts.push(
          draft("sothoth.document-index/duplicate-relation", firstPath),
        );
        continue;
      }
      firstIndexes.set(valueKey, relationIndex);
      const targetInUniverse = universe.has(relation.target.artifactId);
      if (!relation.target.external && !targetInUniverse) {
        drafts.push(
          draft(
            "sothoth.document-index/unresolved-relation-target",
            `${path}.target.artifactId`,
          ),
        );
        continue;
      }
      if (relation.target.external && targetInUniverse) {
        drafts.push(
          draft(
            "sothoth.document-index/external-target-contradiction",
            `${path}.target.artifactId`,
          ),
        );
        continue;
      }
      records.push({
        relationId: canonicalJson({
          from: emitter.artifactId,
          kind: relation.kind,
          role: relation.role,
          to: relation.target.artifactId,
          revision: relation.target.revision,
        }),
        fromArtifactId: emitter.artifactId,
        kind: relation.kind,
        role: relation.role,
        target: relation.target,
      });
    }
  }
  if (drafts.length > 0) {
    return null;
  }
  // Graph mapping (§8.6): one node per universe artifact id plus one per
  // distinct declared-external target id (`facets = { "external": true }`);
  // one edge per relation record, `role` = the opaque kind or
  // `reference:<role>` string Graph never interprets, no weights. The
  // mapping is validated by construction, so creation cannot fail, and the
  // Graph canonical edge order — ascending `(sortKey, edge id)` — IS the
  // projection's relation-record order.
  const externalIds = new Set<string>();
  for (const record of records) {
    if (record.target.external) {
      externalIds.add(record.target.artifactId);
    }
  }
  const declaration: DirectedMultigraphDeclarationV1 = {
    nodes: [
      ...[...universe].map((id) => ({ node: { id }, sortKey: id })),
      ...[...externalIds].map((id) => ({
        node: { id, facets: { external: true } },
        sortKey: id,
      })),
    ],
    edges: records.map((record) => ({
      id: record.relationId,
      sortKey: record.relationId,
      edge: {
        role: record.kind === "reference" ? `reference:${record.role}` : record.kind,
        fromNodeId: record.fromArtifactId,
        toNodeId: record.target.artifactId,
      },
    })),
  };
  const created = createCanonicalGraphV1(declaration);
  if (!created.ok) {
    // Unreachable by construction (§8.6): endpoints resolve, node ids and
    // edge identities are unique, and sort keys are non-empty.
    throw new Error("canonical graph creation failed for a validated mapping");
  }
  records.sort((left, right) => compareCodePointOrder(left.relationId, right.relationId));
  const relationOrder = created.graph.edges.map((edge) => edge.id);
  return deepFreezeInPlace({
    ok: true as const,
    relations: deepFreezeInPlace(records) as readonly ResolvedRelationRecordV1[],
    graph: deepFreezeInPlace({ relationOrder: Object.freeze(relationOrder) }),
  }) as ReferencesSuccessV1;
}
