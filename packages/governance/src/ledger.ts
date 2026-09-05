/**
 * Public module `@project-sothoth/governance/ledger`: append-only ledger
 * verification.
 *
 * A ledger is a caller-owned sequence of records; every record carries its
 * identity, the digest of the payload it appends, the digest of the record
 * before it, and its own record digest — the SHA-256 digest, owned by
 * `@project-sothoth/core`, over the canonical bytes of the other three fields. A
 * genesis record links to null.
 *
 * `validateAppendOnlyLedgerV1` proves immutable prefixes: when a base ledger
 * is supplied, every base record must appear byte-identically at the head's
 * front, and the head must verify its whole chain. Mutation, removal,
 * duplicate identities, a broken chain, a forged record digest, a non-null
 * genesis link, a foreign ledger identity, or a regressed revision each fail
 * closed as a typed finding under the declared
 * `sothoth.governance/document-governance-diagnostic@1` identity. The
 * verifier reads and rejects; it never appends, repairs, or writes back.
 */

import type {
  CompilationOutcomeKindV1,
  DigestV1,
} from "@project-sothoth/contracts";
import { DIGEST_PATTERN } from "@project-sothoth/contracts";
import { canonicalJson } from "@project-sothoth/core/canonical-json";
import { sha256Digest } from "@project-sothoth/core/digest";
import type { StructuredDiagnosticV1 } from "@project-sothoth/contracts";
import {
  DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
  finalizeFindings,
  findingDraft,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  outcomeOf,
  sortFindings,
  unknownFieldNames,
} from "./index.js";
import type { PlainFindingV1 } from "./index.js";

/** The schema identity of the append-only ledger value this module verifies. */
export const APPEND_ONLY_LEDGER_SCHEMA_V1 = "sothoth.governance/append-only-ledger@1";

const LEDGER_FIELDS = ["schema", "ledgerId", "ledgerRevision", "records"] as const;
const RECORD_FIELDS = ["recordId", "payloadDigest", "previousRecordDigest", "recordDigest"] as const;

/** One append-only ledger record with its hash-chain binding. */
export interface LedgerRecordV1 {
  readonly recordId: string;
  readonly payloadDigest: DigestV1;
  readonly previousRecordDigest: DigestV1 | null;
  readonly recordDigest: DigestV1;
}

/** An append-only ledger value: identity, revision, and record sequence. */
export interface AppendOnlyLedgerV1 {
  readonly schema: typeof APPEND_ONLY_LEDGER_SCHEMA_V1;
  readonly ledgerId: string;
  readonly ledgerRevision: number;
  readonly records: readonly LedgerRecordV1[];
}

/** The input of one ledger verification: an optional base and the head. */
export interface AppendOnlyLedgerInputV1 {
  /** The previously verified prefix, or null/undefined for a genesis head. */
  readonly base?: unknown | undefined;
  /** The head ledger under verification. */
  readonly head: unknown;
}

/** The result envelope of one ledger verification. */
export interface LedgerVerificationV1 {
  readonly schema: "sothoth.governance/ledger-verification@1";
  readonly phase: "ledger";
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  /** The verified head value, or null when verification failed. */
  readonly ledger: AppendOnlyLedgerV1 | null;
  /** The number of records in the verified head (0 on failure). */
  readonly verifiedRecordCount: number;
  /** The number of records appended after the base prefix (0 on failure). */
  readonly appendedRecordCount: number;
  /** The number of records the base carried (0 without a base). */
  readonly baseRecordCount: number;
}

function isDigest(value: unknown): value is DigestV1 {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

/** The record digest formula: SHA-256 over the canonical other three fields. */
export function ledgerRecordDigestV1(record: {
  readonly recordId: string;
  readonly payloadDigest: DigestV1;
  readonly previousRecordDigest: DigestV1 | null;
}): DigestV1 {
  return sha256Digest({
    recordId: record.recordId,
    payloadDigest: record.payloadDigest,
    previousRecordDigest: record.previousRecordDigest,
  });
}

function validateLedgerShape(candidate: unknown): readonly PlainFindingV1[] {
  const findings: PlainFindingV1[] = [];
  if (!isPlainObject(candidate)) {
    return [{ code: "sothoth.governance/ledger-invalid", subject: "ledger" }];
  }
  for (const field of unknownFieldNames(candidate, LEDGER_FIELDS)) {
    findings.push({ code: "sothoth.governance/ledger-invalid", subject: field });
  }
  if (candidate.schema !== APPEND_ONLY_LEDGER_SCHEMA_V1) {
    findings.push({ code: "sothoth.governance/ledger-invalid", subject: "schema" });
  }
  if (!isNonEmptyString(candidate.ledgerId)) {
    findings.push({ code: "sothoth.governance/ledger-invalid", subject: "ledgerId" });
  }
  if (!isPositiveInteger(candidate.ledgerRevision)) {
    findings.push({ code: "sothoth.governance/ledger-invalid", subject: "ledgerRevision" });
  }
  if (!Array.isArray(candidate.records)) {
    findings.push({ code: "sothoth.governance/ledger-invalid", subject: "records" });
    return sortFindings(findings);
  }
  for (const record of candidate.records) {
    if (!isPlainObject(record)) {
      findings.push({ code: "sothoth.governance/ledger-invalid", subject: "records" });
      continue;
    }
    const recordId = isNonEmptyString(record.recordId) ? record.recordId : "records";
    for (const field of unknownFieldNames(record, RECORD_FIELDS)) {
      findings.push({ code: "sothoth.governance/ledger-invalid", subject: `${recordId}:${field}` });
    }
    if (!isNonEmptyString(record.recordId)) {
      findings.push({ code: "sothoth.governance/ledger-invalid", subject: `${recordId}:recordId` });
    }
    if (!isDigest(record.payloadDigest)) {
      findings.push({ code: "sothoth.governance/ledger-invalid", subject: `${recordId}:payloadDigest` });
    }
    if (record.previousRecordDigest !== null && !isDigest(record.previousRecordDigest)) {
      findings.push({
        code: "sothoth.governance/ledger-invalid",
        subject: `${recordId}:previousRecordDigest`,
      });
    }
    if (!isDigest(record.recordDigest)) {
      findings.push({ code: "sothoth.governance/ledger-invalid", subject: `${recordId}:recordDigest` });
    }
  }
  return sortFindings(findings);
}

function toDiagnostics(findings: readonly PlainFindingV1[], findingClass: "input" | "gates") {
  return finalizeFindings(
    findings.map((finding) =>
      findingDraft(
        finding.code,
        finding.subject,
        "ledger",
        DOCUMENT_GOVERNANCE_DIAGNOSTIC_IDENTITY_V1,
        findingClass,
      ),
    ),
  );
}

/**
 * Verifies one ledger head, optionally against a previously verified base.
 * Shape violations fold to `invalid-input`; every rule violation folds to
 * `invalid` with a typed finding and no verified ledger value.
 */
export function validateAppendOnlyLedgerV1(input: AppendOnlyLedgerInputV1): LedgerVerificationV1 {
  const envelope = {
    schema: "sothoth.governance/ledger-verification@1" as const,
    phase: "ledger" as const,
  };
  const hasBase = input.base !== undefined && input.base !== null;
  const shapeFindings = [
    ...validateLedgerShape(input.head),
    ...(hasBase ? validateLedgerShape(input.base) : []),
  ];
  if (shapeFindings.length > 0) {
    const diagnostics = toDiagnostics(shapeFindings, "input");
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      ledger: null,
      verifiedRecordCount: 0,
      appendedRecordCount: 0,
      baseRecordCount: 0,
    };
  }

  const head = input.head as AppendOnlyLedgerV1;
  const base = hasBase ? (input.base as AppendOnlyLedgerV1) : null;
  const findings: PlainFindingV1[] = [];

  if (base !== null && head.ledgerId !== base.ledgerId) {
    findings.push({ code: "sothoth.governance/ledger-identity-mismatch", subject: base.ledgerId });
  }
  if (base !== null && head.ledgerRevision < base.ledgerRevision) {
    findings.push({ code: "sothoth.governance/ledger-revision-regressed", subject: head.ledgerId });
  }

  if (base !== null) {
    for (let index = 0; index < base.records.length; index += 1) {
      const baseRecord = base.records[index]!;
      if (index >= head.records.length) {
        findings.push({
          code: "sothoth.governance/ledger-record-removed",
          subject: `${base.ledgerId}:${baseRecord.recordId}`,
        });
        continue;
      }
      const headRecord = head.records[index]!;
      if (canonicalJson(baseRecord) !== canonicalJson(headRecord)) {
        findings.push({
          code: "sothoth.governance/ledger-record-mutated",
          subject: `${base.ledgerId}:${baseRecord.recordId}`,
        });
      }
    }
  }

  const seenRecordIds = new Set<string>();
  for (const record of head.records) {
    if (seenRecordIds.has(record.recordId)) {
      findings.push({
        code: "sothoth.governance/ledger-record-duplicate",
        subject: `${head.ledgerId}:${record.recordId}`,
      });
    }
    seenRecordIds.add(record.recordId);
  }

  for (let index = 0; index < head.records.length; index += 1) {
    const record = head.records[index]!;
    const predecessor = index === 0 ? null : (head.records[index - 1] as LedgerRecordV1);
    if (index === 0 && record.previousRecordDigest !== null) {
      findings.push({
        code: "sothoth.governance/ledger-genesis-invalid",
        subject: `${head.ledgerId}:${record.recordId}`,
      });
    }
    if (predecessor !== null && record.previousRecordDigest !== predecessor.recordDigest) {
      findings.push({
        code: "sothoth.governance/ledger-chain-broken",
        subject: `${head.ledgerId}:${record.recordId}`,
      });
    }
    if (ledgerRecordDigestV1(record) !== record.recordDigest) {
      findings.push({
        code: "sothoth.governance/ledger-record-digest-mismatch",
        subject: `${head.ledgerId}:${record.recordId}`,
      });
    }
  }

  if (findings.length > 0) {
    const diagnostics = toDiagnostics(sortFindings(findings), "gates");
    return {
      ...envelope,
      outcome: outcomeOf(diagnostics),
      diagnostics,
      diagnosticCount: diagnostics.length,
      ledger: null,
      verifiedRecordCount: 0,
      appendedRecordCount: 0,
      baseRecordCount: 0,
    };
  }

  const baseRecordCount = base === null ? 0 : base.records.length;
  return {
    ...envelope,
    outcome: "valid",
    diagnostics: [],
    diagnosticCount: 0,
    ledger: head,
    verifiedRecordCount: head.records.length,
    appendedRecordCount: head.records.length - baseRecordCount,
    baseRecordCount,
  };
}
