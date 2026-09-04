// Task 6 / Governance Compilation — Registry compilation and Ledger
// append-only verification (plan Step 1). Registry validation compiles
// lifecycle bindings from Registry facts and evaluates section conformance
// against the structural facts of `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` —
// sections come from the index entries, never from re-parsing markdown.
// Ledger verification proves immutable prefixes: every base record must
// appear byte-identically at the head's front, the hash chain must close,
// and genesis, mutation, removal, duplicate, and regression conditions fail
// closed as typed findings. Neither validator writes anything back.

import { describe, expect, test } from "vitest";
import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
} from "../../packages/document-index/src/index.js";
import { validateRegistryV1 } from "../../packages/governance/src/registry.js";
import { validateAppendOnlyLedgerV1 } from "../../packages/governance/src/ledger.js";
import { canonicalJson } from "../../packages/core/src/canonical-json.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const ZERO_SPAN = {
  startLine: 1,
  startColumn: 1,
  startOffset: 0,
  endLine: 1,
  endColumn: 1,
  endOffset: 0,
};

function indexEntry(
  artifactId: string,
  sectionIds: readonly string[],
): DocumentEntryV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    artifactId,
    path: `docs/${artifactId}.md`,
    version: "1",
    kind: "test-dossier",
    status: "accepted",
    owner: "sothoth",
    tags: [],
    contentDigest: sha256Digest(`content of ${artifactId}`),
    blobSha: null,
    headings: [],
    sections: sectionIds.map((sectionId, index) => ({
      sectionId,
      markerSpan: ZERO_SPAN,
      headingId: `${artifactId}#h${index + 1}`,
      headingSpan: ZERO_SPAN,
    })),
    relations: [],
    entryDigest: sha256Digest({ artifactId, sectionIds }),
  };
}

function indexProjection(documents: readonly DocumentEntryV1[]): DocumentIndexProjectionV1 {
  return {
    schema: "sothoth.document-index/document-index@1",
    documents,
    provenance: {
      compiler: { compilerId: "test-compiler", compilerRevision: 1 },
      budgets: {
        maxContentCodeUnits: 1000,
        maxDocuments: 100,
        maxAstNodes: 1000,
        maxRelationsPerDocument: 10,
        maxHeadingTextCodeUnits: 200,
      },
      inputs: documents.map((document) => ({
        artifactId: document.artifactId,
        path: document.path,
        version: document.version,
        contentDigest: document.contentDigest,
      })),
    },
    indexDigest: sha256Digest(documents.map((document) => document.artifactId)),
  };
}

const REGISTRY = {
  schema: "sothoth.design-document-registry/v1",
  registryId: "TEST-REGISTRY",
  registryRevision: 2,
  documents: [
    {
      documentId: "DOC-A",
      documentRevision: 1,
      path: "docs/DOC-A.md",
      status: "accepted",
      sectionIds: ["alpha", "beta"],
    },
    {
      documentId: "DOC-B",
      documentRevision: 3,
      path: "docs/DOC-B.md",
      status: "proposed",
      sectionIds: ["gamma"],
    },
  ],
};

function code(result: { diagnostics: ReadonlyArray<{ code: string; subjects: readonly string[] }> }) {
  return result.diagnostics.map((diagnostic) => `${diagnostic.code}|${diagnostic.subjects.join(",")}`);
}

describe("validateRegistryV1", () => {
  test("compiles lifecycle bindings and section conformance for a conforming registry", () => {
    const result = validateRegistryV1({
      registry: REGISTRY,
      documentIndex: indexProjection([
        indexEntry("DOC-A", ["alpha", "beta"]),
        indexEntry("DOC-B", ["gamma"]),
      ]),
    });
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.schema).toBe("sothoth.governance/registry-compilation@1");
    expect(result.registry).not.toBeNull();
    expect(result.registry?.registryId).toBe("TEST-REGISTRY");
    expect(result.documents.map((document) => document.documentId)).toEqual(["DOC-A", "DOC-B"]);
    expect(result.documents.every((document) => document.sectionsConform)).toBe(true);
    expect(result.documents[0]?.indexedSectionIds).toEqual(["alpha", "beta"]);
  });

  test("binds registry documents to index entries by exact artifact identity", () => {
    const result = validateRegistryV1({
      registry: REGISTRY,
      documentIndex: indexProjection([indexEntry("DOC-A", ["alpha", "beta"])]),
    });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/registry-document-unindexed|DOC-B");
    const documentB = result.documents.find((document) => document.documentId === "DOC-B");
    expect(documentB?.indexedSectionIds).toBeNull();
    expect(documentB?.sectionsConform).toBe(false);
  });

  test("declared section identities must equal the indexed sections in document order", () => {
    const result = validateRegistryV1({
      registry: REGISTRY,
      documentIndex: indexProjection([
        indexEntry("DOC-A", ["beta", "alpha"]),
        indexEntry("DOC-B", ["gamma"]),
      ]),
    });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/document-sections-mismatch|DOC-A");
  });

  test("duplicate document identities fail closed", () => {
    const registry = {
      ...REGISTRY,
      documents: [...REGISTRY.documents, { ...REGISTRY.documents[0]! }],
    };
    const result = validateRegistryV1({
      registry,
      documentIndex: indexProjection([
        indexEntry("DOC-A", ["alpha", "beta"]),
        indexEntry("DOC-B", ["gamma"]),
      ]),
    });
    expect(result.outcome).toBe("invalid-input");
    expect(result.registry).toBeNull();
    expect(code(result)).toContain("sothoth.governance/registry-invalid|DOC-A:duplicate");
  });

  test("unknown fields, bad statuses, and malformed revisions fail closed as registry-invalid", () => {
    const registry = {
      ...REGISTRY,
      documents: [
        { ...REGISTRY.documents[0]!, extra: true },
        { ...REGISTRY.documents[1]!, status: "draft", documentRevision: 0 },
      ],
    };
    const result = validateRegistryV1({
      registry,
      documentIndex: indexProjection([
        indexEntry("DOC-A", ["alpha", "beta"]),
        indexEntry("DOC-B", ["gamma"]),
      ]),
    });
    expect(result.outcome).toBe("invalid-input");
    expect(result.registry).toBeNull();
    expect(code(result)).toContain("sothoth.governance/registry-invalid|DOC-A:extra");
    expect(code(result)).toContain("sothoth.governance/registry-invalid|DOC-B:status");
    expect(code(result)).toContain("sothoth.governance/registry-invalid|DOC-B:documentRevision");
  });

  test("a shape-invalid registry yields invalid-input and no compiled registry value", () => {
    const result = validateRegistryV1({
      registry: { schema: "other/v1", registryId: "X", registryRevision: 1 },
      documentIndex: indexProjection([]),
    });
    expect(result.outcome).toBe("invalid-input");
    expect(result.registry).toBeNull();
    expect(result.documents).toEqual([]);
    expect(code(result)).toContain("sothoth.governance/registry-invalid|documents");
  });
});

// ---------------------------------------------------------------------------
// Ledger append-only verification
// ---------------------------------------------------------------------------

function record(
  recordId: string,
  payloadDigest: string,
  previousRecordDigest: string | null,
): {
  recordId: string;
  payloadDigest: string;
  previousRecordDigest: string | null;
  recordDigest: string;
} {
  return {
    recordId,
    payloadDigest,
    previousRecordDigest,
    recordDigest: sha256Digest({ recordId, payloadDigest, previousRecordDigest }),
  };
}

function payload(index: number): string {
  return sha256Digest(`payload-${index}`);
}

function chain(count: number, ledgerRevision: number) {
  const records = [];
  let previous: string | null = null;
  for (let index = 0; index < count; index += 1) {
    const current = record(`rec-${index}`, payload(index), previous);
    records.push(current);
    previous = current.recordDigest;
  }
  return {
    schema: "sothoth.governance/append-only-ledger@1",
    ledgerId: "TEST-LEDGER",
    ledgerRevision,
    records,
  };
}

describe("validateAppendOnlyLedgerV1", () => {
  test("verifies a genesis head with a closing hash chain", () => {
    const result = validateAppendOnlyLedgerV1({ head: chain(3, 1) });
    expect(result.outcome).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.schema).toBe("sothoth.governance/ledger-verification@1");
    expect(result.ledger).not.toBeNull();
    expect(result.verifiedRecordCount).toBe(3);
    expect(result.appendedRecordCount).toBe(3);
    expect(result.baseRecordCount).toBe(0);
  });

  test("accepts an append-only continuation and reports the appended prefix length", () => {
    const base = chain(2, 1);
    const head = chain(4, 2);
    const result = validateAppendOnlyLedgerV1({ base, head });
    expect(result.outcome).toBe("valid");
    expect(result.baseRecordCount).toBe(2);
    expect(result.appendedRecordCount).toBe(2);
    expect(result.verifiedRecordCount).toBe(4);
  });

  test("accepts an unchanged re-verification of the same ledger", () => {
    const ledger = chain(3, 1);
    const result = validateAppendOnlyLedgerV1({ base: ledger, head: structuredClone(ledger) });
    expect(result.outcome).toBe("valid");
    expect(result.appendedRecordCount).toBe(0);
  });

  test("a mutated base record inside the head prefix fails closed", () => {
    const base = chain(3, 1);
    const head = chain(4, 2);
    head.records[1]!.payloadDigest = sha256Digest("tampered");
    const result = validateAppendOnlyLedgerV1({ base, head });
    expect(result.outcome).toBe("invalid");
    expect(result.ledger).toBeNull();
    expect(code(result)).toContain("sothoth.governance/ledger-record-mutated|TEST-LEDGER:rec-1");
  });

  test("a removed base record fails closed per removed identity", () => {
    const base = chain(4, 1);
    const head = chain(2, 2);
    const result = validateAppendOnlyLedgerV1({ base, head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ledger-record-removed|TEST-LEDGER:rec-2");
    expect(code(result)).toContain("sothoth.governance/ledger-record-removed|TEST-LEDGER:rec-3");
  });

  test("a wrong record digest inside the head fails closed", () => {
    const head = chain(3, 1);
    head.records[2]!.recordDigest = head.records[1]!.recordDigest;
    const result = validateAppendOnlyLedgerV1({ head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain(
      "sothoth.governance/ledger-record-digest-mismatch|TEST-LEDGER:rec-2",
    );
  });

  test("a broken previous-record link fails closed", () => {
    const head = chain(3, 1);
    head.records[2]!.previousRecordDigest = sha256Digest("not-the-real-predecessor");
    const result = validateAppendOnlyLedgerV1({ head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ledger-chain-broken|TEST-LEDGER:rec-2");
  });

  test("a non-null genesis link fails closed", () => {
    const head = chain(2, 1);
    head.records[0]!.previousRecordDigest = sha256Digest("pretend-predecessor");
    const result = validateAppendOnlyLedgerV1({ head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ledger-genesis-invalid|TEST-LEDGER:rec-0");
  });

  test("duplicate record identities inside one ledger fail closed", () => {
    const head = chain(2, 1);
    head.records[1]!.recordId = "rec-0";
    const result = validateAppendOnlyLedgerV1({ head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ledger-record-duplicate|TEST-LEDGER:rec-0");
  });

  test("a head revision below the base revision fails closed", () => {
    const base = chain(1, 5);
    const head = chain(2, 4);
    const result = validateAppendOnlyLedgerV1({ base, head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ledger-revision-regressed|TEST-LEDGER");
  });

  test("a ledger from another identity never verifies as a continuation", () => {
    const base = chain(1, 1);
    const head = { ...chain(2, 2), ledgerId: "OTHER-LEDGER" };
    const result = validateAppendOnlyLedgerV1({ base, head });
    expect(result.outcome).toBe("invalid");
    expect(code(result)).toContain("sothoth.governance/ledger-identity-mismatch|TEST-LEDGER");
  });

  test("shape-invalid ledgers fail as invalid-input with no verified value", () => {
    const malformed = { schema: "sothoth.governance/append-only-ledger@1", ledgerId: "X" };
    const result = validateAppendOnlyLedgerV1({ head: malformed });
    expect(result.outcome).toBe("invalid-input");
    expect(result.ledger).toBeNull();
    expect(code(result)).toContain("sothoth.governance/ledger-invalid|ledgerRevision");
    expect(code(result)).toContain("sothoth.governance/ledger-invalid|records");

    const badRecord = chain(2, 1);
    badRecord.records[1]!.recordDigest = "not-a-digest";
    const digestResult = validateAppendOnlyLedgerV1({ head: badRecord });
    expect(digestResult.outcome).toBe("invalid-input");
    expect(code(digestResult)).toContain("sothoth.governance/ledger-invalid|rec-1:recordDigest");
  });

  test("verification is a pure function: identical inputs yield identical results", () => {
    const head = chain(3, 1);
    const first = validateAppendOnlyLedgerV1({ head });
    const second = validateAppendOnlyLedgerV1({ head: structuredClone(head) });
    expect(canonicalJson(first)).toBe(canonicalJson(second));
  });
});
