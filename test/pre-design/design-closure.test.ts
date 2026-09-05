import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { describe, expect, test } from "vitest";
import {
  canonicalJsonStringify,
  checkPreDesign,
  parseStableSections,
} from "../../scripts/check-pre-design.mjs";
import {
  compileDesignClosureV1,
  compileScopeBomAdmissibilityV1,
} from "../../packages/governance/src/pre-design.js";
import {
  buildDocumentIndexV1,
  type DocumentSourceV1,
} from "../../packages/document-index/src/index.js";
import { DEFAULT_DOCUMENT_INDEX_BUDGETS_V1 } from "../../packages/document-index/src/parse.js";
import { sha256Digest } from "../../packages/core/src/digests.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const runCli = promisify(execFile);

const CATALOG_PATH = `${root}/docs/design/v0.1.0-design-scope-catalog.json`;
const CONTRACT_PATH = `${root}/docs/design/contracts/artifact-design-dossier.v1.json`;
const REGISTRY_PATH = `${root}/docs/design/document-registry.json`;
const REGISTRATIONS_PATH = `${root}/docs/design/artifact-design-registrations.json`;
const REVIEW_PATH = `${root}/docs/design/v0.1.0-cross-artifact-edge-review.md`;

// The review record is a local review format fixed by this task's test, deliberately distinct from
// any published Document Contract identity: it carries neither a `schema` nor a `kind` field.
const REVIEW_ID = "SOTHOTH-CROSS-ARTIFACT-EDGE-REVIEW-0.1";
const REVIEW_REVISION = 1;
const TARGET_RELEASE = "0.1.0";
const REVIEW_AUTHORITY = "non-authoritative-review-record";
const REVIEW_ACCEPTANCE_EFFECT = "none";
const REVIEW_VERDICT = "ready-for-human-acceptance-review";

const REVIEW_RECORD_FIELDS = [
  "acceptanceEffect",
  "authority",
  "componentReviews",
  "contractEdges",
  "packageDependencyEdges",
  "reviewId",
  "reviewRevision",
  "sourceFactsDigest",
  "targetRelease",
  "verdict",
  "waves",
].sort(codePointCompare);

const COMPONENT_REVIEW_FIELDS = [
  "authorityPosture",
  "compatibilityVerdict",
  "componentId",
  "designId",
  "designRevision",
  "documentId",
  "documentRevision",
  "dossierSectionRefs",
  "errorPosture",
  "lifecycleObligations",
  "observationObligations",
  "packageLifecycle",
  "retryPosture",
  "runtimeForm",
].sort(codePointCompare);

const EDGE_FIELDS = [
  "consumerComponentId",
  "consumerDeclarationRole",
  "consumerReviewComponentId",
  "consumerVerdict",
  "contractRef",
  "edgeId",
  "overallVerdict",
  "providerComponentId",
  "providerDeclarationRole",
  "providerReviewComponentId",
  "providerVerdict",
].sort(codePointCompare);

const PACKAGE_EDGE_FIELDS = ["consumerComponentId", "contractRefs", "providerComponentId"].sort(
  codePointCompare,
);

const WAVE_FIELDS = ["members", "waveIndex"].sort(codePointCompare);

// The five stable Dossier sections every component review cites. These belong to the review
// record's own closed format; they are resolved against the live registry and Dossier markdown,
// never against a copied Document Contract constant.
const DOSSIER_SECTION_REF_IDS = [
  "authority-security-and-effects",
  "deployment-configuration-and-operations",
  "failure-recovery-and-consistency",
  "observation-and-audit",
  "state-lifecycle-and-data-flow",
];

const RUNTIME_FORMS: Record<string, string> = {
  "@sothoth/cli": "cli-executable-package",
  "@sothoth/git": "library-adapter-with-git-child-process",
};
const DEFAULT_RUNTIME_FORM = "pure-library-package";
const PACKAGE_LIFECYCLE_FORM = "single-reproducible-npm-package";
const COMPATIBILITY_VERDICT = "compatible";
const EDGE_DECLARATION_ROLE = { provider: "provides", consumer: "requires" };
const EDGE_VERDICT = "compatible";
const EDGE_SEPARATOR = "->";

const REVIEW_MARKER_PATTERN = /^<!-- sothoth:review-section id="([a-z][a-z0-9-]*)" -->$/;
const REVIEW_DOC_SECTION_IDS = [
  "component-review-summaries",
  "contract-edge-matrix-summary",
  "derivation-method",
  "machine-review-record",
  "package-dag-and-waves",
  "review-identity-and-boundary",
].sort(codePointCompare);

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

function codePointCompare(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function isSortedCodePoint(values: string[]): boolean {
  return values.every((value, index) => index === 0 || codePointCompare(values[index - 1]!, value) <= 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function keysSorted(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort(codePointCompare);
}

function diagnostic(code: string, subject: string) {
  return { code, subject };
}

function sortDiagnostics(issues: Array<{ code: string; subject: string }>) {
  return issues.sort(
    (left, right) =>
      codePointCompare(left.code, right.code) || codePointCompare(left.subject, right.subject),
  );
}

// A fulfilled promisified `execFile` result carries only `stdout` and `stderr`: the process exited
// 0, so an absent `code` normalizes to exit 0. Rejected results keep their real nonzero exit code.
function exitCodeOf(result: any): number {
  return typeof result?.code === "number" ? result.code : 0;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

let factsCache: any = null;

async function loadFacts(): Promise<any> {
  if (!factsCache) {
    const catalog = await readJson(CATALOG_PATH);
    const contract = await readJson(CONTRACT_PATH);
    const registry = await readJson(REGISTRY_PATH);
    const registrations = await readJson(REGISTRATIONS_PATH);
    const documents: Record<string, string> = {};
    for (const entry of registry.documents) {
      documents[entry.documentId] = await readFile(`${root}/${entry.path}`, "utf8");
    }
    factsCache = { phase: "closure", catalog, contract, registry, documents, registrations };
  }
  return structuredClone(factsCache);
}

let dossierSectionsCache: Map<string, string[]> | null = null;

async function dossierSectionIds(): Promise<Map<string, string[]>> {
  if (!dossierSectionsCache) {
    const facts = await loadFacts();
    const map = new Map<string, string[]>();
    for (const entry of facts.registry.documents) {
      const parsed = parseStableSections(facts.documents[entry.documentId]);
      expect(parsed.issues, `dossier ${entry.documentId} must parse without marker issues`).toEqual([]);
      map.set(entry.documentId, parsed.sectionIds);
    }
    dossierSectionsCache = map;
  }
  return dossierSectionsCache;
}

const HISTORICAL_FACTS_PATH = `${root}/test/fixtures/pre-design-bootstrap/design-closure.pre-acceptance-r1.json`;
const HISTORICAL_REVISION_2_FACTS_PATH = `${root}/test/fixtures/pre-design-bootstrap/design-closure.pre-acceptance-r2.json`;

// The two exact digests the frozen revision-2 fixture must replay to: the closure digest of the
// accepted revision-2 system and the scope digest of the same accepted revision-2 system with only
// `phase` changed to "scope". They are committed constants of this test, never recomputed targets.
const HISTORICAL_REVISION_2_CLOSURE_DIGEST = "sha256:bc390f1123eacbbd8376e04f75b85e95e9cf9135edc5b71234a0198bc9d99a2c";
const HISTORICAL_REVISION_2_SCOPE_DIGEST = "sha256:f4d538f55ba0349859c32a43984edc3dd83f60566dd791a2a245b7e90bb8156c";

let historicalFactsCache: any = null;

// The frozen revision-1 pre-acceptance closure-fact snapshot: the full fact set the Task 7 review
// record was compiled against, with all eleven registration statuses at their historical
// `proposed` stage. It was captured before any live revision-2 edit and is immutable; live
// revision-3 facts are never cloned or rolled back to reconstruct this historical view.
async function loadHistoricalRevision1Facts(): Promise<any> {
  if (!historicalFactsCache) {
    historicalFactsCache = JSON.parse(await readFile(HISTORICAL_FACTS_PATH, "utf8"));
  }
  return structuredClone(historicalFactsCache);
}

let historicalRevision2FactsCache: any = null;

// The frozen revision-2 accepted-state snapshot: the complete fact object captured immediately
// before the revision-3 materialization, with all eleven registration statuses at their historical
// `accepted` stage. It preserves revision-2 history; it is not a reconstruction of the earlier
// revision-1 pre-acceptance state, and no status is ever rolled back to produce it.
async function loadHistoricalRevision2Facts(): Promise<any> {
  if (!historicalRevision2FactsCache) {
    historicalRevision2FactsCache = JSON.parse(await readFile(HISTORICAL_REVISION_2_FACTS_PATH, "utf8"));
  }
  return structuredClone(historicalRevision2FactsCache);
}

let historicalSectionsCache: Map<string, string[]> | null = null;

// The frozen historical section map: stable section IDs parsed from the revision-1 Dossier bytes
// carried by the frozen fixture, never from live revision-3 documents.
async function historicalDossierSectionIds(): Promise<Map<string, string[]>> {
  if (!historicalSectionsCache) {
    const facts = await loadHistoricalRevision1Facts();
    const map = new Map<string, string[]>();
    for (const entry of facts.registry.documents) {
      const parsed = parseStableSections(facts.documents[entry.documentId]);
      expect(parsed.issues, `historical dossier ${entry.documentId} must parse without marker issues`).toEqual([]);
      map.set(entry.documentId, parsed.sectionIds);
    }
    historicalSectionsCache = map;
  }
  return historicalSectionsCache;
}

// Historical replay engine: the frozen bootstrap checker validates the Design Scope Catalog
// through the migrated `@project-sothoth` allowlist, so it structurally rejects the old-scope
// catalogs embedded in the frozen pre-acceptance snapshots (they are historical records and stay
// byte-identical). The shipped Governance compiler (packages/governance/src/pre-design.ts)
// validates the same facts dynamically and produces byte-identical projections — proven against
// the frozen checker over the live revision-4 facts by
// test/migration/pre-design-bootstrap-equivalence.test.ts — so the historical replays below run
// through it; the frozen snapshot bytes and the pinned digest constants never change.
function buildHistoricalIndex(facts: any) {
  const sources: DocumentSourceV1[] = facts.registry.documents.map((entry: any) => {
    const content: string = facts.documents[entry.documentId];
    return {
      artifactId: entry.documentId,
      path: entry.path,
      version: String(entry.documentRevision),
      content,
      contentDigest: sha256Digest(content),
      blobSha: null,
      kind: facts.contract.documentKind,
      status: entry.status,
      owner: "sothoth",
      tags: [],
      references: [],
    };
  });
  const result = buildDocumentIndexV1({
    sources,
    budgets: DEFAULT_DOCUMENT_INDEX_BUDGETS_V1,
    compiler: { compilerId: "sothoth.governance/pre-design-replay", compilerRevision: 1 },
  });
  if (!result.ok) {
    throw new Error(`historical index build failed: ${canonicalJsonStringify(result.issues)}`);
  }
  return result.projection;
}

function historicalClosureCompile(facts: any) {
  return compileDesignClosureV1({ ...facts, documentIndex: buildHistoricalIndex(facts) });
}

function historicalScopeCompile(facts: any) {
  return compileScopeBomAdmissibilityV1({ ...facts, documentIndex: buildHistoricalIndex(facts) });
}

// Structural reading of the review document: CommonMark AST only. The review owns a marker grammar
// that is deliberately distinct from the Dossier contract marker grammar.
function parseReviewDocument(markdown: string) {
  const tree = fromMarkdown(markdown);
  const children = Array.isArray(tree.children) ? tree.children : [];
  const sectionIds: string[] = [];
  const markerIssues: Array<{ code: string; subject: string }> = [];
  const jsonBlocks: string[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const node: any = children[index];
    if (node.type === "code" && node.lang === "json") {
      jsonBlocks.push(String(node.value));
      continue;
    }
    if (node.type !== "html") continue;
    const match = REVIEW_MARKER_PATTERN.exec(typeof node.value === "string" ? node.value : "");
    if (!match) continue;
    const next = children[index + 1];
    if (!next || next.type !== "heading") {
      markerIssues.push(
        diagnostic("sothoth.edge-review/review-marker-not-followed-by-heading", match[1]!),
      );
      continue;
    }
    if (sectionIds.includes(match[1]!)) {
      markerIssues.push(diagnostic("sothoth.edge-review/review-marker-duplicate", match[1]!));
    }
    sectionIds.push(match[1]!);
  }
  return { sectionIds, markerIssues, jsonBlocks };
}

async function loadReview(): Promise<{ record: any; sectionIds: string[]; markerIssues: Array<any> }> {
  const markdown = await readFile(REVIEW_PATH, "utf8");
  const parsed = parseReviewDocument(markdown);
  expect(parsed.jsonBlocks.length, "exactly one machine-readable JSON block").toBe(1);
  return {
    record: JSON.parse(parsed.jsonBlocks[0]!),
    sectionIds: parsed.sectionIds,
    markerIssues: parsed.markerIssues,
  };
}

function canonicalEdgeId(provider: string, contractRef: string, consumer: string): string {
  return provider + EDGE_SEPARATOR + contractRef + EDGE_SEPARATOR + consumer;
}

// Derivation one: exact contract edges straight from the eleven registrations. This is the only
// owner of the edge truth; the review record is compared against it and never the reverse.
function deriveContractEdges(registrations: any) {
  const providerCounts = new Map<string, Set<string>>();
  for (const registration of registrations.registrations) {
    for (const ref of registration.providedContractRefs) {
      const providers = providerCounts.get(ref) ?? new Set<string>();
      providers.add(registration.componentId);
      providerCounts.set(ref, providers);
    }
  }
  const edges: Array<{ edgeId: string; providerComponentId: string; contractRef: string; consumerComponentId: string }> = [];
  for (const registration of registrations.registrations) {
    for (const ref of registration.requiredContractRefs) {
      const providers = [...(providerCounts.get(ref) ?? new Set<string>())].sort(codePointCompare);
      expect(providers.length, `required contract ${ref} must have exactly one provider`).toBe(1);
      edges.push({
        edgeId: canonicalEdgeId(providers[0]!, ref, registration.componentId),
        providerComponentId: providers[0]!,
        contractRef: ref,
        consumerComponentId: registration.componentId,
      });
    }
  }
  edges.sort((left, right) => codePointCompare(left.edgeId, right.edgeId));
  return { edges, providerCounts };
}

// Derivation two: collapse distinct contract refs on the same provider/consumer package pair.
function derivePackageDag(edges: Array<{ providerComponentId: string; consumerComponentId: string; contractRef: string }>) {
  const collapsed = new Map<string, { providerComponentId: string; consumerComponentId: string; contractRefs: Set<string> }>();
  for (const edge of edges) {
    const key = edge.providerComponentId + EDGE_SEPARATOR + edge.consumerComponentId;
    const entry = collapsed.get(key) ?? {
      providerComponentId: edge.providerComponentId,
      consumerComponentId: edge.consumerComponentId,
      contractRefs: new Set<string>(),
    };
    entry.contractRefs.add(edge.contractRef);
    collapsed.set(key, entry);
  }
  const dag = [...collapsed.values()]
    .map((entry) => ({ ...entry, contractRefs: [...entry.contractRefs].sort(codePointCompare) }))
    .sort((left, right) =>
      codePointCompare(
        left.providerComponentId + EDGE_SEPARATOR + left.consumerComponentId,
        right.providerComponentId + EDGE_SEPARATOR + right.consumerComponentId,
      ),
    );
  return dag;
}

// Derivation three: zero-based deterministic waves. A component enters the first wave in which all
// of its contract-dependency predecessors are already placed; ties break by Unicode code point.
function deriveWaves(dag: Array<{ providerComponentId: string; consumerComponentId: string }>) {
  const nodes = [...new Set(dag.flatMap((edge) => [edge.providerComponentId, edge.consumerComponentId]))].sort(
    codePointCompare,
  );
  const predecessors = new Map(nodes.map((node) => [node, new Set<string>()]));
  for (const edge of dag) predecessors.get(edge.consumerComponentId)!.add(edge.providerComponentId);
  const placed = new Set<string>();
  const waves: Array<{ waveIndex: number; members: string[] }> = [];
  while (placed.size < nodes.length) {
    const members = nodes.filter(
      (node) =>
        !placed.has(node) && [...predecessors.get(node)!].every((provider) => placed.has(provider)),
    );
    expect(members.length, "the contract dependency DAG must be acyclic").toBeGreaterThan(0);
    waves.push({ waveIndex: waves.length, members });
    for (const member of members) placed.add(member);
  }
  return waves;
}

// The review validator compares existing Source Facts with the review record. It owns no domain
// truth of its own: every expected value is derived from the facts handed to it.
function reviewDiagnostics(facts: any, record: any, dossierSections: Map<string, string[]>) {
  const issues: Array<{ code: string; subject: string }> = [];
  const registrations = facts.registrations.registrations;
  const registrationByComponent = new Map(registrations.map((registration: any) => [registration.componentId, registration]));
  const registryById = new Map(facts.registry.documents.map((entry: any) => [entry.documentId, entry]));
  const { edges } = deriveContractEdges(facts.registrations);
  const derivedDag = derivePackageDag(edges);
  const derivedWaves = deriveWaves(derivedDag);

  if (!isPlainObject(record) || !arraysEqualMultiset(keysSorted(record), REVIEW_RECORD_FIELDS)) {
    return sortDiagnostics([diagnostic("sothoth.edge-review/record-shape-invalid", "review-record")]);
  }
  if (record.reviewId !== REVIEW_ID) issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "reviewId"));
  if (record.reviewRevision !== REVIEW_REVISION) issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "reviewRevision"));
  if (record.targetRelease !== TARGET_RELEASE) issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "targetRelease"));
  if (record.authority !== REVIEW_AUTHORITY) issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "authority"));
  if (record.acceptanceEffect !== REVIEW_ACCEPTANCE_EFFECT) issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "acceptanceEffect"));
  if (record.verdict !== REVIEW_VERDICT) issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "verdict"));
  if (!isNonEmptyString(record.sourceFactsDigest) || !DIGEST_PATTERN.test(record.sourceFactsDigest)) {
    issues.push(diagnostic("sothoth.edge-review/record-field-invalid", "sourceFactsDigest"));
  }

  // Criterion identity discipline is checked over the live registrations so the review can never
  // vouch for a registration whose criteria are empty or duplicated within one registration.
  for (const registration of registrations) {
    const componentId = registration.componentId;
    const seen = new Set<string>();
    for (const criterion of registration.acceptanceCriteria ?? []) {
      if (!isNonEmptyString(criterion.criterionId)) {
        issues.push(diagnostic("sothoth.edge-review/criterion-identity-invalid", componentId));
        continue;
      }
      if (seen.has(criterion.criterionId)) {
        issues.push(diagnostic("sothoth.edge-review/criterion-identity-duplicate", componentId));
      }
      seen.add(criterion.criterionId);
    }
  }

  const reviews = record.componentReviews;
  if (!Array.isArray(reviews) || reviews.length !== registrationByComponent.size) {
    issues.push(diagnostic("sothoth.edge-review/component-review-count", "componentReviews"));
  } else {
    if (!isSortedCodePoint(reviews.map((review: any) => String(review.componentId)))) {
      issues.push(diagnostic("sothoth.edge-review/component-review-order", "componentReviews"));
    }
    const reviewIds = new Set<string>();
    for (const review of reviews) {
      const componentId = isNonEmptyString(review?.componentId) ? review.componentId : "componentReviews";
      if (!arraysEqualMultiset(keysSorted(review), COMPONENT_REVIEW_FIELDS)) {
        issues.push(diagnostic("sothoth.edge-review/component-review-field-missing", componentId));
        continue;
      }
      if (reviewIds.has(review.componentId)) {
        issues.push(diagnostic("sothoth.edge-review/component-review-duplicate", review.componentId));
      }
      reviewIds.add(review.componentId);
      const registration = registrationByComponent.get(review.componentId);
      const registryEntry = registryById.get(review.documentId);
      if (!registration || review.designId !== registration.designId || review.designRevision !== registration.designRevision) {
        issues.push(diagnostic("sothoth.edge-review/component-review-binding-mismatch", review.componentId));
      }
      if (
        !registryEntry ||
        review.documentId !== registration?.documentRef?.documentId ||
        review.documentRevision !== registration?.documentRef?.documentRevision ||
        review.documentRevision !== registryEntry.documentRevision
      ) {
        issues.push(diagnostic("sothoth.edge-review/component-review-binding-mismatch", review.componentId));
      }
      const expectedRuntimeForm = RUNTIME_FORMS[review.componentId] ?? DEFAULT_RUNTIME_FORM;
      if (review.runtimeForm !== expectedRuntimeForm) {
        issues.push(diagnostic("sothoth.edge-review/component-review-field-invalid", review.componentId));
      }
      if (review.packageLifecycle !== PACKAGE_LIFECYCLE_FORM) {
        issues.push(diagnostic("sothoth.edge-review/component-review-field-invalid", review.componentId));
      }
      if (review.compatibilityVerdict !== COMPATIBILITY_VERDICT) {
        issues.push(diagnostic("sothoth.edge-review/component-review-field-invalid", review.componentId));
      }
      for (const posture of [review.errorPosture, review.retryPosture, review.authorityPosture, review.lifecycleObligations, review.observationObligations]) {
        if (!isNonEmptyString(posture)) {
          issues.push(diagnostic("sothoth.edge-review/component-review-field-invalid", review.componentId));
        }
      }
      const refs = review.dossierSectionRefs;
      const expectedRefs = DOSSIER_SECTION_REF_IDS.map((sectionId) => ({
        documentId: registration?.documentRef?.documentId,
        documentRevision: registration?.documentRef?.documentRevision,
        sectionId,
      }));
      if (canonicalJsonStringify(refs) !== canonicalJsonStringify(expectedRefs)) {
        issues.push(diagnostic("sothoth.edge-review/dossier-section-refs-invalid", review.componentId));
      } else {
        for (const reference of refs) {
          const parsed = dossierSections.get(reference.documentId);
          if (!parsed || !parsed.includes(reference.sectionId)) {
            issues.push(diagnostic("sothoth.edge-review/dossier-section-refs-invalid", review.componentId));
            break;
          }
        }
      }
    }
    for (const componentId of registrationByComponent.keys()) {
      if (!reviewIds.has(componentId)) {
        issues.push(diagnostic("sothoth.edge-review/component-review-missing", componentId));
      }
    }
  }

  const rows = record.contractEdges;
  if (!Array.isArray(rows) || rows.length !== edges.length) {
    issues.push(diagnostic("sothoth.edge-review/edge-count", "contractEdges"));
  } else {
    const derivedIds = edges.map((edge) => edge.edgeId);
    const reviewIds = rows.map((row: any) => String(row.edgeId));
    if (!isSortedCodePoint(reviewIds)) {
      issues.push(diagnostic("sothoth.edge-review/edge-order", "contractEdges"));
    }
    if (!arraysEqualMultiset(reviewIds, derivedIds)) {
      issues.push(diagnostic("sothoth.edge-review/edge-set-mismatch", "contractEdges"));
    }
    for (const row of rows) {
      const edgeId = isNonEmptyString(row?.edgeId) ? row.edgeId : "contractEdges";
      if (!arraysEqualMultiset(keysSorted(row), EDGE_FIELDS)) {
        issues.push(diagnostic("sothoth.edge-review/edge-field-missing", edgeId));
      }
      // Review-reference resolution is checked on every row regardless of shape closure, so a
      // deleted provider- or consumer-side reference always produces its dedicated diagnostic.
      if (!reviewIdsSet(record).has(row.providerReviewComponentId) || row.providerReviewComponentId !== row.providerComponentId) {
        issues.push(diagnostic("sothoth.edge-review/provider-review-missing", edgeId));
      }
      if (!reviewIdsSet(record).has(row.consumerReviewComponentId) || row.consumerReviewComponentId !== row.consumerComponentId) {
        issues.push(diagnostic("sothoth.edge-review/consumer-review-missing", edgeId));
      }
      const provider = registrationByComponent.get(row.providerComponentId);
      const consumer = registrationByComponent.get(row.consumerComponentId);
      const providerDeclares = provider?.providedContractRefs?.includes(row.contractRef) === true;
      const consumerDeclares = consumer?.requiredContractRefs?.includes(row.contractRef) === true;
      if (!providerDeclares || !consumerDeclares || row.providerComponentId === row.consumerComponentId) {
        issues.push(diagnostic("sothoth.edge-review/producer-consumer-mismatch", edgeId));
      }
      if (
        !isNonEmptyString(row.edgeId) ||
        row.edgeId !== canonicalEdgeId(row.providerComponentId, row.contractRef, row.consumerComponentId)
      ) {
        issues.push(diagnostic("sothoth.edge-review/edge-id-non-canonical", edgeId));
      }
      if (row.providerDeclarationRole !== EDGE_DECLARATION_ROLE.provider || row.consumerDeclarationRole !== EDGE_DECLARATION_ROLE.consumer) {
        issues.push(diagnostic("sothoth.edge-review/edge-field-invalid", edgeId));
      }
      if (row.providerVerdict !== EDGE_VERDICT || row.consumerVerdict !== EDGE_VERDICT || row.overallVerdict !== EDGE_VERDICT) {
        issues.push(diagnostic("sothoth.edge-review/edge-verdict-invalid", edgeId));
      }
    }
  }

  const dagRows = record.packageDependencyEdges;
  if (!Array.isArray(dagRows) || dagRows.length !== derivedDag.length) {
    issues.push(diagnostic("sothoth.edge-review/dag-count", "packageDependencyEdges"));
  } else {
    if (
      !dagRows.every((row: any) => arraysEqualMultiset(keysSorted(row), PACKAGE_EDGE_FIELDS))
    ) {
      issues.push(diagnostic("sothoth.edge-review/dag-field-invalid", "packageDependencyEdges"));
    } else {
      if (
        !dagRows.every((row: any, index: number) =>
          canonicalJsonStringify(row) === canonicalJsonStringify(derivedDag[index]),
        )
      ) {
        issues.push(diagnostic("sothoth.edge-review/dag-set-mismatch", "packageDependencyEdges"));
      }
      if (!isSortedCodePoint(dagRows.map((row: any) => row.providerComponentId + EDGE_SEPARATOR + row.consumerComponentId))) {
        issues.push(diagnostic("sothoth.edge-review/dag-order", "packageDependencyEdges"));
      }
      const pairKeys = new Set(dagRows.map((row: any) => row.providerComponentId + EDGE_SEPARATOR + row.consumerComponentId));
      for (const row of dagRows) {
        if (
          row.providerComponentId === row.consumerComponentId ||
          pairKeys.has(row.consumerComponentId + EDGE_SEPARATOR + row.providerComponentId)
        ) {
          issues.push(diagnostic("sothoth.edge-review/dag-pair-invalid", "packageDependencyEdges"));
        }
      }
    }
  }

  const waveRows = record.waves;
  if (!Array.isArray(waveRows) || waveRows.length !== derivedWaves.length) {
    issues.push(diagnostic("sothoth.edge-review/wave-count", "waves"));
  } else {
    if (!waveRows.every((row: any) => arraysEqualMultiset(keysSorted(row), WAVE_FIELDS))) {
      issues.push(diagnostic("sothoth.edge-review/wave-field-invalid", "waves"));
    } else {
      if (
        !waveRows.every((row: any, index: number) => canonicalJsonStringify(row) === canonicalJsonStringify(derivedWaves[index]))
      ) {
        issues.push(diagnostic("sothoth.edge-review/wave-set-mismatch", "waves"));
      }
      if (!waveRows.every((row: any, index: number) => row.waveIndex === index)) {
        issues.push(diagnostic("sothoth.edge-review/wave-order", "waves"));
      }
      for (const row of waveRows) {
        if (!Array.isArray(row.members) || !isSortedCodePoint(row.members)) {
          issues.push(diagnostic("sothoth.edge-review/wave-members-order", "waves"));
        }
      }
      const flattened = waveRows.flatMap((row: any) => row.members);
      const componentIds = [...registrationByComponent.keys()];
      if (!arraysEqualMultiset(flattened, componentIds)) {
        issues.push(diagnostic("sothoth.edge-review/wave-partition-invalid", "waves"));
      }
    }
  }

  return sortDiagnostics(issues);
}

function reviewIdsSet(record: any): Set<string> {
  return new Set(
    Array.isArray(record?.componentReviews)
      ? record.componentReviews.map((review: any) => String(review?.componentId))
      : [],
  );
}

// Multiset equality of string arrays: order-insensitive membership with exact counts. Field-set
// closure and set comparisons use this; dedicated ordering assertions check sort separately.
function arraysEqualMultiset(left: string[], right: string[]): boolean {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].sort(codePointCompare);
  const b = [...right].sort(codePointCompare);
  return a.every((value, index) => value === b[index]);
}

describe("closure projection over real Source Facts", () => {
  test("eleven accepted registrations project to a valid, acceptance-ready closure", async () => {
    const result = checkPreDesign(await loadFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    const projection = result.projection;
    expect(projection.schema).toBe("sothoth.design-closure-projection/v1");
    expect(projection.readyForAcceptance).toBe(true);
    expect(projection.memberCount).toBe(11);
    expect(projection.sourceFactsDigest).toMatch(DIGEST_PATTERN);
    expect(projection.members.map((member: any) => member.componentId).sort(codePointCompare)).toEqual(
      [
        "@project-sothoth/cli",
        "@project-sothoth/contracts",
        "@project-sothoth/core",
        "@project-sothoth/document-index",
        "@project-sothoth/git",
        "@project-sothoth/governance",
        "@project-sothoth/graph",
        "@project-sothoth/planning",
        "@project-sothoth/profile-sdk",
        "@project-sothoth/sdk",
        "@project-sothoth/selectors",
      ],
    );
    // Historically, the eleven revision-1 registrations were accepted by the external human owner
    // on 2026-09-03 (Task 8). The live revision-4 facts keep all eleven registrations accepted
    // under their own recorded acceptance acts; the exact status assertion replaces the former
    // broad pre-acceptance substring check.
    expect(projection.members.every((member: any) => member.registrationStatus === "accepted")).toBe(true);
    expect(new Set(projection.members.map((member: any) => member.registrationStatus))).toEqual(
      new Set(["accepted"]),
    );
  });

  test("live revision-4 facts stay scope-admissible with Architecture Baseline revision 4 and Scope BOM revision 4", async () => {
    const facts = await loadFacts();
    facts.phase = "scope";
    facts.architectureBaseline = await readJson(`${root}/docs/design/v0.1.0-architecture-baseline.json`);
    facts.scopeBom = await readJson(`${root}/docs/release/v0.1.0-scope-bom.json`);
    const result = checkPreDesign(facts);
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.admissible).toBe(true);
    expect(result.projection.architectureBaseline.baselineRevision).toBe(4);
    expect(result.projection.scopeBom.bomRevision).toBe(4);
  });
});

describe("review record authority boundary", () => {
  test("parses exactly one machine JSON block and the closed review-section marker set", async () => {
    const review = await loadReview();
    expect(review.markerIssues).toEqual([]);
    expect(review.sectionIds.sort(codePointCompare)).toEqual(REVIEW_DOC_SECTION_IDS);
  });

  test("top-level field closure carries no published schema or kind identity", async () => {
    const { record } = await loadReview();
    expect(keysSorted(record)).toEqual(REVIEW_RECORD_FIELDS);
    expect(record.schema).toBeUndefined();
    expect(record.kind).toBeUndefined();
    expect(record.reviewId).toBe(REVIEW_ID);
    expect(record.reviewRevision).toBe(REVIEW_REVISION);
    expect(record.targetRelease).toBe(TARGET_RELEASE);
    expect(record.authority).toBe(REVIEW_AUTHORITY);
    expect(record.acceptanceEffect).toBe(REVIEW_ACCEPTANCE_EFFECT);
    expect(record.verdict).toBe(REVIEW_VERDICT);
    expect(record.sourceFactsDigest).toMatch(DIGEST_PATTERN);
  });

  test("sourceFactsDigest binds the frozen revision-1 pre-acceptance closure projection the review recorded", async () => {
    const { record } = await loadReview();
    // The Task 7 review record binds the pre-acceptance revision-1 facts preserved verbatim in the
    // frozen historical fixture; the record itself is never rewritten.
    const historicalFacts = await loadHistoricalRevision1Facts();
    const historicalProjection = historicalClosureCompile(historicalFacts).projection;
    expect(historicalProjection?.readyForAcceptance).toBe(true);
    expect(record.sourceFactsDigest).toBe(historicalProjection?.sourceFactsDigest);
    // The live revision-4 projection is checked separately and differs from the record digest and
    // from the frozen revision-2 closure digest.
    const liveFacts = await loadFacts();
    const liveCheck = checkPreDesign(liveFacts);
    expect(liveCheck.outcome).toBe("valid");
    expect(liveCheck.projection.readyForAcceptance).toBe(true);
    expect(liveCheck.projection.registryRevision).toBe(4);
    expect(liveCheck.projection.registrationsCollectionRevision).toBe(4);
    const graphMember = liveCheck.projection.members.find((member: any) => member.componentId === "@project-sothoth/graph");
    expect(graphMember.designRevision).toBe(3);
    const documentIndexMember = liveCheck.projection.members.find(
      (member: any) => member.componentId === "@project-sothoth/document-index",
    );
    expect(documentIndexMember.designRevision).toBe(3);
    expect(documentIndexMember.documentRef).toEqual({
      documentId: "DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER",
      documentRevision: 3,
    });
    expect(liveCheck.projection.sourceFactsDigest).not.toBe(record.sourceFactsDigest);
    expect(liveCheck.projection.sourceFactsDigest).not.toBe(HISTORICAL_REVISION_2_CLOSURE_DIGEST);
  });

  test("the frozen historical fixture pins revision-1 identities and cannot be silently re-pointed", async () => {
    const facts = await loadHistoricalRevision1Facts();
    expect(facts.phase).toBe("closure");
    expect(facts.registry.registryRevision).toBe(1);
    expect(facts.registrations.collectionRevision).toBe(1);
    expect(facts.registrations.registrations.length).toBe(11);
    for (const registration of facts.registrations.registrations) {
      expect(registration.status).toBe("proposed");
      expect(registration.designRevision).toBe(1);
    }
    expect(facts.documents["DOC-SOTHOTH-GRAPH-DOSSIER"]).toBeDefined();
  });

  test("the frozen revision-2 fixture replays the accepted pre-revision-3 closure and scope identities exactly", async () => {
    const facts = await loadHistoricalRevision2Facts();
    expect(Object.keys(facts).sort(codePointCompare)).toEqual([
      "architectureBaseline",
      "catalog",
      "contract",
      "documents",
      "phase",
      "registrations",
      "registry",
      "scopeBom",
    ]);
    expect(facts.phase).toBe("closure");
    expect(facts.registry.registryRevision).toBe(2);
    expect(facts.registrations.collectionRevision).toBe(2);
    expect(facts.registrations.registrations.length).toBe(11);
    // The snapshot means "the accepted revision-2 system immediately before revision-3
    // materialization": every registration keeps its accepted status, Graph stays at design
    // revision 2, and Document Index is still at design revision 1. No status is rolled back.
    for (const registration of facts.registrations.registrations) {
      expect(registration.status).toBe("accepted");
    }
    const graphRegistration = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@sothoth/graph",
    );
    const documentIndexRegistration = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@sothoth/document-index",
    );
    expect(graphRegistration.designRevision).toBe(2);
    expect(graphRegistration.supersedes).toBe("SOTHOTH-GRAPH-DOSSIER@1");
    expect(documentIndexRegistration.designRevision).toBe(1);
    expect(documentIndexRegistration.supersedes).toBe(null);
    expect(facts.architectureBaseline.baselineRevision).toBe(2);
    expect(facts.scopeBom.bomRevision).toBe(2);

    // Closure replay over the frozen bytes only, through the shipped Governance compiler (see
    // the historical replay engine note above).
    const closure = historicalClosureCompile(facts);
    expect(closure.diagnostics).toEqual([]);
    expect(closure.outcome).toBe("valid");
    expect(closure.projection?.readyForAcceptance).toBe(true);
    expect(closure.projection?.registryRevision).toBe(2);
    expect(closure.projection?.registrationsCollectionRevision).toBe(2);
    expect(
      closure.projection?.members.every((member: any) => member.registrationStatus === "accepted"),
    ).toBe(true);
    expect(closure.projection?.sourceFactsDigest).toBe(HISTORICAL_REVISION_2_CLOSURE_DIGEST);

    // Scope replay: only the phase differs on an in-memory clone of the frozen fixture.
    const scopeFacts = structuredClone(facts);
    scopeFacts.phase = "scope";
    const scope = historicalScopeCompile(scopeFacts);
    expect(scope.diagnostics).toEqual([]);
    expect(scope.outcome).toBe("valid");
    expect(scope.projection?.admissible).toBe(true);
    expect(scope.projection?.architectureBaseline.baselineRevision).toBe(2);
    expect(scope.projection?.scopeBom.bomRevision).toBe(2);
    expect(scope.projection?.sourceFactsDigest).toBe(HISTORICAL_REVISION_2_SCOPE_DIGEST);
  });

  test("the review record stays outside the document registry and registrations", async () => {
    const facts = await loadFacts();
    const registryIds = facts.registry.documents.map((entry: any) => entry.documentId);
    expect(registryIds).not.toContain(REVIEW_ID);
    expect(facts.registry.documents.map((entry: any) => entry.path)).not.toContain(
      "docs/design/v0.1.0-cross-artifact-edge-review.md",
    );
    expect(canonicalJsonStringify(facts.registrations)).not.toContain(REVIEW_ID);
  });
});

describe("component reviews", () => {
  test("eleven component reviews in code-point order with closed fields", async () => {
    const { record } = await loadReview();
    const reviews = record.componentReviews;
    expect(reviews.length).toBe(11);
    expect(reviews.map((review: any) => review.componentId)).toEqual(
      [...reviews.map((review: any) => review.componentId)].sort(codePointCompare),
    );
    for (const review of reviews) {
      expect(keysSorted(review)).toEqual(COMPONENT_REVIEW_FIELDS);
    }
  });

  test("bindings match the frozen revision-1 registration and registry identities exactly", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const byComponent = new Map(
      facts.registrations.registrations.map((registration: any) => [registration.componentId, registration]),
    );
    const registryById = new Map(facts.registry.documents.map((entry: any) => [entry.documentId, entry]));
    for (const review of record.componentReviews) {
      const registration = byComponent.get(review.componentId);
      expect(registration).toBeDefined();
      expect(review.designId).toBe(registration.designId);
      expect(review.designRevision).toBe(registration.designRevision);
      expect(review.documentId).toBe(registration.documentRef.documentId);
      expect(review.documentRevision).toBe(registration.documentRef.documentRevision);
      expect(review.documentRevision).toBe(registryById.get(review.documentId).documentRevision);
    }
  });

  test("each review cites exactly the five stable Dossier sections resolved in the frozen revision-1 registry and markdown", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const sections = await historicalDossierSectionIds();
    const byComponent = new Map(
      facts.registrations.registrations.map((registration: any) => [registration.componentId, registration]),
    );
    for (const review of record.componentReviews) {
      const documentRef = byComponent.get(review.componentId).documentRef;
      expect(review.dossierSectionRefs.map((reference: any) => reference.sectionId)).toEqual(
        DOSSIER_SECTION_REF_IDS,
      );
      for (const reference of review.dossierSectionRefs) {
        expect(reference.documentId).toBe(documentRef.documentId);
        expect(reference.documentRevision).toBe(documentRef.documentRevision);
        expect(sections.get(reference.documentId)).toContain(reference.sectionId);
      }
    }
  });

  test("runtime forms and package lifecycle follow the closed vocabulary", async () => {
    const { record } = await loadReview();
    for (const review of record.componentReviews) {
      const expected = RUNTIME_FORMS[review.componentId] ?? DEFAULT_RUNTIME_FORM;
      expect(review.runtimeForm, review.componentId).toBe(expected);
      expect(review.packageLifecycle).toBe(PACKAGE_LIFECYCLE_FORM);
      for (const posture of [
        review.errorPosture,
        review.retryPosture,
        review.authorityPosture,
        review.lifecycleObligations,
        review.observationObligations,
      ]) {
        expect(posture.length, review.componentId).toBeGreaterThan(0);
      }
      expect(review.compatibilityVerdict).toBe(COMPATIBILITY_VERDICT);
    }
    const cli = record.componentReviews.find((review: any) => review.componentId === "@sothoth/cli");
    expect(cli.runtimeForm).toBe("cli-executable-package");
    const git = record.componentReviews.find((review: any) => review.componentId === "@sothoth/git");
    expect(git.runtimeForm).toBe("library-adapter-with-git-child-process");
  });

  test("the validator emits no diagnostics over the frozen revision-1 facts and the real record", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const sections = await historicalDossierSectionIds();
    expect(reviewDiagnostics(facts, record, sections)).toEqual([]);
  });
});

describe("contract edge matrix", () => {
  test("registrations derive exactly 33 unique contract edges with one provider per required contract", async () => {
    const facts = await loadFacts();
    const { edges, providerCounts } = deriveContractEdges(facts.registrations);
    expect(edges.length).toBe(33);
    expect(new Set(edges.map((edge) => edge.edgeId)).size).toBe(33);
    for (const providers of providerCounts.values()) {
      expect(providers.size).toBe(1);
    }
    const componentAndRefValues = [
      ...facts.registrations.registrations.flatMap((registration: any) => [
        registration.componentId,
        ...registration.providedContractRefs,
        ...registration.requiredContractRefs,
      ]),
    ];
    for (const value of componentAndRefValues) {
      expect(value.includes(EDGE_SEPARATOR)).toBe(false);
    }
  });

  test("review matrix matches the derived 33 edges row by row", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const { edges } = deriveContractEdges(facts.registrations);
    expect(record.contractEdges.length).toBe(33);
    expect(record.contractEdges.map((row: any) => row.edgeId)).toEqual(edges.map((edge) => edge.edgeId));
    for (const row of record.contractEdges) {
      const derived = edges.find((edge) => edge.edgeId === row.edgeId);
      expect(derived).toBeDefined();
      expect(row.providerComponentId).toBe(derived.providerComponentId);
      expect(row.consumerComponentId).toBe(derived.consumerComponentId);
      expect(row.contractRef).toBe(derived.contractRef);
      expect(row.contractRef.endsWith("@1")).toBe(true);
    }
  });

  test("every edge resolves provider-side and consumer-side reviews with declaration roles", async () => {
    const { record } = await loadReview();
    const reviewIds = new Set(record.componentReviews.map((review: any) => review.componentId));
    for (const row of record.contractEdges) {
      expect(reviewIds.has(row.providerReviewComponentId)).toBe(true);
      expect(row.providerReviewComponentId).toBe(row.providerComponentId);
      expect(row.providerDeclarationRole).toBe("provides");
      expect(reviewIds.has(row.consumerReviewComponentId)).toBe(true);
      expect(row.consumerReviewComponentId).toBe(row.consumerComponentId);
      expect(row.consumerDeclarationRole).toBe("requires");
      expect(row.providerVerdict).toBe(EDGE_VERDICT);
      expect(row.consumerVerdict).toBe(EDGE_VERDICT);
      expect(row.overallVerdict).toBe(EDGE_VERDICT);
    }
  });
});

describe("package dependency DAG and deterministic waves", () => {
  test("33 contract edges collapse to 31 unique package pairs with no self, reverse, or cycle", async () => {
    const facts = await loadFacts();
    const { edges } = deriveContractEdges(facts.registrations);
    const dag = derivePackageDag(edges);
    expect(dag.length).toBe(31);
    expect(dag.filter((edge) => edge.providerComponentId === edge.consumerComponentId).length).toBe(0);
    const pairKeys = new Set(dag.map((edge) => edge.providerComponentId + EDGE_SEPARATOR + edge.consumerComponentId));
    expect(dag.filter((edge) => pairKeys.has(edge.consumerComponentId + EDGE_SEPARATOR + edge.providerComponentId)).length).toBe(0);
    const collapsedRefCount = dag.reduce((total, edge) => total + edge.contractRefs.length, 0);
    expect(collapsedRefCount).toBe(33);
    const waves = deriveWaves(dag);
    expect(waves.length).toBe(8);
    expect(waves.flatMap((wave) => wave.members).length).toBe(11);
  });

  test("review DAG equals the derived collapse edge for edge", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const { edges } = deriveContractEdges(facts.registrations);
    expect(canonicalJsonStringify(record.packageDependencyEdges)).toBe(
      canonicalJsonStringify(derivePackageDag(edges)),
    );
    expect(record.packageDependencyEdges.length).toBe(31);
  });

  test("review waves equal the algorithmically derived zero-based waves", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const { edges } = deriveContractEdges(facts.registrations);
    expect(canonicalJsonStringify(record.waves)).toBe(
      canonicalJsonStringify(deriveWaves(derivePackageDag(edges))),
    );
    expect(record.waves.length).toBe(8);
    expect(record.waves.map((wave: any) => wave.waveIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("RED mutation: producer and consumer reversal on every declared edge", () => {
  test("reversing each of the 33 review edges one at a time yields the stable mismatch diagnostic", async () => {
    const { record } = await loadReview();
    const facts = await loadHistoricalRevision1Facts();
    const sections = await historicalDossierSectionIds();
    const { edges } = deriveContractEdges(facts.registrations);
    expect(edges.length).toBe(33);
    for (const edge of edges) {
      const mutated = structuredClone(record);
      const row = mutated.contractEdges.find((candidate: any) => candidate.edgeId === edge.edgeId);
      expect(row, edge.edgeId).toBeDefined();
      const provider = row.providerComponentId;
      row.providerComponentId = row.consumerComponentId;
      row.consumerComponentId = provider;
      row.providerReviewComponentId = row.providerComponentId;
      row.consumerReviewComponentId = row.consumerComponentId;
      const diagnostics = reviewDiagnostics(facts, mutated, sections);
      const mismatches = diagnostics.filter(
        (candidate) => candidate.code === "sothoth.edge-review/producer-consumer-mismatch",
      );
      expect(mismatches, edge.edgeId).toEqual([
        { code: "sothoth.edge-review/producer-consumer-mismatch", subject: edge.edgeId },
      ]);
    }
  });
});

describe("RED mutation: Source Fact integrity through real checkPreDesign", () => {
  test("a second registration producing an existing state ref is a duplicate truth owner", async () => {
    const facts = await loadFacts();
    const sdk = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@project-sothoth/sdk",
    );
    sdk.producedStateRefs.push("sothoth.core/canonical-bytes@1");
    expect(checkPreDesign(facts).issues).toContainEqual({
      code: "sothoth.pre-design/truth-owner-duplicate",
      subject: "sothoth.core/canonical-bytes@1",
    });
  });

  test("an exact-section inheritance cycle between two dossiers fails closed", async () => {
    const facts = await loadFacts();
    const core = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@project-sothoth/core",
    );
    const graph = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@project-sothoth/graph",
    );
    core.topicCoverage["authority-and-security"].refs = [
      {
        documentId: "DOC-SOTHOTH-GRAPH-DOSSIER",
        documentRevision: 1,
        sectionId: "authority-security-and-effects",
        applicability: "adopts",
      },
    ];
    graph.topicCoverage["authority-and-security"].refs = [
      {
        documentId: "DOC-SOTHOTH-CORE-DOSSIER",
        documentRevision: 1,
        sectionId: "authority-security-and-effects",
        applicability: "adopts",
      },
    ];
    const issues = checkPreDesign(facts).issues;
    expect(issues).toContainEqual({
      code: "sothoth.pre-design/inheritance-cycle",
      subject: "DOC-SOTHOTH-CORE-DOSSIER",
    });
    expect(issues).toContainEqual({
      code: "sothoth.pre-design/inheritance-cycle",
      subject: "DOC-SOTHOTH-GRAPH-DOSSIER",
    });
  });
});

describe("RED mutation: review record structure", () => {
  test("removing runtimeForm from one component review fails on that componentId", async () => {
    const { record } = await loadReview();
    const facts = await loadFacts();
    const sections = await dossierSectionIds();
    const mutated = structuredClone(record);
    const review = mutated.componentReviews.find((candidate: any) => candidate.componentId === "@sothoth/git");
    delete review.runtimeForm;
    expect(reviewDiagnostics(facts, mutated, sections)).toContainEqual({
      code: "sothoth.edge-review/component-review-field-missing",
      subject: "@sothoth/git",
    });
  });

  test("removing packageLifecycle from one component review fails on that componentId", async () => {
    const { record } = await loadReview();
    const facts = await loadFacts();
    const sections = await dossierSectionIds();
    const mutated = structuredClone(record);
    const review = mutated.componentReviews.find((candidate: any) => candidate.componentId === "@sothoth/sdk");
    delete review.packageLifecycle;
    expect(reviewDiagnostics(facts, mutated, sections)).toContainEqual({
      code: "sothoth.edge-review/component-review-field-missing",
      subject: "@sothoth/sdk",
    });
  });

  test("removing the consumer-side review reference from one edge fails on that edgeId", async () => {
    const { record } = await loadReview();
    const facts = await loadFacts();
    const sections = await dossierSectionIds();
    const mutated = structuredClone(record);
    const row = mutated.contractEdges[0]!;
    delete row.consumerReviewComponentId;
    expect(reviewDiagnostics(facts, mutated, sections)).toContainEqual({
      code: "sothoth.edge-review/consumer-review-missing",
      subject: row.edgeId,
    });
  });
});

describe("RED mutation: criterion identity discipline", () => {
  test("an empty criterion identity in a registration fails with the componentId as subject", async () => {
    const { record } = await loadReview();
    const facts = await loadFacts();
    const sections = await dossierSectionIds();
    const cli = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@project-sothoth/cli",
    );
    cli.acceptanceCriteria[0].criterionId = "";
    expect(reviewDiagnostics(facts, record, sections)).toContainEqual({
      code: "sothoth.edge-review/criterion-identity-invalid",
      subject: "@project-sothoth/cli",
    });
  });

  test("a duplicated criterion identity within one registration fails with the componentId as subject", async () => {
    const { record } = await loadReview();
    const facts = await loadFacts();
    const sections = await dossierSectionIds();
    const cli = facts.registrations.registrations.find(
      (registration: any) => registration.componentId === "@project-sothoth/cli",
    );
    cli.acceptanceCriteria[1].criterionId = cli.acceptanceCriteria[0].criterionId;
    expect(reviewDiagnostics(facts, record, sections)).toContainEqual({
      code: "sothoth.edge-review/criterion-identity-duplicate",
      subject: "@project-sothoth/cli",
    });
  });
});

describe("deterministic disposable closure projection through the real CLI", () => {
  test("two fresh closure invocations are byte-identical with the same digest and eleven accepted members", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sothoth-design-closure-"));
    try {
      const firstPath = join(dir, "first.json");
      const secondPath = join(dir, "second.json");
      const first = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "closure",
        "--output",
        firstPath,
      ]).catch((error: any) => error);
      const second = await runCli("node", [
        `${root}/scripts/check-pre-design.mjs`,
        "--phase",
        "closure",
        "--output",
        secondPath,
      ]).catch((error: any) => error);
      expect(exitCodeOf(first)).toBe(0);
      expect(exitCodeOf(second)).toBe(0);
      const firstParsed = JSON.parse(first.stdout);
      const secondParsed = JSON.parse(second.stdout);
      expect(firstParsed.outcome).toBe("valid");
      expect(secondParsed.outcome).toBe("valid");
      expect(firstParsed.issues).toEqual([]);
      expect(first.stdout).toBe(second.stdout);
      const firstBytes = await readFile(firstPath, "utf8");
      const secondBytes = await readFile(secondPath, "utf8");
      expect(firstBytes).toBe(secondBytes);
      expect(firstBytes).toBe(first.stdout);
      expect(firstParsed.projection.schema).toBe("sothoth.design-closure-projection/v1");
      expect(firstParsed.projection.memberCount).toBe(11);
      expect(firstParsed.projection.readyForAcceptance).toBe(true);
      expect(firstParsed.projection.sourceFactsDigest).toBe(secondParsed.projection.sourceFactsDigest);
      // Live closure CLI assertions expect the eleven accepted registration statuses of the live
      // revision-4 facts; the exact status assertion replaces the former broad pre-acceptance
      // substring check and implies nothing about the historical revision-1 acceptance date.
      expect(
        firstParsed.projection.members.every((member: any) => member.registrationStatus === "accepted"),
      ).toBe(true);
      expect(
        new Set(firstParsed.projection.members.map((member: any) => member.registrationStatus)),
      ).toEqual(new Set(["accepted"]));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the review record digest equals the frozen revision-1 view, and the live CLI projects the accepted revision-4 view", async () => {
    const { record } = await loadReview();
    // The Task 7 review record binds the revision-1 facts frozen in the historical fixture. The
    // digest equality is replayed with the unchanged checker over those frozen facts; converting
    // live revision-3 facts into revision-1 facts is not a status-only operation and is never
    // attempted here.
    const historicalFacts = await loadHistoricalRevision1Facts();
    expect(record.sourceFactsDigest).toBe(
      historicalClosureCompile(historicalFacts).projection?.sourceFactsDigest,
    );
    const run = await runCli("node", [`${root}/scripts/check-pre-design.mjs`, "--phase", "closure"]).catch(
      (error: any) => error,
    );
    expect(exitCodeOf(run)).toBe(0);
    const parsed = JSON.parse(run.stdout);
    expect(parsed.outcome).toBe("valid");
    expect(
      parsed.projection.members.every((member: any) => member.registrationStatus === "accepted"),
    ).toBe(true);
    const liveFacts = await loadFacts();
    expect(parsed.projection.sourceFactsDigest).toBe(checkPreDesign(liveFacts).projection.sourceFactsDigest);
    expect(parsed.projection.sourceFactsDigest).not.toBe(record.sourceFactsDigest);
  });
});
