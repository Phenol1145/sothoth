/**
 * Planning-domain contracts.
 *
 * Internal implementation file of the accepted `@project-sothoth/contracts/projection`
 * family, re-exported by `projection.ts` and never exposed under its own
 * subpath. Scheduling has one non-authoritative Schedule Solution identity;
 * at `0.1.0` only dependency validation and deterministic wave assignment are
 * implemented capabilities and every other scheduling axis stays an explicit
 * unsupported dimension.
 */

import type { GraphNodeWaveV1 } from "./graphs.js";

/** The single Schedule Solution identity. */
export const SCHEDULE_SOLUTION_IDENTITY_V1 = "sothoth.planning/schedule-solution@1";

/** Scheduling axes that stay explicitly unsupported at `0.1.0`. */
export const UNSUPPORTED_SCHEDULING_DIMENSIONS_V1 = [
  "assignment",
  "gate",
  "placement",
  "release-train",
  "resource",
  "time",
] as const;

/** An unsupported scheduling dimension. */
export type UnsupportedSchedulingDimensionV1 = (typeof UNSUPPORTED_SCHEDULING_DIMENSIONS_V1)[number];

/** The closed disposition set a Change Plan Projection may assign. */
export const CHANGE_DISPOSITIONS_V1 = [
  "revise",
  "revalidate",
  "rebuild",
  "invalidate-evidence",
  "review-required",
  "unchanged",
] as const;

/** A change disposition member of `CHANGE_DISPOSITIONS_V1`. */
export type ChangeDispositionV1 = (typeof CHANGE_DISPOSITIONS_V1)[number];

/** The non-authoritative schedule solution over deterministic change waves. */
export interface ScheduleSolutionV1 {
  readonly solutionIdentity: typeof SCHEDULE_SOLUTION_IDENTITY_V1;
  readonly waves: readonly (readonly GraphNodeWaveV1[])[];
}
