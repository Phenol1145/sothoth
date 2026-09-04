/**
 * Public modules `@sothoth/selectors/match`, `/cardinality`, and `/explain`
 * (one implementation unit of the accepted file layout): deterministic
 * selection of document-index entries by a canonical selector AST, declared
 * cardinality enforcement, the default zero-match diagnostic, and the
 * per-candidate explain trace.
 *
 * Selection consumes only the structural facts of
 * `CONTRACT/SOTHOTH/DOCUMENT-INDEX@1` — `DocumentIndexProjectionV1` and
 * `DocumentEntryV1` are consumed as types from
 * `@sothoth/document-index/index`, so no runtime dependency on that package
 * and no re-derivation of its projections exists here. Matching is a pure
 * read over the supplied entries: the index is never mutated or reordered,
 * candidates are processed in canonical artifact-identity order, and output
 * order depends only on that canonical key. The engine's observation
 * surface is exactly the declared zero-match diagnostic; diagnostic
 * identity and namespace terms are matched as declared data, and the
 * accepted entry contract exposes no diagnostic facts, so they admit no
 * candidate over it. Every public value is deeply frozen and shares no
 * mutable reference with any input.
 */

import type {
  DocumentEntryV1,
  DocumentIndexProjectionV1,
} from "@sothoth/document-index/index";
import type { SelectorV1 } from "./index.js";
import {
  DEFAULT_SELECTOR_BUDGETS_V1,
  type SelectorBudgetsV1,
  type SelectorIssueCodeV1,
  type SelectorIssueV1,
} from "./parser.js";
import {
  compileSelectorDataV1,
  matchPathGlobV1,
  type CompiledSelectorV1,
} from "./glob.js";

/** The declared identity of the engine's single observation emission. */
export const SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1 = "sothoth.selectors/zero-match-diagnostic";

/** One explain-trace decision: which term admitted or rejected the candidate. */
export interface SelectorExplainTermV1 {
  readonly subject: string;
  readonly outcome: "admitted" | "rejected";
}

/** The per-candidate explain trace: a result, never a log. */
export interface SelectorExplainTraceV1 {
  readonly artifactId: string;
  readonly matched: boolean;
  readonly terms: readonly SelectorExplainTermV1[];
}

/** One selected artifact, carried by its canonical identity. */
export interface SelectorMatchV1 {
  readonly artifactId: string;
}

/** The selection result: an explained set, or a typed failure. */
export type SelectorSelectionResultV1 =
  | {
      readonly ok: true;
      readonly matches: readonly SelectorMatchV1[];
      readonly trace: readonly SelectorExplainTraceV1[];
      readonly diagnostics: readonly SelectorIssueV1[];
    }
  | { readonly ok: false; readonly issues: readonly SelectorIssueV1[] };

const INVALID_SELECTOR: SelectorIssueCodeV1 = "sothoth.selectors/invalid-selector";

/** Compares two strings by Unicode code point (never UTF-16 unit order). */
function compareCodePointOrder(a: string, b: string): number {
  const aPoints = Array.from(a);
  const bPoints = Array.from(b);
  const limit = Math.min(aPoints.length, bPoints.length);
  for (let index = 0; index < limit; index += 1) {
    const left = aPoints[index]!.codePointAt(0)!;
    const right = bPoints[index]!.codePointAt(0)!;
    if (left !== right) {
      return left - right;
    }
  }
  return aPoints.length - bPoints.length;
}

function sortIssues(issues: readonly SelectorIssueV1[]): readonly SelectorIssueV1[] {
  return [...issues].sort((left, right) => {
    const byCode = compareCodePointOrder(left.code, right.code);
    if (byCode !== 0) {
      return byCode;
    }
    return compareCodePointOrder(left.subject, right.subject);
  });
}

/** The own-property state of one known field, read without side effects. */
type OwnField =
  | { readonly state: "missing" }
  | { readonly state: "accessor" }
  | { readonly state: "data"; readonly value: unknown };

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    return false;
  }
  const own = Object.getOwnPropertyNames(value);
  return own.length === value.length + 1 && own.includes("length");
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

interface RelationFacts {
  readonly kind: "reference" | "supersession" | "traceability";
  readonly role: string | null;
  readonly targetArtifactId: string;
}

/** The structural facts of one supplied entry, read descriptor-safely. */
interface EntryFacts {
  readonly artifactId: string;
  readonly path: string;
  readonly kind: string;
  readonly status: string;
  readonly owner: string;
  readonly tags: readonly string[];
  readonly relations: readonly RelationFacts[];
}

interface IndexRead {
  readonly entries: readonly EntryFacts[];
  readonly issues: readonly SelectorIssueV1[];
}

/**
 * Reads the supplied index container descriptor-safely, collecting typed
 * issues with exact `index.*` subjects. Only the structural facts matching
 * consumes are read; the Document Index contract remains the sole owner of
 * entry validation, and no entry field getter ever executes.
 */
function readIndex(projection: unknown): IndexRead {
  const issues: SelectorIssueV1[] = [];
  const issue = (subject: string): void => {
    issues.push({ code: INVALID_SELECTOR, subject });
  };
  if (!isPlainObject(projection)) {
    issue("index");
    return { entries: [], issues };
  }
  const documentsField = readOwnField(projection, "documents");
  if (documentsField.state !== "data" || !isDenseArray(documentsField.value)) {
    issue("index.documents");
    return { entries: [], issues };
  }
  const documents = documentsField.value;
  const seen = new Set<string>();
  const entries: EntryFacts[] = [];
  for (let index = 0; index < documents.length; index += 1) {
    const entry = documents[index];
    const base = `index.documents[${index}]`;
    if (!isPlainObject(entry)) {
      issue(base);
      continue;
    }
    const artifactIdField = readOwnField(entry, "artifactId");
    if (artifactIdField.state !== "data" || !nonEmptyString(artifactIdField.value)) {
      issue(`${base}.artifactId`);
      continue;
    }
    const artifactId = artifactIdField.value;
    if (seen.has(artifactId)) {
      issue(`${base}.artifactId`);
      continue;
    }
    seen.add(artifactId);
    const pathField = readOwnField(entry, "path");
    if (pathField.state !== "data" || !nonEmptyString(pathField.value)) {
      issue(`${base}.path`);
      continue;
    }
    let kind: string | null = null;
    let status: string | null = null;
    let owner: string | null = null;
    let tags: string[] | null = null;
    let relations: RelationFacts[] | null = null;
    let valid = true;
    for (const field of ["kind", "status", "owner"] as const) {
      const fieldRead = readOwnField(entry, field);
      if (fieldRead.state !== "data" || !nonEmptyString(fieldRead.value)) {
        issue(`${base}.${field}`);
        valid = false;
        continue;
      }
      if (field === "kind") {
        kind = fieldRead.value;
      } else if (field === "status") {
        status = fieldRead.value;
      } else {
        owner = fieldRead.value;
      }
    }
    const tagsField = readOwnField(entry, "tags");
    if (tagsField.state !== "data" || !isDenseArray(tagsField.value)) {
      issue(`${base}.tags`);
      valid = false;
    } else {
      const tagValues: string[] = [];
      let tagsValid = true;
      for (let tagIndex = 0; tagIndex < tagsField.value.length; tagIndex += 1) {
        const tag = tagsField.value[tagIndex];
        if (!nonEmptyString(tag)) {
          issue(`${base}.tags[${tagIndex}]`);
          tagsValid = false;
          continue;
        }
        tagValues.push(tag);
      }
      if (tagsValid) {
        tags = tagValues;
      } else {
        valid = false;
      }
    }
    const relationsField = readOwnField(entry, "relations");
    if (relationsField.state !== "data" || !isDenseArray(relationsField.value)) {
      issue(`${base}.relations`);
      valid = false;
    } else {
      const relationFacts: RelationFacts[] = [];
      let relationsValid = true;
      for (let relationIndex = 0; relationIndex < relationsField.value.length; relationIndex += 1) {
        const relationBase = `${base}.relations[${relationIndex}]`;
        const relation = relationsField.value[relationIndex];
        if (!isPlainObject(relation)) {
          issue(relationBase);
          relationsValid = false;
          continue;
        }
        const kindField = readOwnField(relation, "kind");
        const relationKind = kindField.state === "data" ? kindField.value : undefined;
        if (
          relationKind !== "reference" &&
          relationKind !== "supersession" &&
          relationKind !== "traceability"
        ) {
          issue(`${relationBase}.kind`);
          relationsValid = false;
          continue;
        }
        let role: string | null = null;
        if (relationKind === "reference") {
          const roleField = readOwnField(relation, "role");
          if (roleField.state !== "data" || !nonEmptyString(roleField.value)) {
            issue(`${relationBase}.role`);
            relationsValid = false;
            continue;
          }
          role = roleField.value;
        }
        const targetField = readOwnField(relation, "target");
        if (targetField.state !== "data" || !isPlainObject(targetField.value)) {
          issue(`${relationBase}.target`);
          relationsValid = false;
          continue;
        }
        const targetIdField = readOwnField(targetField.value, "artifactId");
        if (targetIdField.state !== "data" || !nonEmptyString(targetIdField.value)) {
          issue(`${relationBase}.target.artifactId`);
          relationsValid = false;
          continue;
        }
        relationFacts.push({
          kind: relationKind,
          role,
          targetArtifactId: targetIdField.value,
        });
      }
      if (relationsValid) {
        relations = relationFacts;
      } else {
        valid = false;
      }
    }
    if (valid && kind !== null && status !== null && owner !== null) {
      entries.push({
        artifactId,
        path: pathField.value,
        kind,
        status,
        owner,
        tags: tags ?? [],
        relations: relations ?? [],
      });
    }
  }
  return { entries, issues };
}

/** One evaluated node slot: its resolved outcome. */
interface EvalSlot {
  outcome: boolean | null;
}

/** One evaluated child of a combinator, recorded for the explain trace. */
interface ChildRecord {
  readonly subject: string;
  readonly slot: EvalSlot;
}

interface ParentState {
  readonly kind: "all" | "any";
  readonly slot: EvalSlot;
  readonly records: ChildRecord[];
  resolved: boolean;
  outcome: boolean;
}

type MatchOperation =
  | {
      readonly type: "eval";
      readonly node: SelectorV1;
      readonly subject: string;
      readonly slot: EvalSlot;
      readonly parent: ParentState | null;
    }
  | { readonly type: "gate"; readonly parent: ParentState; readonly record: ChildRecord }
  | { readonly type: "combine"; readonly parent: ParentState }
  | {
      readonly type: "combine-not";
      readonly slot: EvalSlot;
      readonly childSlot: EvalSlot;
    };

interface MatchContext {
  readonly entry: EntryFacts;
  readonly compiled: CompiledSelectorV1;
  readonly maxGlobStates: number;
  budgetFailure: string | null;
}

function evaluateLeaf(node: SelectorV1, subject: string, context: MatchContext): boolean {
  const entry = context.entry;
  if ("artifactId" in node) {
    return entry.artifactId === node.artifactId;
  }
  if ("path" in node) {
    const glob = context.compiled.globs.get(`${subject}.path`);
    if (glob === undefined) {
      return false;
    }
    const result = matchPathGlobV1(glob, entry.path, context.maxGlobStates);
    if (result.overBudget) {
      context.budgetFailure = `${subject}.path`;
      return false;
    }
    return result.matched;
  }
  if ("kind" in node) {
    return node.kind.any.some((value) => value === entry.kind);
  }
  if ("status" in node) {
    return node.status.any.some((value) => value === entry.status);
  }
  if ("owner" in node) {
    return node.owner.any.some((value) => value === entry.owner);
  }
  if ("tag" in node) {
    return node.tag.any.some((value) => entry.tags.some((tag) => tag === value));
  }
  if ("reference" in node) {
    return entry.relations.some(
      (relation) =>
        relation.kind === "reference" &&
        relation.targetArtifactId === node.reference.target &&
        (node.reference.role === undefined || relation.role === node.reference.role),
    );
  }
  if ("traceability" in node) {
    return entry.relations.some(
      (relation) =>
        relation.kind === "traceability" &&
        relation.targetArtifactId === node.traceability.target,
    );
  }
  // Diagnostic identity and namespace terms match declared diagnostic facts
  // as data. The accepted `DocumentEntryV1@1` contract exposes no diagnostic
  // facts, so these closed terms admit no candidate over the accepted
  // substrate; the engine never invents observation identities.
  return false;
}

function isCombinator(
  node: SelectorV1,
): node is { all: readonly SelectorV1[] } | { any: readonly SelectorV1[] } | { not: SelectorV1 } {
  return "all" in node || "any" in node || "not" in node;
}

/**
 * Evaluates one canonical AST against one entry with true short-circuit
 * semantics, iteratively (no input-shaped recursion). Decisions are emitted
 * in preorder: the deciding term first, then each actually-evaluated child
 * subtree in evaluation order — exactly the nodes a short-circuiting
 * evaluation visits.
 */
function evaluateAgainstEntry(
  ast: SelectorV1,
  context: MatchContext,
): { readonly matched: boolean; readonly decisions: readonly SelectorExplainTermV1[] } {
  const rootSlot: EvalSlot = { outcome: null };
  const emitted = new Map<EvalSlot, { readonly subject: string; readonly children: ChildRecord[] }>();
  const stack: MatchOperation[] = [];
  stack.push({ type: "eval", node: ast, subject: "selector", slot: rootSlot, parent: null });
  while (stack.length > 0) {
    if (context.budgetFailure !== null) {
      return { matched: false, decisions: [] };
    }
    const operation = stack.pop()!;
    if (operation.type === "eval") {
      const { node, subject, slot, parent } = operation;
      if (parent !== null && parent.resolved) {
        continue;
      }
      if (!isCombinator(node)) {
        slot.outcome = evaluateLeaf(node, subject, context);
        emitted.set(slot, { subject, children: [] });
        continue;
      }
      if ("not" in node) {
        const childSlot: EvalSlot = { outcome: null };
        emitted.set(slot, {
          subject,
          children: [{ subject: `${subject}.not`, slot: childSlot }],
        });
        stack.push({ type: "combine-not", slot, childSlot });
        stack.push({
          type: "eval",
          node: node.not,
          subject: `${subject}.not`,
          slot: childSlot,
          parent: null,
        });
        continue;
      }
      const kind = "all" in node ? "all" : "any";
      const children = "all" in node ? node.all : node.any;
      const parentState: ParentState = {
        kind,
        slot,
        records: [],
        resolved: false,
        outcome: false,
      };
      emitted.set(slot, { subject, children: parentState.records });
      stack.push({ type: "combine", parent: parentState });
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index]!;
        const childSubject = `${subject}.${kind}[${index}]`;
        const childSlot: EvalSlot = { outcome: null };
        const record: ChildRecord = { subject: childSubject, slot: childSlot };
        stack.push({ type: "gate", parent: parentState, record });
        stack.push({
          type: "eval",
          node: child,
          subject: childSubject,
          slot: childSlot,
          parent: parentState,
        });
      }
      continue;
    }
    if (operation.type === "gate") {
      const { parent, record } = operation;
      if (parent.resolved || record.slot.outcome === null) {
        continue;
      }
      parent.records.push(record);
      if (parent.kind === "all" && record.slot.outcome === false) {
        parent.resolved = true;
        parent.outcome = false;
      }
      if (parent.kind === "any" && record.slot.outcome === true) {
        parent.resolved = true;
        parent.outcome = true;
      }
      continue;
    }
    if (operation.type === "combine") {
      const { parent } = operation;
      if (!parent.resolved) {
        parent.outcome = parent.records.every((record) => record.slot.outcome === true);
      }
      parent.slot.outcome = parent.outcome;
      continue;
    }
    const { slot, childSlot } = operation;
    slot.outcome = childSlot.outcome === null ? false : !childSlot.outcome;
  }
  if (context.budgetFailure !== null) {
    return { matched: false, decisions: [] };
  }
  const decisions: SelectorExplainTermV1[] = [];
  const emitStack: { subject: string; slot: EvalSlot }[] = [
    { subject: "selector", slot: rootSlot },
  ];
  while (emitStack.length > 0) {
    const current = emitStack.pop()!;
    const outcome = current.slot.outcome;
    if (outcome === null) {
      continue;
    }
    decisions.push({ subject: current.subject, outcome: outcome ? "admitted" : "rejected" });
    const children = emitted.get(current.slot)?.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      emitStack.push({ subject: children[index]!.subject, slot: children[index]!.slot });
    }
  }
  return { matched: rootSlot.outcome === true, decisions };
}

/** Iterative deep freeze for engine-built plain values (acyclic by construction). */
function deepFreezeValue(root: unknown): void {
  if (root === null || typeof root !== "object") {
    return;
  }
  const stack: object[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    Object.freeze(current);
    for (const name of Object.getOwnPropertyNames(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor === undefined || !("value" in descriptor)) {
        continue;
      }
      const value = descriptor.value;
      if (value !== null && typeof value === "object") {
        stack.push(value as object);
      }
    }
  }
}

/**
 * Selects the entries of a Document Index projection matched by a closed
 * `SelectorV1` declaration. The selector — canonical AST or hostile unknown
 * source — is compiled under the declared budgets, the supplied index is
 * read descriptor-safely and matched in canonical artifact-identity order,
 * and every reference and traceability target must resolve against a
 * declared identity or the selection fails closed. The result carries the
 * ordered matches, the per-candidate explain trace, and exactly one
 * emission: the default zero-match diagnostic, produced whenever a
 * selection that did not opt out (an explicitly declared `min: 0`) matches
 * nothing. A selection whose non-empty match count violates its declared
 * bounds fails closed.
 */
export function selectDocumentsV1(
  projection: DocumentIndexProjectionV1,
  selector: unknown,
  budgets?: SelectorBudgetsV1 | undefined,
): SelectorSelectionResultV1 {
  const compiledResult = compileSelectorDataV1(
    selector,
    budgets === undefined ? DEFAULT_SELECTOR_BUDGETS_V1 : budgets,
  );
  if (!compiledResult.ok) {
    return { ok: false, issues: compiledResult.issues };
  }
  const compiled = compiledResult.compiled;
  const index = readIndex(projection);
  if (index.issues.length > 0) {
    return { ok: false, issues: sortIssues(index.issues) };
  }

  // Every declared relation target must resolve against a supplied identity.
  const identities = new Set(index.entries.map((entry) => entry.artifactId));
  const resolutionIssues: SelectorIssueV1[] = [];
  for (const relation of compiled.relations) {
    if (!identities.has(relation.target)) {
      resolutionIssues.push({
        code: INVALID_SELECTOR,
        subject: `${relation.subject}.target`,
      });
    }
  }
  if (resolutionIssues.length > 0) {
    return { ok: false, issues: sortIssues(resolutionIssues) };
  }

  const maxGlobStates =
    budgets === undefined ? DEFAULT_SELECTOR_BUDGETS_V1.maxGlobStates : budgets.maxGlobStates;
  const entries = [...index.entries].sort((left, right) =>
    compareCodePointOrder(left.artifactId, right.artifactId),
  );
  const matches: SelectorMatchV1[] = [];
  const trace: SelectorExplainTraceV1[] = [];
  for (const entry of entries) {
    const context: MatchContext = {
      entry,
      compiled,
      maxGlobStates,
      budgetFailure: null,
    };
    const evaluation = evaluateAgainstEntry(compiled.ast, context);
    if (context.budgetFailure !== null) {
      return {
        ok: false,
        issues: [{ code: INVALID_SELECTOR, subject: context.budgetFailure }],
      };
    }
    if (evaluation.matched) {
      matches.push({ artifactId: entry.artifactId });
    }
    trace.push({
      artifactId: entry.artifactId,
      matched: evaluation.matched,
      terms: evaluation.decisions,
    });
  }

  const count = matches.length;
  const min = compiled.cardinality.min;
  const max = compiled.cardinality.max;
  if (count > 0 && ((min !== undefined && count < min) || (max !== undefined && count > max))) {
    return { ok: false, issues: [{ code: INVALID_SELECTOR, subject: "selector" }] };
  }
  const diagnostics: SelectorIssueV1[] =
    count === 0 && min !== 0
      ? [{ code: SELECTOR_ZERO_MATCH_DIAGNOSTIC_CODE_V1, subject: "selector" }]
      : [];
  const result = {
    ok: true as const,
    matches,
    trace,
    diagnostics,
  };
  deepFreezeValue(result);
  return result;
}
