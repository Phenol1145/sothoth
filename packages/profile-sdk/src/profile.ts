/**
 * Public module `@project-sothoth/profile-sdk/load` (also carrying the
 * `/contract-composition` and `/relation-roles` surfaces, which map to this
 * same dist file): the closed `ConsumerProfileV1` contract
 * (`CONTRACT/SOTHOTH/CONSUMER-PROFILE@1`).
 *
 * The caller owns every profile fact: this module reads caller-supplied
 * values, validates the closed shape fail-closed — exact identity, Document
 * Contract and Gate Macro references as caller-owned exact-reference data,
 * explicit versioned relation-role mappings, diagnostic help, and module
 * locks — and canonicalizes valid facts into one frozen, digested value. It
 * reads and rejects; it never repairs, defaults, writes back, or re-authors
 * a Profile. References use the shared exact-reference grammar
 * `<identity>@<positive integer revision>` of `@project-sothoth/contracts`; bare
 * names, `latest`, and floating refs are inexpressible.
 *
 * Neutrality fence: a profile may attach diagnostic help only to non-core
 * diagnostic codes. Consumer terms never enter the kernel-owned Structured
 * Diagnostic vocabulary (`sothoth.contracts`, `sothoth.core`,
 * `sothoth.input`). Canonical orders sort in Unicode code-point order.
 */

import {
  EXACT_REFERENCE_PATTERN,
  isDiagnosticCodeV1,
  validateExactRecordV1,
} from "@project-sothoth/contracts";
import type { ContractIssueV1, DiagnosticCodeV1, DigestV1 } from "@project-sothoth/contracts";
import { canonicalJson } from "@project-sothoth/core/canonical-json";
import { sha256Digest } from "@project-sothoth/core/digest";
import {
  canonicalizeProfileV1,
  deepFreezeInPlace,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  sortIssues,
} from "./index.js";

/** The exact schema identity of a `ConsumerProfileV1`. */
export const CONSUMER_PROFILE_SCHEMA_V1 = "sothoth.profile/consumer-profile@1";

/** The closed field set of a `ConsumerProfileV1`. */
export const CONSUMER_PROFILE_FIELDS_V1 = Object.freeze([
  "schema",
  "profileId",
  "profileRevision",
  "documentContracts",
  "gateMacros",
  "relationRoleMappings",
  "diagnosticHelp",
  "moduleLocks",
] as const);

/** The closed field set of one relation-role mapping. */
export const RELATION_ROLE_MAPPING_FIELDS_V1 = Object.freeze([
  "mappingId",
  "mappingRevision",
  "relationKind",
  "assignedRole",
  "explanation",
] as const);

/** The closed field set of one diagnostic help entry. */
export const DIAGNOSTIC_HELP_ENTRY_FIELDS_V1 = Object.freeze(["code", "help"] as const);

/** The closed field set of one module lock. */
export const MODULE_LOCK_FIELDS_V1 = Object.freeze(["moduleId", "lockedRevision"] as const);

/**
 * The closed relation-kind vocabulary of `0.1.0`: the `impact` relation that
 * expands review scope. An `impact` relation never becomes an Ordering Edge
 * by itself; only an explicit versioned mapping can classify it as ordering.
 */
export const PROFILE_RELATION_KINDS_V1 = Object.freeze(["impact"] as const);

/** A member of `PROFILE_RELATION_KINDS_V1`. */
export type ProfileRelationKindV1 = (typeof PROFILE_RELATION_KINDS_V1)[number];

/** The closed role vocabulary a relation-role mapping may assign. */
export const PROFILE_RELATION_ROLES_V1 = Object.freeze(["ordering-edge", "review-scope"] as const);

/** A member of `PROFILE_RELATION_ROLES_V1`. */
export type ProfileRelationRoleV1 = (typeof PROFILE_RELATION_ROLES_V1)[number];

/**
 * The kernel-owned diagnostic code owners. A consumer profile may never
 * attach its help — or any other consumer term — to a diagnostic code under
 * one of these owners; those codes belong to the core contracts.
 */
export const CORE_DIAGNOSTIC_CODE_OWNERS_V1 = Object.freeze([
  "sothoth.contracts",
  "sothoth.core",
  "sothoth.input",
] as const);

/** One explicit, versioned, explainable relation-role mapping. */
export interface RelationRoleMappingV1 {
  /** The exact mapping identity; unique inside one profile. */
  readonly mappingId: string;
  /** The mapping's own positive integer revision. */
  readonly mappingRevision: number;
  /** The relation kind the mapping assigns a role to. */
  readonly relationKind: ProfileRelationKindV1;
  /** The role assigned to the relation kind. */
  readonly assignedRole: ProfileRelationRoleV1;
  /** The caller-owned explanation that makes the mapping explainable. */
  readonly explanation: string;
}

/** One caller-authored help entry for a non-core diagnostic code. */
export interface DiagnosticHelpEntryV1 {
  /** The non-core diagnostic code the help lines attach to. */
  readonly code: DiagnosticCodeV1;
  /** The help lines, sorted in Unicode code-point order. */
  readonly help: readonly string[];
}

/** One module lock pinning a module to an exact reference. */
export interface ModuleLockV1 {
  /** The locked module identity; unique inside one profile. */
  readonly moduleId: string;
  /** The exact `<identity>@<positive integer revision>` lock; never floating. */
  readonly lockedRevision: string;
}

/** The caller-owned Consumer Profile facts of `CONTRACT/SOTHOTH/CONSUMER-PROFILE@1`. */
export interface ConsumerProfileV1 {
  readonly schema: typeof CONSUMER_PROFILE_SCHEMA_V1;
  /** The exact profile identity. */
  readonly profileId: string;
  /** The profile's positive integer revision. */
  readonly profileRevision: number;
  /** Document Contract references as caller-owned exact-reference data. */
  readonly documentContracts: readonly string[];
  /** Gate Macro references as caller-owned exact-reference data. */
  readonly gateMacros: readonly string[];
  /** The explicit versioned relation-role mappings, in canonical order. */
  readonly relationRoleMappings: readonly RelationRoleMappingV1[];
  /** The caller-authored diagnostic help entries, in canonical order. */
  readonly diagnosticHelp: readonly DiagnosticHelpEntryV1[];
  /** The exact module locks, in canonical order. */
  readonly moduleLocks: readonly ModuleLockV1[];
}

/** The load result of one caller-supplied profile value. */
export interface ProfileDefinitionV1 {
  /** The canonicalized, frozen profile; `null` when validation failed. */
  readonly profile: ConsumerProfileV1 | null;
  /** The sorted validation issues; empty when the profile loaded. */
  readonly issues: readonly ContractIssueV1[];
  /** The canonical digest of the loaded profile; `null` when validation failed. */
  readonly profileDigest: DigestV1 | null;
}

const RELATION_KIND_SET: ReadonlySet<string> = new Set(PROFILE_RELATION_KINDS_V1);
const RELATION_ROLE_SET: ReadonlySet<string> = new Set(PROFILE_RELATION_ROLES_V1);
const CORE_DIAGNOSTIC_OWNER_SET: ReadonlySet<string> = new Set(CORE_DIAGNOSTIC_CODE_OWNERS_V1);

function issue(code: string, subject: string): ContractIssueV1 {
  return { code, subject };
}

/** The identity of an exact reference: everything before its final `@`. */
function exactReferenceIdentity(reference: string): string {
  const cut = reference.lastIndexOf("@");
  return cut === -1 ? reference : reference.slice(0, cut);
}

/**
 * Validates one list of exact references (Document Contracts, Gate Macros):
 * each element must be a string in the exact-reference grammar, and each
 * identity may be referenced at most once — two revisions of one identity
 * are a contradiction, not a range.
 */
function validateExactReferenceList(
  value: unknown,
  field: "documentContracts" | "gateMacros",
): readonly ContractIssueV1[] {
  if (!Array.isArray(value)) {
    return [issue("sothoth.contracts/invalid-field", `profile.${field}`)];
  }
  const issues: ContractIssueV1[] = [];
  const seenIdentities = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const subject = `profile.${field}[${index}]`;
    const element = value[index];
    if (typeof element !== "string") {
      issues.push(issue("sothoth.contracts/invalid-field", subject));
      continue;
    }
    if (!EXACT_REFERENCE_PATTERN.test(element)) {
      issues.push(issue("sothoth.profile/floating-ref", subject));
      continue;
    }
    const identity = exactReferenceIdentity(element);
    if (seenIdentities.has(identity)) {
      issues.push(issue("sothoth.profile/duplicate-identity", subject));
      continue;
    }
    seenIdentities.add(identity);
  }
  return issues;
}

/** Validates the explicit versioned relation-role mappings as closed data. */
function validateRelationRoleMappings(value: unknown): readonly ContractIssueV1[] {
  if (!Array.isArray(value)) {
    return [issue("sothoth.contracts/invalid-field", "profile.relationRoleMappings")];
  }
  const issues: ContractIssueV1[] = [];
  const seenMappingIds = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const subject = `profile.relationRoleMappings[${index}]`;
    const element = value[index];
    if (!isPlainObject(element)) {
      issues.push(issue("sothoth.contracts/invalid-field", subject));
      continue;
    }
    issues.push(...validateExactRecordV1(element, RELATION_ROLE_MAPPING_FIELDS_V1, subject));
    const present = (field: string): boolean => Object.hasOwn(element, field);
    if (!present("mappingId")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.mappingId`));
    } else if (!isNonEmptyString(element.mappingId)) {
      issues.push(issue("sothoth.contracts/invalid-field", `${subject}.mappingId`));
    }
    if (!present("mappingRevision")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.mappingRevision`));
    } else if (!isPositiveInteger(element.mappingRevision)) {
      issues.push(issue("sothoth.contracts/invalid-field", `${subject}.mappingRevision`));
    }
    if (!present("relationKind")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.relationKind`));
    } else if (typeof element.relationKind !== "string" || !RELATION_KIND_SET.has(element.relationKind)) {
      issues.push(issue("sothoth.profile/unknown-mapping", `${subject}.relationKind`));
    }
    if (!present("assignedRole")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.assignedRole`));
    } else if (typeof element.assignedRole !== "string" || !RELATION_ROLE_SET.has(element.assignedRole)) {
      issues.push(issue("sothoth.profile/unknown-mapping", `${subject}.assignedRole`));
    }
    if (!present("explanation")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.explanation`));
    } else if (!isNonEmptyString(element.explanation)) {
      issues.push(issue("sothoth.contracts/invalid-field", `${subject}.explanation`));
    }
    if (isNonEmptyString(element.mappingId)) {
      if (seenMappingIds.has(element.mappingId)) {
        issues.push(issue("sothoth.profile/duplicate-identity", `${subject}.mappingId`));
      } else {
        seenMappingIds.add(element.mappingId);
      }
    }
  }
  return issues;
}

/** Validates the caller-authored diagnostic help entries and the neutrality fence. */
function validateDiagnosticHelp(value: unknown): readonly ContractIssueV1[] {
  if (!Array.isArray(value)) {
    return [issue("sothoth.contracts/invalid-field", "profile.diagnosticHelp")];
  }
  const issues: ContractIssueV1[] = [];
  const seenCodes = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const subject = `profile.diagnosticHelp[${index}]`;
    const element = value[index];
    if (!isPlainObject(element)) {
      issues.push(issue("sothoth.contracts/invalid-field", subject));
      continue;
    }
    issues.push(...validateExactRecordV1(element, DIAGNOSTIC_HELP_ENTRY_FIELDS_V1, subject));
    const present = (field: string): boolean => Object.hasOwn(element, field);
    if (!present("code")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.code`));
    } else if (!isDiagnosticCodeV1(element.code)) {
      issues.push(issue("sothoth.contracts/invalid-field", `${subject}.code`));
    } else {
      const owner = element.code.split("/")[0]!;
      if (CORE_DIAGNOSTIC_OWNER_SET.has(owner)) {
        issues.push(issue("sothoth.profile/consumer-term-in-core-contract", `${subject}.code`));
      }
      if (seenCodes.has(element.code)) {
        issues.push(issue("sothoth.profile/duplicate-identity", `${subject}.code`));
      } else {
        seenCodes.add(element.code);
      }
    }
    if (!present("help")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.help`));
    } else if (
      !Array.isArray(element.help) ||
      element.help.some((line) => !isNonEmptyString(line))
    ) {
      issues.push(issue("sothoth.contracts/invalid-field", `${subject}.help`));
    }
  }
  return issues;
}

/** Validates the exact module locks: closed records, exact revisions, unique modules. */
function validateModuleLocks(value: unknown): readonly ContractIssueV1[] {
  if (!Array.isArray(value)) {
    return [issue("sothoth.contracts/invalid-field", "profile.moduleLocks")];
  }
  const issues: ContractIssueV1[] = [];
  const seenModuleIds = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const subject = `profile.moduleLocks[${index}]`;
    const element = value[index];
    if (!isPlainObject(element)) {
      issues.push(issue("sothoth.contracts/invalid-field", subject));
      continue;
    }
    issues.push(...validateExactRecordV1(element, MODULE_LOCK_FIELDS_V1, subject));
    const present = (field: string): boolean => Object.hasOwn(element, field);
    if (!present("moduleId")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.moduleId`));
    } else if (!isNonEmptyString(element.moduleId)) {
      issues.push(issue("sothoth.contracts/invalid-field", `${subject}.moduleId`));
    }
    if (!present("lockedRevision")) {
      issues.push(issue("sothoth.contracts/missing-field", `${subject}.lockedRevision`));
    } else if (
      typeof element.lockedRevision !== "string" ||
      !EXACT_REFERENCE_PATTERN.test(element.lockedRevision)
    ) {
      issues.push(issue("sothoth.profile/floating-ref", `${subject}.lockedRevision`));
    }
    if (isNonEmptyString(element.moduleId)) {
      if (seenModuleIds.has(element.moduleId)) {
        issues.push(issue("sothoth.profile/duplicate-identity", `${subject}.moduleId`));
      } else {
        seenModuleIds.add(element.moduleId);
      }
    }
  }
  return issues;
}

/**
 * Validates a caller-supplied profile value against the closed
 * `ConsumerProfileV1` contract. Unknown fields, missing fields, malformed
 * values, floating references, duplicate identities, unknown mappings, and
 * consumer terms inside core-owned diagnostic codes all fail closed as
 * sorted `{code, subject}` issues under the shared
 * `@project-sothoth/contracts` issue vocabulary plus the profile-owned semantic
 * codes. The candidate is never mutated.
 */
export function validateProfileV1(candidate: unknown): readonly ContractIssueV1[] {
  if (!isPlainObject(candidate)) {
    return [issue("sothoth.profile/invalid-profile", "profile")];
  }
  const issues: ContractIssueV1[] = [
    ...validateExactRecordV1(candidate, CONSUMER_PROFILE_FIELDS_V1, "profile"),
  ];
  const present = (field: string): boolean => Object.hasOwn(candidate, field);
  for (const field of CONSUMER_PROFILE_FIELDS_V1) {
    if (!present(field)) {
      issues.push(issue("sothoth.contracts/missing-field", `profile.${field}`));
    }
  }
  if (present("schema")) {
    if (typeof candidate.schema !== "string") {
      issues.push(issue("sothoth.contracts/invalid-field", "profile.schema"));
    } else if (candidate.schema !== CONSUMER_PROFILE_SCHEMA_V1) {
      issues.push(issue("sothoth.profile/incompatible-revision", "profile.schema"));
    }
  }
  if (present("profileId") && !isNonEmptyString(candidate.profileId)) {
    issues.push(issue("sothoth.contracts/invalid-field", "profile.profileId"));
  }
  if (present("profileRevision") && !isPositiveInteger(candidate.profileRevision)) {
    issues.push(issue("sothoth.contracts/invalid-field", "profile.profileRevision"));
  }
  if (present("documentContracts")) {
    issues.push(...validateExactReferenceList(candidate.documentContracts, "documentContracts"));
  }
  if (present("gateMacros")) {
    issues.push(...validateExactReferenceList(candidate.gateMacros, "gateMacros"));
  }
  if (present("relationRoleMappings")) {
    issues.push(...validateRelationRoleMappings(candidate.relationRoleMappings));
  }
  if (present("diagnosticHelp")) {
    issues.push(...validateDiagnosticHelp(candidate.diagnosticHelp));
  }
  if (present("moduleLocks")) {
    issues.push(...validateModuleLocks(candidate.moduleLocks));
  }
  return sortIssues(issues);
}

/**
 * Loads one caller-supplied profile value: validates it fail-closed and, when
 * valid, canonicalizes it into one frozen `ConsumerProfileV1` whose arrays
 * sort in Unicode code-point order, and digests the canonical JSON bytes
 * through `@project-sothoth/core` so identical facts always load to identical
 * digest-bearing values regardless of input array order. When validation
 * fails, the profile and digest are `null` and the sorted issues say exactly
 * why; nothing is ever defaulted, repaired, or written back.
 */
export function defineProfileV1(candidate: unknown): ProfileDefinitionV1 {
  const issues = validateProfileV1(candidate);
  if (issues.length > 0) {
    return deepFreezeInPlace({ profile: null, issues, profileDigest: null });
  }
  const canonical = canonicalizeProfileV1(candidate as Record<string, unknown>);
  const profileDigest = sha256Digest(canonicalJson(canonical));
  return deepFreezeInPlace({ profile: canonical, issues, profileDigest });
}
