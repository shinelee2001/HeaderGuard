import type { AnalyzeHeadersInput, Finding, Severity } from "../types";
import { getCanonicalHeaderValue, getHeaderValues } from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzeCrossOriginIsolation(input: AnalyzeHeadersInput): Finding {
  const coop = getCanonicalHeaderValue(
    input.rawHeaders,
    "cross-origin-opener-policy"
  ).toLowerCase();
  const coep = getCanonicalHeaderValue(
    input.rawHeaders,
    "cross-origin-embedder-policy"
  ).toLowerCase();
  const corp = getCanonicalHeaderValue(
    input.rawHeaders,
    "cross-origin-resource-policy"
  ).toLowerCase();

  const observedValues = [
    ...getHeaderValues(input.rawHeaders, "cross-origin-opener-policy"),
    ...getHeaderValues(input.rawHeaders, "cross-origin-embedder-policy"),
    ...getHeaderValues(input.rawHeaders, "cross-origin-resource-policy"),
  ];

  let score = 0;
  const reasons: string[] = [];

  if (coop === "same-origin") score += 4;
  else if (coop === "same-origin-allow-popups") {
    score += 2;
    reasons.push("COOP is present but not strongest.");
  } else {
    reasons.push("COOP is missing or weak.");
  }

  if (coep === "require-corp") score += 4;
  else if (coep === "credentialless") {
    score += 3;
    reasons.push("COEP is present but not strongest.");
  } else {
    reasons.push("COEP is missing or weak.");
  }

  if (corp === "same-origin") score += 2;
  else if (corp === "same-site" || corp === "cross-origin") {
    score += 1;
    reasons.push("CORP is present but not strongest.");
  } else {
    reasons.push("CORP is missing or weak.");
  }

  const status =
    score >= 8 ? "good" : score >= 4 ? "needs_improvement" : "informational";

  const severity: Severity = score >= 8 ? "info" : "moderate";

  return makeFinding({
    key: "cross_origin_isolation_signals",
    title: "COOP / COEP / CORP",
    category: "tier2",
    status,
    severity,
    scoreEarned: score,
    scorePossible: SCORES.CROSS_ORIGIN,
    observedValues,
    shortExplanation:
      score >= 8
        ? "Strong cross-origin isolation signals were detected."
        : score >= 4
        ? "Some cross-origin isolation signals are present."
        : "Cross-origin isolation signals are limited or absent.",
    riskInterpretation:
      "These headers influence isolation boundaries and resource loading behavior, but their relevance depends on the application’s architecture and goals.",
    remediation:
      "Adopt COOP/COEP/CORP deliberately if your application needs stronger cross-origin isolation characteristics.",
    deductionReasons: reasons,
    rawEvidence: {
      coop,
      coep,
      corp,
    },
  });
}