import type { Finding } from "../types";
import { clamp } from "../normalize";

export function makeFinding(
  base: Omit<Finding, "rawEvidence"> & { rawEvidence?: Record<string, unknown> }
): Finding {
  return {
    ...base,
    scoreEarned: clamp(base.scoreEarned, 0, base.scorePossible),
  };
}