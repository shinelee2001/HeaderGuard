import type { AnalyzeHeadersInput, Finding, Severity } from "../types";
import { getHeaderValues, parseDirectives } from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzeClickjacking(input: AnalyzeHeadersInput): Finding {
  const xfoValues = getHeaderValues(input.rawHeaders, "x-frame-options");
  const cspValues = getHeaderValues(input.rawHeaders, "content-security-policy");
  const observedValues = [...xfoValues, ...cspValues];

  const xfoCanonical = xfoValues.join(", ").toLowerCase();
  const cspCanonical = cspValues.join("; ");
  const directives = parseDirectives(cspCanonical);
  const frameAncestors = directives.get("frame-ancestors") ?? [];

  let score = 0;
  const reasons: string[] = [];

  const strongXfo =
    xfoCanonical.includes("deny") || xfoCanonical.includes("sameorigin");
  const strongFrameAncestors =
    frameAncestors.includes("'none'") || frameAncestors.includes("'self'");

  if (strongXfo) score = Math.max(score, 10);
  if (strongFrameAncestors) score = Math.max(score, 15);

  if (!strongXfo && xfoValues.length > 0) {
    score = Math.max(score, 5);
    reasons.push("X-Frame-Options is present but not clearly strong.");
  }

  if (!strongFrameAncestors && frameAncestors.length > 0) {
    score = Math.max(score, 8);
    reasons.push("frame-ancestors is present but not clearly restrictive.");
  }

  if (!strongXfo && !strongFrameAncestors) {
    reasons.push("No strong clickjacking defense signal detected.");
  }

  const status =
    score >= 15 ? "good" : score >= 8 ? "needs_improvement" : "missing_or_weak";

  const severity: Severity =
    score >= 15 ? "info" : score >= 8 ? "moderate" : "critical";

  return makeFinding({
    key: "clickjacking_defense",
    title: "Clickjacking Defense",
    category: "tier1",
    status,
    severity,
    scoreEarned: score,
    scorePossible: SCORES.CLICKJACKING,
    observedValues,
    shortExplanation:
      score >= 15
        ? "A strong framing restriction signal was detected."
        : score >= 8
        ? "Some framing protection exists, but it could be stronger."
        : "No strong clickjacking protection signal was detected.",
    riskInterpretation:
      "Framing restrictions help limit whether other sites can embed this page in potentially deceptive UI contexts.",
    remediation:
      "Prefer a restrictive CSP frame-ancestors policy, and use X-Frame-Options as legacy defense where appropriate.",
    deductionReasons: reasons,
    rawEvidence: {
      xFrameOptions: xfoValues,
      frameAncestors,
    },
  });
}