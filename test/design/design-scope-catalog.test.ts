import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { validateDesignScopeCatalog } from "../../scripts/check-design-scope-catalog.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

interface CatalogCandidate {
  componentId: string;
  designId: string;
  artifactType: string;
  designRequirement: string;
  coverage: string;
  owner: string;
}

type DesignScopeCatalog = Record<string, unknown> & {
  candidates: CatalogCandidate[];
  status: string;
};

async function readCatalog(): Promise<DesignScopeCatalog> {
  return JSON.parse(await readFile(`${root}/docs/design/v0.1.0-design-scope-catalog.json`, "utf8"));
}

describe("Sothoth v0.1 Design Scope Catalog", () => {
  test("accepts the repository Design Scope Catalog", async () => {
    expect(validateDesignScopeCatalog(await readCatalog())).toEqual([]);
  });

  test.each(["members", "gates", "candidateDigest", "tarball"])(
    "rejects release-only field %s",
    async (field) => {
      expect(validateDesignScopeCatalog({ ...(await readCatalog()), [field]: [] }))
        .toContainEqual({ code: "sothoth.design-scope/release-field-forbidden", subject: field });
    },
  );

  test("does not claim that intended candidates are admitted release members", async () => {
    const catalog = await readCatalog();
    expect(catalog.status).toBe("working");
    const designCoverageStates = new Set(["complete", "partial", "conflicting", "obsolete", "missing"]);
    expect(catalog.candidates.every((candidate) => designCoverageStates.has(candidate.coverage))).toBe(true);
  });

  test("rejects a Design Scope Catalog that omits an intended package candidate", async () => {
    const catalog = structuredClone(await readCatalog());
    catalog.candidates = catalog.candidates.filter(
      (candidate) => candidate.componentId !== "@sothoth/graph",
    );

    expect(validateDesignScopeCatalog(catalog)).toContainEqual({
      code: "sothoth.design-scope/candidate-missing",
      subject: "@sothoth/graph",
    });
  });

  test("rejects unknown top-level fields", async () => {
    const catalog = { ...(await readCatalog()), surprise: true };
    expect(validateDesignScopeCatalog(catalog)).toContainEqual({
      code: "sothoth.design-scope/unknown-field",
      subject: "surprise",
    });
  });

  test("rejects a catalog published at the wrong revision", async () => {
    const catalog = structuredClone(await readCatalog());
    catalog.catalogRevision = 2;
    expect(validateDesignScopeCatalog(catalog)).toContainEqual({
      code: "sothoth.design-scope/catalog-revision-mismatch",
      subject: "catalogRevision",
    });
  });
});
