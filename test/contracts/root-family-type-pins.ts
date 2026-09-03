/**
 * Compile-time pins for the accepted family homes of the document, graph,
 * and planning contract names.
 *
 * This module is typechecked by `tsc -b` through `test/tsconfig.json`; it is
 * not a vitest suite. The imports resolve the published package specifiers,
 * so their types come through each package's exports map: a name that loses
 * its accepted family home (or the root's aggregation of a family) breaks
 * `npm run typecheck`.
 */

import type { StructuredDiagnosticV1 } from "@sothoth/contracts";
import type {
  DocumentContractV1,
  GraphEdgeV1,
  GraphNodeV1,
  GraphNodeWaveV1,
  SectionIdV1,
} from "@sothoth/contracts/schema";
import type {
  ChangeDispositionV1,
  ScheduleSolutionV1,
  UnsupportedSchedulingDimensionV1,
} from "@sothoth/contracts/projection";

export const graphNodePin: GraphNodeV1 = { id: "graph-node-pin" };

export const graphEdgePin: GraphEdgeV1 = {
  role: "depends-on",
  fromNodeId: "graph-node-pin",
  toNodeId: "graph-edge-pin",
};

export const graphNodeWavePin: GraphNodeWaveV1 = { nodeId: "graph-node-pin", wave: 0 };

export const sectionIdPin: SectionIdV1 = "purpose";

export const documentContractPin: DocumentContractV1 = {
  schema: "sothoth.document-contract/v1",
  contractId: "DOC-CONTRACT-PIN",
  contractRevision: 1,
  description: "compile-time pin",
  documentKind: "design-dossier",
  sections: { ordering: "declared", requiredSectionIds: ["purpose"] },
  topics: { closedSet: [], resolutions: [], inheritanceApplicability: [] },
  references: { exactFields: [] },
  criteria: { minimumPerRegistration: 1, fields: [] },
};

export const scheduleSolutionPin: ScheduleSolutionV1 = {
  solutionIdentity: "sothoth.planning/schedule-solution@1",
  waves: [[{ nodeId: "graph-node-pin", wave: 0 }]],
};

export const changeDispositionPin: ChangeDispositionV1 = "revise";

export const unsupportedDimensionPin: UnsupportedSchedulingDimensionV1 = "time";

export const rootDiagnosticPin: StructuredDiagnosticV1 = {
  code: "sothoth.evidence/unresolved",
  origin: "@sothoth/core",
  category: "evidence",
  phase: "validation",
  verdict: "unresolved",
  severity: "error",
  ruleId: "required-evidence",
  location: null,
  subjects: ["evidence:test"],
  parameters: {},
  causes: [],
  help: [],
  digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
};
