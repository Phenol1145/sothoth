import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXPECTED_CANDIDATES = Object.freeze([
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
]);

const TOP_LEVEL_FIELDS = new Set([
  "schema",
  "catalogId",
  "catalogRevision",
  "targetReleaseIntent",
  "status",
  "candidates",
  "externalRelations",
  "deferredCapabilities",
]);

const RELEASE_ONLY_FIELDS = new Set([
  "release",
  "license",
  "members",
  "gates",
  "completionGates",
  "candidateDigest",
  "tarball",
  "provenance",
]);

const CANDIDATE_FIELDS = new Set([
  "componentId",
  "designId",
  "artifactType",
  "designRequirement",
  "coverage",
  "owner",
]);

const COVERAGE_STATES = new Set(["complete", "partial", "conflicting", "obsolete", "missing"]);

const EXTERNAL_RELATION = Object.freeze({
  componentId: "@fracta/sothoth-profile",
  relation: "companion",
  owner: "fracta",
});

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

export function validateDesignScopeCatalog(value) {
  const issues = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [issue("sothoth.design-scope/invalid-document", "design-scope-catalog")];
  }

  for (const field of Object.keys(value)) {
    if (RELEASE_ONLY_FIELDS.has(field)) {
      issues.push(issue("sothoth.design-scope/release-field-forbidden", field));
    } else if (!TOP_LEVEL_FIELDS.has(field)) {
      issues.push(issue("sothoth.design-scope/unknown-field", field));
    }
  }
  if (value.schema !== "sothoth.design-scope-catalog/v1") {
    issues.push(issue("sothoth.design-scope/schema-mismatch", "schema"));
  }
  if (value.catalogId !== "SOTHOTH-DESIGN-SCOPE-0.1") {
    issues.push(issue("sothoth.design-scope/catalog-id-mismatch", "catalogId"));
  }
  if (value.catalogRevision !== 2) {
    issues.push(issue("sothoth.design-scope/catalog-revision-mismatch", "catalogRevision"));
  }
  if (value.targetReleaseIntent !== "0.1.0") {
    issues.push(issue("sothoth.design-scope/release-intent-mismatch", "targetReleaseIntent"));
  }
  if (value.status !== "working") {
    issues.push(issue("sothoth.design-scope/status-not-working", "status"));
  }

  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  if (!Array.isArray(value.candidates)) {
    issues.push(issue("sothoth.design-scope/invalid-candidates", "candidates"));
  }
  const seenComponents = new Set();
  const seenDesignIds = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      issues.push(issue("sothoth.design-scope/invalid-candidate", "candidates"));
      continue;
    }
    const componentId = typeof candidate.componentId === "string" ? candidate.componentId : "candidates";
    for (const field of Object.keys(candidate)) {
      if (!CANDIDATE_FIELDS.has(field)) {
        issues.push(issue("sothoth.design-scope/unknown-candidate-field", `${componentId}:${field}`));
      }
    }
    if (seenComponents.has(componentId)) {
      issues.push(issue("sothoth.design-scope/candidate-duplicate", componentId));
    }
    seenComponents.add(componentId);
    if (!EXPECTED_CANDIDATES.includes(componentId)) {
      issues.push(issue("sothoth.design-scope/candidate-unknown", componentId));
    }
    if (typeof candidate.designId !== "string" || candidate.designId.length === 0) {
      issues.push(issue("sothoth.design-scope/invalid-design-id", componentId));
    } else if (seenDesignIds.has(candidate.designId)) {
      issues.push(issue("sothoth.design-scope/design-id-duplicate", componentId));
    } else {
      seenDesignIds.add(candidate.designId);
    }
    if (candidate.artifactType !== "npm-package") {
      issues.push(issue("sothoth.design-scope/artifact-type-mismatch", componentId));
    }
    if (candidate.designRequirement !== "full") {
      issues.push(issue("sothoth.design-scope/design-requirement-mismatch", componentId));
    }
    if (!COVERAGE_STATES.has(candidate.coverage)) {
      issues.push(issue("sothoth.design-scope/invalid-coverage", componentId));
    }
    if (candidate.owner !== "sothoth") {
      issues.push(issue("sothoth.design-scope/owner-mismatch", componentId));
    }
  }
  for (const componentId of EXPECTED_CANDIDATES) {
    if (!seenComponents.has(componentId)) {
      issues.push(issue("sothoth.design-scope/candidate-missing", componentId));
    }
  }

  const relations = value.externalRelations;
  const relation = Array.isArray(relations) ? relations[0] : undefined;
  if (
    !Array.isArray(relations) ||
    relations.length !== 1 ||
    typeof relation !== "object" ||
    relation === null ||
    Object.keys(relation).length !== 3 ||
    relation.componentId !== EXTERNAL_RELATION.componentId ||
    relation.relation !== EXTERNAL_RELATION.relation ||
    relation.owner !== EXTERNAL_RELATION.owner
  ) {
    issues.push(issue("sothoth.design-scope/external-relation-invalid", EXTERNAL_RELATION.componentId));
  }

  const deferred = value.deferredCapabilities;
  if (!Array.isArray(deferred) || deferred.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    issues.push(issue("sothoth.design-scope/invalid-deferred-capabilities", "deferredCapabilities"));
  }

  return issues.sort(
    (left, right) =>
      codePointCompare(left.code, right.code) || codePointCompare(String(left.subject), String(right.subject)),
  );
}

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const catalog = JSON.parse(await readFile(`${root}/docs/design/v0.1.0-design-scope-catalog.json`, "utf8"));
  const issues = validateDesignScopeCatalog(catalog);
  if (issues.length > 0) {
    process.stderr.write(`${JSON.stringify({ issues }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Sothoth 0.1 Design Scope Catalog valid (${EXPECTED_CANDIDATES.length} provisional candidates)\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
