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

const CAPSULE_ID = "DOC-SOTHOTH-GOVERNANCE-CONTROL-PLANE-DESIGN";
const CAPSULE_REVISION = 2;
const CAPSULE_AUTHORITY_SECTION = "authority-boundary";
const FIXTURE_DOSSIER_ID = "DOC-FIXTURE-INTEGRATION-PACKAGE-DOSSIER";

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
const SURFACE_KIND = "sothoth-dossier/public-surface-declaration@1";
const DETERMINISM_KIND = "sothoth-dossier/determinism-declaration@1";
const CRITERIA_KIND = "sothoth-dossier/verification-criteria@1";
const SCHEDULE_KIND = "sothoth-dossier/schedule-solution-declaration@1";
const PROFILE_BOUNDARY_KIND = "sothoth-dossier/profile-boundary-declaration@1";
const SKILL_KIND = "sothoth-dossier/skill-recommendation-declaration@1";
const PROFILE_FAILURE_KIND = "sothoth-dossier/profile-failure-declaration@1";
const GIT_PROVENANCE_KIND = "sothoth-dossier/git-provenance-declaration@1";
const GIT_PROCESS_KIND = "sothoth-dossier/git-process-declaration@1";
const GIT_PATH_KIND = "sothoth-dossier/git-path-declaration@1";
const GIT_BUDGET_KIND = "sothoth-dossier/git-budget-declaration@1";

const EXACT_REF = /^(.+)@([1-9][0-9]*)$/;
const MARKER = /^<!-- sothoth:section id="([a-z][a-z0-9-]*)" -->$/;

interface CriterionSpec {
  criterionId: string;
  sectionId: string;
}

interface IntegrationSpec {
  packageId: string;
  designId: string;
  documentId: string;
  path: string;
  dependency: Record<string, unknown>;
  forbidden: Record<string, unknown>;
  truth: Record<string, unknown>;
  surface: Record<string, unknown>;
  determinism: Record<string, unknown>;
  criteria: Record<string, unknown>;
  extra: Record<string, Record<string, unknown>>;
  inheritedApplicability: "adopts" | "narrows" | "specializes";
  forbiddenImports: string[];
}

const PLANNING_UNSUPPORTED_DIMENSIONS = [
  "assignment",
  "gate",
  "placement",
  "release-train",
  "resource",
  "time",
];

const PLANNING_IMPLEMENTED_CAPABILITIES = [
  "dependency-constraint-validation",
  "deterministic-wave-assignment",
];

const PROFILE_FAIL_CLOSED_CONDITIONS = [
  "duplicate-identity",
  "floating-ref",
  "incompatible-revision",
  "missing-provider",
  "unknown-field",
  "unknown-mapping",
];

const SKILL_ALLOWED_FIELDS = [
  "applicable-diagnostic",
  "digest",
  "exact-commit-or-tag",
  "license",
  "path",
  "source-repository",
];

const SKILL_PROHIBITED_OPERATIONS = [
  "crawl",
  "discover",
  "download",
  "host",
  "install",
  "invoke",
  "search",
];

const GIT_EXECUTABLE_SUBCOMMANDS = ["diff", "ls-tree", "rev-parse", "show", "status"];

const GIT_MUTATION_SUBCOMMANDS = [
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

const GIT_REJECTED_PATH_CLASSES = [
  "absolute-path",
  "nul-byte",
  "parent-escape",
  "repository-escape",
  "unnormalizable-path",
];

const GIT_ENFORCED_BUDGETS = ["file-count", "per-file-byte", "process-output", "total-byte"];

const GIT_WORKSPACE_BYTE_CLASSES = ["head", "index", "unstaged", "untracked"];

const INTEGRATION: IntegrationSpec[] = [
  {
    packageId: "@sothoth/git",
    designId: "SOTHOTH-GIT-DOSSIER",
    documentId: "DOC-SOTHOTH-GIT-DOSSIER",
    path: "docs/design/dossiers/git.md",
    dependency: {
      kind: DEPENDENCY_KIND,
      packageId: "@sothoth/git",
      runtimeImportAllowlist: ["@sothoth/contracts", "@sothoth/core"],
      providedContracts: ["CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1"],
      requiredContracts: ["CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1", "CONTRACT/SOTHOTH/SCHEMAS@1"],
    },
    forbidden: {
      kind: FORBIDDEN_KIND,
      packageId: "@sothoth/git",
      capabilityClasses: {
        "ambiguous-ref-acceptance": "forbidden",
        "environment-variable-semantics": "forbidden",
        "forge-api": "forbidden",
        "git-mutation": "forbidden",
        "path-escape-acceptance": "forbidden",
        "shell-invocation": "forbidden",
        "snapshot-truncation-success": "forbidden",
        "workspace-commit-masquerade": "forbidden",
      },
    },
    truth: {
      kind: TRUTH_KIND,
      packageId: "@sothoth/git",
      producedStateRefs: [
        "sothoth.git/commit-snapshot@1",
        "sothoth.git/compare-snapshot@1",
        "sothoth.git/workspace-snapshot@1",
      ],
      issuedAuthorityRefs: [],
      emittedObservationRefs: ["sothoth.git/git-adapter-diagnostic@1"],
      effectOwnership: "read-only-source-adapter",
    },
    surface: {
      kind: SURFACE_KIND,
      packageId: "@sothoth/git",
      publicModules: [
        "@sothoth/git/commit",
        "@sothoth/git/compare",
        "@sothoth/git/path",
        "@sothoth/git/process",
        "@sothoth/git/snapshot",
        "@sothoth/git/workspace",
      ],
      surfaceKind: "pure-functions-only",
    },
    determinism: {
      kind: DETERMINISM_KIND,
      packageId: "@sothoth/git",
      byteStableOutputs: true,
      stringOrdering: "unicode-code-point",
      tieBreaking: "canonical-identity-then-diagnostic-code",
    },
    criteria: {
      kind: CRITERIA_KIND,
      packageId: "@sothoth/git",
      criteria: [
        { criterionId: "git-command-allowlist-closure", sectionId: "authority-security-and-effects" },
        { criterionId: "git-no-mutation-boundary", sectionId: "authority-security-and-effects" },
        { criterionId: "git-path-and-ref-fail-closed", sectionId: "failure-recovery-and-consistency" },
        { criterionId: "git-provenance-separation", sectionId: "state-lifecycle-and-data-flow" },
        { criterionId: "git-snapshot-budget-fail-closed", sectionId: "failure-recovery-and-consistency" },
      ],
    },
    extra: {
      [GIT_PROVENANCE_KIND]: {
        kind: GIT_PROVENANCE_KIND,
        packageId: "@sothoth/git",
        workspaceMasqueradesAsCommit: false,
        provenanceIdentitySeparation: "strict",
        modes: [
          {
            mode: "commit",
            binding: "exact-commit-tree-blob",
            intendedUse: "ci-release-immutable-evidence",
          },
          {
            mode: "compare",
            binding: "exact-base-head",
            intendedUse: "impact-regression-and-append-only-checks",
          },
          {
            mode: "workspace",
            binding: "head-index-unstaged-untracked-composition",
            intendedUse: "local-feedback-only",
          },
        ],
        workspaceByteClasses: GIT_WORKSPACE_BYTE_CLASSES,
      },
      [GIT_PROCESS_KIND]: {
        kind: GIT_PROCESS_KIND,
        packageId: "@sothoth/git",
        executableSubcommands: GIT_EXECUTABLE_SUBCOMMANDS,
        argumentStyle: "fixed-argument-array",
        shellInvocation: "forbidden",
        environmentVariableSemantics: "forbidden",
        mutationSubcommands: GIT_MUTATION_SUBCOMMANDS,
        mutationCapability: "forbidden",
      },
      [GIT_PATH_KIND]: {
        kind: GIT_PATH_KIND,
        packageId: "@sothoth/git",
        normalization: "repository-relative-posix",
        ambiguousRefPolicy: "reject",
        rejectedPathClasses: GIT_REJECTED_PATH_CLASSES,
      },
      [GIT_BUDGET_KIND]: {
        kind: GIT_BUDGET_KIND,
        packageId: "@sothoth/git",
        enforcedBudgets: GIT_ENFORCED_BUDGETS,
        exhaustionPolicy: "fail-closed",
        truncationPolicy: "forbidden",
      },
    },
    inheritedApplicability: "adopts",
    forbiddenImports: [
      "@sothoth/cli",
      "@sothoth/document-index",
      "@sothoth/governance",
      "@sothoth/graph",
      "@sothoth/planning",
      "@sothoth/profile-sdk",
      "@sothoth/sdk",
      "@sothoth/selectors",
    ],
  },
  {
    packageId: "@sothoth/planning",
    designId: "SOTHOTH-PLANNING-DOSSIER",
    documentId: "DOC-SOTHOTH-PLANNING-DOSSIER",
    path: "docs/design/dossiers/planning.md",
    dependency: {
      kind: DEPENDENCY_KIND,
      packageId: "@sothoth/planning",
      runtimeImportAllowlist: [
        "@sothoth/contracts",
        "@sothoth/core",
        "@sothoth/graph",
        "@sothoth/selectors",
      ],
      providedContracts: ["CONTRACT/SOTHOTH/PLANNING@1"],
      requiredContracts: [
        "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
        "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
        "CONTRACT/SOTHOTH/SCHEMAS@1",
        "CONTRACT/SOTHOTH/SELECTOR@1",
      ],
    },
    forbidden: {
      kind: FORBIDDEN_KIND,
      packageId: "@sothoth/planning",
      capabilityClasses: {
        "acceptance-authority": "forbidden",
        "calendar-placement-solver": "forbidden",
        "consumer-identity": "forbidden",
        "external-executable": "forbidden",
        filesystem: "forbidden",
        "gate-axis-solver": "forbidden",
        git: "forbidden",
        "governance-policy": "forbidden",
        "independent-wave-truth": "forbidden",
        network: "forbidden",
        "placement-solver": "forbidden",
        process: "forbidden",
        "registry-authority": "forbidden",
        "release-train-solver": "forbidden",
        "resource-solver": "forbidden",
        "source-fact-mutation": "forbidden",
        "task-dispatch": "forbidden",
        "time-axis-solver": "forbidden",
        "unsupported-dimension-ignoring": "forbidden",
      },
    },
    truth: {
      kind: TRUTH_KIND,
      packageId: "@sothoth/planning",
      producedStateRefs: ["sothoth.planning/schedule-solution@1"],
      issuedAuthorityRefs: [],
      emittedObservationRefs: ["sothoth.planning/schedule-diagnostic@1"],
      effectOwnership: "non-authoritative-schedule-projection",
    },
    surface: {
      kind: SURFACE_KIND,
      packageId: "@sothoth/planning",
      publicModules: [
        "@sothoth/planning/constraints",
        "@sothoth/planning/schedule",
        "@sothoth/planning/solution",
        "@sothoth/planning/waves",
      ],
      surfaceKind: "pure-functions-only",
    },
    determinism: {
      kind: DETERMINISM_KIND,
      packageId: "@sothoth/planning",
      byteStableOutputs: true,
      stringOrdering: "unicode-code-point",
      tieBreaking: "canonical-identity-then-diagnostic-code",
    },
    criteria: {
      kind: CRITERIA_KIND,
      packageId: "@sothoth/planning",
      criteria: [
        { criterionId: "planning-dependency-wave-only", sectionId: "core-sdk-protocol-boundary" },
        { criterionId: "planning-deterministic-projection", sectionId: "failure-recovery-and-consistency" },
        { criterionId: "planning-single-schedule-solution", sectionId: "purpose-and-non-goals" },
        { criterionId: "planning-source-fact-read-only", sectionId: "responsibility-and-truth-ownership" },
      ],
    },
    extra: {
      [SCHEDULE_KIND]: {
        kind: SCHEDULE_KIND,
        packageId: "@sothoth/planning",
        solutionIdentity: "sothoth.planning/schedule-solution@1",
        authority: "non-authoritative-projection",
        implementedCapabilities: PLANNING_IMPLEMENTED_CAPABILITIES,
        unsupportedDimensions: PLANNING_UNSUPPORTED_DIMENSIONS,
        waveTruthIdentities: [],
      },
    },
    inheritedApplicability: "narrows",
    forbiddenImports: [
      "@sothoth/cli",
      "@sothoth/document-index",
      "@sothoth/git",
      "@sothoth/governance",
      "@sothoth/profile-sdk",
      "@sothoth/sdk",
    ],
  },
  {
    packageId: "@sothoth/profile-sdk",
    designId: "SOTHOTH-PROFILE-SDK-DOSSIER",
    documentId: "DOC-SOTHOTH-PROFILE-SDK-DOSSIER",
    path: "docs/design/dossiers/profile-sdk.md",
    dependency: {
      kind: DEPENDENCY_KIND,
      packageId: "@sothoth/profile-sdk",
      runtimeImportAllowlist: ["@sothoth/contracts", "@sothoth/core"],
      providedContracts: ["CONTRACT/SOTHOTH/CONSUMER-PROFILE@1"],
      requiredContracts: ["CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1", "CONTRACT/SOTHOTH/SCHEMAS@1"],
    },
    forbidden: {
      kind: FORBIDDEN_KIND,
      packageId: "@sothoth/profile-sdk",
      capabilityClasses: {
        "automatic-default-policy": "forbidden",
        "automatic-skill-discovery": "forbidden",
        "consumer-identity-ownership": "forbidden",
        "consumer-policy-ownership": "forbidden",
        "consumer-repository-scanning": "forbidden",
        "domain-implementation-invocation": "forbidden",
        filesystem: "forbidden",
        "floating-revision-resolution": "forbidden",
        "fracta-policy-ownership": "forbidden",
        "fracta-release-ownership": "forbidden",
        git: "forbidden",
        "implicit-impact-ordering": "forbidden",
        network: "forbidden",
        process: "forbidden",
        "profile-mutation": "forbidden",
        "skill-download": "forbidden",
        "skill-execution": "forbidden",
        "skill-installation": "forbidden",
        "skill-search": "forbidden",
        "unknown-field-ignoring": "forbidden",
        "unknown-mapping-ignoring": "forbidden",
      },
    },
    truth: {
      kind: TRUTH_KIND,
      packageId: "@sothoth/profile-sdk",
      producedStateRefs: ["sothoth.profile-sdk/conformance-result@1"],
      issuedAuthorityRefs: [],
      emittedObservationRefs: ["sothoth.profile-sdk/profile-diagnostic@1"],
      effectOwnership: "non-authoritative-conformance-projection",
    },
    surface: {
      kind: SURFACE_KIND,
      packageId: "@sothoth/profile-sdk",
      publicModules: [
        "@sothoth/profile-sdk/conformance",
        "@sothoth/profile-sdk/contract-composition",
        "@sothoth/profile-sdk/load",
        "@sothoth/profile-sdk/recommendations",
        "@sothoth/profile-sdk/relation-roles",
      ],
      surfaceKind: "pure-functions-only",
    },
    determinism: {
      kind: DETERMINISM_KIND,
      packageId: "@sothoth/profile-sdk",
      byteStableOutputs: true,
      stringOrdering: "unicode-code-point",
      tieBreaking: "canonical-identity-then-diagnostic-code",
    },
    criteria: {
      kind: CRITERIA_KIND,
      packageId: "@sothoth/profile-sdk",
      criteria: [
        { criterionId: "profile-consumer-neutral-boundary", sectionId: "responsibility-and-truth-ownership" },
        { criterionId: "profile-fail-closed-conformance", sectionId: "failure-recovery-and-consistency" },
        { criterionId: "profile-impact-no-ordering", sectionId: "authority-security-and-effects" },
        { criterionId: "profile-skills-curated-exact-only", sectionId: "core-sdk-protocol-boundary" },
      ],
    },
    extra: {
      [PROFILE_BOUNDARY_KIND]: {
        kind: PROFILE_BOUNDARY_KIND,
        packageId: "@sothoth/profile-sdk",
        compositionMode: "caller-owned-exact-reference-data",
        ownsConsumerIdentity: false,
        ownsConsumerPolicy: false,
        ownsFractaIdentity: false,
        ownsFractaPolicy: false,
        ownsFractaReleaseRules: false,
        ownsRegistryTruth: false,
        ownsPlanGraphTruth: false,
        ownsTaskStateTruth: false,
        ownsCapacityPolicyTruth: false,
        ownsEvidenceTruth: false,
        ownsReleaseBomTruth: false,
        importsDomainImplementations: false,
        impactPromotedToOrderingEdge: false,
      },
      [SKILL_KIND]: {
        kind: SKILL_KIND,
        packageId: "@sothoth/profile-sdk",
        sourceKind: "caller-supplied-curated-versioned-catalog",
        automaticDiscovery: false,
        revisionLocking: "exact-only",
        allowedFields: SKILL_ALLOWED_FIELDS,
        prohibitedOperations: SKILL_PROHIBITED_OPERATIONS,
        namedCandidate: {
          sourceRepository: "mattpocock/skills",
          path: "domain-modeling",
        },
        lockedRevision: null,
        lockedDigest: null,
      },
      [PROFILE_FAILURE_KIND]: {
        kind: PROFILE_FAILURE_KIND,
        packageId: "@sothoth/profile-sdk",
        conformanceResult: "non-authoritative-projection-or-diagnostic",
        failClosedConditions: PROFILE_FAIL_CLOSED_CONDITIONS,
        profileMutation: "forbidden",
      },
    },
    inheritedApplicability: "specializes",
    forbiddenImports: [
      "@sothoth/cli",
      "@sothoth/document-index",
      "@sothoth/git",
      "@sothoth/governance",
      "@sothoth/graph",
      "@sothoth/planning",
      "@sothoth/sdk",
      "@sothoth/selectors",
    ],
  },
];

const COMMON_KIND_SECTION: Record<string, string> = {
  [DEPENDENCY_KIND]: "dependency-and-topology",
  [FORBIDDEN_KIND]: "purpose-and-non-goals",
  [TRUTH_KIND]: "responsibility-and-truth-ownership",
  [SURFACE_KIND]: "public-surface-and-consumers",
  [DETERMINISM_KIND]: "failure-recovery-and-consistency",
  [CRITERIA_KIND]: "verification-and-acceptance-criteria",
  [SCHEDULE_KIND]: "purpose-and-non-goals",
  [PROFILE_BOUNDARY_KIND]: "authority-security-and-effects",
  [SKILL_KIND]: "core-sdk-protocol-boundary",
  [PROFILE_FAILURE_KIND]: "failure-recovery-and-consistency",
  [GIT_PROVENANCE_KIND]: "state-lifecycle-and-data-flow",
  [GIT_PROCESS_KIND]: "authority-security-and-effects",
  [GIT_PATH_KIND]: "failure-recovery-and-consistency",
  [GIT_BUDGET_KIND]: "failure-recovery-and-consistency",
};

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

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    const byCode = codePointCompare(left.code, right.code);
    return byCode !== 0 ? byCode : codePointCompare(left.subject, right.subject);
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

function collectByType(node: any, type: string, result: any[]): void {
  if (!node || typeof node !== "object") return;
  if (node.type === type) result.push(node);
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectByType(child, type, result);
  }
}

/**
 * Recursively walks the CommonMark AST, binds root-level stable markers to their following
 * heading sibling, assigns each fenced `json` block to its enclosing stable section, and reports
 * marker-looking comments outside the root marker/heading protocol. Prose is never scanned.
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
  collectByType(tree, "html", htmlEverywhere);
  for (const node of htmlEverywhere) {
    if (rootMarkerOffsets.has(node.position.start.offset)) continue;
    const match = MARKER.exec(typeof node.value === "string" ? node.value : "");
    if (match) nestedMarkerIds.push(match[1]);
  }

  const blocks: any[] = [];
  collectByType(tree, "code", blocks);
  blocks.sort((left, right) => left.position.start.offset - right.position.start.offset);

  const declarations: DeclarationSite[] = [];
  for (const node of blocks) {
    if (node.lang !== "json") continue;
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

function expectedKinds(spec: IntegrationSpec): Set<string> {
  return new Set([
    DEPENDENCY_KIND,
    FORBIDDEN_KIND,
    TRUTH_KIND,
    SURFACE_KIND,
    DETERMINISM_KIND,
    CRITERIA_KIND,
    ...Object.keys(spec.extra),
  ]);
}

function expectedValueForKind(spec: IntegrationSpec, kind: string): Record<string, unknown> | null {
  if (kind === DEPENDENCY_KIND) return spec.dependency;
  if (kind === FORBIDDEN_KIND) return spec.forbidden;
  if (kind === TRUTH_KIND) return spec.truth;
  if (kind === SURFACE_KIND) return spec.surface;
  if (kind === DETERMINISM_KIND) return spec.determinism;
  if (kind === CRITERIA_KIND) return spec.criteria;
  return spec.extra[kind] ?? null;
}

function checkCodePointOrderedArrays(
  value: any,
  path: string,
  issues: Issue[],
  push: (code: string, subject: string) => void,
): void {
  if (Array.isArray(value)) {
    if (value.length > 1 && value.every((entry) => typeof entry === "string")) {
      if (!arraysEqual(value, codePointSorted(value))) {
        push("sequence-not-code-point-sorted", path);
      }
    }
    value.forEach((entry, index) => checkCodePointOrderedArrays(entry, `${path}[${index}]`, issues, push));
    return;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      checkCodePointOrderedArrays(value[key], `${path}.${key}`, issues, push);
    }
  }
}

function validateIntegrationDesign(facts: {
  documents: Record<string, string>;
  allDossierMarkdown: { componentId: string; markdown: string }[];
  registry: any;
  registrations: any;
  catalog: any;
}): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, subject: string) =>
    issues.push(issue(`sothoth.integration/${code}`, subject));

  const registrationsByComponent = new Map<string, any>();
  for (const registration of Array.isArray(facts.registrations?.registrations)
    ? facts.registrations.registrations
    : []) {
    if (isPlainObject(registration) && typeof registration.componentId === "string") {
      registrationsByComponent.set(registration.componentId, registration);
    }
  }

  const registryByDocument = new Map<string, any>();
  for (const entry of Array.isArray(facts.registry?.documents) ? facts.registry.documents : []) {
    if (isPlainObject(entry) && typeof entry.documentId === "string") {
      registryByDocument.set(entry.documentId, entry);
    }
  }

  const candidatesByComponent = new Map<string, any>();
  for (const candidate of Array.isArray(facts.catalog?.candidates) ? facts.catalog.candidates : []) {
    if (isPlainObject(candidate) && typeof candidate.componentId === "string") {
      candidatesByComponent.set(candidate.componentId, candidate);
    }
  }

  const providedContracts = new Map<string, string>();
  for (const registration of registrationsByComponent.values()) {
    for (const ref of Array.isArray(registration.providedContractRefs)
      ? registration.providedContractRefs
      : []) {
      if (typeof ref === "string") providedContracts.set(ref, registration.componentId);
    }
  }

  for (const spec of INTEGRATION) {
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

    const allowedKinds = expectedKinds(spec);
    const kindCounts = new Map<string, number>();
    for (const site of declarations) {
      if (site.parseError) {
        push("declaration-unparseable", `${spec.packageId}:${site.sectionId ?? "outside-stable-section"}`);
        continue;
      }
      if (site.kind === null) {
        push("declaration-kind-missing", `${spec.packageId}:${site.sectionId ?? "outside-stable-section"}`);
        continue;
      }
      if (!allowedKinds.has(site.kind)) {
        push("declaration-kind-unknown", `${spec.packageId}:${site.kind}`);
        continue;
      }
      kindCounts.set(site.kind, (kindCounts.get(site.kind) ?? 0) + 1);
      if (site.sectionId === null) {
        push("declaration-outside-stable-section", `${spec.packageId}:${site.kind}`);
        continue;
      }
      if (COMMON_KIND_SECTION[site.kind] !== site.sectionId) {
        push("declaration-section-misplaced", `${spec.packageId}:${site.kind}`);
      }
      if (site.packageId !== spec.packageId) {
        push("declaration-owner-mismatch", `${spec.packageId}:${site.kind}`);
      }
    }
    for (const [kind, count] of kindCounts) {
      if (count > 1) push("declaration-duplicate", `${spec.packageId}:${kind}`);
    }
    for (const kind of [...allowedKinds].sort(codePointCompare)) {
      if ((kindCounts.get(kind) ?? 0) === 0) {
        push("declaration-missing", `${spec.packageId}:${kind}`);
      }
    }

    const sitesByKind = new Map<string, DeclarationSite>();
    for (const site of declarations) {
      if (!site.parseError && site.kind !== null && !sitesByKind.has(site.kind)) {
        sitesByKind.set(site.kind, site);
      }
    }
    const declaration = (kind: string) => sitesByKind.get(kind) ?? null;

    for (const kind of [
      DEPENDENCY_KIND,
      FORBIDDEN_KIND,
      TRUTH_KIND,
      SURFACE_KIND,
      DETERMINISM_KIND,
      CRITERIA_KIND,
    ]) {
      const site = declaration(kind);
      const expected = expectedValueForKind(spec, kind);
      if (!site || !expected) continue;
      checkCodePointOrderedArrays(site.value, `${spec.packageId}:${kind}`, issues, push);
      if (!canonicalEqual(site.value, expected)) {
        push("declaration-mismatch", `${spec.packageId}:${kind}`);
      }
    }
    for (const kind of Object.keys(spec.extra)) {
      const site = declaration(kind);
      if (!site) continue;
      checkCodePointOrderedArrays(site.value, `${spec.packageId}:${kind}`, issues, push);
    }

    const dependency = declaration(DEPENDENCY_KIND)?.value;
    const truth = declaration(TRUTH_KIND)?.value;
    const criteria = declaration(CRITERIA_KIND)?.value;

    if (dependency) {
      for (const ref of [...(dependency.providedContracts ?? []), ...(dependency.requiredContracts ?? [])]) {
        if (typeof ref !== "string" || !EXACT_REF.test(ref)) {
          push("contract-ref-not-exact", `${spec.packageId}:${ref}`);
        }
      }
      for (const target of dependency.runtimeImportAllowlist ?? []) {
        if (typeof target === "string" && spec.forbiddenImports.includes(target)) {
          push("forbidden-import", `${spec.packageId}:${target}`);
        }
      }
    }

    const registryEntry = registryByDocument.get(spec.documentId);
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
    if (!arraysEqual(registration.providedContractRefs, dependency?.providedContracts)) {
      push("registration-provided-contracts-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.requiredContractRefs, dependency?.requiredContracts)) {
      push("registration-required-contracts-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.producedStateRefs, truth?.producedStateRefs)) {
      push("registration-produced-state-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.issuedAuthorityRefs, truth?.issuedAuthorityRefs)) {
      push("registration-issued-authority-mismatch", spec.packageId);
    }
    if (!arraysEqual(registration.emittedObservationRefs, spec.truth.emittedObservationRefs ?? [])) {
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
        if (topic === "authority-and-security") {
          const reference = resolution.refs?.[0];
          if (
            resolution.resolution !== "inherited" ||
            resolution.sectionId !== null ||
            resolution.reason !== null ||
            !Array.isArray(resolution.refs) ||
            resolution.refs.length !== 1 ||
            reference?.documentId !== CAPSULE_ID ||
            reference?.documentRevision !== CAPSULE_REVISION ||
            reference?.sectionId !== CAPSULE_AUTHORITY_SECTION ||
            reference?.applicability !== spec.inheritedApplicability
          ) {
            push("topic-inheritance-invalid", `${spec.packageId}:${topic}`);
          }
        } else if (
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

    const criterionIds = (registration.acceptanceCriteria ?? []).map((entry: any) => entry?.criterionId);
    if (!arraysEqual(criterionIds, (criteria?.criteria ?? []).map((entry: any) => entry?.criterionId))) {
      push("registration-criteria-mismatch", spec.packageId);
    }
    for (const entry of registration.acceptanceCriteria ?? []) {
      if (!isPlainObject(entry) || entry.sectionId !== "verification-and-acceptance-criteria") {
        push("registration-criterion-section-unresolved", `${spec.packageId}:${entry?.criterionId}`);
      }
    }

    const candidate = candidatesByComponent.get(spec.packageId);
    if (!candidate) {
      push("catalog-candidate-missing", spec.packageId);
    } else if (candidate.coverage !== "complete" || candidate.designId !== spec.designId) {
      push("catalog-coverage-incomplete", spec.packageId);
    }

    for (const required of dependency?.requiredContracts ?? []) {
      if (typeof required !== "string" || !EXACT_REF.test(required)) continue;
      const owner = providedContracts.get(required);
      if (!owner) {
        push("contract-edge-unresolved", required);
      } else if (!(dependency.runtimeImportAllowlist ?? []).includes(owner)) {
        push("contract-owner-not-imported", `${spec.packageId}:${required}:${owner}`);
      }
    }

    const providedOwners = new Map<string, string>();
    for (const [ref, owner] of providedContracts) {
      providedOwners.set(ref, owner);
    }
    for (const target of dependency?.runtimeImportAllowlist ?? []) {
      const owner = registrationsByComponent.get(target);
      if (!owner) {
        push("import-owner-unregistered", `${spec.packageId}:${target}`);
        continue;
      }
      const hasRequiredContract = (dependency.requiredContracts ?? []).some(
        (ref: string) => providedOwners.get(ref) === target,
      );
      if (!hasRequiredContract) {
        push("import-without-required-contract", `${spec.packageId}:${target}`);
      }
    }
  }

  // Planning: one Schedule Solution, dependency/Wave only, explicit unsupported dimensions.
  const planningSpec = INTEGRATION.find((spec) => spec.packageId === "@sothoth/planning");
  if (planningSpec) {
    const planningSite = extractDeclarations(facts.documents[planningSpec.packageId] ?? "").declarations.find(
      (site) => site.kind === SCHEDULE_KIND,
    );
    const schedule = planningSite?.value;
    if (!schedule) {
      push("planning-schedule-declaration-missing", planningSpec.packageId);
    } else {
      if (schedule.solutionIdentity !== "sothoth.planning/schedule-solution@1") {
        push("planning-solution-identity-invalid", planningSpec.packageId);
      }
      if (schedule.authority !== "non-authoritative-projection") {
        push("planning-schedule-authority-invalid", planningSpec.packageId);
      }
      const waves = Array.isArray(schedule.waveTruthIdentities) ? schedule.waveTruthIdentities : [];
      if (waves.length !== 0) {
        for (const waveTruth of waves) {
          push("planning-independent-wave-truth", `${planningSpec.packageId}:${waveTruth}`);
        }
      }
      const implemented = Array.isArray(schedule.implementedCapabilities)
        ? schedule.implementedCapabilities
        : [];
      if (!arraysEqual(implemented, PLANNING_IMPLEMENTED_CAPABILITIES)) {
        push("planning-implemented-capability-boundary", planningSpec.packageId);
      }
      const unsupported = Array.isArray(schedule.unsupportedDimensions) ? schedule.unsupportedDimensions : [];
      for (const dimension of PLANNING_UNSUPPORTED_DIMENSIONS) {
        if (!unsupported.includes(dimension)) {
          push("planning-unsupported-dimension-ignored", `${planningSpec.packageId}:${dimension}`);
        }
      }
      for (const dimension of unsupported) {
        if (!PLANNING_UNSUPPORTED_DIMENSIONS.includes(dimension)) {
          push("planning-unknown-schedule-dimension", `${planningSpec.packageId}:${dimension}`);
        }
      }
      for (const dimension of implemented) {
        if (PLANNING_UNSUPPORTED_DIMENSIONS.includes(dimension)) {
          push("planning-unsupported-dimension-misclassified", `${planningSpec.packageId}:${dimension}`);
        }
      }
      const produced = (planningSpec.truth.producedStateRefs ?? []).filter(
        (ref: unknown) => typeof ref === "string" && ref !== schedule.solutionIdentity,
      );
      if (produced.length !== 0 || (planningSpec.truth.producedStateRefs ?? []).length !== 1) {
        push("planning-schedule-truth-mismatch", planningSpec.packageId);
      }
    }
  }

  // Profile SDK: consumer-neutral boundary, curated exact-only recommendations, fail-closed loading.
  const profileSpec = INTEGRATION.find((spec) => spec.packageId === "@sothoth/profile-sdk");
  if (profileSpec) {
    const profileDeclarations = extractDeclarations(facts.documents[profileSpec.packageId] ?? "").declarations;
    const boundary = profileDeclarations.find((site) => site.kind === PROFILE_BOUNDARY_KIND)?.value;
    if (!boundary) {
      push("profile-boundary-declaration-missing", profileSpec.packageId);
    } else {
      if (boundary.compositionMode !== "caller-owned-exact-reference-data") {
        push("profile-composition-mode-invalid", profileSpec.packageId);
      }
      const ownershipFields: [string, string][] = [
        ["ownsConsumerIdentity", "profile-consumer-identity-owned"],
        ["ownsConsumerPolicy", "profile-consumer-policy-owned"],
        ["ownsFractaIdentity", "profile-fracta-identity-owned"],
        ["ownsFractaPolicy", "profile-fracta-policy-owned"],
        ["ownsFractaReleaseRules", "profile-fracta-release-rules-owned"],
        ["ownsRegistryTruth", "profile-forbidden-truth-owned"],
        ["ownsPlanGraphTruth", "profile-forbidden-truth-owned"],
        ["ownsTaskStateTruth", "profile-forbidden-truth-owned"],
        ["ownsCapacityPolicyTruth", "profile-forbidden-truth-owned"],
        ["ownsEvidenceTruth", "profile-forbidden-truth-owned"],
        ["ownsReleaseBomTruth", "profile-forbidden-truth-owned"],
      ];
      for (const [field, code] of ownershipFields) {
        if (boundary[field] !== false) {
          push(code, `${profileSpec.packageId}:${field}`);
        }
      }
      if (boundary.importsDomainImplementations !== false) {
        push("profile-domain-implementation-imported", profileSpec.packageId);
      }
      if (boundary.impactPromotedToOrderingEdge !== false) {
        push("profile-impact-promoted", profileSpec.packageId);
      }
    }

    const skill = profileDeclarations.find((site) => site.kind === SKILL_KIND)?.value;
    if (!skill) {
      push("profile-skill-declaration-missing", profileSpec.packageId);
    } else {
      if (skill.sourceKind !== "caller-supplied-curated-versioned-catalog") {
        push("profile-skill-source-invalid", profileSpec.packageId);
      }
      if (skill.automaticDiscovery !== false) {
        push("profile-automatic-skill-discovery", profileSpec.packageId);
      }
      if (skill.revisionLocking !== "exact-only") {
        push("profile-skill-revision-not-exact", profileSpec.packageId);
      }
      if (!arraysEqual(skill.allowedFields, SKILL_ALLOWED_FIELDS)) {
        push("profile-skill-allowed-fields-invalid", profileSpec.packageId);
      }
      if (!arraysEqual(skill.prohibitedOperations, SKILL_PROHIBITED_OPERATIONS)) {
        push("profile-skill-operations-invalid", profileSpec.packageId);
      }
      if (
        skill.namedCandidate?.sourceRepository !== "mattpocock/skills" ||
        skill.namedCandidate?.path !== "domain-modeling" ||
        skill.lockedRevision !== null ||
        skill.lockedDigest !== null
      ) {
        push("profile-skill-named-candidate-invalid", profileSpec.packageId);
      }
    }

    const failure = profileDeclarations.find((site) => site.kind === PROFILE_FAILURE_KIND)?.value;
    if (!failure) {
      push("profile-failure-declaration-missing", profileSpec.packageId);
    } else {
      if (failure.conformanceResult !== "non-authoritative-projection-or-diagnostic") {
        push("profile-conformance-result-invalid", profileSpec.packageId);
      }
      if (!arraysEqual(failure.failClosedConditions, PROFILE_FAIL_CLOSED_CONDITIONS)) {
        push("profile-fail-closed-boundary-invalid", profileSpec.packageId);
      }
      if (failure.profileMutation !== "forbidden") {
        push("profile-mutation-enabled", profileSpec.packageId);
      }
    }
  }

  // Git: provenance separation, closed process allowlist, path/ref fail-closed, enforced budgets.
  const gitSpec = INTEGRATION.find((spec) => spec.packageId === "@sothoth/git");
  if (gitSpec) {
    const gitDeclarations = extractDeclarations(facts.documents[gitSpec.packageId] ?? "").declarations;
    const provenance = gitDeclarations.find((site) => site.kind === GIT_PROVENANCE_KIND)?.value;
    if (!provenance) {
      push("git-provenance-declaration-missing", gitSpec.packageId);
    } else {
      if (provenance.workspaceMasqueradesAsCommit !== false) {
        push("git-workspace-provenance-masquerade", gitSpec.packageId);
      }
      if (provenance.provenanceIdentitySeparation !== "strict") {
        push("git-provenance-separation-invalid", gitSpec.packageId);
      }
      if (!arraysEqual(provenance.workspaceByteClasses, GIT_WORKSPACE_BYTE_CLASSES)) {
        push("git-workspace-byte-classes-invalid", gitSpec.packageId);
      }
      const expectedModes = gitSpec.extra[GIT_PROVENANCE_KIND]?.modes;
      if (!canonicalEqual(provenance.modes, expectedModes)) {
        push("git-provenance-modes-invalid", gitSpec.packageId);
      }
    }

    const process = gitDeclarations.find((site) => site.kind === GIT_PROCESS_KIND)?.value;
    if (!process) {
      push("git-process-declaration-missing", gitSpec.packageId);
    } else {
      if (!arraysEqual(process.executableSubcommands, GIT_EXECUTABLE_SUBCOMMANDS)) {
        push("git-command-allowlist-violation", gitSpec.packageId);
      }
      if (process.argumentStyle !== "fixed-argument-array") {
        push("git-argument-style-invalid", gitSpec.packageId);
      }
      if (process.shellInvocation !== "forbidden") {
        push("git-shell-invocation-enabled", gitSpec.packageId);
      }
      if (process.environmentVariableSemantics !== "forbidden") {
        push("git-environment-semantics-enabled", gitSpec.packageId);
      }
      if (!arraysEqual(process.mutationSubcommands, GIT_MUTATION_SUBCOMMANDS)) {
        push("git-mutation-subcommand-boundary-invalid", gitSpec.packageId);
      }
      if (process.mutationCapability !== "forbidden") {
        push("git-mutation-enabled", gitSpec.packageId);
      }
    }

    const path = gitDeclarations.find((site) => site.kind === GIT_PATH_KIND)?.value;
    if (!path) {
      push("git-path-declaration-missing", gitSpec.packageId);
    } else {
      if (path.normalization !== "repository-relative-posix") {
        push("git-path-normalization-invalid", gitSpec.packageId);
      }
      if (path.ambiguousRefPolicy !== "reject") {
        push("git-ambiguous-refs-accepted", gitSpec.packageId);
      }
      if (!arraysEqual(path.rejectedPathClasses, GIT_REJECTED_PATH_CLASSES)) {
        push("git-path-rejection-boundary-invalid", gitSpec.packageId);
      }
    }

    const budget = gitDeclarations.find((site) => site.kind === GIT_BUDGET_KIND)?.value;
    if (!budget) {
      push("git-budget-declaration-missing", gitSpec.packageId);
    } else {
      if (!arraysEqual(budget.enforcedBudgets, GIT_ENFORCED_BUDGETS)) {
        push("git-budget-boundary-invalid", gitSpec.packageId);
      }
      if (budget.exhaustionPolicy !== "fail-closed") {
        push("git-budget-exhaustion-policy-invalid", gitSpec.packageId);
      }
      if (budget.truncationPolicy !== "forbidden") {
        push("git-budget-truncation-enabled", gitSpec.packageId);
      }
    }
  }

  // Dependency DAG over every currently registered package.
  const registeredComponents = [...registrationsByComponent.keys()].sort(codePointCompare);
  const adjacency = new Map<string, Set<string>>();
  for (const componentId of registeredComponents) {
    const dossier = facts.allDossierMarkdown.find((entry) => entry.componentId === componentId);
    if (!dossier) {
      push("registered-dependency-declaration-missing", componentId);
      continue;
    }
    const dependency = extractDeclarations(dossier.markdown).declarations.find(
      (site) => site.kind === DEPENDENCY_KIND,
    );
    if (!dependency) {
      push("registered-dependency-declaration-missing", componentId);
      continue;
    }
    const targets = new Set<string>();
    for (const target of dependency.value.runtimeImportAllowlist ?? []) {
      if (typeof target !== "string") continue;
      targets.add(target);
      if (target === componentId) push("self-import", componentId);
    }
    adjacency.set(componentId, targets);
  }
  for (const from of registeredComponents) {
    const targets = adjacency.get(from) ?? new Set<string>();
    for (const to of targets) {
      const reverseTargets = adjacency.get(to) ?? new Set<string>();
      if (reverseTargets.has(from)) push("reverse-import", `${from}:${to}`);
    }
  }

  const state = new Map<string, number>();
  const stack: string[] = [];
  const cycleNodes = new Set<string>();
  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    for (const target of [...(adjacency.get(node) ?? new Set<string>())].sort(codePointCompare)) {
      const targetState = state.get(target) ?? 0;
      if (targetState === 1) {
        const start = stack.lastIndexOf(target);
        for (let index = start; index < stack.length; index += 1) cycleNodes.add(stack[index]!);
      } else if (targetState === 0) {
        visit(target);
      }
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of registeredComponents) {
    if ((state.get(node) ?? 0) === 0) visit(node);
  }
  for (const node of [...cycleNodes].sort(codePointCompare)) {
    push("import-cycle", node);
  }

  // Registry/registration/catalog ordering: proposed document entries and registrations are
  // code-point ordered by identity, and the catalog candidate list is code-point ordered.
  const proposedDocuments = (facts.registry?.documents ?? []).filter(
    (entry: any) => isPlainObject(entry) && entry.status === "proposed",
  );
  if (
    proposedDocuments.length > 1 &&
    !arraysEqual(
      proposedDocuments.map((entry: any) => entry.documentId),
      codePointSorted(proposedDocuments.map((entry: any) => entry.documentId)),
    )
  ) {
    push("registry-order-not-code-point-sorted", "proposed-documents");
  }
  const registrationDesignIds = (facts.registrations?.registrations ?? [])
    .filter((entry: any) => isPlainObject(entry))
    .map((entry: any) => entry.designId);
  if (
    registrationDesignIds.length > 1 &&
    !arraysEqual(registrationDesignIds, codePointSorted(registrationDesignIds))
  ) {
    push("registration-order-not-code-point-sorted", "design-ids");
  }
  const catalogComponentIds = (facts.catalog?.candidates ?? [])
    .filter((entry: any) => isPlainObject(entry))
    .map((entry: any) => entry.componentId);
  if (
    catalogComponentIds.length > 1 &&
    !arraysEqual(catalogComponentIds, codePointSorted(catalogComponentIds))
  ) {
    push("catalog-order-not-code-point-sorted", "component-ids");
  }
  if (facts.catalog?.status !== "working") {
    push("catalog-status-invalid", "status");
  }

  for (const spec of INTEGRATION) {
    const registryEntry = registryByDocument.get(spec.documentId);
    const registration = registrationsByComponent.get(spec.packageId);
    // Registry documents stay proposed; only the registrations passed the external human gate, so
    // the reviewed registrations must now be accepted and never silently rolled back.
    if (registryEntry?.status === "accepted") push("accepted-status-forbidden", spec.documentId);
    if (registration?.status !== "accepted") push("registration-status-invalid", spec.packageId);
  }

  return sortIssues(issues);
}

function mutateDeclaration(
  markdown: string,
  kind: string,
  mutate: (value: any) => void,
): string {
  const { declarations } = extractDeclarations(markdown);
  const sites = declarations.filter((entry) => !entry.parseError && entry.kind === kind);
  if (sites.length !== 1) throw new Error(`expected exactly one ${kind} declaration, found ${sites.length}`);
  const site = sites[0]!;
  const value = JSON.parse(JSON.stringify(site.value));
  mutate(value);
  const replacement = `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  return markdown.slice(0, site.start) + replacement + markdown.slice(site.end);
}

async function repositoryFacts(): Promise<any> {
  const documents: Record<string, string> = {};
  for (const spec of INTEGRATION) {
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

function fixtureDossierMarkdown(): string {
  return REQUIRED_SECTIONS.map(
    (sectionId) => `<!-- sothoth:section id="${sectionId}" -->\n\n## ${sectionId}\n\nFixture body.\n`,
  ).join("\n");
}

async function syntheticClosureFacts(): Promise<any> {
  const facts = await repositoryFacts();
  const contract = await readJson(CONTRACT_PATH);
  const realRegistrations = (facts.registrations.registrations ?? []).filter((entry: any) =>
    isPlainObject(entry),
  );
  const realComponents = new Set(realRegistrations.map((entry: any) => entry.componentId));
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
    [FIXTURE_DOSSIER_ID]: fixtureDossierMarkdown(),
  };
  for (const entry of facts.registry.documents ?? []) {
    if (typeof entry?.documentId === "string") {
      documents[entry.documentId] = await readText(`${root}/${entry.path}`);
    }
  }
  for (const spec of INTEGRATION) {
    documents[spec.documentId] = facts.documents[spec.packageId];
  }
  const fixtureRegistrations = facts.catalog.candidates
    .filter((candidate: any) => !realComponents.has(candidate.componentId))
    .map((candidate: any) => {
      const topicCoverage: Record<string, unknown> = {};
      for (const topic of CLOSED_TOPICS) {
        topicCoverage[topic] = {
          resolution: "local",
          sectionId: TOPIC_SECTION[topic] ?? "authority-security-and-effects",
          refs: [],
          reason: null,
        };
      }
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
        acceptanceCriteria: [
          { criterionId: "fixture-criterion-1", sectionId: "verification-and-acceptance-criteria" },
        ],
        supersedes: null,
      };
    });
  return {
    phase: "closure",
    catalog: facts.catalog,
    contract,
    registry: syntheticRegistry,
    documents,
    registrations: {
      ...facts.registrations,
      registrations: [...realRegistrations, ...fixtureRegistrations],
    },
  };
}

describe("integration dossier structured design facts", () => {
  test("the three planning/profile/git Dossiers and their registry, registration, and catalog facts validate", async () => {
    const facts = await repositoryFacts();
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test.each(INTEGRATION.map((spec) => [spec.packageId, spec]))(
    "%s declares exactly the eighteen contract sections in the frozen order",
    async (packageId: string, spec: IntegrationSpec) => {
      const markdown = await readText(`${root}/${spec.path}`);
      const parsed = parseStableSections(markdown);
      expect(parsed.sectionIds).toEqual(REQUIRED_SECTIONS);
      expect(parsed.issues).toEqual([]);
    },
  );

  test("the three new registrations close under the bootstrap checker once the catalog is synthetically completed", async () => {
    const result = checkPreDesign(await syntheticClosureFacts());
    expect(result.issues).toEqual([]);
    expect(result.outcome).toBe("valid");
    expect(result.projection.readyForAcceptance).toBe(true);
    for (const spec of INTEGRATION) {
      const member = result.projection.members.find((entry: any) => entry.componentId === spec.packageId);
      // Live reviewed registrations were accepted by the external human owner on 2026-09-03.
      expect(member.registrationStatus).toBe("accepted");
      expect(member.documentRef.documentId).toBe(spec.documentId);
      expect(member.localTopics + member.inheritedTopics + member.notApplicableTopics).toBe(18);
      expect(member.inheritedTopics).toBe(1);
    }
  });

  test("every registered package dependency graph is acyclic, reverse-free, and self-free", async () => {
    const facts = await repositoryFacts();
    const issues = validateIntegrationDesign(facts).filter((entry) =>
      ["sothoth.integration/import-cycle", "sothoth.integration/reverse-import", "sothoth.integration/self-import"].includes(
        entry.code,
      ),
    );
    expect(issues).toEqual([]);
  });

  test("planning freezes one non-authoritative Schedule Solution with dependency and Wave only", async () => {
    const facts = await repositoryFacts();
    const markdown = facts.documents["@sothoth/planning"];
    const schedule = extractDeclarations(markdown).declarations.find(
      (site) => site.kind === SCHEDULE_KIND,
    )?.value;
    expect(schedule.solutionIdentity).toBe("sothoth.planning/schedule-solution@1");
    expect(schedule.waveTruthIdentities).toEqual([]);
    expect(schedule.implementedCapabilities).toEqual(PLANNING_IMPLEMENTED_CAPABILITIES);
    expect(schedule.unsupportedDimensions).toEqual(PLANNING_UNSUPPORTED_DIMENSIONS);
    expect(schedule.implementedCapabilities.filter((entry: string) =>
      PLANNING_UNSUPPORTED_DIMENSIONS.includes(entry),
    )).toEqual([]);
    const planning = INTEGRATION.find((spec) => spec.packageId === "@sothoth/planning")!;
    expect(planning.truth.producedStateRefs).toEqual([schedule.solutionIdentity]);
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test("profile SDK owns neither consumer identity/policy nor FRACTA policy, and impact never becomes order", async () => {
    const facts = await repositoryFacts();
    const boundary = extractDeclarations(facts.documents["@sothoth/profile-sdk"]).declarations.find(
      (site) => site.kind === PROFILE_BOUNDARY_KIND,
    )?.value;
    expect(boundary.ownsConsumerIdentity).toBe(false);
    expect(boundary.ownsConsumerPolicy).toBe(false);
    expect(boundary.ownsFractaPolicy).toBe(false);
    expect(boundary.impactPromotedToOrderingEdge).toBe(false);
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test("skill recommendations are caller-supplied curated exact references only", async () => {
    const facts = await repositoryFacts();
    const skill = extractDeclarations(facts.documents["@sothoth/profile-sdk"]).declarations.find(
      (site) => site.kind === SKILL_KIND,
    )?.value;
    expect(skill.sourceKind).toBe("caller-supplied-curated-versioned-catalog");
    expect(skill.automaticDiscovery).toBe(false);
    expect(skill.revisionLocking).toBe("exact-only");
    expect(skill.allowedFields).toEqual(SKILL_ALLOWED_FIELDS);
    expect(skill.prohibitedOperations).toEqual(SKILL_PROHIBITED_OPERATIONS);
    expect(skill.namedCandidate).toEqual({ sourceRepository: "mattpocock/skills", path: "domain-modeling" });
    expect(skill.lockedRevision).toBe(null);
    expect(skill.lockedDigest).toBe(null);
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test("git provenance modes cannot masquerade, the command allowlist is closed, and mutation is forbidden", async () => {
    const facts = await repositoryFacts();
    const declarations = extractDeclarations(facts.documents["@sothoth/git"]).declarations;
    const provenance = declarations.find((site) => site.kind === GIT_PROVENANCE_KIND)?.value;
    const process = declarations.find((site) => site.kind === GIT_PROCESS_KIND)?.value;
    expect(provenance.workspaceMasqueradesAsCommit).toBe(false);
    expect(provenance.provenanceIdentitySeparation).toBe("strict");
    expect(provenance.workspaceByteClasses).toEqual(GIT_WORKSPACE_BYTE_CLASSES);
    expect(process.executableSubcommands).toEqual(GIT_EXECUTABLE_SUBCOMMANDS);
    expect(process.argumentStyle).toBe("fixed-argument-array");
    expect(process.mutationSubcommands).toEqual(GIT_MUTATION_SUBCOMMANDS);
    expect(process.mutationCapability).toBe("forbidden");
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test("git path escape and ambiguous refs fail closed under enforced byte budgets", async () => {
    const facts = await repositoryFacts();
    const declarations = extractDeclarations(facts.documents["@sothoth/git"]).declarations;
    const path = declarations.find((site) => site.kind === GIT_PATH_KIND)?.value;
    const budget = declarations.find((site) => site.kind === GIT_BUDGET_KIND)?.value;
    expect(path.normalization).toBe("repository-relative-posix");
    expect(path.ambiguousRefPolicy).toBe("reject");
    expect(path.rejectedPathClasses).toEqual(GIT_REJECTED_PATH_CLASSES);
    expect(budget.enforcedBudgets).toEqual(GIT_ENFORCED_BUDGETS);
    expect(budget.exhaustionPolicy).toBe("fail-closed");
    expect(budget.truncationPolicy).toBe("forbidden");
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test("all identity, contract, package, and diagnostic sequences are Unicode code-point ordered", async () => {
    const facts = await repositoryFacts();
    for (const spec of INTEGRATION) {
      const declarations = extractDeclarations(facts.documents[spec.packageId]).declarations;
      for (const site of declarations) {
        if (!site.value) continue;
        checkCodePointOrderedArrays(
          site.value,
          `${spec.packageId}:${site.kind}`,
          [],
          (code, subject) => {
            throw new Error(`${code} ${subject}`);
          },
        );
      }
    }
    expect(validateIntegrationDesign(facts)).toEqual([]);
  });

  test("the Task 4 direct-contract ruling holds for every new package", async () => {
    const facts = await repositoryFacts();
    for (const spec of INTEGRATION) {
      const dependency = extractDeclarations(facts.documents[spec.packageId]).declarations.find(
        (site) => site.kind === DEPENDENCY_KIND,
      )?.value;
      expect(dependency.requiredContracts).toContain("CONTRACT/SOTHOTH/SCHEMAS@1");
      expect(dependency.runtimeImportAllowlist).toContain("@sothoth/contracts");
      expect(dependency.requiredContracts).toContain("CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1");
      expect(dependency.runtimeImportAllowlist).toContain("@sothoth/core");
      const registration = facts.registrations.registrations.find(
        (entry: any) => entry.componentId === spec.packageId,
      );
      expect(registration.requiredContractRefs).toEqual(dependency.requiredContracts);
    }
    const planning = INTEGRATION.find((spec) => spec.packageId === "@sothoth/planning")!;
    expect(planning.dependency.requiredContracts).toEqual([
      "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
      "CONTRACT/SOTHOTH/GENERIC-GRAPH@1",
      "CONTRACT/SOTHOTH/SCHEMAS@1",
      "CONTRACT/SOTHOTH/SELECTOR@1",
    ]);
    expect(planning.dependency.runtimeImportAllowlist).toEqual([
      "@sothoth/contracts",
      "@sothoth/core",
      "@sothoth/graph",
      "@sothoth/selectors",
    ]);
  });

  test("validator diagnostics sort strictly by Unicode code point over code, then subject", () => {
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

describe("integration dossier mutation tests", () => {
  test("rejects creating an independent Wave truth next to the Schedule Solution", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/planning", (markdown) =>
      mutateDeclaration(markdown, SCHEDULE_KIND, (value) => {
        value.waveTruthIdentities = ["sothoth.planning/wave-truth@1"];
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/planning-independent-wave-truth",
        subject: "@sothoth/planning:sothoth.planning/wave-truth@1",
      },
    ]);
  });

  test("rejects silently ignoring an unsupported scheduling dimension", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/planning", (markdown) =>
      mutateDeclaration(markdown, SCHEDULE_KIND, (value) => {
        value.unsupportedDimensions = value.unsupportedDimensions.filter(
          (dimension: string) => dimension !== "time",
        );
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/planning-unsupported-dimension-ignored",
        subject: "@sothoth/planning:time",
      },
    ]);
  });

  test("rejects profile SDK owning FRACTA policy", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/profile-sdk", (markdown) =>
      mutateDeclaration(markdown, PROFILE_BOUNDARY_KIND, (value) => {
        value.ownsFractaPolicy = true;
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/profile-fracta-policy-owned",
        subject: "@sothoth/profile-sdk:ownsFractaPolicy",
      },
    ]);
  });

  test("rejects automatic skill discovery", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/profile-sdk", (markdown) =>
      mutateDeclaration(markdown, SKILL_KIND, (value) => {
        value.automaticDiscovery = true;
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/profile-automatic-skill-discovery",
        subject: "@sothoth/profile-sdk",
      },
    ]);
  });

  test("rejects enabling any Git mutation capability", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/git", (markdown) =>
      mutateDeclaration(markdown, GIT_PROCESS_KIND, (value) => {
        value.mutationCapability = "permitted";
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/git-mutation-enabled",
        subject: "@sothoth/git",
      },
    ]);
  });

  test("rejects accepting ambiguous refs", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/git", (markdown) =>
      mutateDeclaration(markdown, GIT_PATH_KIND, (value) => {
        value.ambiguousRefPolicy = "accept";
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/git-ambiguous-refs-accepted",
        subject: "@sothoth/git",
      },
    ]);
  });

  test("rejects workspace evidence masquerading as commit evidence", async () => {
    expect(validateIntegrationDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/git", (markdown) =>
      mutateDeclaration(markdown, GIT_PROVENANCE_KIND, (value) => {
        value.workspaceMasqueradesAsCommit = true;
      }),
    );
    expect(validateIntegrationDesign(facts)).toEqual([
      {
        code: "sothoth.integration/git-workspace-provenance-masquerade",
        subject: "@sothoth/git",
      },
    ]);
  });
});
