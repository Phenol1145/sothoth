/**
 * SARIF 2.1.0 machine-document renderer: one deterministic SARIF log per
 * invocation, diagnostics as results, nothing else on the channel. Levels
 * map from the closed severity set (`error`/`warning`) and messages carry
 * the diagnostic code and subjects; the invocation record rides in the run
 * property bag; no timestamps or environment-derived bytes enter the
 * document.
 */

import type { StructuredDiagnosticV1 } from "@sothoth/sdk/diagnostics";
import type { CliInvocationResultV1 } from "./render-json.js";

interface SarifResultV1 {
  readonly ruleId: string;
  readonly level: "error" | "warning";
  readonly message: { readonly text: string };
}

const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";

/** Renders one SARIF 2.1.0 document from the invocation record. */
export function renderSarifDocumentV1(document: CliInvocationResultV1): string {
  const results: readonly SarifResultV1[] = document.diagnostics.map((diagnostic) => ({
    ruleId: diagnostic.code,
    level: diagnostic.severity === "warning" ? "warning" : "error",
    message: { text: `${diagnostic.code}: ${diagnostic.subjects.join(", ")}` },
  }));
  return `${JSON.stringify(
    {
      $schema: SARIF_SCHEMA,
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "sothoth",
              version: "0.1.0",
              informationUri: "https://github.com/Phenol1145/sothoth",
            },
          },
          properties: {
            "sothoth/command": document.command,
            "sothoth/outcome": document.outcome,
            "sothoth/exitCode": document.exitCode,
            "sothoth/result": document.result,
          },
          results,
        },
      ],
    },
    null,
    2,
  )}\n`;
}
