import type { AnalyzeHeadersInput, Finding, Severity } from "../types";
import { getHeaderValues, getCanonicalHeaderValue } from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzeReferrerPolicy(input: AnalyzeHeadersInput): Finding {
  const observedValues = getHeaderValues(input.rawHeaders, "referrer-policy");
  const canonicalValue = getCanonicalHeaderValue(
    input.rawHeaders,
    "referrer-policy"
  ).toLowerCase();

  if (observedValues.length === 0) {
    return makeFinding({
      key: "referrer_policy",
      title: "Referrer-Policy",
      category: "tier1",
      status: "missing_or_weak",
      severity: "moderate",
      scoreEarned: 0,
      scorePossible: SCORES.REFERRER,
      observedValues,
      shortExplanation: "Referrer-Policy is missing.",
      riskInterpretation:
        "Without an explicit policy, the browser may send more referral information than intended in some navigation or subrequest contexts.",
      remediation:
        "Set a deliberate Referrer-Policy such as strict-origin-when-cross-origin or stricter where compatible.",
      deductionReasons: ["Missing Referrer-Policy header."],
      rawEvidence: {},
    });
  }

  let score = 3;
  const reasons: string[] = [];

  if (
    canonicalValue.includes("strict-origin") ||
    canonicalValue.includes("strict-origin-when-cross-origin") ||
    canonicalValue.includes("same-origin") ||
    canonicalValue.includes("no-referrer")
  ) {
    score = 10;
  } else if (
    canonicalValue.includes("origin") ||
    canonicalValue.includes("origin-when-cross-origin")
  ) {
    score = 7;
    reasons.push("Referrer-Policy is present but could be stricter.");
  } else if (
    canonicalValue.includes("unsafe-url") ||
    canonicalValue.includes("no-referrer-when-downgrade")
  ) {
    score = 2;
    reasons.push("Referrer-Policy appears permissive.");
  }

  const status =
    score >= 9 ? "good" : score >= 5 ? "needs_improvement" : "missing_or_weak";

  const severity: Severity = score >= 9 ? "info" : "moderate";

  return makeFinding({
    key: "referrer_policy",
    title: "Referrer-Policy",
    category: "tier1",
    status,
    severity,
    scoreEarned: score,
    scorePossible: SCORES.REFERRER,
    observedValues,
    shortExplanation:
      score >= 9
        ? "Referrer-Policy appears appropriately restrictive."
        : score >= 5
        ? "Referrer-Policy is present but not especially strict."
        : "Referrer-Policy appears weak.",
    riskInterpretation:
      "Referrer policies influence how much URL context may be shared during browser requests.",
    remediation:
      "Use strict-origin-when-cross-origin or a stricter policy where application behavior allows it.",
    deductionReasons: reasons,
    rawEvidence: {
      canonicalValue,
    },
  });
}