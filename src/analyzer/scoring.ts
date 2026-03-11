import type { Finding, Grade } from "./types";
import { clamp } from "./normalize";

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

export function computeTotalScore(findings: Finding[]): number {
  const rawScore = findings.reduce((sum, finding) => sum + finding.scoreEarned, 0);
  return clamp(Math.round(rawScore), 0, 100);
}