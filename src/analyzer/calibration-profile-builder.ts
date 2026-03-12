import type { CalibrationProfile } from "./calibration-types";

export const DEFAULT_BASELINE_PROFILE_NAME = "web_baseline_v1" as const;
export const DEFAULT_BASELINE_METHOD = "percentile" as const;
export const DEFAULT_BASELINE_TARGET = {
  mean: 70,
  std: 15,
} as const;

function sortAscending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot compute mean of an empty baseline.");
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(sortedValues: readonly number[]): number {
  if (sortedValues.length === 0) {
    throw new Error("Cannot compute median of an empty baseline.");
  }

  const mid = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }

  return sortedValues[mid];
}

function standardDeviation(values: readonly number[], avg: number): number {
  if (values.length === 0) {
    throw new Error("Cannot compute standard deviation of an empty baseline.");
  }

  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildCalibrationProfile(
  rawScores: readonly number[],
  options?: {
    profile?: string;
    method?: "percentile" | "zscore";
    target?: { mean: number; std: number };
  },
): CalibrationProfile {
  if (rawScores.length === 0) {
    throw new Error("Calibration baseline must contain at least one score.");
  }

  const sortedRawScores = sortAscending(rawScores);
  const avg = mean(sortedRawScores);
  const med = median(sortedRawScores);
  const std = standardDeviation(sortedRawScores, avg);

  return {
    profile: options?.profile ?? DEFAULT_BASELINE_PROFILE_NAME,
    method: options?.method ?? DEFAULT_BASELINE_METHOD,
    stats: {
      count: sortedRawScores.length,
      mean: roundTo(avg, 2),
      median: roundTo(med, 2),
      std: roundTo(std, 2),
      min: sortedRawScores[0],
      max: sortedRawScores[sortedRawScores.length - 1],
    },
    sortedRawScores,
    target: {
      mean: options?.target?.mean ?? DEFAULT_BASELINE_TARGET.mean,
      std: options?.target?.std ?? DEFAULT_BASELINE_TARGET.std,
    },
  };
}
