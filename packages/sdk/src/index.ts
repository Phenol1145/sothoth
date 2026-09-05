/**
 * Public modules `@project-sothoth/sdk/{change-plan,check,compile,diagnostics,
 * documents,git,profiles,verify}` — the sole aggregate public library facade
 * of Sothoth `0.1.0` (`CONTRACT/SOTHOTH/PUBLIC-SDK@1`).
 *
 * The facade composes the public capabilities of the eight owning packages
 * behind one typed, versioned surface and delegates EVERY semantic operation
 * to the package that owns it: canonical bytes and digests, diagnostic
 * finalization and outcome folding, document parsing and indexing, selector
 * parsing/matching/explanation, governance pre-design and change-plan
 * compilation, dependency scheduling, Consumer Profile conformance, and Git
 * source snapshots. It performs no semantic step itself, holds no state
 * between calls, never mutates caller data, never reads the environment,
 * never scans a filesystem, never mutates Git, runs no process, and never
 * selects a process exit code: expected failures return through the closed
 * typed outcome/diagnostic envelope `sothoth.sdk/facade-result@1`, and the
 * outcome-to-exit mapping belongs to `@project-sothoth/cli` alone.
 *
 * Every delegated callable is re-exported by reference in `SDK_DELEGATES_V1`
 * so delegation identity is observable; the facade does not wrap
 * `CONTRACT/SOTHOTH/GENERIC-GRAPH@1` and exposes no Core capability beyond
 * `CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1`.
 */

import { buildDocumentIndexV1 } from "@project-sothoth/document-index/index";
import type { DocumentIndexResultV1 } from "@project-sothoth/document-index/index";
import {
  compileDesignClosureV1,
  compileScopeBomAdmissibilityV1,
} from "@project-sothoth/governance/pre-design";
import type {
  DesignClosureCompilationV1,
  ScopeBomAdmissibilityCompilationV1,
} from "@project-sothoth/governance/pre-design";
import { compileChangePlanV1 } from "@project-sothoth/governance/change-plan";
import type { ChangePlanProjectionV1 } from "@project-sothoth/governance/change-plan";
import { compileDependencyScheduleV1 } from "@project-sothoth/planning/schedule";
import type { ScheduleSolutionV1 } from "@project-sothoth/planning/schedule";
import type { SchedulingProblemV1 } from "@project-sothoth/planning/constraints";
import { selectDocumentsV1 } from "@project-sothoth/selectors/match";
import type { SelectorSelectionResultV1 } from "@project-sothoth/selectors/match";
import { defineProfileV1, validateProfileV1 } from "@project-sothoth/profile-sdk/load";
import type { ConsumerProfileV1, ProfileDefinitionV1 } from "@project-sothoth/profile-sdk/load";
import { runProfileConformanceV1 } from "@project-sothoth/profile-sdk/conformance";
import type { ProfileConformanceV1 } from "@project-sothoth/profile-sdk/conformance";
import { createGitSourceAdapterV1 } from "@project-sothoth/git/commit";
import type {
  GitSourceAdapterOptionsV1,
  GitSourceAdapterV1,
} from "@project-sothoth/git/commit";
import { canonicalJson, SothothInputError } from "@project-sothoth/core/canonical-json";
import { sha256Digest } from "@project-sothoth/core/digest";
import { finalizeDiagnostics } from "@project-sothoth/core/diagnostics";
import { aggregateOutcome } from "@project-sothoth/core/outcome";
import {
  COMPILATION_OUTCOMES_V1,
  DIAGNOSTIC_CATEGORIES_V1,
  DIAGNOSTIC_CODE_PATTERN,
  DIAGNOSTIC_DRAFT_FIELDS_V1,
  DIAGNOSTIC_SEVERITIES_V1,
  DIAGNOSTIC_VERDICTS_V1,
  isDiagnosticCodeV1,
  validateDiagnosticDraftV1,
} from "@project-sothoth/contracts";
import type {
  CompilationOutcomeKindV1,
  CompilationOutcomeV1,
  DiagnosticCategoryV1,
  DiagnosticDraftV1,
  DiagnosticSeverityV1,
  DiagnosticVerdictV1,
  JsonValue,
  StructuredDiagnosticV1,
} from "@project-sothoth/contracts";

// ---------------------------------------------------------------------------
// Vocabulary (public module `@project-sothoth/sdk/diagnostics`)
// ---------------------------------------------------------------------------
// The closed `@project-sothoth/contracts` diagnostic vocabulary plus the canonical
// compilation finalization/folding of `@project-sothoth/core`, re-exported verbatim
// for envelope consumers. The facade adds no parallel schema, diagnostic, or
// digest vocabulary of its own.

export {
  COMPILATION_OUTCOMES_V1,
  DIAGNOSTIC_CATEGORIES_V1,
  DIAGNOSTIC_CODE_PATTERN,
  DIAGNOSTIC_DRAFT_FIELDS_V1,
  DIAGNOSTIC_SEVERITIES_V1,
  DIAGNOSTIC_VERDICTS_V1,
  isDiagnosticCodeV1,
  validateDiagnosticDraftV1,
};
export { finalizeDiagnostics, aggregateOutcome };
export type {
  CompilationOutcomeKindV1,
  CompilationOutcomeV1,
  DiagnosticCategoryV1,
  DiagnosticDraftV1,
  DiagnosticSeverityV1,
  DiagnosticVerdictV1,
  JsonValue,
  StructuredDiagnosticV1,
};

// ---------------------------------------------------------------------------
// Delegation table (observable by reference)
// ---------------------------------------------------------------------------

/** The closed runtime import allowlist of the facade (eight packages). */
export const SDK_RUNTIME_IMPORT_ALLOWLIST_V1: readonly string[] = Object.freeze([
  "@project-sothoth/contracts",
  "@project-sothoth/core",
  "@project-sothoth/document-index",
  "@project-sothoth/git",
  "@project-sothoth/governance",
  "@project-sothoth/planning",
  "@project-sothoth/profile-sdk",
  "@project-sothoth/selectors",
]);

/**
 * Every semantic callable the facade delegates to, re-exported by reference:
 * each value IS its owning package's function. A parallel implementation
 * inside the facade would break this identity.
 */
export const SDK_DELEGATES_V1 = Object.freeze({
  buildDocumentIndexV1,
  compileDesignClosureV1,
  compileScopeBomAdmissibilityV1,
  compileChangePlanV1,
  compileDependencyScheduleV1,
  selectDocumentsV1,
  defineProfileV1,
  validateProfileV1,
  runProfileConformanceV1,
  createGitSourceAdapterV1,
  canonicalJson,
  sha256Digest,
  finalizeDiagnostics,
  aggregateOutcome,
});

// The git adapter factory is the owner's callable verbatim (X9→10): the
// facade re-exports it unchanged and softens no fail-closed rejection.
export { createGitSourceAdapterV1 };
export type { GitSourceAdapterOptionsV1, GitSourceAdapterV1 };

// ---------------------------------------------------------------------------
// The facade envelope (`sothoth.sdk/facade-result@1`)
// ---------------------------------------------------------------------------

const FACADE_RESULT_SCHEMA = "sothoth.sdk/facade-result@1" as const;

/**
 * The facade's single produced state: the envelope carrying one delegated
 * result. `result` is the owner's typed outcome verbatim (or `null` when the
 * request never reached an owner); `outcome` and `diagnostics` forward the
 * owner's own folded outcome or its fail-closed issue rejections.
 */
export interface SothothFacadeResultV1<TResult = unknown> {
  readonly schema: typeof FACADE_RESULT_SCHEMA;
  readonly capability: string;
  readonly operation: string;
  readonly contractRefs: readonly string[];
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
  readonly diagnosticCount: number;
  readonly result: TResult | null;
}

/** Owners whose result already folds outcome + finalized diagnostics. */
interface OutcomeBearingV1 {
  readonly outcome: CompilationOutcomeKindV1;
  readonly diagnostics: readonly StructuredDiagnosticV1[];
}

/** Owners that reject malformed caller data as closed issue lists. */
interface IssueBearingV1 {
  readonly code: string;
  readonly subject: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Envelope for an outcome-bearing owner: everything forwards verbatim. */
function outcomeEnvelope<TResult extends OutcomeBearingV1>(
  capability: string,
  operation: string,
  contractRefs: readonly string[],
  owner: TResult,
): SothothFacadeResultV1<TResult> {
  return Object.freeze({
    schema: FACADE_RESULT_SCHEMA,
    capability,
    operation,
    contractRefs: Object.freeze([...contractRefs]),
    outcome: owner.outcome,
    diagnostics: owner.diagnostics,
    diagnosticCount: owner.diagnostics.length,
    result: owner,
  });
}

/**
 * Envelope for an owner that fails only as a fail-closed validator of caller
 * data (Document Index structural issues, Selector issues, Profile issues):
 * a rejection is the invalid-input transport class, and each owner issue
 * forwards verbatim — code and subject unchanged — as a finalized Structured
 * Diagnostic through `@project-sothoth/core`. This classification is envelope
 * adaptation only; no owner semantic is re-implemented or re-interpreted.
 */
function issueEnvelope<TResult extends { readonly ok: boolean }>(
  capability: string,
  operation: string,
  contractRefs: readonly string[],
  phase: string,
  ownerIdentity: string,
  owner: TResult,
  issuesOf: (result: TResult) => readonly IssueBearingV1[],
): SothothFacadeResultV1<TResult> {
  if (owner.ok) {
    return Object.freeze({
      schema: FACADE_RESULT_SCHEMA,
      capability,
      operation,
      contractRefs: Object.freeze([...contractRefs]),
      outcome: "valid",
      diagnostics: [],
      diagnosticCount: 0,
      result: owner,
    });
  }
  const diagnostics = finalizeDiagnostics(
    issuesOf(owner).map((issue) => issueDraft(ownerIdentity, phase, issue)),
  );
  return Object.freeze({
    schema: FACADE_RESULT_SCHEMA,
    capability,
    operation,
    contractRefs: Object.freeze([...contractRefs]),
    outcome: "invalid-input",
    diagnostics,
    diagnosticCount: diagnostics.length,
    result: owner,
  });
}

/** One owner issue forwarded verbatim into the closed diagnostic contract. */
function issueDraft(
  ownerIdentity: string,
  phase: string,
  issue: IssueBearingV1,
): DiagnosticDraftV1 {
  return {
    code: issue.code,
    origin: ownerIdentity,
    category: "input",
    phase,
    verdict: "fail",
    severity: "error",
    ruleId: issue.code,
    location: null,
    subjects: [issue.subject],
    parameters: {},
    causes: [],
    help: [],
  };
}

/** Envelope for an invalid facade request: fail closed, no owner reached. */
function invalidInputEnvelope<TResult>(
  capability: string,
  operation: string,
  contractRefs: readonly string[],
): SothothFacadeResultV1<TResult> {
  return Object.freeze({
    schema: FACADE_RESULT_SCHEMA,
    capability,
    operation,
    contractRefs: Object.freeze([...contractRefs]),
    outcome: "invalid-input",
    diagnostics: [],
    diagnosticCount: 0,
    result: null,
  });
}

/**
 * Runs one owner callable that consumes object-shaped facts. The facade's
 * request-shape gate is transport-level totality only: a request that is not
 * a plain object cannot carry the owner's exact fields, so it fails closed
 * as `invalid-input` without reaching the owner; every object-shaped request
 * passes through exactly as supplied and the owner's own validation decides.
 */
function objectRequestEnvelope<TResult extends OutcomeBearingV1>(
  capability: string,
  operation: string,
  contractRefs: readonly string[],
  request: unknown,
  delegate: (facts: never) => TResult,
): SothothFacadeResultV1<TResult> {
  if (!isPlainObject(request)) {
    return invalidInputEnvelope<TResult>(capability, operation, contractRefs);
  }
  return outcomeEnvelope(capability, operation, contractRefs, delegate(request as never));
}

// ---------------------------------------------------------------------------
// Capability: check (pre-design Design Closure checking)
// ---------------------------------------------------------------------------

/** Pre-design Design Closure checking through `@project-sothoth/governance`. */
export function checkDesignClosure(
  facts: unknown,
): SothothFacadeResultV1<DesignClosureCompilationV1> {
  return objectRequestEnvelope(
    "check/design-closure",
    "compileDesignClosureV1",
    ["CONTRACT/SOTHOTH/PRE-DESIGN@1"],
    facts,
    compileDesignClosureV1,
  );
}

// ---------------------------------------------------------------------------
// Capability: compile (governance and planning compilation)
// ---------------------------------------------------------------------------

/** Scope BOM Admissibility compilation through `@project-sothoth/governance`. */
export function compileGovernance(
  facts: unknown,
): SothothFacadeResultV1<ScopeBomAdmissibilityCompilationV1> {
  return objectRequestEnvelope(
    "compile/governance",
    "compileScopeBomAdmissibilityV1",
    ["CONTRACT/SOTHOTH/PRE-DESIGN@1"],
    facts,
    compileScopeBomAdmissibilityV1,
  );
}

/** Dependency schedule compilation through `@project-sothoth/planning`. */
export function compilePlanning(
  problem: unknown,
): SothothFacadeResultV1<ScheduleSolutionV1> {
  return objectRequestEnvelope(
    "compile/planning",
    "compileDependencyScheduleV1",
    ["CONTRACT/SOTHOTH/PLANNING@1"],
    problem,
    compileDependencyScheduleV1,
  );
}

// ---------------------------------------------------------------------------
// Capability: change-plan (change-plan projection)
// ---------------------------------------------------------------------------

/** Change-plan projection through `@project-sothoth/governance`. */
export function compileChangePlan(
  facts: unknown,
): SothothFacadeResultV1<ChangePlanProjectionV1> {
  return objectRequestEnvelope(
    "change-plan/compile",
    "compileChangePlanV1",
    ["CONTRACT/SOTHOTH/CHANGE-PLAN@1"],
    facts,
    compileChangePlanV1,
  );
}

// ---------------------------------------------------------------------------
// Capability: documents (indexing, selection, explanation)
// ---------------------------------------------------------------------------

/**
 * Document index compilation: delegates to `buildDocumentIndexV1` under
 * `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1`. The facade never re-parses Markdown,
 * never copies index logic, and never wraps Generic Graph.
 */
export function buildDocumentIndex(
  input: unknown,
): SothothFacadeResultV1<DocumentIndexResultV1> {
  return issueEnvelope(
    "documents/index",
    "buildDocumentIndexV1",
    ["CONTRACT/SOTHOTH/DOCUMENT-INDEX@1"],
    "documents",
    "sothoth.document-index",
    buildDocumentIndexV1(input as never),
    (result) => (result.ok ? [] : result.issues),
  );
}

/** The selector request: an index projection, a Selector, optional budgets. */
export interface SelectorRequestV1 {
  readonly documentIndex: unknown;
  readonly selector: unknown;
  readonly budgets?: unknown;
}

function selectRequestEnvelope(
  capability: string,
  operation: string,
  request: unknown,
): SothothFacadeResultV1<SelectorSelectionResultV1> {
  if (!isPlainObject(request) || !("documentIndex" in request) || !("selector" in request)) {
    return invalidInputEnvelope(capability, operation, ["CONTRACT/SOTHOTH/SELECTOR@1"]);
  }
  const selectorRequest = request as unknown as SelectorRequestV1;
  return issueEnvelope(
    capability,
    operation,
    ["CONTRACT/SOTHOTH/SELECTOR@1"],
    "documents",
    "sothoth.selectors",
    selectDocumentsV1(
      selectorRequest.documentIndex as never,
      selectorRequest.selector,
      selectorRequest.budgets as never,
    ),
    (result) => (result.ok ? [] : result.issues),
  );
}

/** Selector resolution through `@project-sothoth/selectors`. */
export function selectDocuments(
  request: unknown,
): SothothFacadeResultV1<SelectorSelectionResultV1> {
  return selectRequestEnvelope("documents/select", "selectDocumentsV1", request);
}

/** Selector evaluation explanation through `@project-sothoth/selectors` (trace owner). */
export function explainSelector(
  request: unknown,
): SothothFacadeResultV1<SelectorSelectionResultV1> {
  return selectRequestEnvelope("documents/explain", "selectDocumentsV1", request);
}

// ---------------------------------------------------------------------------
// Capability: git (source snapshots; X9→10)
// ---------------------------------------------------------------------------

/** Builds the read-only Git source adapter of `@project-sothoth/git`, verbatim. */
export function gitSourceAdapter(options?: GitSourceAdapterOptionsV1): GitSourceAdapterV1 {
  return createGitSourceAdapterV1(options);
}

// ---------------------------------------------------------------------------
// Capability: profiles (Consumer Profile conformance)
// ---------------------------------------------------------------------------

/** Consumer Profile loading through `@project-sothoth/profile-sdk`. */
export function loadConsumerProfile(candidate: unknown): SothothFacadeResultV1<ProfileDefinitionV1> {
  const definition = defineProfileV1(candidate);
  if (definition.issues.length > 0) {
    const diagnostics = finalizeDiagnostics(
      definition.issues.map((issue) => issueDraft("sothoth.profile-sdk", "profiles", issue)),
    );
    return Object.freeze({
      schema: FACADE_RESULT_SCHEMA,
      capability: "profiles/load",
      operation: "defineProfileV1",
      contractRefs: Object.freeze(["CONTRACT/SOTHOTH/CONSUMER-PROFILE@1"]),
      outcome: "invalid-input",
      diagnostics,
      diagnosticCount: diagnostics.length,
      result: definition,
    });
  }
  return Object.freeze({
    schema: FACADE_RESULT_SCHEMA,
    capability: "profiles/load",
    operation: "defineProfileV1",
    contractRefs: Object.freeze(["CONTRACT/SOTHOTH/CONSUMER-PROFILE@1"]),
    outcome: "valid",
    diagnostics: [],
    diagnosticCount: 0,
    result: definition,
  });
}

/** Consumer Profile conformance through `@project-sothoth/profile-sdk`. */
export function runConsumerProfileConformance(
  profile: unknown,
): SothothFacadeResultV1<ProfileConformanceV1> {
  return outcomeEnvelope(
    "profiles/conformance",
    "runProfileConformanceV1",
    ["CONTRACT/SOTHOTH/CONSUMER-PROFILE@1"],
    runProfileConformanceV1(profile),
  );
}

// ---------------------------------------------------------------------------
// Capability: verify (projection digest verification)
// ---------------------------------------------------------------------------

/** The verification request: a projection document and its digest field. */
export interface ProjectionDigestRequestV1 {
  readonly document: unknown;
  readonly digestField: unknown;
}

/** The verification result: a rebuildable comparison, never domain truth. */
export interface ProjectionDigestVerificationV1 {
  readonly verified: boolean;
  readonly digestField: string;
  readonly claimedDigest: string | null;
  readonly recomputedDigest: string | null;
}

const VERIFY_CAPABILITY = "verify/projection-digest" as const;
const VERIFY_CONTRACT_REFS: readonly string[] = Object.freeze([
  "CONTRACT/SOTHOTH/CANONICAL-COMPILATION@1",
]);

/**
 * Verifies one projection digest: the digest input is the document minus its
 * own digest field, canonicalized and digested through `@project-sothoth/core` —
 * exactly how every owner projection computes its digest. A mismatch is the
 * `invalid` outcome; a malformed request fails closed as `invalid-input`;
 * a non-JSON document value forwards the Core gate's own code verbatim.
 */
export function verifyProjectionDigest(
  request: unknown,
): SothothFacadeResultV1<ProjectionDigestVerificationV1> {
  if (!isPlainObject(request) || !("document" in request) || !("digestField" in request)) {
    return invalidInputEnvelope(VERIFY_CAPABILITY, "verifyProjectionDigestV1", VERIFY_CONTRACT_REFS);
  }
  const digestField = request.digestField;
  const document = request.document;
  if (typeof digestField !== "string" || !isPlainObject(document)) {
    return invalidInputEnvelope(VERIFY_CAPABILITY, "verifyProjectionDigestV1", VERIFY_CONTRACT_REFS);
  }
  const claimedDescriptor = Object.getOwnPropertyDescriptor(document, digestField);
  if (
    claimedDescriptor === undefined ||
    !("value" in claimedDescriptor) ||
    typeof claimedDescriptor.value !== "string"
  ) {
    return invalidInputEnvelope(VERIFY_CAPABILITY, "verifyProjectionDigestV1", VERIFY_CONTRACT_REFS);
  }
  const claimedDigest: string = claimedDescriptor.value;
  // Copy the digest input through own data descriptors only: a hostile
  // accessor never executes and fails closed instead.
  const digestInput: Record<string, unknown> = {};
  for (const name of Object.getOwnPropertyNames(document)) {
    if (name === digestField) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(document, name);
    if (descriptor === undefined || !("value" in descriptor)) {
      return invalidInputEnvelope(VERIFY_CAPABILITY, "verifyProjectionDigestV1", VERIFY_CONTRACT_REFS);
    }
    digestInput[name] = descriptor.value;
  }
  let canonical: string;
  try {
    canonical = canonicalJson(digestInput as never);
  } catch (error) {
    if (error instanceof SothothInputError) {
      // Forward the owning gate's code verbatim; the facade invents none.
      const diagnostics = finalizeDiagnostics([
        issueDraft("sothoth.core", "verify", { code: error.code, subject: "request.document" }),
      ]);
      return Object.freeze({
        schema: FACADE_RESULT_SCHEMA,
        capability: VERIFY_CAPABILITY,
        operation: "verifyProjectionDigestV1",
        contractRefs: VERIFY_CONTRACT_REFS,
        outcome: "invalid-input",
        diagnostics,
        diagnosticCount: diagnostics.length,
        result: null,
      });
    }
    throw error;
  }
  const recomputedDigest = sha256Digest(canonical);
  const verified = recomputedDigest === claimedDigest;
  return Object.freeze({
    schema: FACADE_RESULT_SCHEMA,
    capability: VERIFY_CAPABILITY,
    operation: "verifyProjectionDigestV1",
    contractRefs: VERIFY_CONTRACT_REFS,
    outcome: verified ? "valid" : "invalid",
    diagnostics: [],
    diagnosticCount: 0,
    result: Object.freeze({
      verified,
      digestField,
      claimedDigest,
      recomputedDigest,
    }),
  });
}

// ---------------------------------------------------------------------------
// The plan-pinned aggregate callable
// ---------------------------------------------------------------------------

/** The aggregate facade: one frozen object per call, no shared state. */
export interface SothothV1 {
  readonly check: {
    readonly designClosure: (facts: unknown) => SothothFacadeResultV1<DesignClosureCompilationV1>;
  };
  readonly compile: {
    readonly governance: (facts: unknown) => SothothFacadeResultV1<ScopeBomAdmissibilityCompilationV1>;
    readonly planning: (problem: unknown) => SothothFacadeResultV1<ScheduleSolutionV1>;
  };
  readonly changePlan: {
    readonly compile: (facts: unknown) => SothothFacadeResultV1<ChangePlanProjectionV1>;
  };
  readonly documents: {
    readonly buildIndex: (input: unknown) => SothothFacadeResultV1<DocumentIndexResultV1>;
    readonly select: (request: unknown) => SothothFacadeResultV1<SelectorSelectionResultV1>;
    readonly explain: (request: unknown) => SothothFacadeResultV1<SelectorSelectionResultV1>;
  };
  readonly git: {
    readonly createAdapter: (options?: GitSourceAdapterOptionsV1) => GitSourceAdapterV1;
  };
  readonly profiles: {
    readonly load: (candidate: unknown) => SothothFacadeResultV1<ProfileDefinitionV1>;
    readonly conformance: (profile: unknown) => SothothFacadeResultV1<ProfileConformanceV1>;
  };
  readonly verify: {
    readonly projectionDigest: (request: unknown) => SothothFacadeResultV1<ProjectionDigestVerificationV1>;
  };
}

/**
 * Builds the aggregate facade. Each call returns a fresh, deeply frozen
 * object: there is no singleton, no cache, and no ambient state, and the
 * underlying delegates are the owning packages' own functions.
 */
export function createSothothV1(): SothothV1 {
  return Object.freeze({
    check: Object.freeze({
      designClosure: checkDesignClosure,
    }),
    compile: Object.freeze({
      governance: compileGovernance,
      planning: compilePlanning,
    }),
    changePlan: Object.freeze({
      compile: compileChangePlan,
    }),
    documents: Object.freeze({
      buildIndex: buildDocumentIndex,
      select: selectDocuments,
      explain: explainSelector,
    }),
    git: Object.freeze({
      createAdapter: gitSourceAdapter,
    }),
    profiles: Object.freeze({
      load: loadConsumerProfile,
      conformance: runConsumerProfileConformance,
    }),
    verify: Object.freeze({
      projectionDigest: verifyProjectionDigest,
    }),
  });
}

// Owner result types the facade carries, for typed library consumption.
export type {
  ChangePlanProjectionV1,
  ConsumerProfileV1,
  DesignClosureCompilationV1,
  DocumentIndexResultV1,
  ProfileConformanceV1,
  ProfileDefinitionV1,
  ScheduleSolutionV1,
  ScopeBomAdmissibilityCompilationV1,
  SelectorSelectionResultV1,
  SchedulingProblemV1,
};
