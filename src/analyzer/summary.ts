import type { Finding, Severity } from "./types";

function severityRank(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "moderate") return 2;
  return 1;
}

export function buildSummary(score: number, findings: Finding[]): string {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const moderateCount = findings.filter((finding) => finding.severity === "moderate").length;

  if (score >= 90) {
    return "The page shows a strong set of browser-facing security header signals.";
  }

  if (criticalCount > 0) {
    return "Security posture is meaningfully limited by one or more missing or weak core header signals.";
  }

  if (moderateCount > 0) {
    return "The page shows some useful security signals, but several headers appear incomplete or only moderately strong.";
  }

  return "The page presents a mixed but generally understandable browser security header posture.";
}

export function buildTopRisks(findings: Finding[]): string[] {
  return findings
    .filter((finding) => finding.severity !== "info")
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;

      const scoreGapA = a.scorePossible - a.scoreEarned;
      const scoreGapB = b.scorePossible - b.scoreEarned;
      return scoreGapB - scoreGapA;
    })
    .slice(0, 3)
    .map((finding) => `${finding.title}: ${finding.shortExplanation}`);
}