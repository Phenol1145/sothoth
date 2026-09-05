import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

const PACKAGES = [
  "cli",
  "contracts",
  "core",
  "document-index",
  "git",
  "governance",
  "graph",
  "planning",
  "profile-sdk",
  "sdk",
  "selectors",
] as const;

/** The tracked markdown Task 11 creates; every one must exist and link cleanly. */
const TRACKED_MARKDOWN: string[] = [
  "README.md",
  "ARCHITECTURE.md",
  ...PACKAGES.map((p) => `docs/packages/${p}.md`),
  "docs/release/v0.1.0-release-notes.md",
  ...PACKAGES.map((p) => `packages/${p}/README.md`),
];

async function readTracked(relativePath: string): Promise<string> {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`missing Task 11 markdown deliverable: ${relativePath}`);
  }
  return readFile(absolute, "utf8");
}

function githubSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  for (const match of markdown.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    if (match[1]) {
      anchors.add(githubSlug(match[1]));
    }
  }
  return anchors;
}

interface ExtractedLink {
  file: string;
  target: string;
}

function extractRelativeLinks(file: string, markdown: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  for (const match of markdown.matchAll(/(?<!\!)\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
    const target = match[1];
    if (
      target &&
      !target.startsWith("http://") &&
      !target.startsWith("https://") &&
      !target.startsWith("mailto:") &&
      !target.startsWith("#")
    ) {
      links.push({ file, target });
    }
  }
  return links;
}

describe("Task 11 tracked markdown exists", () => {
  test("every Task 11 markdown deliverable exists", async () => {
    for (const file of TRACKED_MARKDOWN) {
      await readTracked(file); // throws, naming the missing deliverable
    }
    expect(TRACKED_MARKDOWN.length).toBe(25);
  });
});

describe("Task 11 relative document links resolve", () => {
  test("all relative links in Task 11 markdown point at existing files", async () => {
    const problems: string[] = [];
    for (const file of TRACKED_MARKDOWN) {
      const markdown = await readTracked(file);
      for (const link of extractRelativeLinks(file, markdown)) {
        const clean = link.target.split("#")[0] ?? link.target;
        if (clean === "") {
          continue; // pure same-document fragment link
        }
        const absolute = resolve(join(root, dirname(file)), clean);
        if (!existsSync(absolute)) {
          problems.push(`${file} -> ${link.target}`);
        }
      }
    }
    expect(problems, `broken relative links:\n${problems.join("\n")}`).toEqual([]);
  });

  test("markdown fragments point at headings that exist in the target document", async () => {
    const problems: string[] = [];
    for (const file of TRACKED_MARKDOWN) {
      const markdown = await readTracked(file);
      for (const link of extractRelativeLinks(file, markdown)) {
        const fragment = link.target.split("#")[1];
        if (!fragment) {
          continue;
        }
        const clean = link.target.split("#")[0] ?? "";
        const targetFile = clean === "" ? file : resolve(join(root, dirname(file)), clean);
        if (!existsSync(targetFile) || !targetFile.endsWith(".md")) {
          continue; // non-markdown targets are covered by the existence test
        }
        const targetMarkdown = await readFile(targetFile, "utf8");
        if (!headingAnchors(targetMarkdown).has(fragment)) {
          problems.push(`${file} -> ${link.target} (missing heading anchor)`);
        }
      }
    }
    expect(problems, `broken fragments:\n${problems.join("\n")}`).toEqual([]);
  });

  test("package reference docs bind to their Dossier, the architecture, and adjacent packages", async () => {
    for (const p of PACKAGES) {
      const markdown = await readTracked(`docs/packages/${p}.md`);
      expect(
        markdown.includes(`(../design/dossiers/${p}.md)`),
        `docs/packages/${p}.md must link to docs/design/dossiers/${p}.md`,
      ).toBe(true);
      expect(markdown.includes("(../../ARCHITECTURE.md)")).toBe(true);
      expect(markdown.includes("(../../README.md)")).toBe(true);
      const adjacent = (markdown.match(/\]\([a-z-]+\.md\)/g) ?? []).filter(
        (link) => link !== `(${p}.md)`,
      );
      expect(adjacent.length, `docs/packages/${p}.md links to adjacent package docs`).toBeGreaterThan(
        0,
      );
    }
  });
});

describe("Task 11 honesty rules", () => {
  test("root README states the not-yet-published status and avoids fabricated claims", async () => {
    const readme = await readTracked("README.md");
    expect(readme).toContain("not yet published on npm");
    for (const forbidden of [
      "available on npm",
      "released on npm",
      "is published on npm",
      "are published on npm",
      "installable from the npm registry",
    ]) {
      expect(readme, `README must not claim: "${forbidden}"`).not.toContain(forbidden);
    }
    // Badges asserting CI/registry state that does not exist are forbidden;
    // Task 11 uses no markdown image badges at all.
    expect(readme.includes("!["), "README must not embed image badges").toBe(false);
  });

  test("release notes are marked 0.1.0 release-candidate / pre-publication", async () => {
    const notes = await readTracked("docs/release/v0.1.0-release-notes.md");
    expect(notes).toContain("release candidate");
    expect(notes.toLowerCase()).toContain("pre-publication");
    expect(notes).toContain("not yet published");
  });

  test("no hardcoded test counts in committed release documentation", async () => {
    for (const file of ["README.md", "docs/release/v0.1.0-release-notes.md"]) {
      const markdown = await readTracked(file);
      expect(
        /\b\d{3,}\s+(tests|test files)\b/.test(markdown),
        `${file} must not hardcode test counts`,
      ).toBe(false);
    }
  });

  test("Task 11 markdown makes no FRACTA unblock or publication claims", async () => {
    const forbidden = /\b(unblocked|release-ready|rebaselined)\b/i;
    for (const file of TRACKED_MARKDOWN) {
      const markdown = await readTracked(file);
      expect(markdown.match(forbidden), `${file} must not claim FRACTA readiness`).toBeNull();
    }
  });
});
