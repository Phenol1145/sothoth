import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { validateDesignScopeCatalog } from "./check-design-scope-catalog.mjs";

const RESULT_SCHEMA = "sothoth.pre-design-check/v1";
const REGISTRY_SCHEMA = "sothoth.design-document-registry/v1";
const REGISTRATIONS_SCHEMA = "sothoth.artifact-design-registrations/v1";
const CONTRACT_SCHEMA = "sothoth.document-contract/v1";
const CONTRACT_ID = "sothoth.design-dossier/full/v1";
const SCOPE_BOM_SCHEMA = "sothoth.candidate-scope-bom/v1";
const CLOSURE_PROJECTION_SCHEMA = "sothoth.design-closure-projection/v1";
const SCOPE_PROJECTION_SCHEMA = "sothoth.scope-bom-admissibility-projection/v1";

const PHASES = new Set(["dossiers", "closure", "scope"]);
const RESOLUTION_KINDS = ["local", "inherited", "not-applicable"];
const APPLICABILITY_KINDS = ["adopts", "narrows", "specializes"];
const REFERENCE_FIELDS = ["documentId", "documentRevision", "sectionId", "applicability"];
const CRITERION_FIELDS = ["criterionId", "sectionId"];
const DOCUMENT_REF_FIELDS = ["documentId", "documentRevision"];
const BASELINE_FIELDS = ["baselineId", "baselineRevision", "status"];
const DESIGN_REF_FIELDS = [
  "architectureBaselineId",
  "architectureBaselineRevision",
  "designId",
  "designRevision",
];
const BOM_MEMBER_FIELDS = ["componentId", "designRef"];

const REGISTRY_FIELDS = new Set(["schema", "registryId", "registryRevision", "documents"]);
const DOCUMENT_FIELDS = new Set(["documentId", "documentRevision", "path", "status", "sectionIds"]);
const REGISTRATIONS_FIELDS = new Set(["schema", "collectionId", "collectionRevision", "registrations"]);
const REGISTRATION_FIELDS = new Set([
  "designId",
  "componentId",
  "designRevision",
  "designRequirement",
  "status",
  "documentRef",
  "topicCoverage",
  "providedContractRefs",
  "requiredContractRefs",
  "producedStateRefs",
  "consumedStateRefs",
  "issuedAuthorityRefs",
  "requiredAuthorityRefs",
  "emittedObservationRefs",
  "deploymentDependencyRefs",
  "acceptanceCriteria",
  "supersedes",
]);
const CONTRACT_FIELDS = new Set([
  "schema",
  "contractId",
  "contractRevision",
  "description",
  "documentKind",
  "sections",
  "topics",
  "references",
  "criteria",
]);
const STRING_ARRAY_FIELDS = [
  "providedContractRefs",
  "requiredContractRefs",
  "producedStateRefs",
  "consumedStateRefs",
  "issuedAuthorityRefs",
  "requiredAuthorityRefs",
  "emittedObservationRefs",
  "deploymentDependencyRefs",
];
const CONTRACT_REF_FIELDS = new Set(["providedContractRefs", "requiredContractRefs"]);

const DOCUMENT_STATUSES = new Set(["proposed", "accepted", "superseded"]);
const REGISTRATION_STATUSES = new Set(["proposed", "accepted", "superseded"]);
const DESIGN_REQUIREMENTS = new Set(["full", "projection", "compatibility"]);

const SECTION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const MARKER_PATTERN = /^<!-- sothoth:section id="([a-z][a-z0-9-]*)" -->$/;
const CONTRACT_REF_PATTERN = /^(.+)@([0-9]+)$/;

function issue(code, subject) {
  return { code, subject };
}

function codePointCompare(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index].codePointAt(0) - b[index].codePointAt(0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function sortIssues(issues) {
  return issues.sort(
    (left, right) =>
      codePointCompare(left.code, right.code) || codePointCompare(String(left.subject), String(right.subject)),
  );
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function keysExactly(value, fields) {
  return isPlainObject(value) && arraysEqual(Object.keys(value).sort(codePointCompare), [...fields].sort(codePointCompare));
}

function unknownFieldNames(value, allowedFields) {
  return Object.keys(value).filter((field) => !allowedFields.has(field));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const ordered = {};
    for (const key of Object.keys(value).sort(codePointCompare)) {
      ordered[key] = canonicalize(value[key]);
    }
    return ordered;
  }
  return value;
}

export function canonicalJsonStringify(value) {
  return JSON.stringify(canonicalize(value));
}

/**
 * Parses CommonMark and extracts stable section markers. A marker is an HTML comment that exactly
 * matches `<!-- sothoth:section id="[a-z][a-z0-9-]*" -->` and whose next non-blank AST sibling is a
 * heading; blank lines produce no AST nodes, so blank-line separation is permitted while any other
 * intervening node is not. Prose is never inspected.
 */
export function parseStableSections(markdown) {
  const tree = fromMarkdown(String(markdown));
  const children = Array.isArray(tree.children) ? tree.children : [];
  const sectionIds = [];
  const issues = [];
  const seen = new Set();
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (node.type !== "html") continue;
    const match = MARKER_PATTERN.exec(typeof node.value === "string" ? node.value : "");
    if (!match) continue;
    const sectionId = match[1];
    const next = children[index + 1];
    if (!next || next.type !== "heading") {
      issues.push(issue("sothoth.pre-design/marker-not-followed-by-heading", sectionId));
      continue;
    }
    if (seen.has(sectionId)) {
      issues.push(issue("sothoth.pre-design/section-marker-duplicate", sectionId));
    }
    seen.add(sectionId);
    sectionIds.push(sectionId);
  }
  return { sectionIds, issues: sortIssues(issues) };
}

function validateContractShape(contract) {
  const issues = [];
  if (!isPlainObject(contract)) {
    return [issue("sothoth.pre-design/contract-invalid", "contract")];
  }
  for (const field of unknownFieldNames(contract, CONTRACT_FIELDS)) {
    issues.push(issue("sothoth.pre-design/contract-invalid", field));
  }
  if (contract.schema !== CONTRACT_SCHEMA) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "schema"));
  }
  if (contract.contractId !== CONTRACT_ID) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "contractId"));
  }
  if (!isPositiveInteger(contract.contractRevision)) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "contractRevision"));
  }
  if (!isNonEmptyString(contract.description) || !isNonEmptyString(contract.documentKind)) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "description"));
  }
  const sections = contract.sections;
  if (!isPlainObject(sections) || sections.ordering !== "exact") {
    issues.push(issue("sothoth.pre-design/contract-invalid", "sections.ordering"));
  } else if (
    !Array.isArray(sections.requiredSectionIds) ||
    sections.requiredSectionIds.length === 0 ||
    !sections.requiredSectionIds.every((id) => isNonEmptyString(id) && SECTION_ID_PATTERN.test(id)) ||
    new Set(sections.requiredSectionIds).size !== sections.requiredSectionIds.length
  ) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "sections.requiredSectionIds"));
  }
  const topics = contract.topics;
  if (!isPlainObject(topics)) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "topics"));
  } else {
    if (
      !Array.isArray(topics.closedSet) ||
      topics.closedSet.length === 0 ||
      !topics.closedSet.every((topic) => isNonEmptyString(topic) && SECTION_ID_PATTERN.test(topic)) ||
      new Set(topics.closedSet).size !== topics.closedSet.length
    ) {
      issues.push(issue("sothoth.pre-design/contract-invalid", "topics.closedSet"));
    }
    if (!arraysEqual(topics.resolutions, RESOLUTION_KINDS)) {
      issues.push(issue("sothoth.pre-design/contract-invalid", "topics.resolutions"));
    }
    if (
      !Array.isArray(topics.inheritanceApplicability) ||
      topics.inheritanceApplicability.length === 0 ||
      new Set(topics.inheritanceApplicability).size !== topics.inheritanceApplicability.length ||
      !topics.inheritanceApplicability.every((kind) => APPLICABILITY_KINDS.includes(kind))
    ) {
      issues.push(issue("sothoth.pre-design/contract-invalid", "topics.inheritanceApplicability"));
    }
  }
  const references = contract.references;
  if (!isPlainObject(references) || !arraysEqual(references.exactFields, REFERENCE_FIELDS)) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "references.exactFields"));
  }
  const criteria = contract.criteria;
  if (
    !isPlainObject(criteria) ||
    !isPositiveInteger(criteria.minimumPerRegistration) ||
    !arraysEqual(criteria.fields, CRITERION_FIELDS)
  ) {
    issues.push(issue("sothoth.pre-design/contract-invalid", "criteria"));
  }
  return sortIssues(issues);
}

function validateRegistryShape(registry) {
  const issues = [];
  if (!isPlainObject(registry)) {
    return [issue("sothoth.pre-design/registry-invalid", "registry")];
  }
  for (const field of unknownFieldNames(registry, REGISTRY_FIELDS)) {
    issues.push(issue("sothoth.pre-design/registry-invalid", field));
  }
  if (registry.schema !== REGISTRY_SCHEMA) {
    issues.push(issue("sothoth.pre-design/registry-invalid", "schema"));
  }
  if (!isNonEmptyString(registry.registryId)) {
    issues.push(issue("sothoth.pre-design/registry-invalid", "registryId"));
  }
  if (!isPositiveInteger(registry.registryRevision)) {
    issues.push(issue("sothoth.pre-design/registry-invalid", "registryRevision"));
  }
  if (!Array.isArray(registry.documents)) {
    issues.push(issue("sothoth.pre-design/registry-invalid", "documents"));
    return sortIssues(issues);
  }
  const seenDocumentIds = new Set();
  for (const entry of registry.documents) {
    if (!isPlainObject(entry)) {
      issues.push(issue("sothoth.pre-design/registry-invalid", "documents"));
      continue;
    }
    const documentId = isNonEmptyString(entry.documentId) ? entry.documentId : null;
    for (const field of unknownFieldNames(entry, DOCUMENT_FIELDS)) {
      issues.push(issue("sothoth.pre-design/registry-invalid", `${documentId ?? "documents"}:${field}`));
    }
    if (!documentId) {
      issues.push(issue("sothoth.pre-design/registry-invalid", "documents:documentId"));
      continue;
    }
    if (seenDocumentIds.has(documentId)) {
      issues.push(issue("sothoth.pre-design/registry-invalid", `${documentId}:duplicate`));
    }
    seenDocumentIds.add(documentId);
    if (!isPositiveInteger(entry.documentRevision)) {
      issues.push(issue("sothoth.pre-design/registry-invalid", `${documentId}:documentRevision`));
    }
    if (!isNonEmptyString(entry.path)) {
      issues.push(issue("sothoth.pre-design/registry-invalid", `${documentId}:path`));
    }
    if (!DOCUMENT_STATUSES.has(entry.status)) {
      issues.push(issue("sothoth.pre-design/registry-invalid", `${documentId}:status`));
    }
    if (
      !Array.isArray(entry.sectionIds) ||
      entry.sectionIds.length === 0 ||
      !entry.sectionIds.every((id) => isNonEmptyString(id) && SECTION_ID_PATTERN.test(id)) ||
      new Set(entry.sectionIds).size !== entry.sectionIds.length
    ) {
      issues.push(issue("sothoth.pre-design/registry-invalid", `${documentId}:sectionIds`));
    }
  }
  return sortIssues(issues);
}

function validateRegistrationsWrapper(wrapper) {
  const issues = [];
  if (!isPlainObject(wrapper)) {
    return [issue("sothoth.pre-design/registrations-invalid", "registrations")];
  }
  for (const field of unknownFieldNames(wrapper, REGISTRATIONS_FIELDS)) {
    issues.push(issue("sothoth.pre-design/registrations-invalid", field));
  }
  if (wrapper.schema !== REGISTRATIONS_SCHEMA) {
    issues.push(issue("sothoth.pre-design/registrations-invalid", "schema"));
  }
  if (!isNonEmptyString(wrapper.collectionId)) {
    issues.push(issue("sothoth.pre-design/registrations-invalid", "collectionId"));
  }
  if (!isPositiveInteger(wrapper.collectionRevision)) {
    issues.push(issue("sothoth.pre-design/registrations-invalid", "collectionRevision"));
  }
  if (!Array.isArray(wrapper.registrations)) {
    issues.push(issue("sothoth.pre-design/registrations-invalid", "registrations"));
  }
  return sortIssues(issues);
}

function checkRegistration(registration, context, issues) {
  if (!isPlainObject(registration)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", "registrations:registration"));
    return;
  }
  const componentId = isNonEmptyString(registration.componentId) ? registration.componentId : "registrations";
  for (const field of unknownFieldNames(registration, REGISTRATION_FIELDS)) {
    issues.push(issue("sothoth.pre-design/registration-field-unknown", `${componentId}:${field}`));
  }
  if (!isNonEmptyString(registration.designId)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:designId`));
  }
  if (!isPositiveInteger(registration.designRevision)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:designRevision`));
  }
  if (!DESIGN_REQUIREMENTS.has(registration.designRequirement)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:designRequirement`));
  }
  if (!REGISTRATION_STATUSES.has(registration.status)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:status`));
  }
  if (!(registration.supersedes === null || isNonEmptyString(registration.supersedes))) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:supersedes`));
  }
  for (const field of STRING_ARRAY_FIELDS) {
    const value = registration[field];
    if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
      issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:${field}`));
    } else if (CONTRACT_REF_FIELDS.has(field)) {
      for (const entry of value) {
        if (!CONTRACT_REF_PATTERN.test(entry)) {
          issues.push(issue("sothoth.pre-design/contract-ref-not-exact", `${componentId}:${entry}`));
        }
      }
    }
  }

  const documentRef = registration.documentRef;
  let dossierSectionIds = null;
  if (!keysExactly(documentRef, DOCUMENT_REF_FIELDS)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:documentRef`));
  } else {
    const state = context.documents.get(documentRef.documentId);
    if (
      !state ||
      state.entry.documentRevision !== documentRef.documentRevision ||
      !isPositiveInteger(documentRef.documentRevision)
    ) {
      issues.push(issue("sothoth.pre-design/document-ref-unresolved", componentId));
    } else {
      dossierSectionIds = state.sectionIds;
      if (!arraysEqual(dossierSectionIds, context.requiredSectionIds)) {
        issues.push(issue("sothoth.pre-design/contract-sections-mismatch", documentRef.documentId));
      }
    }
  }

  const coverage = registration.topicCoverage;
  if (!isPlainObject(coverage)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:topicCoverage`));
  } else {
    for (const topic of Object.keys(coverage)) {
      if (!context.topicSet.has(topic)) {
        issues.push(issue("sothoth.pre-design/topic-unknown", `${componentId}:${topic}`));
      }
    }
    for (const topic of context.topics) {
      if (!(topic in coverage)) {
        issues.push(issue("sothoth.pre-design/topic-missing", `${componentId}:${topic}`));
      }
    }
    for (const topic of context.topics) {
      if (!(topic in coverage)) continue;
      const resolution = coverage[topic];
      if (
        !isPlainObject(resolution) ||
        !keysExactly(resolution, ["reason", "refs", "resolution", "sectionId"]) ||
        !RESOLUTION_KINDS.includes(resolution.resolution)
      ) {
        issues.push(issue("sothoth.pre-design/topic-resolution-invalid", `${componentId}:${topic}`));
        continue;
      }
      if (resolution.resolution === "local") {
        if (
          !isNonEmptyString(resolution.sectionId) ||
          !Array.isArray(resolution.refs) ||
          resolution.refs.length !== 0 ||
          resolution.reason !== null
        ) {
          issues.push(issue("sothoth.pre-design/topic-resolution-invalid", `${componentId}:${topic}`));
        } else if (dossierSectionIds && !dossierSectionIds.includes(resolution.sectionId)) {
          issues.push(issue("sothoth.pre-design/section-unresolved", `${componentId}:${resolution.sectionId}`));
        }
      } else if (resolution.resolution === "inherited") {
        if (
          resolution.sectionId !== null ||
          resolution.reason !== null ||
          !Array.isArray(resolution.refs) ||
          resolution.refs.length === 0
        ) {
          issues.push(issue("sothoth.pre-design/topic-resolution-invalid", `${componentId}:${topic}`));
          continue;
        }
        for (const reference of resolution.refs) {
          if (
            !isPlainObject(reference) ||
            !keysExactly(reference, REFERENCE_FIELDS) ||
            !isNonEmptyString(reference.documentId) ||
            !isPositiveInteger(reference.documentRevision) ||
            !isNonEmptyString(reference.sectionId)
          ) {
            issues.push(issue("sothoth.pre-design/reference-not-exact", `${componentId}:${topic}`));
            continue;
          }
          if (reference.applicability === "overrides") {
            issues.push(issue("sothoth.pre-design/inheritance-overrides-forbidden", `${componentId}:${topic}`));
          } else if (!context.applicabilitySet.has(reference.applicability)) {
            issues.push(issue("sothoth.pre-design/inheritance-applicability-invalid", `${componentId}:${topic}`));
          }
          const state = context.documents.get(reference.documentId);
          if (
            !state ||
            state.entry.documentRevision !== reference.documentRevision ||
            !state.sectionIds.includes(reference.sectionId)
          ) {
            issues.push(issue("sothoth.pre-design/reference-unresolved", `${componentId}:${topic}`));
          }
        }
      } else if (
        !isNonEmptyString(resolution.reason) ||
        resolution.sectionId !== null ||
        !Array.isArray(resolution.refs) ||
        resolution.refs.length !== 0
      ) {
        issues.push(issue("sothoth.pre-design/topic-resolution-invalid", `${componentId}:${topic}`));
      }
    }
  }

  if (!Array.isArray(registration.acceptanceCriteria)) {
    issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:acceptanceCriteria`));
  } else {
    for (const criterion of registration.acceptanceCriteria) {
      if (
        !keysExactly(criterion, CRITERION_FIELDS) ||
        !isNonEmptyString(criterion.criterionId) ||
        !isNonEmptyString(criterion.sectionId)
      ) {
        issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:acceptanceCriteria`));
      } else if (dossierSectionIds && !dossierSectionIds.includes(criterion.sectionId)) {
        issues.push(issue("sothoth.pre-design/criterion-unresolved", `${componentId}:${criterion.sectionId}`));
      }
    }
  }

  const candidate = context.candidatesByComponent.get(componentId);
  if (!candidate) {
    issues.push(issue("sothoth.pre-design/registration-orphan", componentId));
  } else {
    if (registration.designId !== candidate.designId) {
      issues.push(issue("sothoth.pre-design/design-id-mismatch", componentId));
    }
    if (
      DESIGN_REQUIREMENTS.has(registration.designRequirement) &&
      registration.designRequirement !== candidate.designRequirement
    ) {
      issues.push(issue("sothoth.pre-design/registration-field-invalid", `${componentId}:designRequirement`));
    }
  }
}

function findCycleNodes(adjacency) {
  const state = new Map();
  const cyclic = new Set();
  const stack = [];
  const visit = (node) => {
    state.set(node, 1);
    stack.push(node);
    const targets = [...(adjacency.get(node) ?? [])].sort(codePointCompare);
    for (const target of targets) {
      const targetState = state.get(target) ?? 0;
      if (targetState === 1) {
        const start = stack.lastIndexOf(target);
        for (let index = start; index < stack.length; index += 1) cyclic.add(stack[index]);
      } else if (targetState === 0) {
        visit(target);
      }
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of [...adjacency.keys()].sort(codePointCompare)) {
    if ((state.get(node) ?? 0) === 0) visit(node);
  }
  return cyclic;
}

function checkClosureFacts(facts, context, issues) {
  const { registrationsByComponent, registrations } = context;

  for (const candidate of context.candidates) {
    const registrationsForComponent = registrationsByComponent.get(candidate.componentId) ?? [];
    if (registrationsForComponent.length === 0) continue;
    const retained = registrationsForComponent.filter(
      (registration) => registration.status === "proposed" || registration.status === "accepted",
    );
    if (retained.length === 0) {
      issues.push(issue("sothoth.pre-design/registration-not-retained", candidate.componentId));
      continue;
    }
    if (retained.length === 1 && Array.isArray(retained[0].acceptanceCriteria)) {
      if (retained[0].acceptanceCriteria.length < context.minimumCriteria) {
        issues.push(issue("sothoth.pre-design/criterion-missing", candidate.componentId));
      }
    }
  }

  const contractIdentities = new Map();
  for (const registration of registrations) {
    if (!isPlainObject(registration)) continue;
    for (const field of ["providedContractRefs", "requiredContractRefs"]) {
      const refs = registration[field];
      if (!Array.isArray(refs)) continue;
      for (const ref of refs) {
        if (typeof ref !== "string") continue;
        const match = CONTRACT_REF_PATTERN.exec(ref);
        if (!match) continue;
        const identity = match[1];
        const record = contractIdentities.get(identity) ?? { provided: new Set(), revisions: new Set() };
        record.revisions.add(match[2]);
        if (field === "providedContractRefs") record.provided.add(ref);
        contractIdentities.set(identity, record);
      }
    }
  }
  for (const identity of [...contractIdentities.keys()].sort(codePointCompare)) {
    const record = contractIdentities.get(identity);
    if (record.revisions.size > 1) {
      issues.push(issue("sothoth.pre-design/contract-revision-mismatch", identity));
    }
  }
  const requiredRefs = new Set();
  for (const registration of registrations) {
    if (!isPlainObject(registration) || !Array.isArray(registration.requiredContractRefs)) continue;
    for (const ref of registration.requiredContractRefs) {
      if (typeof ref === "string" && CONTRACT_REF_PATTERN.test(ref)) requiredRefs.add(ref);
    }
  }
  for (const ref of [...requiredRefs].sort(codePointCompare)) {
    const match = CONTRACT_REF_PATTERN.exec(ref);
    const record = contractIdentities.get(match[1]);
    if (!record || !record.provided.has(ref)) {
      issues.push(issue("sothoth.pre-design/contract-edge-mismatch", ref));
    }
  }

  const reportedTruth = new Set();
  const truthOwners = new Map();
  for (const registration of registrations) {
    if (!isPlainObject(registration) || !Array.isArray(registration.producedStateRefs)) continue;
    for (const stateRef of registration.producedStateRefs) {
      if (typeof stateRef !== "string") continue;
      if (truthOwners.has(stateRef) && !reportedTruth.has(stateRef)) {
        reportedTruth.add(stateRef);
        issues.push(issue("sothoth.pre-design/truth-owner-duplicate", stateRef));
      }
      truthOwners.set(stateRef, registration.componentId);
    }
  }

  const adjacency = new Map();
  const addEdge = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from).add(to);
  };
  for (const registration of registrations) {
    if (!isPlainObject(registration)) continue;
    const documentRef = registration.documentRef;
    if (!isPlainObject(documentRef) || typeof documentRef.documentId !== "string") continue;
    const coverage = registration.topicCoverage;
    if (!isPlainObject(coverage)) continue;
    for (const topic of Object.keys(coverage)) {
      const resolution = coverage[topic];
      if (!isPlainObject(resolution) || resolution.resolution !== "inherited") continue;
      if (!Array.isArray(resolution.refs)) continue;
      for (const reference of resolution.refs) {
        if (isPlainObject(reference) && typeof reference.documentId === "string") {
          addEdge(documentRef.documentId, reference.documentId);
        }
      }
    }
  }
  for (const documentId of findCycleNodes(adjacency)) {
    issues.push(issue("sothoth.pre-design/inheritance-cycle", documentId));
  }
}

function checkScopeFacts(facts, context, issues) {
  const baseline = facts.architectureBaseline;
  let baselineUsable = false;
  if (!isPlainObject(baseline)) {
    issues.push(issue("sothoth.pre-design/baseline-missing", "architectureBaseline"));
  } else {
    for (const field of unknownFieldNames(baseline, new Set(BASELINE_FIELDS))) {
      issues.push(issue("sothoth.pre-design/baseline-invalid", field));
    }
    if (
      !isNonEmptyString(baseline.baselineId) ||
      !isPositiveInteger(baseline.baselineRevision) ||
      !REGISTRATION_STATUSES.has(baseline.status)
    ) {
      issues.push(issue("sothoth.pre-design/baseline-invalid", "architectureBaseline"));
    } else if (baseline.status !== "accepted") {
      issues.push(issue("sothoth.pre-design/baseline-not-accepted", baseline.baselineId));
    } else {
      baselineUsable = true;
    }
  }

  for (const candidate of context.candidates) {
    const registrationsForComponent = context.registrationsByComponent.get(candidate.componentId) ?? [];
    const retained = registrationsForComponent.filter(
      (registration) => registration.status === "proposed" || registration.status === "accepted",
    );
    if (retained.length === 1 && retained[0].status !== "accepted") {
      issues.push(issue("sothoth.pre-design/registration-not-accepted", candidate.componentId));
    }
  }

  const scopeBom = facts.scopeBom;
  if (!isPlainObject(scopeBom)) {
    issues.push(issue("sothoth.pre-design/scope-bom-missing", "scopeBom"));
    return;
  }
  if (scopeBom.schema !== SCOPE_BOM_SCHEMA) {
    issues.push(issue("sothoth.pre-design/scope-bom-invalid", "schema"));
  }
  if (!Array.isArray(scopeBom.members)) {
    issues.push(issue("sothoth.pre-design/scope-bom-invalid", "members"));
    return;
  }
  const seenMembers = new Set();
  for (const member of scopeBom.members) {
    if (!isPlainObject(member)) {
      issues.push(issue("sothoth.pre-design/scope-bom-invalid", "members"));
      continue;
    }
    const componentId = isNonEmptyString(member.componentId) ? member.componentId : "members";
    if (!keysExactly(member, BOM_MEMBER_FIELDS)) {
      issues.push(issue("sothoth.pre-design/scope-bom-invalid", `${componentId}:member`));
      continue;
    }
    if (seenMembers.has(componentId)) {
      issues.push(issue("sothoth.pre-design/scope-bom-invalid", `${componentId}:member-duplicate`));
    }
    seenMembers.add(componentId);
    const designRef = member.designRef;
    if (
      !keysExactly(designRef, DESIGN_REF_FIELDS) ||
      !isNonEmptyString(designRef.designId) ||
      !isPositiveInteger(designRef.designRevision) ||
      !isNonEmptyString(designRef.architectureBaselineId) ||
      !isPositiveInteger(designRef.architectureBaselineRevision)
    ) {
      issues.push(issue("sothoth.pre-design/scope-bom-invalid", `${componentId}:designRef`));
      continue;
    }
    const resolved = context.registrations.some(
      (registration) =>
        isPlainObject(registration) &&
        registration.designId === designRef.designId &&
        registration.designRevision === designRef.designRevision,
    );
    if (!resolved) {
      issues.push(issue("sothoth.pre-design/design-ref-unresolved", componentId));
    }
    if (
      baselineUsable &&
      (designRef.architectureBaselineId !== baseline.baselineId ||
        designRef.architectureBaselineRevision !== baseline.baselineRevision)
    ) {
      issues.push(issue("sothoth.pre-design/design-ref-baseline-mismatch", componentId));
    }
  }
}

function topicCounts(registration) {
  const counts = { localTopics: 0, inheritedTopics: 0, notApplicableTopics: 0 };
  const coverage = isPlainObject(registration) ? registration.topicCoverage : null;
  if (!isPlainObject(coverage)) return counts;
  const fieldByResolution = { local: "localTopics", inherited: "inheritedTopics", "not-applicable": "notApplicableTopics" };
  for (const topic of Object.keys(coverage)) {
    const resolution = coverage[topic];
    const field = isPlainObject(resolution) ? fieldByResolution[resolution.resolution] : undefined;
    if (field) counts[field] += 1;
  }
  return counts;
}

function buildClosureProjection(context, outcome, issues) {
  const members = context.candidates.map((candidate) => {
    const registrationsForComponent = context.registrationsByComponent.get(candidate.componentId) ?? [];
    const registration =
      registrationsForComponent.length === 1 ? registrationsForComponent[0] : null;
    const counts = topicCounts(registration);
    return {
      componentId: candidate.componentId,
      designId: candidate.designId,
      registrationStatus:
        registrationsForComponent.length === 1
          ? registration.status
          : registrationsForComponent.length === 0
            ? "missing"
            : "duplicate",
      designRevision: registrationsForComponent.length === 1 ? registration.designRevision : 0,
      localTopics: counts.localTopics,
      inheritedTopics: counts.inheritedTopics,
      notApplicableTopics: counts.notApplicableTopics,
      criteria: registrationsForComponent.length === 1 && Array.isArray(registration.acceptanceCriteria)
        ? registration.acceptanceCriteria.length
        : 0,
    };
  });
  return {
    schema: CLOSURE_PROJECTION_SCHEMA,
    phase: "closure",
    catalogId: context.catalog.catalogId,
    catalogRevision: context.catalog.catalogRevision,
    outcome,
    readyForAcceptance: outcome === "valid",
    memberCount: members.length,
    members,
    diagnosticCount: issues.length,
  };
}

function buildScopeProjection(facts, context, outcome, issues) {
  const baseline = isPlainObject(facts.architectureBaseline) ? facts.architectureBaseline : null;
  const membersSource = isPlainObject(facts.scopeBom) && Array.isArray(facts.scopeBom.members) ? facts.scopeBom.members : [];
  const members = membersSource
    .filter((member) => isPlainObject(member) && isNonEmptyString(member.componentId) && isPlainObject(member.designRef))
    .map((member) => {
      const resolved = context.registrations.some(
        (registration) =>
          isPlainObject(registration) &&
          registration.designId === member.designRef.designId &&
          registration.designRevision === member.designRef.designRevision,
      );
      const registration = context.registrations.find(
        (entry) =>
          isPlainObject(entry) &&
          entry.designId === member.designRef.designId &&
          entry.designRevision === member.designRef.designRevision,
      );
      return {
        componentId: member.componentId,
        designId: typeof member.designRef.designId === "string" ? member.designRef.designId : null,
        designRevision: isPositiveInteger(member.designRef.designRevision) ? member.designRef.designRevision : 0,
        registrationStatus: isPlainObject(registration) ? registration.status : "unresolved",
        designRefResolved: resolved,
      };
    });
  return {
    schema: SCOPE_PROJECTION_SCHEMA,
    phase: "scope",
    catalogId: context.catalog.catalogId,
    catalogRevision: context.catalog.catalogRevision,
    architectureBaseline: {
      baselineId: baseline && typeof baseline.baselineId === "string" ? baseline.baselineId : null,
      baselineRevision: baseline && isPositiveInteger(baseline.baselineRevision) ? baseline.baselineRevision : null,
      status: baseline && typeof baseline.status === "string" ? baseline.status : "missing",
    },
    outcome,
    admissible: outcome === "valid",
    memberCount: members.length,
    members,
    diagnosticCount: issues.length,
  };
}

function result(phase, outcome, issues, projection) {
  return { schema: RESULT_SCHEMA, phase, outcome, issues: sortIssues(issues), projection };
}

export function checkPreDesign(facts) {
  const phase = isPlainObject(facts) ? facts.phase : undefined;
  if (!PHASES.has(phase)) {
    return result(String(phase), "invalid-input", [issue("sothoth.pre-design/phase-invalid", String(phase))], null);
  }

  const contractIssues = validateContractShape(facts.contract);
  if (contractIssues.length > 0) {
    return result(phase, "invalid-input", contractIssues, null);
  }
  const catalogIssues = validateDesignScopeCatalog(facts.catalog);
  if (catalogIssues.length > 0) {
    return result(phase, "invalid", catalogIssues, null);
  }
  const registryIssues = validateRegistryShape(facts.registry);
  if (registryIssues.length > 0) {
    return result(phase, "invalid", registryIssues, null);
  }
  const wrapperIssues = validateRegistrationsWrapper(facts.registrations);
  if (wrapperIssues.length > 0) {
    return result(phase, "invalid", wrapperIssues, null);
  }

  const contract = facts.contract;
  const catalog = facts.catalog;
  const requiredSectionIds = contract.sections.requiredSectionIds;
  const topics = contract.topics.closedSet;
  const context = {
    catalog,
    candidates: [...catalog.candidates].sort((left, right) => codePointCompare(left.componentId, right.componentId)),
    candidatesByComponent: new Map(catalog.candidates.map((candidate) => [candidate.componentId, candidate])),
    topicSet: new Set(topics),
    topics,
    applicabilitySet: new Set(contract.topics.inheritanceApplicability),
    requiredSectionIds,
    minimumCriteria: contract.criteria.minimumPerRegistration,
    documents: new Map(),
    registrations: facts.registrations.registrations,
    registrationsByComponent: new Map(),
  };

  const issues = [];

  const documentSources = isPlainObject(facts.documents) ? facts.documents : {};
  for (const entry of facts.registry.documents) {
    const markdown = documentSources[entry.documentId];
    if (typeof markdown !== "string") {
      issues.push(issue("sothoth.pre-design/document-missing", entry.documentId));
      context.documents.set(entry.documentId, { entry, sectionIds: [] });
      continue;
    }
    const parsed = parseStableSections(markdown);
    for (const markerIssue of parsed.issues) {
      issues.push(issue(markerIssue.code, `${entry.documentId}:${markerIssue.subject}`));
    }
    if (!arraysEqual(parsed.sectionIds, entry.sectionIds)) {
      issues.push(issue("sothoth.pre-design/document-sections-mismatch", entry.documentId));
    }
    context.documents.set(entry.documentId, { entry, sectionIds: parsed.sectionIds });
  }

  for (const registration of context.registrations) {
    checkRegistration(registration, context, issues);
    if (isPlainObject(registration) && isNonEmptyString(registration.componentId)) {
      const list = context.registrationsByComponent.get(registration.componentId) ?? [];
      list.push(registration);
      context.registrationsByComponent.set(registration.componentId, list);
    }
  }

  for (const candidate of context.candidates) {
    const count = (context.registrationsByComponent.get(candidate.componentId) ?? []).length;
    if (count === 0) {
      issues.push(issue("sothoth.pre-design/registration-missing", candidate.componentId));
    } else if (count > 1) {
      issues.push(issue("sothoth.pre-design/registration-duplicate", candidate.componentId));
    }
  }

  if (phase === "closure" || phase === "scope") {
    checkClosureFacts(facts, context, issues);
  }
  if (phase === "scope") {
    checkScopeFacts(facts, context, issues);
  }

  const outcome = issues.length === 0 ? "valid" : "invalid";
  const projection =
    phase === "closure"
      ? buildClosureProjection(context, outcome, issues)
      : phase === "scope"
        ? buildScopeProjection(facts, context, outcome, issues)
        : null;
  return result(phase, outcome, issues, projection);
}

const REPO_PATHS = {
  catalog: "docs/design/v0.1.0-design-scope-catalog.json",
  contract: "docs/design/contracts/artifact-design-dossier.v1.json",
  registry: "docs/design/document-registry.json",
  registrations: "docs/design/artifact-design-registrations.json",
};

const CLI_FLAGS = new Map([
  ["--phase", "phase"],
  ["--output", "output"],
  ["--baseline", "baseline"],
  ["--scope-bom", "scopeBom"],
]);

function parseArguments(argv) {
  const options = { phase: null, output: null, baseline: null, scopeBom: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const key = CLI_FLAGS.get(flag);
    if (!key) throw new Error(`unknown argument: ${flag}`);
    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    options[key] = value;
    index += 1;
  }
  if (options.phase === null) throw new Error("--phase is required");
  return options;
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function runRepositoryCheck(root, options) {
  const catalog = await readJsonFile(`${root}/${REPO_PATHS.catalog}`);
  const contract = await readJsonFile(`${root}/${REPO_PATHS.contract}`);
  const registry = await readJsonFile(`${root}/${REPO_PATHS.registry}`);
  const registrations = await readJsonFile(`${root}/${REPO_PATHS.registrations}`);
  const documents = {};
  for (const entry of Array.isArray(registry.documents) ? registry.documents : []) {
    if (entry && typeof entry.documentId === "string" && typeof entry.path === "string") {
      documents[entry.documentId] = await readFile(`${root}/${entry.path}`, "utf8");
    }
  }
  const facts = { phase: options.phase, catalog, contract, registry, documents, registrations };
  if (options.baseline !== null) facts.architectureBaseline = await readJsonFile(options.baseline);
  if (options.scopeBom !== null) facts.scopeBom = await readJsonFile(options.scopeBom);
  return checkPreDesign(facts);
}

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    const failure = result(null, "invalid-input", [issue("sothoth.pre-design/arguments-invalid", String(error.message))], null);
    process.stdout.write(`${canonicalJsonStringify(failure)}\n`);
    process.exitCode = 2;
    return;
  }
  let outcome;
  try {
    const check = await runRepositoryCheck(root, options);
    outcome = check.outcome;
    const bytes = `${canonicalJsonStringify(check)}\n`;
    process.stdout.write(bytes);
    if (options.output !== null) await writeFile(options.output, bytes);
  } catch (error) {
    const failure = result(
      options.phase,
      "invalid-input",
      [issue("sothoth.pre-design/source-unreadable", String(error?.message ?? error))],
      null,
    );
    process.stdout.write(`${canonicalJsonStringify(failure)}\n`);
    process.exitCode = 2;
    return;
  }
  process.exitCode = outcome === "valid" ? 0 : outcome === "invalid" ? 1 : 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
