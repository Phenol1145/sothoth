/**
 * Internal machinery unit for `@project-sothoth/selectors`. Not a public module:
 * nothing here is re-exported from any accepted subpath. It owns two
 * responsibilities of the closed engine —
 *
 * 1. the dynamic-programming POSIX-path glob matcher supporting literals,
 *    `?`, `*`, and whole-segment `**` without RegExp backtracking, and
 * 2. the shared hostile selector compiler used by both public units: a
 *    closed-key, descriptor-safe, budget-bounded one-pass walk that turns a
 *    hostile declaration into the canonical AST plus the match-side
 *    indexes, rejecting every unknown operator, empty boolean group,
 *    invalid cardinality, absolute path, `..`/`.` segment, NUL, and
 *    unsupported glob syntax as `sothoth.selectors/invalid-selector` with
 *    an exact subject.
 *
 * The walk is iterative, so no input and no declared budget can overflow
 * the native stack; a cyclic declaration is rejected deterministically by
 * the depth budget instead. Accessors on known fields are rejected without
 * their getters ever executing.
 */

import { isDiagnosticCodeV1 } from "@project-sothoth/contracts";
import type {
  SelectorAnyV1,
  SelectorAllV1,
  SelectorArtifactIdTermV1,
  SelectorDiagnosticTermV1,
  SelectorNamespaceTermV1,
  SelectorNotV1,
  SelectorOwnerTermV1,
  SelectorPathTermV1,
  SelectorKindTermV1,
  SelectorReferenceTermV1,
  SelectorSetV1,
  SelectorStatusTermV1,
  SelectorTagTermV1,
  SelectorTraceabilityTermV1,
  SelectorV1,
} from "./index.js";
import type { SelectorBudgetsV1, SelectorIssueV1 } from "./parser.js";

const INVALID_SELECTOR = "sothoth.selectors/invalid-selector";

/** One absolute rejection class of the closed glob syntax. */
export type GlobCompileRejection =
  | "empty"
  | "nul"
  | "absolute"
  | "dot-segment"
  | "empty-segment"
  | "unsupported-syntax";

/** A compiled pattern segment: literal run, `?`, `*`, or the whole-segment `**`. */
export type GlobSegmentUnit =
  | { readonly kind: "literal"; readonly char: string }
  | { readonly kind: "question" }
  | { readonly kind: "star" };

/** A compiled pattern: segments where exactly `["globstar"]` means `**`. */
export interface CompiledPathGlobV1 {
  /** Per-segment units; a whole-segment `**` is the singleton `globstar` marker. */
  readonly segments: readonly (readonly GlobSegmentUnit[] | "globstar")[];
}

/** Characters that are glob metacharacters this algebra does not support. */
const UNSUPPORTED_CHARACTERS = new Set(["[", "]", "{", "}", "\\"]);

/**
 * Compiles one normalized path glob under the closed syntax. Every
 * rejection is a parse-time `invalid-selector` at the term's subject; the
 * boolean result keeps this module free of issue-shape knowledge.
 */
export function compilePathGlobV1(
  pattern: string,
): { readonly ok: true; readonly glob: CompiledPathGlobV1 } | {
  readonly ok: false;
  readonly rejection: GlobCompileRejection;
} {
  if (pattern.length === 0) {
    return { ok: false, rejection: "empty" };
  }
  if (pattern.includes("\u0000")) {
    return { ok: false, rejection: "nul" };
  }
  const rawSegments = pattern.split("/");
  const segments: (readonly GlobSegmentUnit[] | "globstar")[] = [];
  for (const rawSegment of rawSegments) {
    if (rawSegment === ".." || rawSegment === ".") {
      return { ok: false, rejection: "dot-segment" };
    }
    if (rawSegment === "**") {
      segments.push("globstar");
      continue;
    }
    if (rawSegment.length === 0) {
      return { ok: false, rejection: pattern.startsWith("/") ? "absolute" : "empty-segment" };
    }
    const units: GlobSegmentUnit[] = [];
    let index = 0;
    while (index < rawSegment.length) {
      const char = rawSegment[index]!;
      if (UNSUPPORTED_CHARACTERS.has(char)) {
        return { ok: false, rejection: "unsupported-syntax" };
      }
      if (char === "?") {
        units.push({ kind: "question" });
        index += 1;
        continue;
      }
      if (char === "*") {
        let stars = 0;
        while (rawSegment[index] === "*") {
          stars += 1;
          index += 1;
        }
        // Exactly one `*` is the within-segment wildcard; `**` is legal only
        // as the whole segment (handled above); every other run — `a**b`,
        // `a**`, `***` — is unsupported syntax.
        if (stars !== 1) {
          return { ok: false, rejection: "unsupported-syntax" };
        }
        units.push({ kind: "star" });
        continue;
      }
      units.push({ kind: "literal", char });
      index += 1;
    }
    segments.push(units);
  }
  return { ok: true, glob: { segments } };
}

/** Segment-match state counter carried through one glob evaluation. */
interface MatchBudget {
  states: number;
  readonly maxStates: number;
}

function budgetExhausted(budget: MatchBudget): boolean {
  return budget.states > budget.maxStates;
}

/**
 * Boolean dynamic program for one (pattern segment, path segment) pair:
 * `?` consumes exactly one character, `*` consumes zero or more characters
 * of the segment, literals compare directly. Returns the matched verdict and
 * charges every evaluated cell to the budget.
 */
function matchSegmentUnits(
  units: readonly GlobSegmentUnit[],
  segment: string,
  budget: MatchBudget,
): { matched: boolean; overBudget: boolean } {
  const rows = units.length;
  const columns = segment.length;
  let previous = new Array<boolean>(columns + 1).fill(false);
  previous[0] = true;
  for (let row = 1; row <= rows; row += 1) {
    const unit = units[row - 1]!;
    const current = new Array<boolean>(columns + 1).fill(false);
    for (let column = 0; column <= columns; column += 1) {
      budget.states += 1;
      if (budgetExhausted(budget)) {
        return { matched: false, overBudget: true };
      }
      if (unit.kind === "star") {
        current[column] = (column > 0 && current[column - 1]!) || previous[column]!;
      } else if (column === 0) {
        current[column] = false;
      } else if (unit.kind === "question") {
        current[column] = previous[column - 1]!;
      } else {
        current[column] = previous[column - 1]! && segment[column - 1] === unit.char;
      }
    }
    previous = current;
  }
  return { matched: previous[columns]!, overBudget: false };
}

/**
 * Matches one normalized POSIX path against a compiled glob with the
 * segment-level dynamic program. Whole-segment `**` matches zero or more
 * complete segments; every other segment matches through the per-segment
 * char-level program. The returned `overBudget` flag is the deterministic
 * fail-closed signal: a partial match is never reported.
 */
export function matchPathGlobV1(
  glob: CompiledPathGlobV1,
  path: string,
  maxStates: number,
): { matched: boolean; overBudget: boolean } {
  const pathSegments = path.split("/");
  const budget: MatchBudget = { states: 0, maxStates };
  const rows = glob.segments.length;
  const columns = pathSegments.length;
  let previous = new Array<boolean>(columns + 1).fill(false);
  previous[0] = true;
  for (let row = 1; row <= rows; row += 1) {
    const patternSegment = glob.segments[row - 1]!;
    const current = new Array<boolean>(columns + 1).fill(false);
    for (let column = 0; column <= columns; column += 1) {
      budget.states += 1;
      if (budgetExhausted(budget)) {
        return { matched: false, overBudget: true };
      }
      if (patternSegment === "globstar") {
        current[column] = previous[column]! || (column > 0 && current[column - 1]!);
        continue;
      }
      if (column === 0 || !previous[column - 1]!) {
        current[column] = false;
        continue;
      }
      const pair = matchSegmentUnits(patternSegment, pathSegments[column - 1]!, budget);
      if (pair.overBudget) {
        return { matched: false, overBudget: true };
      }
      current[column] = pair.matched;
    }
    previous = current;
  }
  if (budgetExhausted(budget)) {
    return { matched: false, overBudget: true };
  }
  return { matched: previous[columns]!, overBudget: false };
}

/**
 * The closed selector vocabulary in canonical order. Key dispatch uses this
 * order, so a declaration carrying several selector keys is classified
 * deterministically regardless of its own key insertion order.
 */
const SELECTOR_KEYS = [
  "all",
  "any",
  "not",
  "artifactId",
  "path",
  "kind",
  "status",
  "owner",
  "tag",
  "reference",
  "traceability",
  "diagnostic",
  "namespace",
] as const;

type SelectorKey = (typeof SELECTOR_KEYS)[number];

const SET_TERM_KEYS: ReadonlySet<string> = new Set(["kind", "status", "owner", "tag"]);
const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const BUDGET_FIELDS = [
  "maxSourceCodeUnits",
  "maxDepth",
  "maxPatternCodeUnits",
  "maxGlobStates",
] as const;

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

/** Orders issues by code, then subject, in Unicode code-point order. */
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

const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

/**
 * True for a dense, undecorated array: own enumerable keys are exactly the
 * canonical index names `"0"`..`"<length-1>"`, every slot is a data property,
 * and no symbol keys or extra own string names exist. The check is
 * descriptor-only — no slot value is read, so a hostile accessor never
 * executes and its return value can never be adopted.
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
    if (!ARRAY_INDEX_PATTERN.test(name) || Number(name) >= length) {
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
  return typeof value === "string" && value.length > 0;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** Mutable result cell one compile frame writes into. */
interface Slot {
  value: SelectorV1 | null;
}

interface VisitOperation {
  readonly type: "visit";
  readonly source: Record<string, unknown>;
  readonly subject: string;
  readonly depth: number;
  readonly slot: Slot;
}

interface BuildOperation {
  readonly type: "build";
  readonly kind: "all" | "any" | "not";
  readonly slot: Slot;
  readonly childSlots: readonly Slot[];
}

type Operation = VisitOperation | BuildOperation;

/** Internal compile output: the canonical AST plus the match-side indexes. */
export interface CompiledSelectorV1 {
  readonly ast: SelectorV1;
  readonly globs: ReadonlyMap<string, CompiledPathGlobV1>;
  readonly relations: readonly {
    readonly subject: string;
    readonly term: "reference" | "traceability";
    readonly target: string;
  }[];
  readonly cardinality: { readonly min?: number | undefined; readonly max?: number | undefined };
}

export type CompiledSelectorResultV1 =
  | { readonly ok: true; readonly compiled: CompiledSelectorV1 }
  | { readonly ok: false; readonly issues: readonly SelectorIssueV1[] };

interface WalkState {
  readonly issues: SelectorIssueV1[];
  readonly globs: Map<string, CompiledPathGlobV1>;
  readonly relations: { subject: string; term: "reference" | "traceability"; target: string }[];
  readonly cardinality: { min?: number; max?: number };
  sizeUnits: number;
  sizeReported: boolean;
}

function issue(state: WalkState, subject: string): void {
  state.issues.push({ code: INVALID_SELECTOR, subject });
}

function chargeSize(state: WalkState, units: number, budgets: SelectorBudgetsV1): void {
  state.sizeUnits += units;
  if (state.sizeUnits > budgets.maxSourceCodeUnits && !state.sizeReported) {
    state.sizeReported = true;
    issue(state, "selector");
  }
}

/**
 * Validates one budgets container as closed, positive-integer data.
 * Accessors are rejected without execution; every violation carries the
 * exact `budgets.*` subject.
 */
function validateBudgets(budgets: unknown, state: WalkState): SelectorBudgetsV1 | null {
  if (!isPlainObject(budgets)) {
    issue(state, "budgets");
    return null;
  }
  for (const name of Object.getOwnPropertyNames(budgets)) {
    if (!(BUDGET_FIELDS as readonly string[]).includes(name)) {
      issue(state, `budgets.${name}`);
    }
  }
  const values = new Map<string, number>();
  for (const name of BUDGET_FIELDS) {
    const field = readOwnField(budgets, name);
    if (field.state !== "data" || !positiveSafeInteger(field.value)) {
      issue(state, `budgets.${name}`);
      continue;
    }
    values.set(name, field.value);
  }
  if (values.size !== BUDGET_FIELDS.length) {
    return null;
  }
  return {
    maxSourceCodeUnits: values.get("maxSourceCodeUnits")!,
    maxDepth: values.get("maxDepth")!,
    maxPatternCodeUnits: values.get("maxPatternCodeUnits")!,
    maxGlobStates: values.get("maxGlobStates")!,
  };
}

/** Validates one closed `{ any: [...] }` set value and returns its canonical form. */
function compileSetTerm(
  value: unknown,
  subject: string,
  state: WalkState,
  budgets: SelectorBudgetsV1,
): SelectorSetV1 | null {
  if (!isPlainObject(value)) {
    issue(state, subject);
    return null;
  }
  for (const name of Object.getOwnPropertyNames(value)) {
    if (name !== "any") {
      issue(state, `${subject}.${name}`);
    }
  }
  const anyField = readOwnField(value, "any");
  if (anyField.state !== "data" || !isDenseArray(anyField.value) || anyField.value.length === 0) {
    issue(state, `${subject}.any`);
    return null;
  }
  const list = anyField.value;
  const values: string[] = [];
  let valid = true;
  for (let index = 0; index < list.length; index += 1) {
    const element = list[index];
    chargeSize(state, nonEmptyString(element) ? element.length : 2, budgets);
    if (!nonEmptyString(element)) {
      issue(state, `${subject}.any[${index}]`);
      valid = false;
      continue;
    }
    values.push(element);
  }
  if (!valid) {
    return null;
  }
  return { any: values };
}

/** Builds one closed leaf term; returns `null` after recording exact issues. */
function compileLeafTerm(
  key:
    | "artifactId"
    | "path"
    | "kind"
    | "status"
    | "owner"
    | "tag"
    | "reference"
    | "traceability"
    | "diagnostic"
    | "namespace",
  value: unknown,
  subject: string,
  state: WalkState,
  budgets: SelectorBudgetsV1,
): SelectorV1 | null {
  if (key === "artifactId" || key === "diagnostic" || key === "namespace") {
    chargeSize(state, nonEmptyString(value) ? value.length : 2, budgets);
    if (!nonEmptyString(value)) {
      issue(state, `${subject}.${key}`);
      return null;
    }
    if (key === "diagnostic" && !isDiagnosticCodeV1(value)) {
      issue(state, `${subject}.${key}`);
      return null;
    }
    if (key === "namespace" && !NAMESPACE_PATTERN.test(value)) {
      issue(state, `${subject}.${key}`);
      return null;
    }
    if (key === "artifactId") {
      const term: SelectorArtifactIdTermV1 = { artifactId: value };
      return term;
    }
    if (key === "diagnostic") {
      const term: SelectorDiagnosticTermV1 = { diagnostic: value };
      return term;
    }
    const term: SelectorNamespaceTermV1 = { namespace: value };
    return term;
  }
  if (key === "path") {
    chargeSize(state, nonEmptyString(value) ? value.length : 2, budgets);
    if (!nonEmptyString(value) || value.length > budgets.maxPatternCodeUnits) {
      issue(state, `${subject}.path`);
      return null;
    }
    const compiled = compilePathGlobV1(value);
    if (!compiled.ok) {
      issue(state, `${subject}.path`);
      return null;
    }
    state.globs.set(`${subject}.path`, compiled.glob);
    const term: SelectorPathTermV1 = { path: value };
    return term;
  }
  if (SET_TERM_KEYS.has(key)) {
    const set = compileSetTerm(value, `${subject}.${key}`, state, budgets);
    if (set === null) {
      return null;
    }
    if (key === "kind") {
      const term: SelectorKindTermV1 = { kind: set };
      return term;
    }
    if (key === "status") {
      const term: SelectorStatusTermV1 = { status: set };
      return term;
    }
    if (key === "owner") {
      const term: SelectorOwnerTermV1 = { owner: set };
      return term;
    }
    const term: SelectorTagTermV1 = { tag: set };
    return term;
  }
  // reference / traceability: closed relation terms over declared targets.
  if (!isPlainObject(value)) {
    issue(state, `${subject}.${key}`);
    return null;
  }
  const allowed = key === "reference" ? ["target", "role"] : ["target"];
  for (const name of Object.getOwnPropertyNames(value)) {
    if (!allowed.includes(name)) {
      issue(state, `${subject}.${key}.${name}`);
    }
  }
  const targetField = readOwnField(value, "target");
  if (targetField.state !== "data" || !nonEmptyString(targetField.value)) {
    issue(state, `${subject}.${key}.target`);
    return null;
  }
  chargeSize(state, targetField.value.length, budgets);
  let role: string | undefined = undefined;
  if (key === "reference") {
    const roleField = readOwnField(value, "role");
    if (roleField.state !== "data") {
      if (roleField.state === "accessor") {
        issue(state, `${subject}.reference.role`);
        return null;
      }
    } else if (!nonEmptyString(roleField.value)) {
      issue(state, `${subject}.reference.role`);
      return null;
    } else {
      chargeSize(state, roleField.value.length, budgets);
      role = roleField.value;
    }
  }
  state.relations.push({
    subject: `${subject}.${key}`,
    term: key === "reference" ? "reference" : "traceability",
    target: targetField.value,
  });
  if (key === "reference") {
    const target = { target: targetField.value };
    const term: SelectorReferenceTermV1 =
      role === undefined ? { reference: target } : { reference: { ...target, role } };
    return term;
  }
  const term: SelectorTraceabilityTermV1 = { traceability: { target: targetField.value } };
  return term;
}

/**
 * Compiles one hostile selector declaration into the canonical AST plus the
 * match-side indexes. Iterative end to end: the explicit operation stack
 * bounds every walk by the declared depth budget, so a cyclic or absurdly
 * deep declaration fails deterministically instead of overflowing the stack.
 */
export function compileSelectorDataV1(
  source: unknown,
  rawBudgets: unknown,
): CompiledSelectorResultV1 {
  const state: WalkState = {
    issues: [],
    globs: new Map(),
    relations: [],
    cardinality: {},
    sizeUnits: 0,
    sizeReported: false,
  };
  const budgets = validateBudgets(rawBudgets, state);
  if (budgets === null) {
    return { ok: false, issues: sortIssues(state.issues) };
  }
  const rootSlot: Slot = { value: null };
  if (!isPlainObject(source)) {
    issue(state, "selector");
    return { ok: false, issues: sortIssues(state.issues) };
  }

  const stack: Operation[] = [];
  stack.push({
    type: "visit",
    source,
    subject: "selector",
    depth: 1,
    slot: rootSlot,
  });
  while (stack.length > 0) {
    const operation = stack.pop()!;
    if (operation.type === "build") {
      const values: SelectorV1[] = [];
      let valid = true;
      for (const childSlot of operation.childSlots) {
        if (childSlot.value === null) {
          valid = false;
          break;
        }
        values.push(childSlot.value);
      }
      if (valid) {
        if (operation.kind === "all") {
          const node: SelectorAllV1 = { all: values };
          operation.slot.value = node;
        } else if (operation.kind === "any") {
          const node: SelectorAnyV1 = { any: values };
          operation.slot.value = node;
        } else {
          const node: SelectorNotV1 = { not: values[0]! };
          operation.slot.value = node;
        }
      }
      continue;
    }
    const { source: nodeSource, subject, depth, slot } = operation;
    chargeSize(state, subject.length + 2, budgets);
    if (depth > budgets.maxDepth) {
      issue(state, subject);
      continue;
    }

    // Closed root cardinality bounds: legal only beside the root selector key.
    const rootOnly = depth === 1;
    for (const name of Object.getOwnPropertyNames(nodeSource)) {
      if ((SELECTOR_KEYS as readonly string[]).includes(name)) {
        continue;
      }
      if (rootOnly && (name === "min" || name === "max")) {
        const bound = readOwnField(nodeSource, name);
        const boundValue = bound.state === "data" ? bound.value : undefined;
        if (!nonNegativeSafeInteger(boundValue)) {
          issue(state, `${subject}.${name}`);
          continue;
        }
        chargeSize(state, String(boundValue).length, budgets);
        if (name === "min") {
          state.cardinality.min = boundValue;
        } else {
          state.cardinality.max = boundValue;
        }
        continue;
      }
      issue(state, `${subject}.${name}`);
    }
    if (
      rootOnly &&
      state.cardinality.min !== undefined &&
      state.cardinality.max !== undefined &&
      state.cardinality.min > state.cardinality.max
    ) {
      issue(state, subject);
    }

    // Deterministic single-form dispatch in canonical vocabulary order.
    const present: { key: SelectorKey; field: OwnField }[] = [];
    for (const candidate of SELECTOR_KEYS) {
      const field = readOwnField(nodeSource, candidate);
      if (field.state !== "missing") {
        present.push({ key: candidate, field });
      }
    }
    if (present.length === 0) {
      issue(state, subject);
      continue;
    }
    if (present.length > 1) {
      issue(state, subject);
      for (const entry of present) {
        if (entry.field.state === "accessor") {
          issue(state, `${subject}.${entry.key}`);
        }
      }
      continue;
    }
    const selected = present[0]!;
    const selectedField = selected.field;
    if (selectedField.state !== "data") {
      issue(state, `${subject}.${selected.key}`);
      continue;
    }
    const key = selected.key;
    const value = selectedField.value;

    if (key === "all" || key === "any") {
      if (!isDenseArray(value) || value.length === 0) {
        issue(state, `${subject}.${key}`);
        continue;
      }
      const childSlots: Slot[] = [];
      const childOps: VisitOperation[] = [];
      let elementsValid = true;
      for (let index = 0; index < value.length; index += 1) {
        const element = value[index];
        const childSubject = `${subject}.${key}[${index}]`;
        if (!isPlainObject(element)) {
          issue(state, childSubject);
          elementsValid = false;
          continue;
        }
        const childSlot: Slot = { value: null };
        childSlots.push(childSlot);
        childOps.push({
          type: "visit",
          source: element,
          subject: childSubject,
          depth: depth + 1,
          slot: childSlot,
        });
      }
      if (!elementsValid) {
        continue;
      }
      stack.push({ type: "build", kind: key, slot, childSlots });
      for (let index = childOps.length - 1; index >= 0; index -= 1) {
        stack.push(childOps[index]!);
      }
      continue;
    }

    if (key === "not") {
      if (!isPlainObject(value)) {
        issue(state, `${subject}.not`);
        continue;
      }
      const childSlot: Slot = { value: null };
      stack.push({ type: "build", kind: "not", slot, childSlots: [childSlot] });
      stack.push({
        type: "visit",
        source: value,
        subject: `${subject}.not`,
        depth: depth + 1,
        slot: childSlot,
      });
      continue;
    }

    slot.value = compileLeafTerm(key, value, subject, state, budgets);
  }

  if (state.issues.length > 0 || rootSlot.value === null) {
    if (rootSlot.value === null && state.issues.length === 0) {
      issue(state, "selector");
    }
    return { ok: false, issues: sortIssues(state.issues) };
  }
  return {
    ok: true,
    compiled: {
      ast: rootSlot.value,
      globs: state.globs,
      relations: state.relations,
      cardinality: {
        min: state.cardinality.min,
        max: state.cardinality.max,
      },
    },
  };
}
