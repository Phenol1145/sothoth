import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { describe, expect, test } from "vitest";
import { checkPreDesign, parseStableSections } from "../../scripts/check-pre-design.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

const CATALOG_PATH = `${root}/docs/design/v0.1.0-design-scope-catalog.json`;
const CONTRACT_PATH = `${root}/docs/design/contracts/artifact-design-dossier.v1.json`;
const REGISTRY_PATH = `${root}/docs/design/document-registry.json`;
const REGISTRATIONS_PATH = `${root}/docs/design/artifact-design-registrations.json`;
const GOVERNANCE_DOC_PATH = `${root}/docs/design/governance-control-plane.md`;

const CAPSULE_ID = "DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN";
const CAPSULE_REVISION = 2;
const FIXTURE_DOSSIER_ID = "DOC-FIXTURE-GOVERNANCE-PACKAGE-DOSSIER";

const REQUIRED_SECTIONS = [
  "decision-summary",
  "artifact-identity-and-classification",
  "purpose-and-non-goals",
  "responsibility-and-truth-ownership",
  "public-surface-and-consumers",
  "core-sdk-protocol-boundary",
  "dependency-and-topology",
  "state-lifecycle-and-data-flow",
  "authority-security-and-effects",
  "failure-recovery-and-consistency",
  "observation-and-audit",
  "deployment-configuration-and-operations",
  "compatibility-and-migration",
  "developer-and-operator-experience",
  "verification-and-acceptance-criteria",
  "future-capability-compatibility",
  "traceability-and-exact-references",
  "topic-coverage-declaration",
];

const CLOSED_TOPICS = [
  "identity",
  "intent-and-non-goals",
  "responsibility",
  "truth-ownership",
  "public-surface",
  "core-sdk-boundary",
  "dependency-boundary",
  "protocol-and-data-flow",
  "state-and-lifecycle",
  "authority-and-security",
  "failure-and-recovery",
  "concurrency-and-consistency",
  "observation-and-audit",
  "deployment-and-configuration",
  "compatibility-and-migration",
  "developer-and-operator-experience",
  "verification",
  "future-compatibility",
];

const TOPIC_SECTION: Record<string, string> = {
  identity: "artifact-identity-and-classification",
  "intent-and-non-goals": "purpose-and-non-goals",
  responsibility: "responsibility-and-truth-ownership",
  "truth-ownership": "responsibility-and-truth-ownership",
  "public-surface": "public-surface-and-consumers",
  "core-sdk-boundary": "core-sdk-protocol-boundary",
  "dependency-boundary": "dependency-and-topology",
  "protocol-and-data-flow": "core-sdk-protocol-boundary",
  "state-and-lifecycle": "state-lifecycle-and-data-flow",
  "authority-and-security": null as unknown as string,
  "failure-and-recovery": "failure-recovery-and-consistency",
  "concurrency-and-consistency": "failure-recovery-and-consistency",
  "observation-and-audit": "observation-and-audit",
  "deployment-and-configuration": "deployment-configuration-and-operations",
  "compatibility-and-migration": "compatibility-and-migration",
  "developer-and-operator-experience": "developer-and-operator-experience",
  verification: "verification-and-acceptance-criteria",
  "future-compatibility": "future-capability-compatibility",
};

const DEPENDENCY_KIND = "sothoth-dossier/dependency-declaration@1";
const FORBIDDEN_KIND = "sothoth-dossier/forbidden-capability-declaration@1";
const TRUTH_KIND = "sothoth-dossier/truth-ownership-declaration@1";
const DOMAIN_KIND = "sothoth-dossier/domain-semantics-declaration@1";
const SURFACE_DECL_KIND = "sothoth-dossier/public-surface-declaration@1";
const DETERMINISM_KIND = "sothoth-dossier/determinism-declaration@1";
const CRITERIA_KIND = "sothoth-dossier/verification-criteria@1";

/**
 * The declaration vocabulary is exactly the one introduced by the Task 3 foundation Dossiers.
 * No competing dialect is admitted: an unknown `kind` is a defect, not an extension point.
 */
const DECLARATION_SECTION: Record<string, string> = {
  [DEPENDENCY_KIND]: "dependency-and-topology",
  [FORBIDDEN_KIND]: "purpose-and-non-goals",
  [TRUTH_KIND]: "responsibility-and-truth-ownership",
  [DOMAIN_KIND]: "responsibility-and-truth-ownership",
  [SURFACE_DECL_KIND]: "public-surface-and-consumers",
  [DETERMINISM_KIND]: "failure-recovery-and-consistency",
  [CRITERIA_KIND]: "verification-and-acceptance-criteria",
};

const EXACT_REF = /^(.+)@([1-9][0-9]*)$/;
const MARKER = /^<!-- sothoth:section id="([a-z][a-z0-9-]*)" -->$/;
const VAGUE_REASONS = new Set(["n/a", "na", "none", "not needed", "not applicable", "later", "tbd"]);

interface CriterionSpec {
  criterionId: string;
  sectionId: string;
}

interface GovernanceSpec {
  packageId: string;
  designId: string;
  documentId: string;
  path: string;
  importAllowlist: string[];
  providedContracts: string[];
  requiredContracts: string[];
  producedStateRefs: string[];
  consumedStateRefs: string[];
  issuedAuthorityRefs: string[];
  requiredAuthorityRefs: string[];
  emittedObservationRefs: string[];
  deploymentDependencyRefs: string[];
  capabilityClasses: Record<string, string>;
  effectOwnership: string;
  ownedDomainSemantics: string[];
  interpretedEdgeRoles: string[];
  semanticsDeferredTo: string;
  tieBreaking: string;
  surfaceKind: string;
  publicModules: string[];
  criteria: CriterionSpec[];
  inheritedTopic: { topic: string; sectionId: string; applicability: string };
  notApplicableTopics: { topic: string; reason: string }[];
}

const DOCUMENT_GOVERNANCE: GovernanceSpec[] = [
  {
    packageId: "@sothoth/document-index",
    designId: "SOTHOTH-DOCUMENT-INDEX-DOSSIER",
    documentId: "DOC-SOTHOTH-DOCUMENT-INDEX-DOSSIER",
    path: "docs/design/dossiers/document-index.md",
    importAllowlist: ["@sothoth/contracts", "@sothoth/core", "@sothoth/graph"],
    providedContracts: ["CONTRACT/SOTHOTH/DOCUMENT-INDEX@1"],
    requiredContracts: [
      "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
      "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
      "CONTRACT/SOTHOTH/SCHEMAS@1",
    ],
    producedStateRefs: [
      "sothoth.document-index/document-index@1",
      "sothoth.document-index/blob-cache-entry@1",
    ],
    consumedStateRefs: [],
    issuedAuthorityRefs: [],
    requiredAuthorityRefs: [],
    emittedObservationRefs: [],
    deploymentDependencyRefs: [],
    capabilityClasses: {
      "external-executable": "forbidden",
      filesystem: "forbidden",
      git: "forbidden",
      "governance-conformance-evaluation": "forbidden",
      network: "forbidden",
      "non-exact-identity-cache-addressing": "forbidden",
      process: "forbidden",
      "registry-authority": "forbidden",
      "source-document-mutation": "forbidden",
      "source-text-substring-matching": "forbidden",
      "undeclared-semantics-inference": "forbidden",
    },
    effectOwnership: "structural-index-projections-only",
    ownedDomainSemantics: [
      "commonmark-structure",
      "stable-section-identity",
      "heading-and-anchor-identity",
      "precise-source-span",
      "declared-reference-index",
      "supersession-index",
      "traceability-index",
      "index-provenance",
    ],
    interpretedEdgeRoles: [],
    semanticsDeferredTo: "governance-and-consumer-profiles",
    tieBreaking: "canonical-identity-then-source-span",
    surfaceKind: "pure-functions-only",
    publicModules: [
      "@sothoth/document-index/parse",
      "@sothoth/document-index/sections",
      "@sothoth/document-index/anchors",
      "@sothoth/document-index/references",
      "@sothoth/document-index/index",
      "@sothoth/document-index/cache",
    ],
    criteria: [
      { criterionId: "document-index-structural-parse-boundary", sectionId: "purpose-and-non-goals" },
      { criterionId: "document-index-deterministic-index-projection", sectionId: "state-lifecycle-and-data-flow" },
      { criterionId: "document-index-cache-byte-neutrality", sectionId: "failure-recovery-and-consistency" },
    ],
    inheritedTopic: { topic: "authority-and-security", sectionId: "authority-boundary", applicability: "adopts" },
    notApplicableTopics: [],
  },
  {
    packageId: "@sothoth/selectors",
    designId: "SOTHOTH-SELECTORS-DOSSIER",
    documentId: "DOC-SOTHOTH-SELECTORS-DOSSIER",
    path: "docs/design/dossiers/selectors.md",
    importAllowlist: ["@sothoth/contracts", "@sothoth/core", "@sothoth/document-index"],
    providedContracts: ["CONTRACT/SOTHOTH/SELECTOR@1"],
    requiredContracts: [
      "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
      "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1",
      "CONTRACT/SOTHOTH/SCHEMAS@1",
    ],
    producedStateRefs: [
      "sothoth.selectors/selector-canonical-ast@1",
      "sothoth.selectors/selection-result@1",
      "sothoth.selectors/explain-trace@1",
    ],
    consumedStateRefs: [],
    issuedAuthorityRefs: [],
    requiredAuthorityRefs: [],
    emittedObservationRefs: ["sothoth.selectors/zero-match-diagnostic@1"],
    deploymentDependencyRefs: [],
    capabilityClasses: {
      "external-executable": "forbidden",
      filesystem: "forbidden",
      "free-text-inference": "forbidden",
      git: "forbidden",
      "input-order-dependent-output": "forbidden",
      "javascript-predicate": "forbidden",
      network: "forbidden",
      process: "forbidden",
      "registry-authority": "forbidden",
      "relation-semantics-interpretation": "forbidden",
      "selection-authorization": "forbidden",
      "shell-expression": "forbidden",
      "unbudgeted-hostile-glob": "forbidden",
      "unrestricted-backtracking-regexp": "forbidden",
    },
    effectOwnership: "selection-results-only",
    ownedDomainSemantics: [
      "selector-syntax",
      "selector-canonical-ast",
      "exact-identity-matching",
      "normalized-path-glob",
      "facet-set-matching",
      "explicit-relation-matching",
      "diagnostic-identity-matching",
      "cardinality-constraints",
      "explain-trace",
    ],
    interpretedEdgeRoles: [],
    semanticsDeferredTo: "governance-and-consumer-profiles",
    tieBreaking: "canonical-identity-by-default",
    surfaceKind: "pure-functions-only",
    publicModules: [
      "@sothoth/selectors/parse",
      "@sothoth/selectors/ast",
      "@sothoth/selectors/match",
      "@sothoth/selectors/cardinality",
      "@sothoth/selectors/explain",
    ],
    criteria: [
      { criterionId: "selectors-closed-selector-algebra", sectionId: "public-surface-and-consumers" },
      { criterionId: "selectors-hostile-input-budgets", sectionId: "failure-recovery-and-consistency" },
      { criterionId: "selectors-order-independence", sectionId: "failure-recovery-and-consistency" },
    ],
    inheritedTopic: { topic: "authority-and-security", sectionId: "authority-boundary", applicability: "adopts" },
    notApplicableTopics: [],
  },
  {
    packageId: "@sothoth/governance",
    designId: "SOTHOTH-GOVERNANCE-DOSSIER",
    documentId: "DOC-SOTHOTH-GOVERNANCE-DOSSIER",
    path: "docs/design/dossiers/governance.md",
    importAllowlist: [
      "@sothoth/contracts",
      "@sothoth/core",
      "@sothoth/document-index",
      "@sothoth/graph",
      "@sothoth/selectors",
    ],
    providedContracts: [
      "CONTRACT/SOTHOTH/CHANGE-PLAN@1",
      "CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1",
      "CONTRACT/SOTHOTH/PRE-DESIGN@1",
    ],
    requiredContracts: [
      "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
      "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1",
      "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
      "CONTRACT/SOTHOTH/SCHEMAS@1",
      "CONTRACT/SOTHOTH/SELECTOR@1",
    ],
    producedStateRefs: [
      "sothoth.governance/design-closure-projection@1",
      "sothoth.governance/scope-bom-admissibility-projection@1",
      "sothoth.governance/change-plan-projection@1",
      "sothoth.governance/registry-compilation@1",
      "sothoth.governance/ledger-verification@1",
    ],
    consumedStateRefs: [],
    issuedAuthorityRefs: [],
    requiredAuthorityRefs: [],
    emittedObservationRefs: [
      "sothoth.governance/pre-design-diagnostic@1",
      "sothoth.governance/document-governance-diagnostic@1",
    ],
    deploymentDependencyRefs: [],
    capabilityClasses: {
      "acceptance-state-marking": "forbidden",
      "authoritative-scope-bom-write": "forbidden",
      "business-authorization": "forbidden",
      "evidence-check-execution": "forbidden",
      "external-executable": "forbidden",
      filesystem: "forbidden",
      "gate-macro-execution": "forbidden",
      git: "forbidden",
      "implicit-ordering-edge-promotion": "forbidden",
      network: "forbidden",
      process: "forbidden",
      "prose-substring-conformance": "forbidden",
      "rule-module-discovery-or-install": "forbidden",
      "source-fact-write": "forbidden",
    },
    effectOwnership: "non-authoritative-projections-only",
    ownedDomainSemantics: [
      "registry-lifecycle-compilation",
      "ledger-append-only-verification",
      "traceability",
      "manifest",
      "pre-design-closure",
      "scope-bom-admissibility",
      "change-impact-compilation",
      "relation-role-mapping-compilation",
      "gate-macro-expansion",
    ],
    interpretedEdgeRoles: [
      "normative-dependency",
      "derivation",
      "validation",
      "history",
      "navigation",
      "impact",
    ],
    semanticsDeferredTo: "consumer-profiles",
    tieBreaking: "canonical-identity-then-diagnostic-code",
    surfaceKind: "pure-functions-only",
    publicModules: [
      "@sothoth/governance/registry",
      "@sothoth/governance/ledger",
      "@sothoth/governance/traceability",
      "@sothoth/governance/manifest",
      "@sothoth/governance/pre-design",
      "@sothoth/governance/change-plan",
      "@sothoth/governance/gate-macros",
    ],
    criteria: [
      { criterionId: "governance-source-fact-non-authority", sectionId: "responsibility-and-truth-ownership" },
      { criterionId: "governance-impact-edge-non-ordering", sectionId: "authority-security-and-effects" },
      { criterionId: "governance-projection-rebuild-determinism", sectionId: "state-lifecycle-and-data-flow" },
      { criterionId: "governance-gate-macro-static-expansion", sectionId: "core-sdk-protocol-boundary" },
    ],
    inheritedTopic: { topic: "authority-and-security", sectionId: "authority-boundary", applicability: "narrows" },
    notApplicableTopics: [],
  },
];

interface Issue {
  code: string;
  subject: string;
}

interface DeclarationSite {
  kind: string | null;
  sectionId: string | null;
  packageId: string | null;
  value: any;
  start: number;
  end: number;
  parseError: boolean;
}

function issue(code: string, subject: string): Issue {
  return { code, subject };
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function codePointCompare(left: string, right: string): -1 | 0 | 1 {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index].codePointAt(0)! - b[index].codePointAt(0)!;
    if (difference < 0) return -1;
    if (difference > 0) return 1;
  }
  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
}

function codePointSorted(values: string[]): string[] {
  return [...values].sort(codePointCompare);
}

function arraysEqual(left: any, right: any): boolean {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isPlainObject(value: any): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Key-order-insensitive canonicalization: object key order never carries meaning in the
 * `sothoth-dossier/*@1` vocabulary, so semantic equality compares canonical forms instead of raw
 * `JSON.stringify` output.
 */
function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const ordered: Record<string, any> = {};
    for (const key of codePointSorted(Object.keys(value))) {
      ordered[key] = canonicalize(value[key]);
    }
    return ordered;
  }
  return value;
}

function canonicalJson(value: any): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalEqual(left: any, right: any): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/**
 * Recursively collects every fenced `json` code block anywhere in the CommonMark AST, so nested
 * (legitimate or hostile) content is never silently missed the way a root-only walk would miss it.
 */
function collectJsonBlocks(node: any, blocks: any[]): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "code" && node.lang === "json") {
    blocks.push(node);
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectJsonBlocks(child, blocks);
  }
}

function collectHtmlComments(node: any, html: any[]): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "html") {
    html.push(node);
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectHtmlComments(child, html);
  }
}

/**
 * Binds every `json` fenced block to the stable section that encloses it in source order. Stable
 * markers are exactly the root-level HTML comments matching the frozen marker grammar whose next
 * non-blank AST sibling is a heading; a marker-looking comment anywhere else is reported instead of
 * being silently ignored. Prose is never scanned.
 */
function extractDeclarations(markdown: string): {
  declarations: DeclarationSite[];
  markerIssues: string[];
  nestedMarkerIds: string[];
} {
  const tree = fromMarkdown(String(markdown));
  const children = Array.isArray(tree.children) ? tree.children : [];
  const markers: { sectionId: string; offset: number }[] = [];
  const markerIssues: string[] = [];
  const rootMarkerOffsets = new Set<number>();
  for (let index = 0; index < children.length; index += 1) {
    const node: any = children[index];
    if (node.type !== "html") continue;
    const match = MARKER.exec(typeof node.value === "string" ? node.value : "");
    if (!match) continue;
    const next: any = children[index + 1];
    if (!next || next.type !== "heading") {
      markerIssues.push(match[1]);
      continue;
    }
    markers.push({ sectionId: match[1], offset: node.position.start.offset });
    rootMarkerOffsets.add(node.position.start.offset);
  }

  const nestedMarkerIds: string[] = [];
  const htmlEverywhere: any[] = [];
  collectHtmlComments(tree, htmlEverywhere);
  for (const node of htmlEverywhere) {
    if (rootMarkerOffsets.has(node.position.start.offset)) continue;
    const match = MARKER.exec(typeof node.value === "string" ? node.value : "");
    if (match) nestedMarkerIds.push(match[1]);
  }

  const blocks: any[] = [];
  collectJsonBlocks(tree, blocks);
  blocks.sort((left, right) => left.position.start.offset - right.position.start.offset);

  const declarations: DeclarationSite[] = [];
  for (const node of blocks) {
    const offset = node.position.start.offset;
    let sectionId: string | null = null;
    for (const marker of markers) {
      if (marker.offset < offset) sectionId = marker.sectionId;
    }
    const raw = typeof node.value === "string" ? node.value : "";
    let value: any = null;
    let parseError = false;
    let kind: string | null = null;
    let packageId: string | null = null;
    try {
      value = JSON.parse(raw);
      kind = typeof value?.kind === "string" ? value.kind : null;
      packageId = typeof value?.packageId === "string" ? value.packageId : null;
    } catch {
      parseError = true;
    }
    declarations.push({
      kind,
      sectionId,
      packageId,
      value,
      start: node.position.start.offset,
      end: node.position.end.offset,
      parseError,
    });
  }
  return { declarations, markerIssues, nestedMarkerIds };
}

/**
 * Validates the structured design constraints of the three document/governance Dossiers plus their
 * registry, registration, and catalog facts. Every cross-file invariant is computed from the live
 * repository facts so later pre-design tasks can grow the registry, the registrations, and the
 * catalog without breaking this suite.
 */
function validateDocumentGovernanceDesign(facts: {
  documents: Record<string, string>;
  allDossierMarkdown: { componentId: string; markdown: string }[];
  registry: any;
  registrations: any;
  catalog: any;
}): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, subject: string) => issues.push(issue(`sothoth.document-governance/${code}`, subject));

  const registrationsByComponent = new Map<string, any>();
  for (const registration of Array.isArray(facts.registrations?.registrations)
    ? facts.registrations.registrations
    : []) {
    if (isPlainObject(registration) && typeof registration.componentId === "string") {
      registrationsByComponent.set(registration.componentId, registration);
    }
  }

  const providedContracts = new Map<string, string>();
  for (const [componentId, registration] of registrationsByComponent) {
    for (const ref of Array.isArray(registration?.providedContractRefs) ? registration.providedContractRefs : []) {
      if (typeof ref !== "string") continue;
      providedContracts.set(ref, componentId);
    }
  }

  for (const spec of DOCUMENT_GOVERNANCE) {
    const markdown = facts.documents[spec.packageId] ?? "";
    const parsed = parseStableSections(markdown);
    if (!arraysEqual(parsed.sectionIds, REQUIRED_SECTIONS)) {
      push("dossier-sections-mismatch", `${spec.packageId}:${parsed.sectionIds.length}-of-18`);
    }
    for (const markerIssue of parsed.issues) {
      push("dossier-marker-invalid", `${spec.packageId}:${markerIssue.subject}`);
    }

    const { declarations, markerIssues, nestedMarkerIds } = extractDeclarations(markdown);
    for (const markerIssue of markerIssues) {
      push("dossier-marker-invalid", `${spec.packageId}:${markerIssue}`);
    }
    for (const nestedId of nestedMarkerIds) {
      push("marker-nested-or-unbound", `${spec.packageId}:${nestedId}`);
    }

    const kindCounts = new Map<string, number>();
    for (const site of declarations) {
      if (site.parseError) {
        push("declaration-unparseable", `${spec.packageId}:${site.sectionId ?? "outside-stable-section"}`);
        continue;
      }
      if (site.kind === null) continue;
      if (!(site.kind in DECLARATION_SECTION)) {
        push("declaration-kind-unknown", `${spec.packageId}:${site.kind}`);
        continue;
      }
      kindCounts.set(site.kind, (kindCounts.get(site.kind) ?? 0) + 1);
      if (site.sectionId === null) {
        push("declaration-outside-stable-section", `${spec.packageId}:${site.kind}`);
        continue;
      }
      if (DECLARATION_SECTION[site.kind] !== site.sectionId) {
        push("declaration-section-misplaced", `${spec.packageId}:${site.kind}`);
      }
      if (site.packageId !== spec.packageId) {
        push("declaration-owner-mismatch", `${spec.packageId}:${site.kind}`);
      }
    }
    for (const [kind, count] of kindCounts) {
      if (count > 1) push("declaration-duplicate", `${spec.packageId}:${kind}`);
    }
    const declaration = (kind: string) => declarations.find((site) => !site.parseError && site.kind === kind);

    const dependency = declaration(DEPENDENCY_KIND);
    if (!dependency) {
      push("declaration-missing", `${spec.packageId}:dependency-declaration`);
    } else {
      if (!arraysEqual(dependency.value.runtimeImportAllowlist, spec.importAllowlist)) {
        push("import-allowlist-mismatch", spec.packageId);
      }
      if (!arraysEqual(dependency.value.providedContracts, spec.providedContracts)) {
        push("provided-contracts-mismatch", spec.packageId);
      }
      if (!arraysEqual(dependency.value.requiredContracts, spec.requiredContracts)) {
        push("required-contracts-mismatch", spec.packageId);
      }
      for (const ref of [...dependency.value.providedContracts, ...dependency.value.requiredContracts]) {
        if (typeof ref !== "string" || !EXACT_REF.test(ref)) {
          push("contract-ref-not-exact", `${spec.packageId}:${ref}`);
        }
      }
    }

    const forbidden = declaration(FORBIDDEN_KIND);
    if (!forbidden) {
      push("declaration-missing", `${spec.packageId}:forbidden-capability-declaration`);
    } else {
      const classes = forbidden.value.capabilityClasses;
      if (!isPlainObject(classes) || !canonicalEqual(classes, spec.capabilityClasses)) {
        push("forbidden-capability-mismatch", spec.packageId);
      }
      if (isPlainObject(classes)) {
        for (const [name, verdict] of Object.entries(classes)) {
          if (verdict !== "forbidden") {
            push("capability-not-forbidden", `${spec.packageId}:${name}`);
          }
        }
      }
    }

    const truth = declaration(TRUTH_KIND);
    if (!truth) {
      push("declaration-missing", `${spec.packageId}:truth-ownership-declaration`);
    } else {
      if (!arraysEqual(truth.value.producedStateRefs, spec.producedStateRefs)) {
        push("truth-ownership-mismatch", spec.packageId);
      }
      if (!arraysEqual(truth.value.issuedAuthorityRefs, spec.issuedAuthorityRefs)) {
        push("authority-claimed", spec.packageId);
      }
      if (truth.value.effectOwnership !== spec.effectOwnership) {
        push("effect-ownership-mismatch", spec.packageId);
      }
    }

    const domain = declaration(DOMAIN_KIND);
    if (!domain) {
      push("declaration-missing", `${spec.packageId}:domain-semantics-declaration`);
    } else {
      if (!arraysEqual(domain.value.ownedDomainSemantics, spec.ownedDomainSemantics)) {
        push("domain-semantics-mismatch", spec.packageId);
      }
      if (!arraysEqual(domain.value.interpretedEdgeRoles, spec.interpretedEdgeRoles)) {
        push("interpreted-roles-mismatch", spec.packageId);
      }
      if (domain.value.semanticsDeferredTo !== spec.semanticsDeferredTo) {
        push("semantics-deferred-invalid", spec.packageId);
      }
    }

    const determinism = declaration(DETERMINISM_KIND);
    if (!determinism) {
      push("declaration-missing", `${spec.packageId}:determinism-declaration`);
    } else {
      if (determinism.value.stringOrdering !== "unicode-code-point") {
        push("determinism-ordering-missing", spec.packageId);
      }
      if (determinism.value.byteStableOutputs !== true) {
        push("determinism-byte-stability-missing", spec.packageId);
      }
      if (determinism.value.tieBreaking !== spec.tieBreaking) {
        push("determinism-tie-breaking-mismatch", spec.packageId);
      }
    }

    const surface = declaration(SURFACE_DECL_KIND);
    if (!surface) {
      push("declaration-missing", `${spec.packageId}:public-surface-declaration`);
    } else {
      if (!arraysEqual(surface.value.publicModules, spec.publicModules)) {
        push("public-surface-mismatch", spec.packageId);
      }
      if (surface.value.surfaceKind !== spec.surfaceKind) {
        push("surface-kind-mismatch", spec.packageId);
      }
    }

    const criteria = declaration(CRITERIA_KIND);
    if (!criteria) {
      push("declaration-missing", `${spec.packageId}:verification-criteria`);
    } else {
      const declared = Array.isArray(criteria.value.criteria) ? criteria.value.criteria : [];
      if (!canonicalEqual(declared, spec.criteria)) {
        push("verification-criteria-mismatch", spec.packageId);
      }
      for (const entry of declared) {
        if (!isPlainObject(entry) || !REQUIRED_SECTIONS.includes(entry.sectionId)) {
          push("criterion-section-unresolved", `${spec.packageId}:${entry?.criterionId}`);
        }
      }
    }

    const registryEntry = (facts.registry?.documents ?? []).find(
      (entry: any) => entry?.documentId === spec.documentId,
    );
    if (!registryEntry) {
      push("registry-entry-missing", spec.documentId);
    } else {
      if (registryEntry.documentRevision !== 1 || registryEntry.status !== "proposed") {
        push("registry-entry-invalid", spec.documentId);
      }
      if (registryEntry.path !== spec.path) {
        push("registry-path-mismatch", spec.documentId);
      }
      if (!arraysEqual(registryEntry.sectionIds, REQUIRED_SECTIONS)) {
        push("registry-sections-mismatch", spec.documentId);
      }
    }

    const registration = registrationsByComponent.get(spec.packageId);
    if (!registration) {
      push("registration-missing", spec.packageId);
      continue;
    }
    if (
      registration.designId !== spec.designId ||
      registration.designRevision !== 1 ||
      registration.designRequirement !== "full" ||
      registration.supersedes !== null
    ) {
      push("registration-identity-invalid", spec.packageId);
    }
    if (registration.status !== "proposed") {
      push("registration-status-invalid", `${spec.packageId}:${registration.status}`);
    }
    if (
      registration.documentRef?.documentId !== spec.documentId ||
      registration.documentRef?.documentRevision !== 1
    ) {
      push("registration-document-ref-unresolved", spec.packageId);
    }
    if (!arraysEqual(registration.providedContractRefs, spec.providedContracts)) {
      push("registration-provided-contracts-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.requiredContractRefs, spec.requiredContracts)) {
      push("registration-required-contracts-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.producedStateRefs, spec.producedStateRefs)) {
      push("registration-produced-state-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.consumedStateRefs, spec.consumedStateRefs)) {
      push("registration-consumed-state-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.issuedAuthorityRefs, spec.issuedAuthorityRefs)) {
      push("registration-issued-authority-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.requiredAuthorityRefs, spec.requiredAuthorityRefs)) {
      push("registration-required-authority-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.emittedObservationRefs, spec.emittedObservationRefs)) {
      push("registration-observation-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.deploymentDependencyRefs, spec.deploymentDependencyRefs)) {
      push("registration-deployment-mismatch", spec.packageId);
    }
    for (const field of [
      "providedContractRefs",
      "requiredContractRefs",
      "producedStateRefs",
      "consumedStateRefs",
      "issuedAuthorityRefs",
      "requiredAuthorityRefs",
      "emittedObservationRefs",
      "deploymentDependencyRefs",
    ]) {
      for (const ref of registration[field] ?? []) {
        if (typeof ref !== "string" || !EXACT_REF.test(ref)) {
          push("registration-ref-not-exact", `${spec.packageId}:${field}:${ref}`);
        }
      }
    }

    const coverage = registration.topicCoverage;
    if (!isPlainObject(coverage)) {
      push("registration-topic-coverage-invalid", spec.packageId);
    } else {
      if (!arraysEqual(codePointSorted(Object.keys(coverage)), codePointSorted(CLOSED_TOPICS))) {
        push("registration-topics-mismatch", spec.packageId);
      }
      for (const topic of CLOSED_TOPICS) {
        const resolution = coverage[topic];
        if (!isPlainObject(resolution)) continue;
        const inherited = spec.inheritedTopic.topic === topic;
        const notApplicable = spec.notApplicableTopics.some((entry) => entry.topic === topic);
        if (inherited) {
          const reference = resolution.refs?.[0];
          if (
            resolution.resolution !== "inherited" ||
            resolution.sectionId !== null ||
            resolution.reason !== null ||
            reference?.documentId !== CAPSULE_ID ||
            reference?.documentRevision !== CAPSULE_REVISION ||
            reference?.sectionId !== spec.inheritedTopic.sectionId ||
            !["adopts", "narrows", "specializes"].includes(reference?.applicability) ||
            reference?.applicability !== spec.inheritedTopic.applicability
          ) {
            push("topic-inheritance-invalid", `${spec.packageId}:${topic}`);
          }
        } else if (notApplicable) {
          const expected = spec.notApplicableTopics.find((entry) => entry.topic === topic)!.reason;
          const reason = typeof resolution.reason === "string" ? resolution.reason.trim().toLowerCase() : "";
          if (
            resolution.resolution !== "not-applicable" ||
            resolution.sectionId !== null ||
            !arraysEqual(resolution.refs, []) ||
            resolution.reason !== expected ||
            reason.length < 40 ||
            VAGUE_REASONS.has(reason)
          ) {
            push("topic-not-applicable-invalid", `${spec.packageId}:${topic}`);
          }
        } else {
          if (
            resolution.resolution !== "local" ||
            resolution.reason !== null ||
            !arraysEqual(resolution.refs, []) ||
            resolution.sectionId !== TOPIC_SECTION[topic] ||
            !REQUIRED_SECTIONS.includes(resolution.sectionId)
          ) {
            push("topic-resolution-invalid", `${spec.packageId}:${topic}`);
          }
        }
      }
    }

    const criteriaIds = (registration.acceptanceCriteria ?? []).map((entry: any) => entry?.criterionId);
    if (!arraysEqual(criteriaIds, spec.criteria.map((entry) => entry.criterionId))) {
      push("registration-criteria-mismatch", spec.packageId);
    }
    for (const entry of registration.acceptanceCriteria ?? []) {
      if (!isPlainObject(entry) || entry.sectionId !== "verification-and-acceptance-criteria") {
        push("registration-criterion-section-unresolved", `${spec.packageId}:${entry?.criterionId}`);
      }
    }

    const candidate = (facts.catalog?.candidates ?? []).find(
      (entry: any) => entry?.componentId === spec.packageId,
    );
    if (!candidate) {
      push("catalog-candidate-missing", spec.packageId);
    } else if (candidate.coverage !== "complete" || candidate.designId !== spec.designId) {
      push("catalog-coverage-incomplete", spec.packageId);
    }
  }

  for (const spec of DOCUMENT_GOVERNANCE) {
    for (const required of spec.requiredContracts) {
      if (!providedContracts.has(required)) {
        push("contract-edge-unresolved", required);
      }
    }
    for (const provided of spec.providedContracts) {
      const owner = providedContracts.get(provided);
      if (!owner) {
        push("contract-provider-missing", provided);
      } else if (owner !== spec.packageId) {
        push("contract-owner-duplicate", `${provided}:${owner}:${spec.packageId}`);
      }
    }
    for (const stateRef of spec.producedStateRefs) {
      for (const [componentId, registration] of registrationsByComponent) {
        if (componentId === spec.packageId) continue;
        if ((registration.producedStateRefs ?? []).includes(stateRef)) {
          push("truth-owner-duplicate", `${stateRef}:${componentId}`);
        }
      }
    }
  }

  const declaredEdges: { from: string; to: string }[] = [];
  for (const dossier of facts.allDossierMarkdown) {
    const dependency = extractDeclarations(dossier.markdown).declarations.find(
      (site) => site.kind === DEPENDENCY_KIND,
    );
    for (const target of dependency?.value?.runtimeImportAllowlist ?? []) {
      declaredEdges.push({ from: dossier.componentId, to: target });
    }
  }
  for (const edge of declaredEdges) {
    if (declaredEdges.some((other) => other.from === edge.to && other.to === edge.from)) {
      push("reverse-import", `${edge.from}:${edge.to}`);
    }
    if (edge.from === edge.to) {
      push("self-import", edge.from);
    }
  }

  if (facts.catalog?.status !== "working") {
    push("catalog-status-invalid", "status");
  }

  return sortIssues(issues);
}

/**
 * A valid total-order comparator: code first, then subject, each by Unicode code point. It returns
 * `-1 | 0 | 1` so the ordering is antisymmetric and engine-independent.
 */
function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    const byCode = codePointCompare(left.code, right.code);
    return byCode !== 0 ? byCode : codePointCompare(left.subject, right.subject);
  });
}

function mutateDeclaration(
  markdown: string,
  sectionId: string,
  kind: string,
  mutate: (value: any) => void,
): string {
  const { declarations } = extractDeclarations(markdown);
  const site = declarations.find((entry) => entry.sectionId === sectionId && entry.kind === kind);
  if (!site) throw new Error(`declaration ${kind} in section ${sectionId} not found`);
  const value = JSON.parse(JSON.stringify(site.value));
  mutate(value);
  const replacement = `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  return markdown.slice(0, site.start) + replacement + markdown.slice(site.end);
}

function rewriteDeclarationWithReversedKeys(markdown: string, sectionId: string, kind: string): string {
  const { declarations } = extractDeclarations(markdown);
  const site = declarations.find((entry) => entry.sectionId === sectionId && entry.kind === kind);
  if (!site) throw new Error(`declaration ${kind} in section ${sectionId} not found`);
  const reverse = (value: any): any => {
    if (Array.isArray(value)) return value.map(reverse);
    if (isPlainObject(value)) {
      const reversed: Record<string, any> = {};
      for (const key of Object.keys(value).reverse()) {
        reversed[key] = reverse(value[key]);
      }
      return reversed;
    }
    return value;
  };
  const replacement = `\`\`\`json\n${JSON.stringify(reverse(site.value), null, 2)}\n\`\`\``;
  return markdown.slice(0, site.start) + replacement + markdown.slice(site.end);
}

async function repositoryFacts(): Promise<any> {
  const documents: Record<string, string> = {};
  for (const spec of DOCUMENT_GOVERNANCE) {
    documents[spec.packageId] = await readText(`${root}/${spec.path}`);
  }
  const registry = await readJson(REGISTRY_PATH);
  const registrations = await readJson(REGISTRATIONS_PATH);
  const registrationsByDocument = new Map<string, string>();
  for (const registration of registrations.registrations ?? []) {
    if (isPlainObject(registration?.documentRef)) {
      registrationsByDocument.set(registration.documentRef.documentId, registration.componentId);
    }
  }
  const allDossierMarkdown: { componentId: string; markdown: string }[] = [];
  for (const entry of registry.documents ?? []) {
    if (entry?.status !== "proposed" || typeof entry.path !== "string") continue;
    const componentId = registrationsByDocument.get(entry.documentId);
    if (!componentId) continue;
    allDossierMarkdown.push({ componentId, markdown: await readText(`${root}/${entry.path}`) });
  }
  return {
    documents,
    allDossierMarkdown,
    registry,
    registrations,
    catalog: await readJson(CATALOG_PATH),
  };
}

function fixtureDossierMarkdown(): string {
  return REQUIRED_SECTIONS.map(
    (sectionId) => `<!-- sothoth:section id="${sectionId}" -->\n\n## ${sectionId}\n\nFixture body.\n`,
  ).join("\n");
}

async function syntheticClosureFacts(): Promise<any> {
  const facts = await repositoryFacts();
  const catalog = facts.catalog;
  const contract = await readJson(CONTRACT_PATH);
  const governanceMarkdown = await readFile(GOVERNANCE_DOC_PATH, "utf8");
  const realRegistrations = (facts.registrations.registrations ?? []).filter((registration: any) =>
    isPlainObject(registration),
  );
  const realComponents = new Set(realRegistrations.map((registration: any) => registration.componentId));
  const realDocumentIds = new Set(
    (facts.registry.documents ?? []).map((entry: any) => entry?.documentId).filter((id: any) => typeof id === "string"),
  );
  const syntheticRegistry = {
    ...facts.registry,
    documents: [
      ...facts.registry.documents,
      {
        documentId: FIXTURE_DOSSIER_ID,
        documentRevision: 1,
        path: "(test fixture)",
        status: "proposed",
        sectionIds: [...REQUIRED_SECTIONS],
      },
    ],
  };
  const documents: Record<string, string> = {
    [CAPSULE_ID]: governanceMarkdown,
    [FIXTURE_DOSSIER_ID]: fixtureDossierMarkdown(),
  };
  for (const entry of facts.registry.documents ?? []) {
    if (entry?.status === "proposed" && typeof entry.path === "string") {
      documents[entry.documentId] = await readText(`${root}/${entry.path}`);
    }
  }
  for (const spec of DOCUMENT_GOVERNANCE) {
    documents[spec.documentId] = facts.documents[spec.packageId];
    if (!realDocumentIds.has(spec.documentId)) {
      syntheticRegistry.documents.push({
        documentId: spec.documentId,
        documentRevision: 1,
        path: spec.path,
        status: "proposed",
        sectionIds: [...REQUIRED_SECTIONS],
      });
    }
  }
  const fixtureRegistrations = catalog.candidates
    .filter((candidate: any) => !realComponents.has(candidate.componentId))
    .map((candidate: any) => {
      const topicCoverage: Record<string, unknown> = {};
      CLOSED_TOPICS.forEach((topic, index) => {
        topicCoverage[topic] = { resolution: "local", sectionId: REQUIRED_SECTIONS[index], refs: [], reason: null };
      });
      return {
        designId: candidate.designId,
        componentId: candidate.componentId,
        designRevision: 1,
        designRequirement: candidate.designRequirement,
        status: "proposed",
        documentRef: { documentId: FIXTURE_DOSSIER_ID, documentRevision: 1 },
        topicCoverage,
        providedContractRefs: [],
        requiredContractRefs: [],
        producedStateRefs: [`${candidate.componentId}:fixture-state@1`],
        consumedStateRefs: [],
        issuedAuthorityRefs: [],
        requiredAuthorityRefs: [],
        emittedObservationRefs: [],
        deploymentDependencyRefs: [],
        acceptanceCriteria: [{ criterionId: "fixture-criterion-1", sectionId: "verification-and-acceptance-criteria" }],
        supersedes: null,
      };
    });
  return {
    phase: "closure",
    catalog,
    contract,
    registry: syntheticRegistry,
    documents,
    registrations: {
      ...facts.registrations,
      registrations: [...realRegistrations, ...fixtureRegistrations],
    },
  };
}

describe("document governance dossier structured design facts", () => {
  test("the three document/governance Dossiers and their registry, registration, and catalog facts validate", async () => {
    const issues = validateDocumentGovernanceDesign(await repositoryFacts());
    expect(issues).toEqual([]);
  });

  test.each(DOCUMENT_GOVERNANCE.map((spec) => [spec.packageId, spec]))(
    "%s declares exactly the eighteen contract sections in the frozen order",
    async (packageId: string, spec: GovernanceSpec) => {
      const markdown = await readText(`${root}/${spec.path}`);
      const parsed = parseStableSections(markdown);
      expect(parsed.sectionIds).toEqual(REQUIRED_SECTIONS);
      expect(parsed.issues).toEqual([]);
    },
  );

  test("the document/governance registrations close under the bootstrap checker once the catalog is synthetically completed", async () => {
    const result = checkPreDesign(await syntheticClosureFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.readyForAcceptance).toBe(true);
    for (const spec of DOCUMENT_GOVERNANCE) {
      const member = result.projection.members.find((entry: any) => entry.componentId === spec.packageId);
      expect(member.registrationStatus).toBe("proposed");
      expect(member.documentRef.documentId).toBe(spec.documentId);
      expect(member.localTopics + member.inheritedTopics + member.notApplicableTopics).toBe(18);
      expect(member.inheritedTopics).toBe(1);
      expect(member.criteria).toBe(spec.criteria.length);
    }
  });
});

describe("document governance dossier mutation tests", () => {
  async function mutatedFacts(
    packageId: string,
    mutator: (markdown: string) => string,
  ): Promise<any> {
    const facts = await repositoryFacts();
    facts.documents[packageId] = mutator(facts.documents[packageId]);
    facts.allDossierMarkdown = facts.allDossierMarkdown.map((dossier: any) =>
      dossier.componentId === packageId ? { ...dossier, markdown: facts.documents[packageId] } : dossier,
    );
    return facts;
  }

  async function mutatedRegistrations(mutate: (registrations: any) => void): Promise<any> {
    const facts = await repositoryFacts();
    mutate(facts.registrations);
    return facts;
  }

  function expectBaselineValid(facts: any) {
    expect(validateDocumentGovernanceDesign(facts)).toEqual([]);
  }

  test("rejects downgrading Document Contract checks to prose substring matching", async () => {
    expectBaselineValid(await repositoryFacts());

    const indexFacts = await mutatedFacts("@sothoth/document-index", (markdown) =>
      mutateDeclaration(markdown, "purpose-and-non-goals", FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["source-text-substring-matching"] = "permitted";
      }),
    );
    expect(validateDocumentGovernanceDesign(indexFacts)).toContainEqual({
      code: "sothoth.document-governance/capability-not-forbidden",
      subject: "@sothoth/document-index:source-text-substring-matching",
    });

    const governanceFacts = await mutatedFacts("@sothoth/governance", (markdown) =>
      mutateDeclaration(markdown, "purpose-and-non-goals", FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["prose-substring-conformance"] = "permitted";
      }),
    );
    expect(validateDocumentGovernanceDesign(governanceFacts)).toContainEqual({
      code: "sothoth.document-governance/capability-not-forbidden",
      subject: "@sothoth/governance:prose-substring-conformance",
    });
  });

  test("rejects allowing unrestricted catastrophic-backtracking regular expressions in selectors", async () => {
    expectBaselineValid(await repositoryFacts());
    const facts = await mutatedFacts("@sothoth/selectors", (markdown) =>
      mutateDeclaration(markdown, "purpose-and-non-goals", FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["unrestricted-backtracking-regexp"] = "permitted";
      }),
    );
    expect(validateDocumentGovernanceDesign(facts)).toContainEqual({
      code: "sothoth.document-governance/capability-not-forbidden",
      subject: "@sothoth/selectors:unrestricted-backtracking-regexp",
    });
  });

  test("rejects letting the impact relation silently become an Ordering Edge", async () => {
    expectBaselineValid(await repositoryFacts());
    const facts = await mutatedFacts("@sothoth/governance", (markdown) =>
      mutateDeclaration(markdown, "purpose-and-non-goals", FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["implicit-ordering-edge-promotion"] = "permitted";
      }),
    );
    expect(validateDocumentGovernanceDesign(facts)).toContainEqual({
      code: "sothoth.document-governance/capability-not-forbidden",
      subject: "@sothoth/governance:implicit-ordering-edge-promotion",
    });
  });

  test("rejects a checker or projection marking a Dossier as accepted", async () => {
    expectBaselineValid(await repositoryFacts());

    const capabilityFacts = await mutatedFacts("@sothoth/governance", (markdown) =>
      mutateDeclaration(markdown, "purpose-and-non-goals", FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["acceptance-state-marking"] = "permitted";
      }),
    );
    expect(validateDocumentGovernanceDesign(capabilityFacts)).toContainEqual({
      code: "sothoth.document-governance/capability-not-forbidden",
      subject: "@sothoth/governance:acceptance-state-marking",
    });

    const statusFacts = await mutatedRegistrations((registrations) => {
      const registration = registrations.registrations.find(
        (entry: any) => entry.componentId === "@sothoth/governance",
      );
      registration.status = "accepted";
    });
    expect(validateDocumentGovernanceDesign(statusFacts)).toContainEqual({
      code: "sothoth.document-governance/registration-status-invalid",
      subject: "@sothoth/governance:accepted",
    });
  });

  test("rejects Governance creating, writing back, or replacing an authoritative Scope BOM", async () => {
    expectBaselineValid(await repositoryFacts());
    const facts = await mutatedFacts("@sothoth/governance", (markdown) =>
      mutateDeclaration(markdown, "purpose-and-non-goals", FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["authoritative-scope-bom-write"] = "permitted";
      }),
    );
    expect(validateDocumentGovernanceDesign(facts)).toContainEqual({
      code: "sothoth.document-governance/capability-not-forbidden",
      subject: "@sothoth/governance:authoritative-scope-bom-write",
    });
  });

  test("rejects a duplicated structured declaration instead of reading only the first occurrence", async () => {
    expectBaselineValid(await repositoryFacts());
    const facts = await mutatedFacts("@sothoth/selectors", (markdown) => {
      const { declarations } = extractDeclarations(markdown);
      const site = declarations.find(
        (entry) => entry.sectionId === "dependency-and-topology" && entry.kind === DEPENDENCY_KIND,
      );
      if (!site) throw new Error("dependency declaration not found");
      const duplicate = `\n\n\`\`\`json\n${JSON.stringify(site.value, null, 2)}\n\`\`\``;
      return markdown.slice(0, site.end) + duplicate + markdown.slice(site.end);
    });
    expect(validateDocumentGovernanceDesign(facts)).toContainEqual({
      code: "sothoth.document-governance/declaration-duplicate",
      subject: `@sothoth/selectors:${DEPENDENCY_KIND}`,
    });
  });

  test("declaration comparison is insensitive to JSON key order", async () => {
    const facts = await mutatedFacts("@sothoth/governance", (markdown) =>
      rewriteDeclarationWithReversedKeys(markdown, "responsibility-and-truth-ownership", TRUTH_KIND),
    );
    expect(validateDocumentGovernanceDesign(facts)).toEqual([]);
  });
});

describe("validator determinism regression", () => {
  test("diagnostics sort strictly by Unicode code point over code, then subject", () => {
    const issues: Issue[] = [
      { code: "a", subject: "z" },
      { code: "b", subject: "a" },
      { code: "a", subject: "a" },
      { code: "c", subject: "m" },
    ];
    expect(sortIssues(issues)).toEqual([
      { code: "a", subject: "a" },
      { code: "a", subject: "z" },
      { code: "b", subject: "a" },
      { code: "c", subject: "m" },
    ]);
  });
});

describe("controller dependency ruling regression", () => {
  const SCHEMAS_REF = "CONTRACT/SOTHOTH/SCHEMAS@1";
  const CANONICAL_REF = "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1";

  function dependencyDeclarationOf(markdown: string): any {
    const site = extractDeclarations(markdown).declarations.find((entry) => entry.kind === DEPENDENCY_KIND);
    if (!site) throw new Error("dependency declaration not found");
    return site.value;
  }

  test("SCHEMAS@1 and @sothoth/contracts are declared directly by every Dossier, registration, and spec", async () => {
    const facts = await repositoryFacts();
    const registrationsByComponent = new Map<string, any>(
      (facts.registrations.registrations ?? []).map((registration: any) => [registration.componentId, registration]),
    );

    for (const spec of DOCUMENT_GOVERNANCE) {
      expect(spec.requiredContracts).toContain(SCHEMAS_REF);
      expect(spec.importAllowlist).toContain("@sothoth/contracts");

      const declaration = dependencyDeclarationOf(facts.documents[spec.packageId]);
      expect(declaration.runtimeImportAllowlist).toContain("@sothoth/contracts");
      expect(declaration.requiredContracts).toContain(SCHEMAS_REF);

      const registration = registrationsByComponent.get(spec.packageId);
      expect(registration.requiredContractRefs).toContain(SCHEMAS_REF);

      expect(declaration.requiredContracts).toEqual(registration.requiredContractRefs);
    }

    const governance = DOCUMENT_GOVERNANCE.find((spec) => spec.packageId === "@sothoth/governance")!;
    expect(governance.requiredContracts).toContain(CANONICAL_REF);
    expect(governance.importAllowlist).toContain("@sothoth/core");

    const governanceDeclaration = dependencyDeclarationOf(facts.documents["@sothoth/governance"]);
    expect(governanceDeclaration.runtimeImportAllowlist).toContain("@sothoth/core");
    expect(governanceDeclaration.requiredContracts).toContain(CANONICAL_REF);
    expect(registrationsByComponent.get("@sothoth/governance").requiredContractRefs).toContain(CANONICAL_REF);
  });

  test.each([
    {
      packageId: "@sothoth/document-index",
      field: "requiredContracts",
      removed: "CONTRACT/SOTHOTH/SCHEMAS@1",
      code: "sothoth.document-governance/required-contracts-mismatch",
    },
    {
      packageId: "@sothoth/selectors",
      field: "requiredContracts",
      removed: "CONTRACT/SOTHOTH/SCHEMAS@1",
      code: "sothoth.document-governance/required-contracts-mismatch",
    },
    {
      packageId: "@sothoth/governance",
      field: "requiredContracts",
      removed: "CONTRACT/SOTHOTH/SCHEMAS@1",
      code: "sothoth.document-governance/required-contracts-mismatch",
    },
    {
      packageId: "@sothoth/governance",
      field: "requiredContracts",
      removed: "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
      code: "sothoth.document-governance/required-contracts-mismatch",
    },
    {
      packageId: "@sothoth/document-index",
      field: "runtimeImportAllowlist",
      removed: "@sothoth/contracts",
      code: "sothoth.document-governance/import-allowlist-mismatch",
    },
    {
      packageId: "@sothoth/selectors",
      field: "runtimeImportAllowlist",
      removed: "@sothoth/contracts",
      code: "sothoth.document-governance/import-allowlist-mismatch",
    },
    {
      packageId: "@sothoth/governance",
      field: "runtimeImportAllowlist",
      removed: "@sothoth/contracts",
      code: "sothoth.document-governance/import-allowlist-mismatch",
    },
    {
      packageId: "@sothoth/governance",
      field: "runtimeImportAllowlist",
      removed: "@sothoth/core",
      code: "sothoth.document-governance/import-allowlist-mismatch",
    },
  ])(
    "removing the direct binding %s -> %s is reported with one stable, precise diagnostic",
    async (row) => {
      const facts = await repositoryFacts();
      facts.documents[row.packageId] = mutateDeclaration(
        facts.documents[row.packageId],
        "dependency-and-topology",
        DEPENDENCY_KIND,
        (value) => {
          value[row.field] = value[row.field].filter((entry: string) => entry !== row.removed);
        },
      );
      facts.allDossierMarkdown = facts.allDossierMarkdown.map((dossier: any) =>
        dossier.componentId === row.packageId ? { ...dossier, markdown: facts.documents[row.packageId] } : dossier,
      );
      expect(validateDocumentGovernanceDesign(facts)).toEqual([{ code: row.code, subject: row.packageId }]);
    },
  );
});
