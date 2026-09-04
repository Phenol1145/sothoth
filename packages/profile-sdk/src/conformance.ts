/**
 * Public module `@sothoth/profile-sdk/conformance` (also carrying the
 * `/recommendations` surface, which maps to this same dist file): the
 * non-authoritative conformance Projection and the Recommended Skill
 * Catalog validation.
 *
 * `runProfileConformanceV1` is the only lifecycle: caller-owned profile
 * values enter, the closed structure and every semantic rule are validated
 * fail-closed, and one immutable conformance result comes back — finalized
 * Structured Diagnostics under the declared
 * `sothoth.profile-sdk/profile-diagnostic@1` observation identity, the
 * single outcome folded through `@sothoth/core`, and the canonical echo of
 * exactly the facts that were evaluated. An `impact` relation is never
 * promoted to an ordering edge: `orderingRelationKinds` classifies a
 * relation kind as ordering only when an explicit, versioned, caller-owned
 * mapping assigns that role, and the result never carries graph edges,
 * waves, or schedule output of its own.
 *
 * `validateRecommendedSkillCatalogV1` validates the caller-supplied,
 * human-curated, versioned catalog. Recommendations are recorded references
 * only: this module — and no other code path in the package — never
 * searches, crawls, discovers, downloads, hosts, installs, or invokes a
 * skill, and never resolves a floating revision. The package never reads
 * the catalog file from disk; callers supply the parsed value.
 */

import {
  DIGEST_PATTERN,
  isDiagnosticCodeV1,
  validateExactRecordV1,
} from "@sothoth/contracts";
import type {
  CompilationOutcomeKindV1,
  ContractIssueV1,
  DiagnosticCodeV1,
  DigestV1,
  StructuredDiagnosticV1,
} from "@sothoth/contracts";
import { aggregateOutcome } from "@sothoth/core/outcome";
import { canonicalJson } from "@sothoth/core/canonical-json";
import { sha256Digest } from "@sothoth/core/digest";
import {
  canonicalizeProfileV1,
  compareCodePointOrder,
  deepFreezeInPlace,
  finalizeFindings,
  findingDraft,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  sortIssues,
} from "./index.js";
import { validateProfileV1 } from "./profile.js";
import type {
  DiagnosticHelpEntryV1,
  ModuleLockV1,
  RelationRoleMappingV1,
} from "./profile.js";

/** The exact schema identity of a `RecommendedSkillCatalogV1`. */
export const RECOMMENDED_SKILL_CATALOG_SCHEMA_V1 = "sothoth.profile/recommended-skill-catalog@1";

/** The closed field set of a `RecommendedSkillCatalogV1`. */
export const RECOMMENDED_SKILL_CATALOG_FIELDS_V1 = Object.freeze([
  "schema",
  "catalogId",
  "catalogRevision",
  "automaticDiscovery",
  "recommendations",
] as const);

/** The closed field set of one recommendation: exactly the Dossier's allowed fields. */
export const RECOMMENDED_SKILL_FIELDS_V1 = Object.freeze([
  "applicable-diagnostic",
  "digest",
  "exact-commit-or-tag",
  "license",
  "path",
  "source-repository",
] as const);

/**
 * The operation classes no code path of this package ever performs on a
 * skill: the Dossier's closed prohibited-operation list.
 */
export const SKILL_PROHIBITED_OPERATIONS_V1 = Object.freeze([
  "crawl",
  "discover",
  "download",
  "host",
  "install",
  "invoke",
  "search",
] as const);

/** Matches one exact commit: forty lowercase hex characters. */
export const EXACT_COMMIT_PATTERN_V1 = /^[0-9a-f]{40}$/;

/** Matches one exact tag: a `v`-prefixed semantic version. */
export const EXACT_TAG_PATTERN_V1 = /^v[0-9]+\.[0-9]+\.[0-9]+$/;

/** One human-curated, exactly locked skill recommendation. */
export interface RecommendedSkillV1 {
  /** The non-core diagnostic code the recommendation applies to. */
  readonly "applicable-diagnostic": DiagnosticCodeV1;
  /** The SHA-256 digest of the locked content, `sha256:` + 64 lowercase hex. */
  readonly digest: DigestV1;
  /** The exact upstream commit or tag; branches and `latest` are inexpressible. */
  readonly "exact-commit-or-tag": string;
  /** The license identifier of the locked content. */
  readonly license: string;
  /** The exact path of the skill inside the source repository. */
  readonly path: string;
  /** The exact source repository identity. */
  readonly "source-repository": string;
}

/** The caller-supplied, human-curated, versioned recommended-skill catalog. */
export interface RecommendedSkillCatalogV1 {
  readonly schema: typeof RECOMMENDED_SKILL_CATALOG_SCHEMA_V1;
  /** The exact catalog identity. */
  readonly catalogId: string;
  /** The catalog's positive integer revision. */
  readonly catalogRevision: number;
  /** Always false: automatic discovery is a forbidden capability. */
  readonly automaticDiscovery: false;
  /** The exactly locked recommendations, in canonical order. */
  readonly recommendations: readonly RecommendedSkillV1[];
}

/** The non-authoritative conformance Projection of one profile compilation. */
export interface ProfileConformanceV1 {
  readonly schema: "sothoth.profile-sdk/conformance-result@1";
  readonly phase: "conformance";
  /** The single folded outcome of the compilation. */
  readonly outcome: CompilationOutcomeKindV1;
  /** The finalized, ordered, deduplicated diagnostics. */
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The canonical digest of the conformed profile; `null` when it did not load. */
  readonly profileDigest: DigestV1 | null;
  /** Relation kinds an explicit versioned mapping classifies as ordering — and nothing else. */
  readonly orderingRelationKinds: readonly string[];
  /** The canonical echo of the evaluated relation-role mappings. */
  readonly relationRoleAssignments: readonly RelationRoleMappingV1[];
  /** The canonical echo of the evaluated Document Contract references. */
  readonly documentContractRefs: readonly string[];
  /** The canonical echo of the evaluated Gate Macro references. */
  readonly gateMacroRefs: readonly string[];
  /** The canonical echo of the evaluated diagnostic help entries. */
  readonly diagnosticHelp: readonly DiagnosticHelpEntryV1[];
  /** The canonical echo of the evaluated module locks. */
  readonly moduleLocks: readonly ModuleLockV1[];
}

function issue(code: string, subject: string): ContractIssueV1 {
  return { code, subject };
}

function isExactCommitOrTag(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (EXACT_COMMIT_PATTERN_V1.test(value) || EXACT_TAG_PATTERN_V1.test(value))
  );
}

/**
 * Collects the caller-authored help lines for one diagnostic code from a
 * possibly-invalid profile value. Only well-formed entries with a valid,
 * non-core code contribute; nothing is guessed and nothing throws.
 */
function consumerHelpFor(
  candidate: unknown,
  code: string,
): readonly string[] {
  if (!isPlainObject(candidate) || !Array.isArray(candidate.diagnosticHelp)) {
    return [];
  }
  const lines: string[] = [];
  for (const entry of candidate.diagnosticHelp) {
    if (
      isPlainObject(entry) &&
      isDiagnosticCodeV1(entry.code) &&
      entry.code === code &&
      Array.isArray(entry.help) &&
      entry.help.every((line) => isNonEmptyString(line))
    ) {
      lines.push(...(entry.help as readonly string[]));
    }
  }
  return [...lines].sort(compareCodePointOrder);
}

/** Validates one recommendation as a closed record with an exact, digested lock. */
function validateRecommendation(
  element: Record<string, unknown>,
  subject: string,
  seenIdentities: Set<string>,
): readonly ContractIssueV1[] {
  const issues: ContractIssueV1[] = [
    ...validateExactRecordV1(element, RECOMMENDED_SKILL_FIELDS_V1, subject),
  ];
  const present = (field: string): boolean => Object.hasOwn(element, field);
  for (const field of RECOMMENDED_SKILL_FIELDS_V1) {
    if (!present(field)) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.${field}`));
    }
  }
  if (present("source-repository") && !isNonEmptyString(element["source-repository"])) {
    issues.push(issue("sothoth.contracts/invalid-field", `${subject}.source-repository`));
  }
  if (present("path") && !isNonEmptyString(element.path)) {
    issues.push(issue("sothoth.contracts/invalid-field", `${subject}.path`));
  }
  if (present("license") && !isNonEmptyString(element.license)) {
    issues.push(issue("sothoth.contracts/invalid-field", `${subject}.license`));
  }
  if (
    present("applicable-diagnostic") &&
    !isDiagnosticCodeV1(element["applicable-diagnostic"])
  ) {
    issues.push(issue("sothoth.contracts/invalid-field", `${subject}.applicable-diagnostic`));
  }
  // The lock fields are exclusively lock concerns: absent, null, floating, or
  // malformed values are unlocked recommendations, never silent defaults.
  if (!isExactCommitOrTag(element["exact-commit-or-tag"])) {
    issues.push(issue("sothoth.skills/unlocked-recommendation", `${subject}.exact-commit-or-tag`));
  }
  if (typeof element.digest !== "string" || !DIGEST_PATTERN.test(element.digest)) {
    issues.push(issue("sothoth.skills/unlocked-recommendation", `${subject}.digest`));
  }
  if (
    isNonEmptyString(element["source-repository"]) &&
    isNonEmptyString(element.path)
  ) {
    const identity = `${element["source-repository"]}:${element.path}`;
    if (seenIdentities.has(identity)) {
      issues.push(issue("sothoth.skills/duplicate-identity", subject));
    } else {
      seenIdentities.add(identity);
    }
  }
  return issues;
}

/**
 * Validates a caller-supplied recommended-skill catalog value against the
 * closed curated-exact-only contract. Unknown fields, missing fields,
 * malformed values, declared automatic discovery, incompatible schema
 * revisions, duplicate recommendation identities, and — as the plan's
 * example — any recommendation without an exact upstream commit and digest
 * (`sothoth.skills/unlocked-recommendation`) fail closed as sorted
 * `{code, subject}` issues. The catalog value is never mutated, and nothing
 * is ever discovered, downloaded, installed, or invoked.
 */
export function validateRecommendedSkillCatalogV1(
  candidate: unknown,
): readonly ContractIssueV1[] {
  if (!isPlainObject(candidate)) {
    return [issue("sothoth.skills/invalid-catalog", "catalog")];
  }
  const issues: ContractIssueV1[] = [
    ...validateExactRecordV1(candidate, RECOMMENDED_SKILL_CATALOG_FIELDS_V1, "catalog"),
  ];
  const present = (field: string): boolean => Object.hasOwn(candidate, field);
  for (const field of RECOMMENDED_SKILL_CATALOG_FIELDS_V1) {
    if (!present(field)) {
      issues.push(issue("sothoth.contracts/missing-field", `catalog.${field}`));
    }
  }
  if (present("schema")) {
    if (typeof candidate.schema !== "string") {
      issues.push(issue("sothoth.contracts/invalid-field", "catalog.schema"));
    } else if (candidate.schema !== RECOMMENDED_SKILL_CATALOG_SCHEMA_V1) {
      issues.push(issue("sothoth.skills/incompatible-revision", "catalog.schema"));
    }
  }
  if (present("catalogId") && !isNonEmptyString(candidate.catalogId)) {
    issues.push(issue("sothoth.contracts/invalid-field", "catalog.catalogId"));
  }
  if (present("catalogRevision") && !isPositiveInteger(candidate.catalogRevision)) {
    issues.push(issue("sothoth.contracts/invalid-field", "catalog.catalogRevision"));
  }
  if (present("automaticDiscovery") && candidate.automaticDiscovery !== false) {
    issues.push(issue("sothoth.skills/automatic-discovery", "catalog.automaticDiscovery"));
  }
  if (present("recommendations")) {
    if (!Array.isArray(candidate.recommendations)) {
      issues.push(issue("sothoth.contracts/invalid-field", "catalog.recommendations"));
    } else {
      const seenIdentities = new Set<string>();
      for (let index = 0; index < candidate.recommendations.length; index += 1) {
        const element = candidate.recommendations[index];
        const subject = `catalog.recommendations[${index}]`;
        if (!isPlainObject(element)) {
          issues.push(issue("sothoth.contracts/invalid-field", subject));
          continue;
        }
        issues.push(...validateRecommendation(element, subject, seenIdentities));
      }
    }
  }
  return sortIssues(issues);
}

/**
 * Compiles one conformance run over caller-owned profile values. The load
 * boundary validates the closed structure; the conformance boundary reports
 * every semantic finding as a finalized Structured Diagnostic under the
 * declared observation identity, merging well-formed caller-authored help
 * lines for the firing code. Valid facts conform to a frozen Projection
 * echoing exactly what was evaluated, with the canonical profile digest and
 * the ordering classification derived only from explicit versioned
 * mappings. Nothing persists, nothing is mutated, and the result is
 * byte-stable for identical facts.
 */
export function runProfileConformanceV1(profile: unknown): ProfileConformanceV1 {
  const issues = validateProfileV1(profile);
  const drafts = issues.map((finding) =>
    findingDraft(finding.code, finding.subject, consumerHelpFor(profile, finding.code)),
  );
  const diagnostics = finalizeFindings(drafts);
  const outcome = aggregateOutcome(diagnostics).outcome;
  if (issues.length > 0) {
    return deepFreezeInPlace({
      schema: "sothoth.profile-sdk/conformance-result@1",
      phase: "conformance",
      outcome,
      diagnostics,
      diagnosticCount: diagnostics.length,
      profileDigest: null,
      orderingRelationKinds: [],
      relationRoleAssignments: [],
      documentContractRefs: [],
      gateMacroRefs: [],
      diagnosticHelp: [],
      moduleLocks: [],
    });
  }
  const canonical = canonicalizeProfileV1(profile as Record<string, unknown>);
  const profileDigest = sha256Digest(canonicalJson(canonical));
  const orderingRelationKinds = [
    ...new Set(
      canonical.relationRoleMappings
        .filter((mapping) => mapping.assignedRole === "ordering-edge")
        .map((mapping) => mapping.relationKind),
    ),
  ].sort(compareCodePointOrder);
  return deepFreezeInPlace({
    schema: "sothoth.profile-sdk/conformance-result@1",
    phase: "conformance",
    outcome,
    diagnostics,
    diagnosticCount: diagnostics.length,
    profileDigest,
    orderingRelationKinds,
    relationRoleAssignments: canonical.relationRoleMappings,
    documentContractRefs: canonical.documentContracts,
    gateMacroRefs: canonical.gateMacros,
    diagnosticHelp: canonical.diagnosticHelp,
    moduleLocks: canonical.moduleLocks,
  });
}
