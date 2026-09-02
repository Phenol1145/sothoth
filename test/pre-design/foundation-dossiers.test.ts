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
const CAPSULE_SECTION_IDS = [
  "decision",
  "authority-boundary",
  "package-architecture",
  "documents-and-selectors",
  "graphs-change-order-and-scheduling",
  "pre-design-boundary",
  "extensions-and-evidence",
  "diagnostics-and-process-outcomes",
  "release-boundary",
];

const FIXTURE_DOSSIER_ID = "DOC-FIXTURE-PACKAGE-DOSSIER";

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

interface FoundationSpec {
  packageId: string;
  designId: string;
  documentId: string;
  path: string;
  importAllowlist: string[];
  providedContracts: string[];
  requiredContracts: string[];
  producedStateRefs: string[];
  emittedObservationRefs: string[];
  capabilityClasses: Record<string, string>;
  tieBreaking: string;
  surfaceKind: string;
  publicModules: string[];
  criteria: string[];
  inheritedTopic: { topic: string; sectionId: string; applicability: string };
  notApplicableTopics: { topic: string; reason: string }[];
}

const FOUNDATION: FoundationSpec[] = [
  {
    packageId: "@sothoth/contracts",
    designId: "SOTHOTH-CONTRACTS-DOSSIER",
    documentId: "DOC-SOTHOTH-CONTRACTS-DOSSIER",
    path: "docs/design/dossiers/contracts.md",
    importAllowlist: [],
    providedContracts: ["CONTRACT/SOTHOTH/SCHEMAS@1"],
    requiredContracts: [],
    producedStateRefs: ["sothoth.contracts/schema-identity@1"],
    emittedObservationRefs: [],
    capabilityClasses: {
      "business-authority": "forbidden",
      "canonical-json-implementation": "forbidden",
      "commonmark-parsing": "forbidden",
      "compilation-algorithm": "forbidden",
      "consumer-semantics": "forbidden",
      filesystem: "forbidden",
      git: "forbidden",
      "graph-algorithm": "forbidden",
      network: "forbidden",
      process: "forbidden",
      "source-fact-write": "forbidden",
    },
    tieBreaking: "declared-enumeration-order",
    surfaceKind: "types-and-validation-only",
    publicModules: [
      "@sothoth/contracts/identity",
      "@sothoth/contracts/schema",
      "@sothoth/contracts/diagnostic",
      "@sothoth/contracts/projection",
      "@sothoth/contracts/pre-design",
      "@sothoth/contracts/extension",
    ],
    criteria: [
      "contracts-schema-closure",
      "contracts-zero-dependency-floor",
      "contracts-identity-code-point-order",
    ],
    inheritedTopic: { topic: "authority-and-security", sectionId: "authority-boundary", applicability: "narrows" },
    notApplicableTopics: [],
  },
  {
    packageId: "@sothoth/core",
    designId: "SOTHOTH-CORE-DOSSIER",
    documentId: "DOC-SOTHOTH-CORE-DOSSIER",
    path: "docs/design/dossiers/core.md",
    importAllowlist: ["@sothoth/contracts"],
    providedContracts: ["CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1"],
    requiredContracts: ["CONTRACT/SOTHOTH/SCHEMAS@1"],
    producedStateRefs: ["sothoth.core/canonical-bytes@1", "sothoth.core/compilation-outcome@1"],
    emittedObservationRefs: ["sothoth.core/diagnostic-aggregate@1"],
    capabilityClasses: {
      "business-acceptance": "forbidden",
      "consumer-identity": "forbidden",
      "consumer-path": "forbidden",
      "document-domain-semantics": "forbidden",
      "external-executable": "forbidden",
      filesystem: "forbidden",
      "fracta-term": "forbidden",
      git: "forbidden",
      "graph-domain-semantics": "forbidden",
      network: "forbidden",
      process: "forbidden",
      "source-fact-mutation": "forbidden",
    },
    tieBreaking: "canonical-identity-then-code-point",
    surfaceKind: "pure-functions-only",
    publicModules: [
      "@sothoth/core/canonical-json",
      "@sothoth/core/digest",
      "@sothoth/core/compile",
      "@sothoth/core/diagnostics",
      "@sothoth/core/outcome",
    ],
    criteria: [
      "core-pure-kernel-boundary",
      "core-canonical-byte-stability",
      "core-outcome-aggregation-closure",
    ],
    inheritedTopic: { topic: "authority-and-security", sectionId: "authority-boundary", applicability: "adopts" },
    notApplicableTopics: [],
  },
  {
    packageId: "@sothoth/graph",
    designId: "SOTHOTH-GRAPH-DOSSIER",
    documentId: "DOC-SOTHOTH-GRAPH-DOSSIER",
    path: "docs/design/dossiers/graph.md",
    importAllowlist: ["@sothoth/contracts", "@sothoth/core"],
    providedContracts: ["CONTRACT/SOTHOTH/GENERIC-GRAPH@1"],
    requiredContracts: ["CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1", "CONTRACT/SOTHOTH/SCHEMAS@1"],
    producedStateRefs: ["sothoth.graph/algorithm-result@1"],
    emittedObservationRefs: [],
    capabilityClasses: {
      "consumer-fracta-semantics": "forbidden",
      "document-reference-semantics": "forbidden",
      "external-executable": "forbidden",
      filesystem: "forbidden",
      git: "forbidden",
      "governance-policy": "forbidden",
      network: "forbidden",
      "planning-scheduling-policy": "forbidden",
      process: "forbidden",
      "relation-role-semantics": "forbidden",
    },
    tieBreaking: "caller-sort-key-then-node-identity",
    surfaceKind: "pure-functions-only",
    publicModules: [
      "@sothoth/graph/digraph",
      "@sothoth/graph/traversal",
      "@sothoth/graph/scc",
      "@sothoth/graph/condensation",
      "@sothoth/graph/waves",
      "@sothoth/graph/longest-paths",
    ],
    criteria: [
      "graph-generic-algorithm-surface",
      "graph-zero-domain-semantics",
      "graph-deterministic-waves",
    ],
    inheritedTopic: { topic: "authority-and-security", sectionId: "authority-boundary", applicability: "adopts" },
    notApplicableTopics: [
      {
        topic: "observation-and-audit",
        reason:
          "@sothoth/graph computes pure results over caller-provided nodes, edges, weights, and sort keys; every diagnostic, audit trail, and observation identity is declared by @sothoth/contracts and aggregated by @sothoth/core or the consuming domain compiler, so the graph package owns no observation or audit surface of its own.",
      },
    ],
  },
];

const DECLARATION_SECTION: Record<string, string> = {
  "sothoth-dossier/dependency-declaration@1": "dependency-and-topology",
  "sothoth-dossier/forbidden-capability-declaration@1": "purpose-and-non-goals",
  "sothoth-dossier/truth-ownership-declaration@1": "responsibility-and-truth-ownership",
  "sothoth-dossier/domain-semantics-declaration@1": "responsibility-and-truth-ownership",
  "sothoth-dossier/public-surface-declaration@1": "public-surface-and-consumers",
  "sothoth-dossier/determinism-declaration@1": "failure-recovery-and-consistency",
  "sothoth-dossier/verification-criteria@1": "verification-and-acceptance-criteria",
};

const EXACT_REF = /^(.+)@([1-9][0-9]*)$/;
const MARKER = /^<!-- sothoth:section id="([a-z][a-z0-9-]*)" -->$/;
const VAGUE_REASONS = new Set(["n/a", "na", "none", "not needed", "not applicable", "later", "tbd"]);

interface Issue {
  code: string;
  subject: string;
}

interface DeclarationSite {
  kind: string;
  sectionId: string;
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

/**
 * Walks the CommonMark AST, binds each stable section marker to its heading, and collects the
 * fenced `json` code blocks that live inside each stable section. Section location is a property
 * of the parsed AST; prose is never scanned.
 */
function extractDeclarations(markdown: string): { declarations: DeclarationSite[]; markerIssues: string[] } {
  const tree = fromMarkdown(String(markdown));
  const children = Array.isArray(tree.children) ? tree.children : [];
  const declarations: DeclarationSite[] = [];
  const markerIssues: string[] = [];
  let sectionId: string | null = null;
  for (let index = 0; index < children.length; index += 1) {
    const node: any = children[index];
    if (node.type === "html") {
      const match = MARKER.exec(typeof node.value === "string" ? node.value : "");
      if (!match) continue;
      const next: any = children[index + 1];
      if (!next || next.type !== "heading") {
        markerIssues.push(match[1]);
        sectionId = null;
        continue;
      }
      sectionId = match[1];
      continue;
    }
    if (node.type === "code" && node.lang === "json" && sectionId !== null) {
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
        kind: kind as string,
        sectionId,
        packageId,
        value,
        start: node.position.start.offset,
        end: node.position.end.offset,
        parseError,
      });
    }
  }
  return { declarations, markerIssues };
}

function codePointSorted(values: string[]): string[] {
  return [...values].sort((left, right) => {
    const a = Array.from(left);
    const b = Array.from(right);
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const difference = a[index].codePointAt(0)! - b[index].codePointAt(0)!;
      if (difference !== 0) return difference;
    }
    return a.length - b.length;
  });
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
 * Validates the structured design constraints declared inside the three foundation Dossiers plus
 * their registry, registration, and catalog facts. Returns a deterministic, sorted issue list so
 * both the repository state and mutated states can be asserted exactly.
 */
function validateFoundationDesign(facts: {
  documents: Record<string, string>;
  registry: any;
  registrations: any;
  catalog: any;
}): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, subject: string) => issues.push(issue(`sothoth.foundation/${code}`, subject));

  const registrationsByComponent = new Map<string, any>();
  for (const registration of Array.isArray(facts.registrations?.registrations) ? facts.registrations.registrations : []) {
    if (isPlainObject(registration) && typeof registration.componentId === "string") {
      registrationsByComponent.set(registration.componentId, registration);
    }
  }

  const providedContracts = new Map<string, string>();

  for (const spec of FOUNDATION) {
    const markdown = facts.documents[spec.packageId] ?? "";
    const parsed = parseStableSections(markdown);
    if (!arraysEqual(parsed.sectionIds, REQUIRED_SECTIONS)) {
      push("dossier-sections-mismatch", `${spec.packageId}:${parsed.sectionIds.length}-of-18`);
    }
    for (const markerIssue of parsed.issues) {
      push("dossier-marker-invalid", `${spec.packageId}:${markerIssue.subject}`);
    }

    const { declarations, markerIssues } = extractDeclarations(markdown);
    for (const markerIssue of markerIssues) {
      push("dossier-marker-invalid", `${spec.packageId}:${markerIssue}`);
    }
    for (const site of declarations) {
      if (site.parseError) {
        push("declaration-unparseable", `${spec.packageId}:${site.sectionId}`);
        continue;
      }
      if (!(site.kind in DECLARATION_SECTION)) {
        push("declaration-kind-unknown", `${spec.packageId}:${site.kind}`);
        continue;
      }
      if (DECLARATION_SECTION[site.kind] !== site.sectionId) {
        push("declaration-section-misplaced", `${spec.packageId}:${site.kind}`);
      }
      if (site.packageId !== spec.packageId) {
        push("declaration-owner-mismatch", `${spec.packageId}:${site.kind}`);
      }
    }
    const declaration = (kind: string) =>
      declarations.find((site) => !site.parseError && site.kind === kind);

    const dependency = declaration("sothoth-dossier/dependency-declaration@1");
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
      for (const ref of dependency.value.providedContracts) {
        if (typeof ref !== "string" || !EXACT_REF.test(ref)) continue;
        const identity = EXACT_REF.exec(ref)![1];
        const owner = providedContracts.get(identity);
        if (owner && owner !== spec.packageId) {
          push("contract-owner-duplicate", `${identity}:${owner}:${spec.packageId}`);
        }
        providedContracts.set(identity, spec.packageId);
      }
    }

    const forbidden = declaration("sothoth-dossier/forbidden-capability-declaration@1");
    if (!forbidden) {
      push("declaration-missing", `${spec.packageId}:forbidden-capability-declaration`);
    } else {
      const classes = forbidden.value.capabilityClasses;
      if (!isPlainObject(classes) || JSON.stringify(classes) !== JSON.stringify(spec.capabilityClasses)) {
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

    const truth = declaration("sothoth-dossier/truth-ownership-declaration@1");
    if (!truth) {
      push("declaration-missing", `${spec.packageId}:truth-ownership-declaration`);
    } else {
      if (!arraysEqual(truth.value.producedStateRefs, spec.producedStateRefs)) {
        push("truth-ownership-mismatch", spec.packageId);
      }
      if (!arraysEqual(truth.value.issuedAuthorityRefs, [])) {
        push("authority-claimed", spec.packageId);
      }
    }

    if (spec.packageId === "@sothoth/graph") {
      const domain = declaration("sothoth-dossier/domain-semantics-declaration@1");
      if (!domain) {
        push("declaration-missing", `${spec.packageId}:domain-semantics-declaration`);
      } else {
        if (!arraysEqual(domain.value.ownedDomainSemantics, []) || !arraysEqual(domain.value.interpretedEdgeRoles, [])) {
          push("graph-domain-semantics-owned", spec.packageId);
        }
        if (domain.value.semanticsDeferredTo !== "consuming-domain-package") {
          push("graph-semantics-deferred-invalid", spec.packageId);
        }
      }
    }

    const determinism = declaration("sothoth-dossier/determinism-declaration@1");
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

    const surface = declaration("sothoth-dossier/public-surface-declaration@1");
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

    const criteria = declaration("sothoth-dossier/verification-criteria@1");
    if (!criteria) {
      push("declaration-missing", `${spec.packageId}:verification-criteria`);
    } else {
      const declared = Array.isArray(criteria.value.criteria) ? criteria.value.criteria : [];
      const ids = declared.map((entry: any) => entry?.criterionId);
      if (!arraysEqual(ids, spec.criteria)) {
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
      registration.status !== "accepted" ||
      registration.supersedes !== null
    ) {
      push("registration-identity-invalid", spec.packageId);
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
    if (!arraysEqual(registration.emittedObservationRefs, spec.emittedObservationRefs)) {
      push("registration-observation-mismatch", spec.packageId);
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
          const reason = typeof resolution.reason === "string" ? resolution.reason.trim().toLowerCase() : "";
          if (
            resolution.resolution !== "not-applicable" ||
            resolution.sectionId !== null ||
            !arraysEqual(resolution.refs, []) ||
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

    const criterionIds = (registration.acceptanceCriteria ?? []).map((entry: any) => entry?.criterionId);
    if (!arraysEqual(criterionIds, spec.criteria)) {
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

  for (const spec of FOUNDATION) {
    for (const required of spec.requiredContracts) {
      const identity = EXACT_REF.exec(required)?.[1];
      if (!identity || !providedContracts.has(identity)) {
        push("contract-edge-unresolved", required);
      }
    }
  }

  const declaredEdges: { from: string; to: string }[] = [];
  for (const spec of FOUNDATION) {
    const markdown = facts.documents[spec.packageId] ?? "";
    const dependency = extractDeclarations(markdown).declarations.find(
      (site) => site.kind === "sothoth-dossier/dependency-declaration@1",
    );
    for (const target of dependency?.value?.runtimeImportAllowlist ?? []) {
      declaredEdges.push({ from: spec.packageId, to: target });
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

  const stateOwners = new Map<string, string>();
  for (const spec of FOUNDATION) {
    for (const stateRef of spec.producedStateRefs) {
      stateOwners.set(stateRef, spec.packageId);
    }
  }
  for (const registration of registrationsByComponent.values()) {
    for (const stateRef of registration.producedStateRefs ?? []) {
      const expected = stateOwners.get(stateRef);
      if (expected && expected !== registration.componentId) {
        push("truth-owner-duplicate", stateRef);
      }
    }
  }

  if (facts.catalog?.status !== "working") {
    push("catalog-status-invalid", "status");
  }

  return issues.sort(
    (left, right) =>
      left.code.localeCompare(right.code, undefined, { sensitivity: "variant" }) ||
      left.subject.localeCompare(right.subject, undefined, { sensitivity: "variant" }),
  );
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

async function repositoryFacts(): Promise<any> {
  const documents: Record<string, string> = {};
  for (const spec of FOUNDATION) {
    documents[spec.packageId] = await readText(`${root}/${spec.path}`);
  }
  return {
    documents,
    registry: await readJson(REGISTRY_PATH),
    registrations: await readJson(REGISTRATIONS_PATH),
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
  const capsule = facts.registry.documents.find(
    (entry: any) => entry.documentId === CAPSULE_ID,
  );
  const syntheticRegistry = {
    ...facts.registry,
    documents: [
      capsule,
      ...FOUNDATION.map((spec) => ({
        documentId: spec.documentId,
        documentRevision: 1,
        path: spec.path,
        status: "proposed",
        sectionIds: [...REQUIRED_SECTIONS],
      })),
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
  for (const spec of FOUNDATION) {
    documents[spec.documentId] = facts.documents[spec.packageId];
  }
  const fixtureRegistrations = catalog.candidates
    .filter((candidate: any) => !FOUNDATION.some((spec) => spec.packageId === candidate.componentId))
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
  const realRegistrations = (facts.registrations.registrations ?? []).filter((registration: any) =>
    FOUNDATION.some((spec) => spec.packageId === registration.componentId),
  );
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

describe("foundation dossier structured design facts", () => {
  test("the three foundation Dossiers and their registry, registration, and catalog facts validate", async () => {
    const issues = validateFoundationDesign(await repositoryFacts());
    expect(issues).toEqual([]);
  });

  test.each(FOUNDATION.map((spec) => [spec.packageId, spec]))(
    "%s declares exactly the eighteen contract sections in the frozen order",
    async (packageId: string, spec: FoundationSpec) => {
      const markdown = await readText(`${root}/${spec.path}`);
      const parsed = parseStableSections(markdown);
      expect(parsed.sectionIds).toEqual(REQUIRED_SECTIONS);
      expect(parsed.issues).toEqual([]);
    },
  );

  test("the foundation registrations close under the bootstrap checker once the catalog is synthetically completed", async () => {
    const result = checkPreDesign(await syntheticClosureFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.readyForAcceptance).toBe(true);
    for (const spec of FOUNDATION) {
      const member = result.projection.members.find((entry: any) => entry.componentId === spec.packageId);
      // The live reviewed registrations were accepted by the external human owner on 2026-09-03;
      // only the synthetic fixture registrations stay in the proposed stage.
      expect(member.registrationStatus).toBe("accepted");
      expect(member.localTopics + member.inheritedTopics + member.notApplicableTopics).toBe(18);
      expect(member.criteria).toBe(spec.criteria.length);
    }
  });
});

describe("foundation dossier mutation tests", () => {
  async function mutatedFacts(
    packageId: string,
    mutator: (markdown: string) => string,
  ): Promise<any> {
    const facts = await repositoryFacts();
    facts.documents[packageId] = mutator(facts.documents[packageId]);
    return facts;
  }

  function expectBaselineValid(facts: any) {
    const baseline = validateFoundationDesign(facts);
    expect(baseline).toEqual([]);
  }

  test("rejects a reverse import that inverts the graph -> core -> contracts direction", async () => {
    const coreFacts = await mutatedFacts("@sothoth/core", (markdown) =>
      mutateDeclaration(markdown, "dependency-and-topology", "sothoth-dossier/dependency-declaration@1", (value) => {
        value.runtimeImportAllowlist = ["@sothoth/contracts", "@sothoth/graph"];
      }),
    );
    expectBaselineValid(await repositoryFacts());
    expect(validateFoundationDesign(coreFacts)).toContainEqual({
      code: "sothoth.foundation/reverse-import",
      subject: "@sothoth/core:@sothoth/graph",
    });

    const contractsFacts = await mutatedFacts("@sothoth/contracts", (markdown) =>
      mutateDeclaration(markdown, "dependency-and-topology", "sothoth-dossier/dependency-declaration@1", (value) => {
        value.runtimeImportAllowlist = ["@sothoth/core"];
      }),
    );
    expect(validateFoundationDesign(contractsFacts)).toContainEqual({
      code: "sothoth.foundation/reverse-import",
      subject: "@sothoth/contracts:@sothoth/core",
    });
  });

  test("rejects filesystem access declared for Core or Graph", async () => {
    expectBaselineValid(await repositoryFacts());
    for (const packageId of ["@sothoth/core", "@sothoth/graph"]) {
      const facts = await mutatedFacts(packageId, (markdown) =>
        mutateDeclaration(markdown, "purpose-and-non-goals", "sothoth-dossier/forbidden-capability-declaration@1", (value) => {
          value.capabilityClasses.filesystem = "permitted";
        }),
      );
      expect(validateFoundationDesign(facts)).toContainEqual({
        code: "sothoth.foundation/capability-not-forbidden",
        subject: `${packageId}:filesystem`,
      });
    }
  });

  test("rejects duplicated contract truth ownership between foundation packages", async () => {
    expectBaselineValid(await repositoryFacts());
    const facts = await mutatedFacts("@sothoth/core", (markdown) =>
      mutateDeclaration(markdown, "dependency-and-topology", "sothoth-dossier/dependency-declaration@1", (value) => {
        value.providedContracts = ["CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1", "CONTRACT/SOTHOTH/SCHEMAS@1"];
      }),
    );
    expect(validateFoundationDesign(facts)).toContainEqual({
      code: "sothoth.foundation/contract-owner-duplicate",
      subject: "CONTRACT/SOTHOTH/SCHEMAS:@sothoth/contracts:@sothoth/core",
    });
  });

  test("rejects Graph acquiring domain semantics such as the impact relation role", async () => {
    expectBaselineValid(await repositoryFacts());
    const facts = await mutatedFacts("@sothoth/graph", (markdown) =>
      mutateDeclaration(markdown, "responsibility-and-truth-ownership", "sothoth-dossier/domain-semantics-declaration@1", (value) => {
        value.interpretedEdgeRoles = ["impact"];
      }),
    );
    expect(validateFoundationDesign(facts)).toContainEqual({
      code: "sothoth.foundation/graph-domain-semantics-owned",
      subject: "@sothoth/graph",
    });
  });

  test("rejects a missing or weakened Unicode code-point determinism criterion", async () => {
    expectBaselineValid(await repositoryFacts());
    const graphFacts = await mutatedFacts("@sothoth/graph", (markdown) =>
      mutateDeclaration(markdown, "failure-recovery-and-consistency", "sothoth-dossier/determinism-declaration@1", (value) => {
        value.stringOrdering = "locale-collation";
      }),
    );
    expect(validateFoundationDesign(graphFacts)).toContainEqual({
      code: "sothoth.foundation/determinism-ordering-missing",
      subject: "@sothoth/graph",
    });

    const coreFacts = await mutatedFacts("@sothoth/core", (markdown) =>
      mutateDeclaration(markdown, "failure-recovery-and-consistency", "sothoth-dossier/determinism-declaration@1", (value) => {
        delete value.stringOrdering;
      }),
    );
    expect(validateFoundationDesign(coreFacts)).toContainEqual({
      code: "sothoth.foundation/determinism-ordering-missing",
      subject: "@sothoth/core",
    });
  });
});
