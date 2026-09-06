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

/** The tracked public documentation and agent guidance; every file must exist and link cleanly. */
const TRACKED_MARKDOWN: string[] = [
  "README.md",
  "ARCHITECTURE.md",
  "docs/quick-start.md",
  "docs/user-guide.md",
  ...PACKAGES.map((p) => `docs/packages/${p}.md`),
  "docs/release/v0.1.0-release-notes.md",
  ...PACKAGES.map((p) => `packages/${p}/README.md`),
  "skills/using-sothoth/SKILL.md",
  "skills/using-sothoth/references/command-guide.md",
];

async function readTracked(relativePath: string): Promise<string> {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`missing tracked documentation: ${relativePath}`);
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

describe("tracked documentation exists", () => {
  test("every public guide and agent-skill document exists", async () => {
    for (const file of TRACKED_MARKDOWN) {
      await readTracked(file); // throws, naming the missing document
    }
  });
});

describe("relative document links resolve", () => {
  test("all relative links in tracked markdown point at existing files", async () => {
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

describe("release-document honesty rules", () => {
  test("root README states the published status and routes humans to both collaboration guides", async () => {
    const readme = await readTracked("README.md");
    expect(readme).toContain("`0.1.0` — published on npm");
    expect(readme).toContain("[Quick Start](docs/quick-start.md)");
    expect(readme).toContain("[User Guide](docs/user-guide.md)");
    for (const stale of ["not yet published on npm", "After publication", "publication evidence is pending"]) {
      expect(readme, `README must not retain stale lifecycle text: "${stale}"`).not.toContain(stale);
    }
    // Registry and CI badges drift independently from repository documentation.
    expect(readme.includes("!["), "README must not embed image badges").toBe(false);
  });

  test("release notes bind the published release to its exact source and keep evidence classes separate", async () => {
    const notes = await readTracked("docs/release/v0.1.0-release-notes.md");
    expect(notes).toContain("**Status: 0.1.0 — published on npm.**");
    expect(notes).toContain("50f8b28d3499133deab25f65835526af2de935cb");
    expect(notes).toContain("33967130657");
    expect(notes).toContain("all eleven packages");
    expect(notes).toContain("registry evidence");
    expect(notes).toContain("repository evidence");
    expect(notes).not.toContain("not yet published");
  });

  test("package-facing documentation contains no stale pre-publication status", async () => {
    for (const file of [
      ...PACKAGES.map((p) => `docs/packages/${p}.md`),
      ...PACKAGES.map((p) => `packages/${p}/README.md`),
    ]) {
      const markdown = await readTracked(file);
      expect(markdown, `${file} must describe 0.1.0 as published`).not.toContain(
        "release candidate, not yet published on npm",
      );
      expect(markdown, `${file} must not use a before-publication run instruction`).not.toContain(
        "before publication",
      );
    }
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

  test("tracked documentation makes no FRACTA readiness claims", async () => {
    const forbidden = /\b(unblocked|release-ready|rebaselined)\b/i;
    for (const file of TRACKED_MARKDOWN) {
      const markdown = await readTracked(file);
      expect(markdown.match(forbidden), `${file} must not claim FRACTA readiness`).toBeNull();
    }
  });
});
