import { clamp } from "./normalize";
import type { CalibrationProfile } from "./calibration-types";

export type CalibrationResult = {
  score: number;
  percentile?: number;
};

function empiricalPercentile(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 0.5;

  let count = 0;
  for (const score of sorted) {
    if (score <= value) {
      count += 1;
      continue;
    }

    break;
  }

  return count / sorted.length;
}

function mapPercentileToScore(percentile: number): number {
  const score = 40 + percentile * 55;
  return clamp(Math.round(score), 0, 100);
}

function applyPercentileCalibration(
  rawScore: number,
  profile: CalibrationProfile,
): CalibrationResult {
  const percentile = empiricalPercentile(rawScore, profile.sortedRawScores);
  return {
    score: mapPercentileToScore(percentile),
    percentile,
  };
}

function applyZScoreCalibration(
  rawScore: number,
  profile: CalibrationProfile,
): CalibrationResult {
  const baselineMean = profile.stats.mean;
  const baselineStd = profile.stats.std || 1;

  const targetMean = profile.target?.mean ?? 70;
  const targetStd = profile.target?.std ?? 15;

  const z = (rawScore - baselineMean) / baselineStd;
  const score = clamp(Math.round(targetMean + z * targetStd), 0, 100);

  return { score };
}

export function applyCalibration(
  rawScore: number,
  profile: CalibrationProfile,
): CalibrationResult {
  if (profile.method === "zscore") {
    return applyZScoreCalibration(rawScore, profile);
  }

  return applyPercentileCalibration(rawScore, profile);
}
