import type { Finding, Grade, ScoreMode, ScoreResult } from "./types";
import { clamp } from "./normalize";
import { DEFAULT_CALIBRATION_PROFILE } from "./calibration-profile";
import { applyCalibration } from "./calibration";


export const SCORES = {
  CSP: 30,
  HSTS: 20,
  CLICKJACKING: 15,
  REFERRER: 10,
  PERMISSIONS: 10,
  XCTO: 5,
  CROSS_ORIGIN: 10,
} as const;

export function toGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function computeRawScore(findings: Finding[]): number {
  const rawScore = findings.reduce((sum, finding) => sum + finding.scoreEarned, 0);
  return clamp(Math.round(rawScore), 0, 100);
}

export function computeTotalScore(findings: Finding[]): number {
  return computeRawScore(findings);
}

export function computeScoreResult(
  findings: Finding[],
  mode: ScoreMode = "calibrated",
): ScoreResult {
  const rawScore = computeRawScore(findings);

  if (mode === "raw") {
    return {
      rawScore,
      calibratedScore: rawScore,
      grade: toGrade(rawScore),
      mode: "raw",
    };
  }

  const calibrated = applyCalibration(rawScore, DEFAULT_CALIBRATION_PROFILE);

  return {
    rawScore,
    calibratedScore: calibrated.score,
    grade: toGrade(calibrated.score),
    mode: "calibrated",
    calibrationMeta: {
      profile: DEFAULT_CALIBRATION_PROFILE.profile,
      method: DEFAULT_CALIBRATION_PROFILE.method,
      baselineMean: DEFAULT_CALIBRATION_PROFILE.stats.mean,
      baselineStd: DEFAULT_CALIBRATION_PROFILE.stats.std,
      percentile: calibrated.percentile,
    },
  };
}