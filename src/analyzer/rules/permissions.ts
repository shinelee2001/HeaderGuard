import type { AnalyzeHeadersInput, Finding, Severity } from "../types";
import { getHeaderValues, getCanonicalHeaderValue } from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzePermissionsPolicy(input: AnalyzeHeadersInput): Finding {
  const observedValues = getHeaderValues(input.rawHeaders, "permissions-policy");
  const canonicalValue = getCanonicalHeaderValue(
    input.rawHeaders,
    "permissions-policy"
  );

  if (observedValues.length === 0) {
    return makeFinding({
      key: "permissions_policy",
      title: "Permissions-Policy",
      category: "tier1",
      status: "missing_or_weak",
      severity: "moderate",
      scoreEarned: 0,
      scorePossible: SCORES.PERMISSIONS,
      observedValues,
      shortExplanation: "Permissions-Policy is missing.",
      riskInterpretation:
        "Without an explicit permissions policy, browser feature access is less clearly constrained at the document level.",
      remediation:
        "Define a Permissions-Policy and explicitly disable or scope features that the application does not need.",
      deductionReasons: ["Missing Permissions-Policy header."],
      rawEvidence: {},
    });
  }

  let score = 4;
  const reasons: string[] = [];

  const restrictiveMarkers = ["=()", "=(self)", "=(\"self\")"];
  const hasRestrictiveMarker = restrictiveMarkers.some((marker) =>
    canonicalValue.includes(marker)
  );

  if (hasRestrictiveMarker) {
    score = 10;
  } else if (canonicalValue.includes("*")) {
    score = 3;
    reasons.push("Permissions-Policy appears broad or permissive.");
  } else {
    score = 7;
    reasons.push("Permissions-Policy is present but not clearly restrictive.");
  }

  const status =
    score >= 9 ? "good" : score >= 5 ? "needs_improvement" : "missing_or_weak";

  const severity: Severity = score >= 9 ? "info" : "moderate";

  return makeFinding({
    key: "permissions_policy",
    title: "Permissions-Policy",
    category: "tier1",
    status,
    severity,
    scoreEarned: score,
    scorePossible: SCORES.PERMISSIONS,
    observedValues,
    shortExplanation:
      score >= 9
        ? "Permissions-Policy is present with restrictive-looking feature controls."
        : score >= 5
        ? "Permissions-Policy is present but could be tighter."
        : "Permissions-Policy appears weak.",
    riskInterpretation:
      "Permissions-Policy can reduce unnecessary browser feature exposure for embedded or top-level contexts.",
    remediation:
      "Explicitly disable features not required by the application and scope allowed features narrowly.",
    deductionReasons: reasons,
    rawEvidence: {
      canonicalValue,
    },
  });
}