/**
 * Descriptor-only hostile-input validation and the canonical graph model for
 * `@sothoth/graph`.
 *
 * Internal responsibility unit of the package: never re-exported from any
 * public subpath. This module owns the complete hostile-input machinery —
 * the declaration validator with its exact phase order and suppression
 * cascade, the shared algorithm result-envelope validator, issue coalescing
 * and canonical issue ordering — plus the canonical graph model every
 * algorithm consumes. All reads go through property descriptors: a hostile
 * accessor on a known field fails closed as `sothoth.graph/invalid-field`
 * without its getter ever executing, nothing is coerced, and no input is
 * mutated. Facet validation reuses `canonicalJson` from
 * `@sothoth/core/canonical-json` inside a fail-closed try/catch as the single
 * owner of the JSON value grammar.
 */

import { canonicalJson } from "@sothoth/core/canonical-json";
import type {
  CanonicalGraphV1,
  DirectedMultigraphDeclarationV1,
  GraphEdgeDeclarationV1,
  GraphFailureV1,
  GraphIssueV1,
  GraphNodeDeclarationV1,
} from "../digraph.js";
import { compareCodePointOrder } from "./code-point.js";
import { deepFrozenCopy } from "./immutable.js";

/** One typed rejection before it is coalesced, sorted, and frozen. */
export interface IssueDraft {
  readonly code: string;
  readonly subject: string;
  readonly witnessNodeIds?: readonly string[];
}

/** The closed ten-code Graph diagnostic vocabulary. */
const GRAPH_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  "sothoth.graph/invalid-declaration",
  "sothoth.graph/unknown-field",
  "sothoth.graph/missing-field",
  "sothoth.graph/invalid-field",
  "sothoth.graph/duplicate-node-id",
  "sothoth.graph/duplicate-edge-id",
  "sothoth.graph/unresolved-endpoint",
  "sothoth.graph/unknown-start-node",
  "sothoth.graph/not-a-dag",
  "sothoth.graph/weight-overflow",
]);

type OwnField =
  | { readonly state: "missing" }
  | { readonly state: "accessor" }
  | { readonly state: "data"; readonly value: unknown };

/** Reads one own field through its descriptor; a getter never executes. */
function readOwnField(owner: object, key: string): OwnField {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined) {
    return { state: "missing" };
  }
  if (!("value" in descriptor)) {
    return { state: "accessor" };
  }
  return { state: "data", value: descriptor.value };
}

/** True for a plain own-data-capable object: prototype `Object.prototype` or `null`. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

/**
 * True for a dense, undecorated array: own enumerable keys are exactly the
 * canonical index names `"0"`..`"<length-1>"`, every slot is a data property,
 * and no symbol keys or extra own string names exist.
 */
function isDenseArray(value: unknown): value is unknown[] {
  if (typeof value !== "object" || value === null || !Array.isArray(value)) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }
  const length = value.length;
  let indices = 0;
  for (const name of Object.getOwnPropertyNames(value)) {
    if (name === "length") {
      continue;
    }
    if (!INDEX_PATTERN.test(name) || Number(name) >= length) {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
    indices += 1;
  }
  return indices === length;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * Flags every own key outside the closed set as `unknown-field` (whether a
 * data or accessor property) and every accessor on a closed key as
 * `invalid-field`, without executing any getter.
 */
function checkClosedKeys(
  owner: object,
  closedKeys: readonly string[],
  path: string,
  issues: IssueDraft[],
): void {
  for (const name of Object.getOwnPropertyNames(owner)) {
    if (closedKeys.includes(name)) {
      continue;
    }
    issues.push({ code: "sothoth.graph/unknown-field", subject: `${path}.${name}` });
  }
  for (const symbol of Object.getOwnPropertySymbols(owner)) {
    issues.push({
      code: "sothoth.graph/unknown-field",
      subject: `${path}[symbol:${symbol.description ?? ""}]`,
    });
  }
  for (const key of closedKeys) {
    if (readOwnField(owner, key).state === "accessor") {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.${key}` });
    }
  }
}

interface NodeEntryInfo {
  readonly validId: boolean;
  readonly id: string;
}

function validateInnerNode(path: string, inner: unknown, issues: IssueDraft[]): NodeEntryInfo {
  if (!isPlainObject(inner)) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: path });
    return { validId: false, id: "" };
  }
  checkClosedKeys(inner, ["id", "facets"], path, issues);
  const idField = readOwnField(inner, "id");
  let id = "";
  let validId = false;
  if (idField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.id` });
  } else if (idField.state === "data") {
    if (nonEmptyString(idField.value)) {
      id = idField.value;
      validId = true;
    } else {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.id` });
    }
  }
  const facets = readOwnField(inner, "facets");
  if (facets.state === "data") {
    try {
      canonicalJson(facets.value);
    } catch {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.facets` });
    }
  }
  return { validId, id };
}

function validateNodeEntry(path: string, entry: unknown, issues: IssueDraft[]): NodeEntryInfo {
  if (!isPlainObject(entry)) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: path });
    return { validId: false, id: "" };
  }
  checkClosedKeys(entry, ["node", "sortKey"], path, issues);
  const sortKey = readOwnField(entry, "sortKey");
  if (sortKey.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.sortKey` });
  } else if (sortKey.state === "data" && !nonEmptyString(sortKey.value)) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.sortKey` });
  }
  const nodeField = readOwnField(entry, "node");
  if (nodeField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.node` });
    return { validId: false, id: "" };
  }
  if (nodeField.state === "accessor") {
    return { validId: false, id: "" };
  }
  return validateInnerNode(`${path}.node`, nodeField.value, issues);
}

interface EdgeEntryInfo {
  readonly validId: boolean;
  readonly id: string;
  readonly validFrom: boolean;
  readonly from: string;
  readonly validTo: boolean;
  readonly to: string;
}

function validateInnerEdge(
  path: string,
  inner: unknown,
  issues: IssueDraft[],
  identity: { validId: boolean; id: string },
): EdgeEntryInfo {
  const endpoints = { validFrom: false, from: "", validTo: false, to: "" };
  if (!isPlainObject(inner)) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: path });
    return { ...identity, ...endpoints };
  }
  checkClosedKeys(inner, ["role", "fromNodeId", "toNodeId", "weight"], path, issues);
  let from = "";
  let to = "";
  let validFrom = false;
  let validTo = false;
  for (const field of ["role", "fromNodeId", "toNodeId"] as const) {
    const read = readOwnField(inner, field);
    if (read.state === "missing") {
      issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.${field}` });
      continue;
    }
    if (read.state === "accessor") {
      continue;
    }
    if (!nonEmptyString(read.value)) {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.${field}` });
      continue;
    }
    if (field === "fromNodeId") {
      from = read.value;
      validFrom = true;
    }
    if (field === "toNodeId") {
      to = read.value;
      validTo = true;
    }
  }
  const weight = readOwnField(inner, "weight");
  if (weight.state === "data") {
    if (typeof weight.value !== "number" || !Number.isFinite(weight.value)) {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.weight` });
    }
  }
  return { ...identity, validFrom, from, validTo, to };
}

function validateEdgeEntry(path: string, entry: unknown, issues: IssueDraft[]): EdgeEntryInfo {
  const dead: EdgeEntryInfo = {
    validId: false,
    id: "",
    validFrom: false,
    from: "",
    validTo: false,
    to: "",
  };
  if (!isPlainObject(entry)) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: path });
    return dead;
  }
  checkClosedKeys(entry, ["id", "edge", "sortKey"], path, issues);
  const idField = readOwnField(entry, "id");
  let id = "";
  let validId = false;
  if (idField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.id` });
  } else if (idField.state === "data") {
    if (nonEmptyString(idField.value)) {
      id = idField.value;
      validId = true;
    } else {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.id` });
    }
  }
  const sortKey = readOwnField(entry, "sortKey");
  if (sortKey.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.sortKey` });
  } else if (sortKey.state === "data" && !nonEmptyString(sortKey.value)) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: `${path}.sortKey` });
  }
  const edgeField = readOwnField(entry, "edge");
  if (edgeField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${path}.edge` });
    return dead;
  }
  if (edgeField.state === "accessor") {
    return dead;
  }
  return validateInnerEdge(`${path}.edge`, edgeField.value, issues, { validId, id });
}

/**
 * Validates a whole declaration under the §7.1.1 phase order. `root` anchors
 * the top-level subjects (`declaration` for direct creation, `graph.graph` for
 * success-payload revalidation) while `entryPrefix` anchors entry paths: the
 * direct declaration anchors the exact input path (`nodes[0].node.id`) and
 * revalidation re-anchors entries under `graph.graph.` per §7.1.2 phase 4.
 */
export function validateDeclaration(
  root: string,
  entryPrefix: string,
  declaration: unknown,
): IssueDraft[] {
  const issues: IssueDraft[] = [];
  if (!isPlainObject(declaration)) {
    issues.push({ code: "sothoth.graph/invalid-declaration", subject: root });
    return issues;
  }
  checkClosedKeys(declaration, ["nodes", "edges"], root, issues);
  let nodes: unknown[] | null = null;
  let edges: unknown[] | null = null;
  const nodesField = readOwnField(declaration, "nodes");
  if (nodesField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${root}.nodes` });
  } else if (nodesField.state === "data") {
    if (isDenseArray(nodesField.value)) {
      nodes = nodesField.value;
    } else {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${root}.nodes` });
    }
  }
  const edgesField = readOwnField(declaration, "edges");
  if (edgesField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: `${root}.edges` });
  } else if (edgesField.state === "data") {
    if (isDenseArray(edgesField.value)) {
      edges = edgesField.value;
    } else {
      issues.push({ code: "sothoth.graph/invalid-field", subject: `${root}.edges` });
    }
  }
  const nodeInfos: NodeEntryInfo[] = [];
  if (nodes !== null) {
    for (let index = 0; index < nodes.length; index += 1) {
      nodeInfos.push(validateNodeEntry(`${entryPrefix}nodes[${index}]`, nodes[index], issues));
    }
  }
  const edgeInfos: EdgeEntryInfo[] = [];
  if (edges !== null) {
    for (let index = 0; index < edges.length; index += 1) {
      edgeInfos.push(validateEdgeEntry(`${entryPrefix}edges[${index}]`, edges[index], issues));
    }
  }
  const nodeCounts = new Map<string, number>();
  for (const info of nodeInfos) {
    if (info.validId) {
      nodeCounts.set(info.id, (nodeCounts.get(info.id) ?? 0) + 1);
    }
  }
  for (const [id, count] of nodeCounts) {
    if (count >= 2) {
      issues.push({ code: "sothoth.graph/duplicate-node-id", subject: id });
    }
  }
  const edgeCounts = new Map<string, number>();
  for (const info of edgeInfos) {
    if (info.validId) {
      edgeCounts.set(info.id, (edgeCounts.get(info.id) ?? 0) + 1);
    }
  }
  for (const [id, count] of edgeCounts) {
    if (count >= 2) {
      issues.push({ code: "sothoth.graph/duplicate-edge-id", subject: id });
    }
  }
  if (nodes !== null && nodeInfos.every((info) => info.validId)) {
    const universe = new Set(nodeInfos.map((info) => info.id));
    edgeInfos.forEach((info, index) => {
      if (!info.validFrom && !info.validTo) {
        return;
      }
      const anchor = info.validId ? info.id : `${entryPrefix}edges[${index}].edge`;
      if (info.validFrom && !universe.has(info.from)) {
        issues.push({ code: "sothoth.graph/unresolved-endpoint", subject: `${anchor}.fromNodeId` });
      }
      if (info.validTo && !universe.has(info.to)) {
        issues.push({ code: "sothoth.graph/unresolved-endpoint", subject: `${anchor}.toNodeId` });
      }
    });
  }
  return issues;
}

function witnessBytes(draft: IssueDraft): string {
  return draft.witnessNodeIds === undefined ? "" : canonicalJson(draft.witnessNodeIds);
}

function compareIssues(left: IssueDraft, right: IssueDraft): number {
  const byCode = compareCodePointOrder(left.code, right.code);
  if (byCode !== 0) {
    return byCode;
  }
  const bySubject = compareCodePointOrder(left.subject, right.subject);
  if (bySubject !== 0) {
    return bySubject;
  }
  return compareCodePointOrder(witnessBytes(left), witnessBytes(right));
}

function issueKey(draft: IssueDraft): string {
  return canonicalJson(
    draft.witnessNodeIds === undefined
      ? { code: draft.code, subject: draft.subject }
      : { code: draft.code, subject: draft.subject, witnessNodeIds: draft.witnessNodeIds },
  );
}

/** Coalesces byte-identical issues, then applies the canonical issue order. */
function canonicalIssueOrder(drafts: readonly IssueDraft[]): IssueDraft[] {
  const seen = new Set<string>();
  const unique: IssueDraft[] = [];
  for (const draft of drafts) {
    const key = issueKey(draft);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(draft);
  }
  return unique.sort(compareIssues);
}

/** Builds the frozen canonical failure envelope from raw issue drafts. */
export function finalizeFailure(drafts: readonly IssueDraft[]): GraphFailureV1 {
  const issues = canonicalIssueOrder(drafts).map(
    (draft) => deepFrozenCopy(draft) as GraphIssueV1,
  );
  const failure: GraphFailureV1 = { ok: false, issues: Object.freeze(issues) };
  return Object.freeze(failure);
}

function validateIssueEntry(
  path: string,
  entry: unknown,
  problems: IssueDraft[],
  accepted: IssueDraft[],
): void {
  if (!isPlainObject(entry)) {
    problems.push({ code: "sothoth.graph/invalid-field", subject: path });
    return;
  }
  checkClosedKeys(entry, ["code", "subject", "witnessNodeIds"], path, problems);
  const codeField = readOwnField(entry, "code");
  const subjectField = readOwnField(entry, "subject");
  let code = "";
  let codeOk = false;
  if (codeField.state === "missing") {
    problems.push({ code: "sothoth.graph/missing-field", subject: `${path}.code` });
  } else if (codeField.state === "data") {
    if (typeof codeField.value === "string" && GRAPH_DIAGNOSTIC_CODES.has(codeField.value)) {
      code = codeField.value;
      codeOk = true;
    } else {
      problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.code` });
    }
  }
  let subject = "";
  let subjectOk = false;
  if (subjectField.state === "missing") {
    problems.push({ code: "sothoth.graph/missing-field", subject: `${path}.subject` });
  } else if (subjectField.state === "data") {
    if (nonEmptyString(subjectField.value)) {
      subject = subjectField.value;
      subjectOk = true;
    } else {
      problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.subject` });
    }
  }
  if (!codeOk || !subjectOk) {
    return;
  }
  const witnessField = readOwnField(entry, "witnessNodeIds");
  if (code === "sothoth.graph/not-a-dag") {
    if (witnessField.state === "missing") {
      problems.push({ code: "sothoth.graph/missing-field", subject: `${path}.witnessNodeIds` });
      return;
    }
    if (witnessField.state === "accessor") {
      problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.witnessNodeIds` });
      return;
    }
    const witness = witnessField.value;
    if (!isDenseArray(witness) || witness.length === 0) {
      problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.witnessNodeIds` });
      return;
    }
    const seen = new Set<string>();
    for (const item of witness) {
      if (!nonEmptyString(item) || seen.has(item)) {
        problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.witnessNodeIds` });
        return;
      }
      seen.add(item);
    }
    if (witness[0] !== subject) {
      problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.witnessNodeIds` });
      return;
    }
    accepted.push({ code, subject, witnessNodeIds: [...witness] as string[] });
  } else {
    if (witnessField.state !== "missing") {
      problems.push({ code: "sothoth.graph/invalid-field", subject: `${path}.witnessNodeIds` });
      return;
    }
    accepted.push({ code, subject });
  }
}

/** Sorts validated declaration entries by `(sortKey, identity)` in code-point order. */
function sortedDeclarations(
  declaration: unknown,
): { nodes: GraphNodeDeclarationV1[]; edges: GraphEdgeDeclarationV1[] } {
  const valid = declaration as DirectedMultigraphDeclarationV1;
  const nodes = [...valid.nodes] as GraphNodeDeclarationV1[];
  nodes.sort(
    (left, right) =>
      compareCodePointOrder(left.sortKey, right.sortKey) ||
      compareCodePointOrder(left.node.id, right.node.id),
  );
  const edges = [...valid.edges] as GraphEdgeDeclarationV1[];
  edges.sort(
    (left, right) =>
      compareCodePointOrder(left.sortKey, right.sortKey) ||
      compareCodePointOrder(left.id, right.id),
  );
  return { nodes, edges };
}

/**
 * The canonical graph value for a validated declaration: descriptor-safe deep
 * copies of every node and edge declaration in canonical order, recursively
 * frozen.
 */
export function canonicalGraphValue(declaration: unknown): CanonicalGraphV1 {
  const { nodes, edges } = sortedDeclarations(declaration);
  const nodeCopies = nodes.map((node) => deepFrozenCopy(node) as GraphNodeDeclarationV1);
  const edgeCopies = edges.map((edge) => deepFrozenCopy(edge) as GraphEdgeDeclarationV1);
  return Object.freeze({
    nodes: Object.freeze(nodeCopies),
    edges: Object.freeze(edgeCopies),
  });
}

/** The adjacency-equipped canonical model every algorithm consumes. */
export interface GraphModel {
  /** The canonically ordered declaration pair (references, read-only use). */
  readonly canonicalValue: CanonicalGraphV1;
  readonly nodeDecls: readonly GraphNodeDeclarationV1[];
  readonly edgeDecls: readonly GraphEdgeDeclarationV1[];
  readonly nodeIds: readonly string[];
  readonly rankOf: ReadonlyMap<string, number>;
  /** Per node, incident edge indices in canonical edge order. */
  readonly outEdges: readonly number[][];
  readonly inEdges: readonly number[][];
  /** Per edge index, the canonical rank of its source and target node. */
  readonly edgeSources: readonly number[];
  readonly edgeTargets: readonly number[];
}

/** Builds the canonical model for a declaration that already passed validation. */
export function buildGraphModel(declaration: unknown): GraphModel {
  const { nodes, edges } = sortedDeclarations(declaration);
  const nodeIds = nodes.map((node) => node.node.id);
  const rankOf = new Map<string, number>();
  nodeIds.forEach((id, index) => {
    rankOf.set(id, index);
  });
  const outEdges: number[][] = nodes.map(() => []);
  const inEdges: number[][] = nodes.map(() => []);
  const edgeSources: number[] = [];
  const edgeTargets: number[] = [];
  edges.forEach((edge, index) => {
    const source = rankOf.get(edge.edge.fromNodeId)!;
    const target = rankOf.get(edge.edge.toNodeId)!;
    outEdges[source]!.push(index);
    inEdges[target]!.push(index);
    edgeSources.push(source);
    edgeTargets.push(target);
  });
  return {
    canonicalValue: { nodes, edges },
    nodeDecls: nodes,
    edgeDecls: edges,
    nodeIds,
    rankOf,
    outEdges,
    inEdges,
    edgeSources,
    edgeTargets,
  };
}

export type PreparedAlgorithmInput =
  | { readonly kind: "failure"; readonly failure: GraphFailureV1 }
  | { readonly kind: "model"; readonly model: GraphModel };

function failureOf(issues: readonly IssueDraft[]): { kind: "failure"; failure: GraphFailureV1 } {
  return { kind: "failure", failure: finalizeFailure(issues) };
}

/**
 * Runs the shared §7.1.2 result-envelope validator over an algorithm
 * argument and either returns the canonical failure to forward or the
 * canonical model to compute over. A crafted failure that passes validation
 * is returned as an observationally indistinguishable frozen canonical value.
 */
export function prepareAlgorithmInput(envelope: unknown): PreparedAlgorithmInput {
  const issues: IssueDraft[] = [];
  if (!isPlainObject(envelope)) {
    return failureOf([{ code: "sothoth.graph/invalid-field", subject: "graph" }]);
  }
  checkClosedKeys(envelope, ["ok", "graph", "issues"], "graph", issues);
  const okField = readOwnField(envelope, "ok");
  if (okField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: "graph.ok" });
    return failureOf(issues);
  }
  if (okField.state === "accessor") {
    return failureOf(issues);
  }
  if (typeof okField.value !== "boolean") {
    issues.push({ code: "sothoth.graph/invalid-field", subject: "graph.ok" });
    return failureOf(issues);
  }
  const graphField = readOwnField(envelope, "graph");
  const issuesField = readOwnField(envelope, "issues");
  if (okField.value) {
    if (graphField.state === "missing") {
      issues.push({ code: "sothoth.graph/missing-field", subject: "graph.graph" });
    }
    if (issuesField.state !== "missing") {
      issues.push({ code: "sothoth.graph/unknown-field", subject: "graph.issues" });
    }
    if (graphField.state !== "data") {
      return failureOf(issues);
    }
    const declarationIssues = validateDeclaration("graph.graph", "graph.graph.", graphField.value);
    if (issues.length > 0 || declarationIssues.length > 0) {
      return failureOf([...issues, ...declarationIssues]);
    }
    return { kind: "model", model: buildGraphModel(graphField.value) };
  }
  if (issuesField.state === "missing") {
    issues.push({ code: "sothoth.graph/missing-field", subject: "graph.issues" });
  }
  if (graphField.state !== "missing") {
    issues.push({ code: "sothoth.graph/unknown-field", subject: "graph.graph" });
  }
  if (issuesField.state !== "data") {
    return failureOf(issues);
  }
  const list = issuesField.value;
  if (!isDenseArray(list) || list.length === 0) {
    issues.push({ code: "sothoth.graph/invalid-field", subject: "graph.issues" });
    return failureOf(issues);
  }
  const problems: IssueDraft[] = [];
  const accepted: IssueDraft[] = [];
  for (let index = 0; index < list.length; index += 1) {
    validateIssueEntry(`graph.issues[${index}]`, list[index], problems, accepted);
  }
  if (issues.length > 0 || problems.length > 0) {
    return failureOf([...issues, ...problems]);
  }
  return failureOf(accepted);
}
