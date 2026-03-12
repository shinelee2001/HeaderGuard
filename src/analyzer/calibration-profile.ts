import type { CalibrationProfile } from "./calibration-types";

export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = {
  profile: "web_baseline_v1",
  method: "percentile",
  stats: {
    count: 20,
    mean: 44.8,
    median: 45,
    std: 11.2,
    min: 21,
    max: 69,
  },
  sortedRawScores: [
    21, 26, 29, 31, 34, 36, 38, 40, 42, 44, 45, 46, 47, 49, 51, 54, 57, 61,
    65, 69,
  ],
  target: {
    mean: 70,
    std: 15,
  },
};