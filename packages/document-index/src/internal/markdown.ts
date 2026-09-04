/**
 * CommonMark parsing and content-derived derivations for
 * `@sothoth/document-index`.
 *
 * Internal responsibility unit of the package: never re-exported from any
 * public subpath, and the only file importing `mdast-util-from-markdown`.
 * The pinned parser runs with no extensions and no options; its value never
 * leaves this module except as projected package-owned fields. All walks are
 * iterative with explicit work stacks. `SECTION_MARKER_PATTERN` is consumed
 * here from `@sothoth/contracts` and never re-exported. Marker binding never
 * inspects prose: markers are recognized only through the exact frozen
 * pattern over parser-produced root `html` values.
 */

import { SECTION_MARKER_PATTERN } from "@sothoth/contracts";
import { fromMarkdown } from "mdast-util-from-markdown";
import { ASCII_WHITESPACE } from "./code-point.js";
import { digestOfContent } from "./validation.js";
import type { HeadingDepthV1, ParsedBlockNodeV1, SourceSpanV1 } from "../parse.js";
import type { BudgetShape, IssueDraft, SourceShape } from "./validation.js";
import { draft } from "./validation.js";

/** Raised when the parser or the projection cannot produce a closed value. */
export class MarkdownProjectionError extends Error {}

interface Position {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

function requirePosition(node: { type?: string; position?: { start?: Position; end?: Position } | null }): {
  readonly start: Position;
  readonly end: Position;
} {
  const position = node.position;
  const start = position?.start;
  const end = position?.end;
  if (
    start === undefined ||
    end === undefined ||
    typeof start.line !== "number" ||
    typeof start.column !== "number" ||
    typeof start.offset !== "number" ||
    typeof end.line !== "number" ||
    typeof end.column !== "number" ||
    typeof end.offset !== "number"
  ) {
    throw new MarkdownProjectionError(`node ${node.type} has no complete position`);
  }
  return { start, end };
}

function spanOf(position: { readonly start: Position; readonly end: Position }): SourceSpanV1 {
  return {
    startLine: position.start.line,
    startColumn: position.start.column,
    startOffset: position.start.offset,
    endLine: position.end.line,
    endColumn: position.end.column,
    endOffset: position.end.offset,
  };
}

/** The complete set of root block kinds default CommonMark emits (§8.2). */
type RootBlockKind = "paragraph" | "code" | "list" | "blockquote" | "thematic-break" | "definition";

const BLOCK_KIND_BY_TYPE: ReadonlyMap<string, RootBlockKind> = new Map([
  ["paragraph", "paragraph"],
  ["code", "code"],
  ["list", "list"],
  ["blockquote", "blockquote"],
  ["thematicBreak", "thematic-break"],
  ["definition", "definition"],
]);

/**
 * Counts every node of the full tree (root included) with an explicit work
 * stack, so no recursion proportional to document size can occur.
 */
function countTree(root: object): number {
  let count = 0;
  const stack: object[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    count += 1;
    const children = (current as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child !== null && typeof child === "object") {
          stack.push(child as object);
        }
      }
    }
  }
  return count;
}

/**
 * Extracts one heading's text: the concatenation, in document order, of the
 * values of descendant `text` and `inlineCode` nodes. Emphasis, strong, and
 * link contribute through their children; inline html and image alt
 * contribute nothing. ATX markers and closing sequences are already stripped
 * by the parser. The walk is iterative pre-order.
 */
function extractHeadingText(heading: { children?: unknown }): string {
  let out = "";
  const stack: object[] = [];
  const children = heading.children;
  if (Array.isArray(children)) {
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index] as object);
    }
  }
  while (stack.length > 0) {
    const current = stack.pop() as { type?: string; value?: unknown; children?: unknown };
    if (current.type === "text" || current.type === "inlineCode") {
      if (typeof current.value === "string") {
        out += current.value;
      }
      continue;
    }
    const nested = current.children;
    if (Array.isArray(nested)) {
      for (let index = nested.length - 1; index >= 0; index -= 1) {
        stack.push(nested[index] as object);
      }
    }
  }
  return out;
}

export interface ProjectedParse {
  readonly nodes: ParsedBlockNodeV1[];
  readonly astNodeCount: number;
}

/**
 * Projects the root-level children of the default-CommonMark tree into the
 * package-owned block model. Root children arrive in document order; each
 * node owns its span copied verbatim from the parser position. Any parser
 * exception (including a depth-induced native `RangeError`) propagates as
 * `MarkdownProjectionError` and is failed closed by the caller.
 */
export function projectRootBlocks(content: string): ProjectedParse {
  let root: { children?: unknown };
  try {
    root = fromMarkdown(content) as { children?: unknown };
  } catch (error) {
    throw new MarkdownProjectionError(`the parser rejected the content: ${String(error)}`);
  }
  if (!Array.isArray(root.children)) {
    throw new MarkdownProjectionError("the parser produced no root children");
  }
  const nodes: ParsedBlockNodeV1[] = [];
  const children = root.children as Array<{ type?: string; depth?: unknown; value?: unknown }>;
  for (const child of children) {
    const type = typeof child.type === "string" ? child.type : "";
    const position = requirePosition(child);
    if (type === "heading") {
      const depth = child.depth;
      if (typeof depth !== "number" || !Number.isSafeInteger(depth) || depth < 1 || depth > 6) {
        throw new MarkdownProjectionError("heading depth is outside 1–6");
      }
      nodes.push({
        type: "heading",
        depth: depth as HeadingDepthV1,
        text: extractHeadingText(child as { children?: unknown }),
        span: spanOf(position),
      });
      continue;
    }
    if (type === "html") {
      nodes.push({
        type: "html",
        value: typeof child.value === "string" ? child.value : "",
        span: spanOf(position),
      });
      continue;
    }
    const blockKind = BLOCK_KIND_BY_TYPE.get(type);
    if (blockKind === undefined) {
      throw new MarkdownProjectionError(`unexpected root block kind ${type}`);
    }
    nodes.push({ type: "block", blockKind, span: spanOf(position) });
  }
  return { nodes, astNodeCount: countTree(root) };
}

/** The exact marker recognition: the frozen pattern over the raw html value. */
export function markerSectionId(value: string): string | null {
  const match = SECTION_MARKER_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  return match[1] ?? null;
}

/**
 * The shared §8.1 stage-1 tail used by `parseDocumentV1` and the cache
 * builder: content-length budget, digest recompute, parse under the pinned
 * parser, and the AST-node and heading-text budgets. Returns the projected
 * nodes, or null once the drafts carry the failure; nothing is thrown
 * onward — a parser exception (including a depth-induced native
 * `RangeError`) fails closed as `invalid-field` at the content path.
 */
export function deriveParsedNodes(
  sourceShape: SourceShape,
  budgetShape: BudgetShape,
  path: string,
  drafts: IssueDraft[],
): readonly ParsedBlockNodeV1[] | null {
  if (sourceShape.content.length > budgetShape.maxContentCodeUnits) {
    drafts.push(draft("sothoth.document-index/budget-exhausted", `${path}.content`));
    return null;
  }
  if (digestOfContent(sourceShape.content) !== sourceShape.contentDigest) {
    drafts.push(draft("sothoth.document-index/content-digest-mismatch", `${path}.contentDigest`));
    return null;
  }
  let nodes: readonly ParsedBlockNodeV1[];
  let astNodeCount: number;
  try {
    const projection = projectRootBlocks(sourceShape.content);
    nodes = projection.nodes;
    astNodeCount = projection.astNodeCount;
  } catch (error) {
    if (error instanceof MarkdownProjectionError) {
      drafts.push(draft("sothoth.document-index/invalid-field", `${path}.content`));
      return null;
    }
    throw error;
  }
  if (astNodeCount > budgetShape.maxAstNodes) {
    drafts.push(draft("sothoth.document-index/budget-exhausted", path));
    return null;
  }
  for (const node of nodes) {
    if (node.type === "heading" && node.text.length > budgetShape.maxHeadingTextCodeUnits) {
      drafts.push(draft("sothoth.document-index/budget-exhausted", path));
      return null;
    }
  }
  return nodes;
}

/** ASCII-folds `A-Z` to `a-z` only; other code points pass through. */
function asciiFold(code: number): number {
  return code >= 0x41 && code <= 0x5a ? code + 0x20 : code;
}

/**
 * The §8.4 anchor base: trim ASCII whitespace, ASCII-fold `A-Z` to `a-z`,
 * replace every maximal ASCII-whitespace run with a single `-`, drop every
 * remaining ASCII code point outside `[a-z0-9_-]`, keep non-ASCII verbatim,
 * and fall back to the literal `heading` when empty. There is no
 * post-normalization trim and no hyphen collapse.
 */
export function anchorBase(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && ASCII_WHITESPACE.has(text.charCodeAt(start))) {
    start += 1;
  }
  while (end > start && ASCII_WHITESPACE.has(text.charCodeAt(end - 1))) {
    end -= 1;
  }
  let hyphenCollapsed = "";
  let lastWasHyphen = false;
  let index = start;
  while (index < end) {
    const code = text.codePointAt(index)!;
    const width = code > 0xffff ? 2 : 1;
    if (code < 0x80 && ASCII_WHITESPACE.has(code)) {
      if (!lastWasHyphen) {
        hyphenCollapsed += "-";
        lastWasHyphen = true;
      }
    } else {
      hyphenCollapsed += String.fromCodePoint(code);
      lastWasHyphen = false;
    }
    index += width;
  }
  let out = "";
  index = 0;
  while (index < hyphenCollapsed.length) {
    const code = hyphenCollapsed.codePointAt(index)!;
    const width = code > 0xffff ? 2 : 1;
    const folded = code < 0x80 ? asciiFold(code) : code;
    if (folded < 0x80) {
      const isAllowed =
        (folded >= 0x61 && folded <= 0x7a) ||
        (folded >= 0x30 && folded <= 0x39) ||
        folded === 0x2d ||
        folded === 0x5f;
      if (isAllowed) {
        out += String.fromCharCode(folded);
      }
    } else {
      out += String.fromCodePoint(folded);
    }
    index += width;
  }
  return out === "" ? "heading" : out;
}

export interface HeadingDerivation {
  readonly ordinal: number;
  readonly depth: HeadingDepthV1;
  readonly text: string;
  readonly anchor: string;
  readonly span: SourceSpanV1;
}

/**
 * Derives every heading record of one document: ordinals are the positive
 * 1-based positions over all headings in document order, and anchors are the
 * per-document disambiguated §8.4 forms.
 */
export function headingDerivations(nodes: readonly ParsedBlockNodeV1[]): HeadingDerivation[] {
  const bases: string[] = [];
  const positions: Array<{ depth: HeadingDepthV1; text: string; span: SourceSpanV1 }> = [];
  for (const node of nodes) {
    if (node.type === "heading") {
      bases.push(anchorBase(node.text));
      positions.push({ depth: node.depth, text: node.text, span: node.span });
    }
  }
  const assigned = new Set<string>();
  const counts = new Map<string, number>();
  const anchors: string[] = [];
  for (const base of bases) {
    const k = (counts.get(base) ?? 0) + 1;
    counts.set(base, k);
    let candidate = k === 1 ? base : `${base}-${k}`;
    let suffix = k;
    while (assigned.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    assigned.add(candidate);
    anchors.push(candidate);
  }
  return positions.map((position, index) => ({
    ordinal: index + 1,
    depth: position.depth,
    text: position.text,
    anchor: anchors[index]!,
    span: position.span,
  }));
}

export interface BoundSection {
  readonly sectionId: string;
  readonly markerSpan: SourceSpanV1;
  readonly headingOrdinal: number;
  readonly headingSpan: SourceSpanV1;
}

/**
 * Binds root-level exact markers to their next root sibling headings
 * (§8.3). Blank source lines produce no AST nodes, so any number of blank
 * lines is permitted; any other next sibling — including a `definition` — or
 * EOF rejects with the exact marker candidate span. A duplicate `sectionId`
 * fails the later occurrence at that later marker's span and the section is
 * not bound twice. Markers nested inside containers are not root level and
 * are invisible here.
 */
export function boundSections(
  nodes: readonly ParsedBlockNodeV1[],
  artifactId: string,
): { readonly sections: readonly BoundSection[]; readonly drafts: readonly IssueDraft[] } {
  const ordinalOfHeading = new Map<number, number>();
  let headingOrdinal = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    if (nodes[index]!.type === "heading") {
      headingOrdinal += 1;
      ordinalOfHeading.set(index, headingOrdinal);
    }
  }
  const sections: BoundSection[] = [];
  const drafts: IssueDraft[] = [];
  const boundIds = new Set<string>();
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type !== "html") {
      continue;
    }
    const sectionId = markerSectionId(node.value);
    if (sectionId === null) {
      continue;
    }
    const next = nodes[index + 1];
    if (next === undefined || next.type !== "heading") {
      drafts.push(
        draft("sothoth.document-index/marker-not-followed-by-heading", sectionId, {
          artifactId,
          span: node.span,
        }),
      );
      continue;
    }
    if (boundIds.has(sectionId)) {
      drafts.push(
        draft("sothoth.document-index/duplicate-section-id", sectionId, {
          artifactId,
          span: node.span,
        }),
      );
      continue;
    }
    boundIds.add(sectionId);
    sections.push({
      sectionId,
      markerSpan: node.span,
      headingOrdinal: ordinalOfHeading.get(index + 1)!,
      headingSpan: next.span,
    });
  }
  return { sections, drafts };
}
