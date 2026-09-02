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

// The section/topic vocabulary is derived from the accepted Dossier Document Contract instead of
// being frozen locally again, so this suite cannot silently drift from the contract it enforces.
const contractFacts = JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
const REQUIRED_SECTIONS: string[] = contractFacts.sections.requiredSectionIds;
const CLOSED_TOPICS: string[] = contractFacts.topics.closedSet;

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
const FACADE_KIND = "sothoth-dossier/facade-capability-declaration@1";
const SDK_OUTCOME_KIND = "sothoth-dossier/sdk-outcome-declaration@1";
const CLI_COMMAND_KIND = "sothoth-dossier/cli-command-declaration@1";
const CLI_INPUT_KIND = "sothoth-dossier/cli-input-declaration@1";
const CLI_EXIT_KIND = "sothoth-dossier/cli-exit-declaration@1";
const CLI_OUTPUT_KIND = "sothoth-dossier/cli-output-declaration@1";
const CLI_STREAM_KIND = "sothoth-dossier/cli-stream-declaration@1";

const EXACT_REF = /^(.+)@([1-9][0-9]*)$/;
const MARKER = /^<!-- sothoth:section id="([a-z][a-z0-9-]*)" -->$/;

const GENERIC_GRAPH_REF = "CONTRACT/SOTHOTH/GENERIC-GRAPH@1";
const SDK_FACADE_STATE = "sothoth.sdk/facade-result@1";
const CLI_INVOCATION_STATE = "sothoth.cli/cli-invocation-result@1";
const OUTPUT_UNWRITABLE_DIAGNOSTIC = "sothoth.pre-design/output-unwritable";

const SDK_CAPABILITY_OWNERS = [
  "@sothoth/contracts",
  "@sothoth/core",
  "@sothoth/document-index",
  "@sothoth/git",
  "@sothoth/governance",
  "@sothoth/planning",
  "@sothoth/profile-sdk",
  "@sothoth/selectors",
];

const SDK_REQUIRED_CONTRACTS = [
  "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
  "CONTRACT/SOTHOTH/CHANGE-PLAN@1",
  "CONTRACT/SOTHOTH/CONSUMER-PROFILE@1",
  "CONTRACT/SOTHOTH/DOCUMENT-INDEX@1",
  "CONTRACT/SOTHOTH/GIT-SOURCE-SNAPSHOT@1",
  "CONTRACT/SOTHOTH/GOVERNANCE-COMPILATION@1",
  "CONTRACT/SOTHOTH/PLANNING@1",
  "CONTRACT/SOTHOTH/PRE-DESIGN@1",
  "CONTRACT/SOTHOTH/SCHEMAS@1",
  "CONTRACT/SOTHOTH/SELECTOR@1",
];

const CLI_COMMANDS = [
  "change-plan",
  "check",
  "compile governance",
  "compile planning",
  "explain",
  "index",
  "select",
  "verify-projection",
];

const CLI_EXIT_MAP: Record<string, string> = {
  "0": "valid",
  "1": "invalid",
  "2": "invalid-input",
  "3": "extension-error",
  "4": "internal-error",
};

interface SurfaceSpec {
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
  allowedImports: string[];
}

const SURFACE: SurfaceSpec[] = [
  {
    packageId: "@sothoth/sdk",
    designId: "SOTHOTH-SDK-DOSSIER",
    documentId: "DOC-SOTHOTH-SDK-DOSSIER",
    path: "docs/design/dossiers/sdk.md",
    dependency: {
      kind: DEPENDENCY_KIND,
      packageId: "@sothoth/sdk",
      runtimeImportAllowlist: SDK_CAPABILITY_OWNERS,
      providedContracts: ["CONTRACT/SOTHOTH/PUBLIC-SDK@1"],
      requiredContracts: SDK_REQUIRED_CONTRACTS,
    },
    forbidden: {
      kind: FORBIDDEN_KIND,
      packageId: "@sothoth/sdk",
      capabilityClasses: {
        "ambient-global-configuration": "forbidden",
        "arbitrary-process-runner": "forbidden",
        "cli-exit-code-ownership": "forbidden",
        "consumer-identity-types": "forbidden",
        "domain-truth-ownership": "forbidden",
        "environment-variable-semantics": "forbidden",
        "evidence-runner": "forbidden",
        "extension-outcome-selection": "forbidden",
        "filesystem-scan": "forbidden",
        "floating-revision-resolution": "forbidden",
        "fracta-policy-ownership": "forbidden",
        "git-mutation": "forbidden",
        "hidden-clock-random-environment": "forbidden",
        "mutable-singleton": "forbidden",
        network: "forbidden",
        "private-core-import": "forbidden",
        process: "forbidden",
        "source-fact-write-back": "forbidden",
      },
    },
    truth: {
      kind: TRUTH_KIND,
      packageId: "@sothoth/sdk",
      producedStateRefs: [SDK_FACADE_STATE],
      issuedAuthorityRefs: [],
      emittedObservationRefs: [],
      ownsDomainTruth: false,
      effectOwnership: "delegating-library-facade",
    },
    surface: {
      kind: SURFACE_KIND,
      packageId: "@sothoth/sdk",
      publicModules: [
        "@sothoth/sdk/change-plan",
        "@sothoth/sdk/check",
        "@sothoth/sdk/compile",
        "@sothoth/sdk/diagnostics",
        "@sothoth/sdk/documents",
        "@sothoth/sdk/git",
        "@sothoth/sdk/profiles",
        "@sothoth/sdk/verify",
      ],
      surfaceKind: "typed-outcome-library-facade",
    },
    determinism: {
      kind: DETERMINISM_KIND,
      packageId: "@sothoth/sdk",
      byteStableOutputs: true,
      stringOrdering: "unicode-code-point",
      tieBreaking: "canonical-identity-then-diagnostic-code",
    },
    criteria: {
      kind: CRITERIA_KIND,
      packageId: "@sothoth/sdk",
      criteria: [
        { criterionId: "sdk-facade-delegation-only", sectionId: "core-sdk-protocol-boundary" },
        { criterionId: "sdk-import-boundary-closure", sectionId: "dependency-and-topology" },
        { criterionId: "sdk-no-domain-truth", sectionId: "responsibility-and-truth-ownership" },
        { criterionId: "sdk-no-exit-code-authority", sectionId: "failure-recovery-and-consistency" },
        { criterionId: "sdk-no-generic-graph-wrap", sectionId: "dependency-and-topology" },
      ],
    },
    extra: {
      [FACADE_KIND]: {
        kind: FACADE_KIND,
        packageId: "@sothoth/sdk",
        facadeKind: "aggregate-public-library-facade",
        solePublicLibraryFacade: true,
        secondCore: false,
        ownsDomainTruth: false,
        wrapsGenericGraph: false,
        exposesPrivateCoreCapability: false,
        delegatesSemanticOperations: true,
        delegatesTo: SDK_CAPABILITY_OWNERS,
        nonDelegatedSemanticOperations: [],
      },
      [SDK_OUTCOME_KIND]: {
        kind: SDK_OUTCOME_KIND,
        packageId: "@sothoth/sdk",
        outcomeEnvelope: "closed-typed-outcome-with-diagnostics",
        selectsProcessExitCode: false,
        extensionSelectsOutcome: false,
        failClosedConditions: [
          "unknown-contract-revision",
          "unknown-field",
          "unknown-outcome-kind",
        ],
      },
    },
    inheritedApplicability: "narrows",
    allowedImports: SDK_CAPABILITY_OWNERS,
  },
  {
    packageId: "@sothoth/cli",
    designId: "SOTHOTH-CLI-DOSSIER",
    documentId: "DOC-SOTHOTH-CLI-DOSSIER",
    path: "docs/design/dossiers/cli.md",
    dependency: {
      kind: DEPENDENCY_KIND,
      packageId: "@sothoth/cli",
      runtimeImportAllowlist: ["@sothoth/sdk"],
      providedContracts: ["CONTRACT/SOTHOTH/CLI-IO@1"],
      requiredContracts: ["CONTRACT/SOTHOTH/PUBLIC-SDK@1"],
    },
    forbidden: {
      kind: FORBIDDEN_KIND,
      packageId: "@sothoth/cli",
      capabilityClasses: {
        "arbitrary-command-execution": "forbidden",
        "direct-domain-package-import": "forbidden",
        "environment-variable-semantics": "forbidden",
        "evidence-check-execution": "forbidden",
        "external-test-runner-invocation": "forbidden",
        "filesystem-scan": "forbidden",
        "git-mutation": "forbidden",
        "hidden-command": "forbidden",
        "implicit-default-profile": "forbidden",
        "implicit-repository-scan": "forbidden",
        "network-request": "forbidden",
        "private-core-escape-hatch": "forbidden",
        "shell-or-javascript-entrypoint": "forbidden",
        "staged-generated-files": "forbidden",
        "undocumented-command": "forbidden",
      },
    },
    truth: {
      kind: TRUTH_KIND,
      packageId: "@sothoth/cli",
      producedStateRefs: [CLI_INVOCATION_STATE],
      issuedAuthorityRefs: [],
      emittedObservationRefs: [],
      ownsDomainTruth: false,
      ownsCompilationSemantics: false,
      ownsAcceptance: false,
      effectOwnership: "composition-and-io-adapter",
    },
    surface: {
      kind: SURFACE_KIND,
      packageId: "@sothoth/cli",
      publicModules: [
        "@sothoth/cli/commands",
        "@sothoth/cli/exit",
        "@sothoth/cli/input",
        "@sothoth/cli/render",
        "@sothoth/cli/write",
      ],
      surfaceKind: "explicit-command-surface",
    },
    determinism: {
      kind: DETERMINISM_KIND,
      packageId: "@sothoth/cli",
      byteStableOutputs: true,
      stringOrdering: "unicode-code-point",
      tieBreaking: "canonical-identity-then-diagnostic-code",
    },
    criteria: {
      kind: CRITERIA_KIND,
      packageId: "@sothoth/cli",
      criteria: [
        { criterionId: "cli-atomic-explicit-output", sectionId: "state-lifecycle-and-data-flow" },
        { criterionId: "cli-command-surface-closure", sectionId: "public-surface-and-consumers" },
        { criterionId: "cli-exit-mapping-frozen", sectionId: "core-sdk-protocol-boundary" },
        { criterionId: "cli-sdk-only-import-boundary", sectionId: "dependency-and-topology" },
        { criterionId: "cli-stdout-single-document", sectionId: "observation-and-audit" },
      ],
    },
    extra: {
      [CLI_COMMAND_KIND]: {
        kind: CLI_COMMAND_KIND,
        packageId: "@sothoth/cli",
        surfaceKind: "explicit-command-surface",
        commands: CLI_COMMANDS,
        hiddenCommands: [],
        unknownCommandOutcome: "invalid-input",
      },
      [CLI_INPUT_KIND]: {
        kind: CLI_INPUT_KIND,
        packageId: "@sothoth/cli",
        explicitInputSources: ["argv-flags", "explicit-path-arguments"],
        implicitScanning: "forbidden",
        environmentVariableSemantics: "forbidden",
        implicitDefaultProfile: "forbidden",
      },
      [CLI_EXIT_KIND]: {
        kind: CLI_EXIT_KIND,
        packageId: "@sothoth/cli",
        exitMap: CLI_EXIT_MAP,
        ownsExitCodeMapping: true,
        extensionExitOverride: "forbidden",
      },
      [CLI_OUTPUT_KIND]: {
        kind: CLI_OUTPUT_KIND,
        packageId: "@sothoth/cli",
        defaultOutput: "stdout",
        writeStrategy: "same-directory-temp-then-replace",
        atomicExplicitWrites: true,
        partialTargetFiles: "forbidden",
        unwritableDestinationOutcome: "invalid-input",
        unwritableDestinationDiagnostic: OUTPUT_UNWRITABLE_DIAGNOSTIC,
        stagedGeneratedFiles: "forbidden",
      },
      [CLI_STREAM_KIND]: {
        kind: CLI_STREAM_KIND,
        packageId: "@sothoth/cli",
        stdoutContract: "exactly-one-machine-document",
        stdoutContamination: "forbidden",
        operationalNarration: "stderr-only",
      },
    },
    inheritedApplicability: "specializes",
    allowedImports: ["@sothoth/sdk"],
  },
];

const KIND_SECTION: Record<string, string> = {
  [DEPENDENCY_KIND]: "dependency-and-topology",
  [FORBIDDEN_KIND]: "purpose-and-non-goals",
  [TRUTH_KIND]: "responsibility-and-truth-ownership",
  [SURFACE_KIND]: "public-surface-and-consumers",
  [DETERMINISM_KIND]: "failure-recovery-and-consistency",
  [CRITERIA_KIND]: "verification-and-acceptance-criteria",
  [FACADE_KIND]: "core-sdk-protocol-boundary",
  [SDK_OUTCOME_KIND]: "failure-recovery-and-consistency",
  [CLI_COMMAND_KIND]: "public-surface-and-consumers",
  [CLI_INPUT_KIND]: "core-sdk-protocol-boundary",
  [CLI_EXIT_KIND]: "core-sdk-protocol-boundary",
  [CLI_OUTPUT_KIND]: "state-lifecycle-and-data-flow",
  [CLI_STREAM_KIND]: "observation-and-audit",
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

function expectedKinds(spec: SurfaceSpec): Set<string> {
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

function expectedValueForKind(spec: SurfaceSpec, kind: string): Record<string, unknown> | null {
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
  push: (code: string, subject: string) => void,
): void {
  if (Array.isArray(value)) {
    if (value.length > 1 && value.every((entry) => typeof entry === "string")) {
      if (!arraysEqual(value, codePointSorted(value))) {
        push("sequence-not-code-point-sorted", path);
      }
    }
    value.forEach((entry, index) => checkCodePointOrderedArrays(entry, `${path}[${index}]`, push));
    return;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      checkCodePointOrderedArrays(value[key], `${path}.${key}`, push);
    }
  }
}

function validateSurfaceDesign(facts: {
  documents: Record<string, string>;
  allDossierMarkdown: { componentId: string; markdown: string }[];
  registry: any;
  registrations: any;
  catalog: any;
}): Issue[] {
  const issues: Issue[] = [];
  const push = (code: string, subject: string) =>
    issues.push(issue(`sothoth.surface/${code}`, subject));

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

  for (const spec of SURFACE) {
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
      if (KIND_SECTION[site.kind] !== site.sectionId) {
        push("declaration-section-misplaced", `${spec.packageId}:${site.kind}`);
      }
      if (site.packageId !== spec.packageId) {
        push("declaration-owner-mismatch", `${spec.packageId}:${site.kind}`);
      }
      const expected = expectedValueForKind(spec, site.kind);
      if (expected !== null && !arraysEqual(codePointSorted(Object.keys(site.value ?? {})), codePointSorted(Object.keys(expected)))) {
        push("declaration-fields-invalid", `${spec.packageId}:${site.kind}`);
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

    // Component-specific semantic checks. A specific diagnostic suppresses only the whole-value
    // equality fallback for the same declaration kind, so every mutation surfaces its exact code
    // while any unanticipated drift still fails the closed expected-value comparison.
    const suppressedKinds = new Set<string>();
    const pushFor = (kind: string, code: string, subject: string) => {
      suppressedKinds.add(kind);
      push(code, subject);
    };

    const dependency = declaration(DEPENDENCY_KIND)?.value;
    const truth = declaration(TRUTH_KIND)?.value;
    const forbiddenValue = declaration(FORBIDDEN_KIND)?.value;

    if (spec.packageId === "@sothoth/sdk") {
      if (truth) {
        for (const ref of Array.isArray(truth.producedStateRefs) ? truth.producedStateRefs : []) {
          if (typeof ref === "string" && !ref.startsWith("sothoth.sdk/")) {
            pushFor(TRUTH_KIND, "sdk-domain-truth-duplicated", `${spec.packageId}:${ref}`);
          }
        }
        if (truth.ownsDomainTruth !== false) {
          pushFor(TRUTH_KIND, "sdk-domain-truth-owned", `${spec.packageId}:ownsDomainTruth`);
        }
      }
      const facade = declaration(FACADE_KIND)?.value;
      if (facade) {
        if (
          facade.facadeKind !== "aggregate-public-library-facade" ||
          facade.solePublicLibraryFacade !== true ||
          facade.delegatesSemanticOperations !== true
        ) {
          pushFor(FACADE_KIND, "sdk-facade-identity-invalid", spec.packageId);
        }
        if (facade.secondCore !== false) {
          pushFor(FACADE_KIND, "sdk-second-core", spec.packageId);
        }
        if (facade.ownsDomainTruth !== false) {
          pushFor(FACADE_KIND, "sdk-domain-truth-owned", `${spec.packageId}:facade`);
        }
        if (facade.wrapsGenericGraph !== false) {
          pushFor(FACADE_KIND, "sdk-generic-graph-wrapped", spec.packageId);
        }
        if (facade.exposesPrivateCoreCapability !== false) {
          pushFor(FACADE_KIND, "sdk-private-core-exposed", spec.packageId);
        }
        if (!arraysEqual(facade.delegatesTo, SDK_CAPABILITY_OWNERS)) {
          pushFor(FACADE_KIND, "sdk-delegation-boundary-invalid", spec.packageId);
        }
      }
      const outcome = declaration(SDK_OUTCOME_KIND)?.value;
      if (outcome) {
        if (outcome.selectsProcessExitCode !== false) {
          pushFor(SDK_OUTCOME_KIND, "sdk-exit-code-owned", spec.packageId);
        }
        if (outcome.extensionSelectsOutcome !== false) {
          pushFor(SDK_OUTCOME_KIND, "sdk-extension-outcome-selection", spec.packageId);
        }
      }
      for (const ref of Array.isArray(dependency?.requiredContracts)
        ? dependency.requiredContracts
        : []) {
        if (ref === GENERIC_GRAPH_REF) {
          pushFor(DEPENDENCY_KIND, "sdk-generic-graph-required", `${spec.packageId}:${ref}`);
        }
      }
    }

    if (spec.packageId === "@sothoth/cli") {
      for (const target of Array.isArray(dependency?.runtimeImportAllowlist)
        ? dependency.runtimeImportAllowlist
        : []) {
        if (typeof target === "string" && !spec.allowedImports.includes(target)) {
          pushFor(DEPENDENCY_KIND, "cli-forbidden-import", `${spec.packageId}:${target}`);
        }
      }
      for (const expectedImport of spec.allowedImports) {
        if (!(Array.isArray(dependency?.runtimeImportAllowlist)
          ? dependency.runtimeImportAllowlist
          : []
        ).includes(expectedImport)) {
          pushFor(DEPENDENCY_KIND, "cli-facade-import-missing", `${spec.packageId}:${expectedImport}`);
        }
      }
      const command = declaration(CLI_COMMAND_KIND)?.value;
      if (command) {
        if (!arraysEqual(command.commands, CLI_COMMANDS)) {
          pushFor(CLI_COMMAND_KIND, "cli-command-surface-invalid", spec.packageId);
        }
        for (const hidden of Array.isArray(command.hiddenCommands) ? command.hiddenCommands : []) {
          pushFor(CLI_COMMAND_KIND, "cli-hidden-command", `${spec.packageId}:${hidden}`);
        }
        if (command.unknownCommandOutcome !== "invalid-input") {
          pushFor(CLI_COMMAND_KIND, "cli-unknown-command-outcome-invalid", spec.packageId);
        }
      }
      const capabilityClasses = isPlainObject(forbiddenValue?.capabilityClasses)
        ? forbiddenValue.capabilityClasses
        : null;
      for (const [name, value] of Object.entries(capabilityClasses ?? {})) {
        if (value !== "forbidden") {
          pushFor(FORBIDDEN_KIND, "cli-forbidden-capability-enabled", `${spec.packageId}:${name}`);
        }
      }
      const input = declaration(CLI_INPUT_KIND)?.value;
      if (input) {
        if (input.implicitScanning !== "forbidden") {
          pushFor(CLI_INPUT_KIND, "cli-implicit-scan-enabled", spec.packageId);
        }
        if (input.environmentVariableSemantics !== "forbidden") {
          pushFor(CLI_INPUT_KIND, "cli-environment-semantics-enabled", spec.packageId);
        }
        if (input.implicitDefaultProfile !== "forbidden") {
          pushFor(CLI_INPUT_KIND, "cli-implicit-default-profile", spec.packageId);
        }
      }
      const exitDeclaration = declaration(CLI_EXIT_KIND)?.value;
      if (exitDeclaration) {
        if (!canonicalEqual(exitDeclaration.exitMap, CLI_EXIT_MAP)) {
          pushFor(CLI_EXIT_KIND, "cli-exit-map-invalid", "exitMap");
        }
        if (exitDeclaration.ownsExitCodeMapping !== true) {
          pushFor(CLI_EXIT_KIND, "cli-exit-owner-invalid", spec.packageId);
        }
        if (exitDeclaration.extensionExitOverride !== "forbidden") {
          pushFor(CLI_EXIT_KIND, "cli-exit-override-enabled", spec.packageId);
        }
      }
      const output = declaration(CLI_OUTPUT_KIND)?.value;
      if (output) {
        if (
          output.writeStrategy !== "same-directory-temp-then-replace" ||
          output.atomicExplicitWrites !== true
        ) {
          pushFor(CLI_OUTPUT_KIND, "cli-atomic-write-violated", `${spec.packageId}:writeStrategy`);
        }
        if (output.partialTargetFiles !== "forbidden") {
          pushFor(CLI_OUTPUT_KIND, "cli-partial-files-permitted", spec.packageId);
        }
        if (output.unwritableDestinationOutcome !== "invalid-input") {
          pushFor(CLI_OUTPUT_KIND, "cli-unwritable-outcome-invalid", spec.packageId);
        }
        if (output.unwritableDestinationDiagnostic !== OUTPUT_UNWRITABLE_DIAGNOSTIC) {
          pushFor(CLI_OUTPUT_KIND, "cli-unwritable-diagnostic-invalid", spec.packageId);
        }
        if (output.stagedGeneratedFiles !== "forbidden") {
          pushFor(CLI_OUTPUT_KIND, "cli-staged-output", spec.packageId);
        }
        if (output.defaultOutput !== "stdout") {
          pushFor(CLI_OUTPUT_KIND, "cli-default-output-invalid", spec.packageId);
        }
      }
      const stream = declaration(CLI_STREAM_KIND)?.value;
      if (stream) {
        if (stream.stdoutContract !== "exactly-one-machine-document") {
          pushFor(CLI_STREAM_KIND, "cli-stdout-contract-invalid", spec.packageId);
        }
        if (stream.stdoutContamination !== "forbidden") {
          pushFor(CLI_STREAM_KIND, "cli-stdout-contamination-enabled", spec.packageId);
        }
        if (stream.operationalNarration !== "stderr-only") {
          pushFor(CLI_STREAM_KIND, "cli-narration-stream-invalid", spec.packageId);
        }
      }
    }

    for (const kind of [
      DEPENDENCY_KIND,
      FORBIDDEN_KIND,
      TRUTH_KIND,
      SURFACE_KIND,
      DETERMINISM_KIND,
      CRITERIA_KIND,
      ...Object.keys(spec.extra),
    ]) {
      const site = declaration(kind);
      const expected = expectedValueForKind(spec, kind);
      if (!site || !expected || suppressedKinds.has(kind)) continue;
      checkCodePointOrderedArrays(site.value, `${spec.packageId}:${kind}`, push);
      if (!canonicalEqual(site.value, expected)) {
        push("declaration-mismatch", `${spec.packageId}:${kind}`);
      }
    }

    const criteria = declaration(CRITERIA_KIND)?.value;

    if (dependency) {
      for (const ref of [...(dependency.providedContracts ?? []), ...(dependency.requiredContracts ?? [])]) {
        if (typeof ref !== "string" || !EXACT_REF.test(ref)) {
          push("contract-ref-not-exact", `${spec.packageId}:${ref}`);
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
    for (const target of dependency?.runtimeImportAllowlist ?? []) {
      const owner = registrationsByComponent.get(target);
      if (!owner) {
        push("import-owner-unregistered", `${spec.packageId}:${target}`);
        continue;
      }
      const hasRequiredContract = (dependency.requiredContracts ?? []).some(
        (ref: string) => providedContracts.get(ref) === target,
      );
      if (!hasRequiredContract) {
        push("import-without-required-contract", `${spec.packageId}:${target}`);
      }
    }
  }

  // Dependency DAG over every registered package, using exactly-once dependency declarations only.
  const registeredComponents = [...registrationsByComponent.keys()].sort(codePointCompare);
  const expectedComponents = codePointSorted(
    (Array.isArray(facts.catalog?.candidates) ? facts.catalog.candidates : [])
      .map((candidate: any) => candidate?.componentId)
      .filter((componentId: any) => typeof componentId === "string"),
  );
  if (!arraysEqual(registeredComponents, expectedComponents)) {
    push("registered-set-mismatch", "catalog-vs-registrations");
  }
  const adjacency = new Map<string, Set<string>>();
  for (const componentId of registeredComponents) {
    const dossier = facts.allDossierMarkdown.find((entry) => entry.componentId === componentId);
    if (!dossier) {
      push("registered-dependency-declaration-missing", componentId);
      continue;
    }
    const dependencySites = extractDeclarations(dossier.markdown).declarations.filter(
      (site) => !site.parseError && site.kind === DEPENDENCY_KIND,
    );
    if (dependencySites.length !== 1) {
      push("registered-dependency-declaration-invalid", `${componentId}:${dependencySites.length}`);
      continue;
    }
    const targets = new Set<string>();
    for (const target of dependencySites[0]!.value.runtimeImportAllowlist ?? []) {
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

  for (const spec of SURFACE) {
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
  for (const spec of SURFACE) {
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
  registrationMutator?: (registration: any) => void,
): Promise<any> {
  const facts = await repositoryFacts();
  facts.documents[packageId] = mutator(facts.documents[packageId]);
  facts.allDossierMarkdown = facts.allDossierMarkdown.map((dossier: any) =>
    dossier.componentId === packageId ? { ...dossier, markdown: facts.documents[packageId] } : dossier,
  );
  if (registrationMutator) {
    const registration = facts.registrations.registrations.find(
    (entry: any) => entry.componentId === packageId,
    );
    if (!isPlainObject(registration)) {
      throw new Error(`registration missing for ${packageId}`);
    }
    registrationMutator(registration);
  }
  return facts;
}

async function realCheckFacts(phase: string): Promise<any> {
  const registry = await readJson(REGISTRY_PATH);
  const documents: Record<string, string> = {};
  for (const entry of registry.documents ?? []) {
    if (typeof entry?.documentId === "string" && typeof entry?.path === "string") {
      documents[entry.documentId] = await readFile(`${root}/${entry.path}`, "utf8");
    }
  }
  return {
    phase,
    catalog: await readJson(CATALOG_PATH),
    contract: contractFacts,
    registry,
    documents,
    registrations: await readJson(REGISTRATIONS_PATH),
  };
}

describe("surface dossier structured design facts", () => {
  test("the two public-surface Dossiers and their registry, registration, and catalog facts validate", async () => {
    const facts = await repositoryFacts();
    expect(validateSurfaceDesign(facts)).toEqual([]);
  });

  test.each(SURFACE.map((spec) => [spec.packageId, spec]))(
    "%s declares exactly the contract section sequence in the frozen order",
    async (packageId: string, spec: SurfaceSpec) => {
      const markdown = await readText(`${root}/${spec.path}`);
      const parsed = parseStableSections(markdown);
      expect(parsed.sectionIds).toEqual(REQUIRED_SECTIONS);
      expect(parsed.issues).toEqual([]);
    },
  );

  test("the completed repository facts are dossiers-valid without a projection and closure-valid with readyForAcceptance", async () => {
    const dossiers = checkPreDesign(await realCheckFacts("dossiers"));
    expect(dossiers.issues).toEqual([]);
    expect(dossiers.outcome).toBe("valid");
    expect(dossiers.projection).toBe(null);
    const closure = checkPreDesign(await realCheckFacts("closure"));
    expect(closure.issues).toEqual([]);
    expect(closure.outcome).toBe("valid");
    expect(closure.projection.schema).toBe("sothoth.design-closure-projection/v1");
    expect(closure.projection.readyForAcceptance).toBe(true);
    for (const spec of SURFACE) {
      const member = closure.projection.members.find((entry: any) => entry.componentId === spec.packageId);
      // Live reviewed registrations were accepted by the external human owner on 2026-09-03.
      expect(member.registrationStatus).toBe("accepted");
      expect(member.documentRef.documentId).toBe(spec.documentId);
      expect(member.localTopics + member.inheritedTopics + member.notApplicableTopics).toBe(18);
      expect(member.inheritedTopics).toBe(1);
    }
  });

  test("every catalog candidate is registered exactly once with complete design coverage", async () => {
    const facts = await repositoryFacts();
    const registrations = facts.registrations.registrations ?? [];
    for (const candidate of facts.catalog.candidates ?? []) {
      const matches = registrations.filter(
        (registration: any) => registration?.componentId === candidate.componentId,
      );
      expect(matches.length).toBe(1);
      expect(candidate.coverage).toBe("complete");
      expect(matches[0].designId).toBe(candidate.designId);
      expect(matches[0].status).toBe("accepted");
    }
    expect(facts.catalog.status).toBe("working");
  });

  test("the whole registered dependency graph is acyclic, reverse-free, and self-free over exactly-once dependency declarations", async () => {
    const facts = await repositoryFacts();
    const issues = validateSurfaceDesign(facts).filter((entry) =>
      [
        "sothoth.surface/import-cycle",
        "sothoth.surface/reverse-import",
        "sothoth.surface/self-import",
        "sothoth.surface/registered-set-mismatch",
        "sothoth.surface/registered-dependency-declaration-missing",
        "sothoth.surface/registered-dependency-declaration-invalid",
      ].includes(entry.code),
    );
    expect(issues).toEqual([]);
  });

  test("the SDK is the sole aggregate facade that owns no domain truth and never wraps GENERIC-GRAPH", async () => {
    const facts = await repositoryFacts();
    const declarations = extractDeclarations(facts.documents["@sothoth/sdk"]).declarations;
    const facade = declarations.find((site) => site.kind === FACADE_KIND)?.value;
    expect(facade.solePublicLibraryFacade).toBe(true);
    expect(facade.secondCore).toBe(false);
    expect(facade.ownsDomainTruth).toBe(false);
    expect(facade.wrapsGenericGraph).toBe(false);
    expect(facade.exposesPrivateCoreCapability).toBe(false);
    expect(facade.delegatesTo).toEqual(SDK_CAPABILITY_OWNERS);
    const dependency = declarations.find((site) => site.kind === DEPENDENCY_KIND)?.value;
    expect(dependency.requiredContracts).toEqual(SDK_REQUIRED_CONTRACTS);
    expect(dependency.requiredContracts).not.toContain(GENERIC_GRAPH_REF);
    expect(dependency.runtimeImportAllowlist).toEqual(SDK_CAPABILITY_OWNERS);
    const truth = declarations.find((site) => site.kind === TRUTH_KIND)?.value;
    expect(truth.producedStateRefs).toEqual([SDK_FACADE_STATE]);
    expect(validateSurfaceDesign(facts)).toEqual([]);
  });

  test("the CLI maps the five public outcomes to exits 0-4 with one uncontaminated stdout document and atomic explicit writes", async () => {
    const facts = await repositoryFacts();
    const declarations = extractDeclarations(facts.documents["@sothoth/cli"]).declarations;
    const command = declarations.find((site) => site.kind === CLI_COMMAND_KIND)?.value;
    expect(command.commands).toEqual(CLI_COMMANDS);
    expect(command.hiddenCommands).toEqual([]);
    const exitDeclaration = declarations.find((site) => site.kind === CLI_EXIT_KIND)?.value;
    expect(exitDeclaration.exitMap).toEqual(CLI_EXIT_MAP);
    expect(exitDeclaration.ownsExitCodeMapping).toBe(true);
    expect(exitDeclaration.extensionExitOverride).toBe("forbidden");
    const output = declarations.find((site) => site.kind === CLI_OUTPUT_KIND)?.value;
    expect(output.writeStrategy).toBe("same-directory-temp-then-replace");
    expect(output.partialTargetFiles).toBe("forbidden");
    expect(output.unwritableDestinationOutcome).toBe("invalid-input");
    expect(output.unwritableDestinationDiagnostic).toBe(OUTPUT_UNWRITABLE_DIAGNOSTIC);
    const stream = declarations.find((site) => site.kind === CLI_STREAM_KIND)?.value;
    expect(stream.stdoutContract).toBe("exactly-one-machine-document");
    expect(stream.stdoutContamination).toBe("forbidden");
    const dependency = declarations.find((site) => site.kind === DEPENDENCY_KIND)?.value;
    expect(dependency.runtimeImportAllowlist).toEqual(["@sothoth/sdk"]);
    expect(dependency.requiredContracts).toEqual(["CONTRACT/SOTHOTH/PUBLIC-SDK@1"]);
    expect(validateSurfaceDesign(facts)).toEqual([]);
  });

  test("all declaration sequences and collection orderings are Unicode code-point ordered", async () => {
    const facts = await repositoryFacts();
    for (const spec of SURFACE) {
      const declarations = extractDeclarations(facts.documents[spec.packageId]).declarations;
      for (const site of declarations) {
        if (!site.value) continue;
        checkCodePointOrderedArrays(site.value, `${spec.packageId}:${site.kind}`, (code, subject) => {
          throw new Error(`${code} ${subject}`);
        });
      }
    }
    expect(validateSurfaceDesign(facts)).toEqual([]);
  });
});

describe("surface dossier mutation tests", () => {
  test("rejects the SDK duplicating domain truth owned by another package", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts(
      "@sothoth/sdk",
      (markdown) =>
        mutateDeclaration(markdown, TRUTH_KIND, (value) => {
          value.producedStateRefs = ["sothoth.core/compilation-outcome@1", ...value.producedStateRefs];
        }),
      (registration) => {
        registration.producedStateRefs = ["sothoth.core/compilation-outcome@1", ...registration.producedStateRefs];
      },
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/sdk-domain-truth-duplicated",
        subject: "@sothoth/sdk:sothoth.core/compilation-outcome@1",
      },
    ]);
  });

  test("rejects the SDK claiming domain truth ownership", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/sdk", (markdown) =>
      mutateDeclaration(markdown, TRUTH_KIND, (value) => {
        value.ownsDomainTruth = true;
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/sdk-domain-truth-owned",
        subject: "@sothoth/sdk:ownsDomainTruth",
      },
    ]);
  });

  test("rejects the SDK exposing private Core capability", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/sdk", (markdown) =>
      mutateDeclaration(markdown, FACADE_KIND, (value) => {
        value.exposesPrivateCoreCapability = true;
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/sdk-private-core-exposed",
        subject: "@sothoth/sdk",
      },
    ]);
  });

  test("rejects the SDK requiring GENERIC-GRAPH, whose algorithms stay with domain packages", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const spliceGenericGraph = (refs: string[]) => [
      ...refs.slice(0, 4),
      GENERIC_GRAPH_REF,
      ...refs.slice(4),
    ];
    const facts = await mutatedFacts(
      "@sothoth/sdk",
      (markdown) =>
        mutateDeclaration(markdown, DEPENDENCY_KIND, (value) => {
          value.requiredContracts = spliceGenericGraph(value.requiredContracts);
        }),
      (registration) => {
        registration.requiredContractRefs = spliceGenericGraph(registration.requiredContractRefs);
      },
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/contract-owner-not-imported",
        subject: `@sothoth/sdk:${GENERIC_GRAPH_REF}:@sothoth/graph`,
      },
      {
        code: "sothoth.surface/sdk-generic-graph-required",
        subject: `@sothoth/sdk:${GENERIC_GRAPH_REF}`,
      },
    ]);
  });

  test("rejects the CLI importing Core directly instead of the public SDK facade", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, DEPENDENCY_KIND, (value) => {
        value.runtimeImportAllowlist = [...value.runtimeImportAllowlist, "@sothoth/core"];
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-forbidden-import",
        subject: "@sothoth/cli:@sothoth/core",
      },
      {
        code: "sothoth.surface/import-without-required-contract",
        subject: "@sothoth/cli:@sothoth/core",
      },
    ]);
  });

  test("rejects hidden or undocumented commands", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, CLI_COMMAND_KIND, (value) => {
        value.hiddenCommands = ["internal-check"];
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-hidden-command",
        subject: "@sothoth/cli:internal-check",
      },
    ]);
  });

  test("rejects enabling arbitrary process execution", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, FORBIDDEN_KIND, (value) => {
        value.capabilityClasses["arbitrary-command-execution"] = "permitted";
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-forbidden-capability-enabled",
        subject: "@sothoth/cli:arbitrary-command-execution",
      },
    ]);
  });

  test("rejects implicit repository or filesystem scanning", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, CLI_INPUT_KIND, (value) => {
        value.implicitScanning = "permitted";
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-implicit-scan-enabled",
        subject: "@sothoth/cli",
      },
    ]);
  });

  test("rejects contaminating the machine stdout document", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, CLI_STREAM_KIND, (value) => {
        value.stdoutContamination = "permitted";
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-stdout-contamination-enabled",
        subject: "@sothoth/cli",
      },
    ]);
  });

  test("rejects an undocumented exit code outside the frozen 0-4 mapping", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, CLI_EXIT_KIND, (value) => {
        value.exitMap = { ...value.exitMap, "5": "valid" };
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-exit-map-invalid",
        subject: "exitMap",
      },
    ]);
  });

  test("rejects an extension overriding the exit-code mapping", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, CLI_EXIT_KIND, (value) => {
        value.extensionExitOverride = "permitted";
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-exit-override-enabled",
        subject: "@sothoth/cli",
      },
    ]);
  });

  test("rejects non-atomic explicit output writes that can leave partial target files", async () => {
    expect(validateSurfaceDesign(await repositoryFacts())).toEqual([]);
    const facts = await mutatedFacts("@sothoth/cli", (markdown) =>
      mutateDeclaration(markdown, CLI_OUTPUT_KIND, (value) => {
        value.writeStrategy = "direct-streaming-write";
      }),
    );
    expect(validateSurfaceDesign(facts)).toEqual([
      {
        code: "sothoth.surface/cli-atomic-write-violated",
        subject: "@sothoth/cli:writeStrategy",
      },
    ]);
  });
});
