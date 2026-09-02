import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXPECTED_MEMBERS = Object.freeze([
  "@sothoth/cli",
  "@sothoth/contracts",
  "@sothoth/core",
  "@sothoth/document-index",
  "@sothoth/git",
  "@sothoth/governance",
  "@sothoth/graph",
  "@sothoth/planning",
  "@sothoth/profile-sdk",
  "@sothoth/sdk",
  "@sothoth/selectors",
]);

const TOP_LEVEL_FIELDS = new Set(["schema", "release", "license", "members", "companions", "deferred"]);
const MEMBER_FIELDS = new Set(["id", "version", "type", "layer", "owner", "gates"]);

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

export function validateScopeBom(value) {
  const issues = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [issue("sothoth.release-bom/invalid-document", "scope-bom")];
  }

  for (const field of Object.keys(value)) {
    if (!TOP_LEVEL_FIELDS.has(field)) issues.push(issue("sothoth.release-bom/unknown-field", field));
  }
  if (value.schema !== "sothoth.release-bom/v1") issues.push(issue("sothoth.release-bom/schema-mismatch", "schema"));
  if (value.release !== "0.1.0") issues.push(issue("sothoth.release-bom/version-mismatch", "release"));
  if (value.license !== "Apache-2.0") issues.push(issue("sothoth.release-bom/license-mismatch", "license"));

  const members = Array.isArray(value.members) ? value.members : [];
  if (!Array.isArray(value.members)) issues.push(issue("sothoth.release-bom/invalid-members", "members"));
  const seen = new Set();
  for (const member of members) {
    if (typeof member !== "object" || member === null || Array.isArray(member)) {
      issues.push(issue("sothoth.release-bom/invalid-member", "members"));
      continue;
    }
    const id = typeof member.id === "string" ? member.id : "members";
    for (const field of Object.keys(member)) {
      if (!MEMBER_FIELDS.has(field)) issues.push(issue("sothoth.release-bom/unknown-member-field", `${id}:${field}`));
    }
    if (seen.has(id)) issues.push(issue("sothoth.release-bom/duplicate-member", id));
    seen.add(id);
    if (!EXPECTED_MEMBERS.includes(id)) issues.push(issue("sothoth.release-bom/unexpected-member", id));
    if (member.version !== "0.1.0") issues.push(issue("sothoth.release-bom/version-mismatch", id));
    if (member.type !== "npm-package") issues.push(issue("sothoth.release-bom/type-mismatch", id));
    if (member.layer !== "required") issues.push(issue("sothoth.release-bom/layer-mismatch", id));
    if (member.owner !== "sothoth") issues.push(issue("sothoth.release-bom/owner-mismatch", id));
    if (!Array.isArray(member.gates) || member.gates.length === 0 || member.gates.some((gate) => typeof gate !== "string" || gate.length === 0)) {
      issues.push(issue("sothoth.release-bom/invalid-gates", id));
    }
  }
  for (const id of EXPECTED_MEMBERS) {
    if (!seen.has(id)) issues.push(issue("sothoth.release-bom/required-member-missing", id));
  }

  const companions = Array.isArray(value.companions) ? value.companions : [];
  if (companions.length !== 1 || companions[0]?.id !== "@fracta/sothoth-profile" || companions[0]?.layer !== "companion" || companions[0]?.owner !== "fracta") {
    issues.push(issue("sothoth.release-bom/invalid-companion", "@fracta/sothoth-profile"));
  }
  if (!Array.isArray(value.deferred) || value.deferred.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    issues.push(issue("sothoth.release-bom/invalid-deferred", "deferred"));
  }

  return issues.sort((left, right) => codePointCompare(left.code, right.code) || codePointCompare(String(left.subject), String(right.subject)));
}

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const bom = JSON.parse(await readFile(`${root}/docs/release/v0.1.0-scope-bom.json`, "utf8"));
  const issues = validateScopeBom(bom);
  if (issues.length > 0) {
    process.stderr.write(`${JSON.stringify({ issues }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Sothoth 0.1.0 Scope BOM valid (${EXPECTED_MEMBERS.length} required packages)\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
