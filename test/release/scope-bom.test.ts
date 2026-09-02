import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { validateScopeBom } from "../../scripts/check-scope-bom.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function readScopeBom(): Promise<Record<string, unknown> & { members: Record<string, unknown>[] }> {
  return JSON.parse(await readFile(`${root}/docs/release/v0.1.0-scope-bom.json`, "utf8"));
}

describe("Sothoth v0.1 Scope BOM", () => {
  test("accepts the repository Scope BOM", async () => {
    expect(validateScopeBom(await readScopeBom())).toEqual([]);
  });

  test("rejects a Scope BOM that omits a required public package", async () => {
    const bom = structuredClone(await readScopeBom());
    bom.members = bom.members.filter((member) => member.id !== "@sothoth/graph");

    expect(validateScopeBom(bom)).toContainEqual({
      code: "sothoth.release-bom/required-member-missing",
      subject: "@sothoth/graph",
    });
  });

  test("rejects unknown top-level fields", async () => {
    const bom = { ...(await readScopeBom()), surprise: true };
    expect(validateScopeBom(bom)).toContainEqual({
      code: "sothoth.release-bom/unknown-field",
      subject: "surprise",
    });
  });

  test("rejects a required member at the wrong version", async () => {
    const bom = structuredClone(await readScopeBom());
    bom.members[0] = { ...bom.members[0], version: "0.2.0" };
    expect(validateScopeBom(bom)).toContainEqual({
      code: "sothoth.release-bom/version-mismatch",
      subject: bom.members[0]?.id,
    });
  });
});
