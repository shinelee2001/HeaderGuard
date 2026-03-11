import type { AnalyzeHeadersInput, Finding, Severity } from "../types";
import { getHeaderValues } from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzeHsts(input: AnalyzeHeadersInput): Finding {
  const observedValues = getHeaderValues(input.rawHeaders, "strict-transport-security");
  const canonicalValue = observedValues.join(", ");
  const reasons: string[] = [];

  if (input.scheme !== "https") {
    return makeFinding({
      key: "strict_transport_security",
      title: "Strict-Transport-Security",
      category: "tier1",
      status: "missing_or_weak",
      severity: "moderate",
      scoreEarned: 0,
      scorePossible: SCORES.HSTS,
      observedValues,
      shortExplanation: "HSTS cannot provide full protection until the site is served over HTTPS.",
      riskInterpretation:
        "Without HTTPS delivery, the browser cannot reliably receive or enforce HSTS for this page.",
      remediation:
        "Serve the site over HTTPS first, then add a strong Strict-Transport-Security policy.",
      deductionReasons: ["Page is not HTTPS; HSTS protection is inherently limited on HTTP."],
      rawEvidence: {
        scheme: input.scheme,
        headerPresent: observedValues.length > 0,
        canonicalValue,
      },
    });
  }

  if (observedValues.length === 0) {
    return makeFinding({
      key: "strict_transport_security",
      title: "Strict-Transport-Security",
      category: "tier1",
      status: "missing_or_weak",
      severity: "critical",
      scoreEarned: 0,
      scorePossible: SCORES.HSTS,
      observedValues,
      shortExplanation: "HSTS is missing.",
      riskInterpretation:
        "This may allow insecure first-contact downgrade scenarios before the browser learns to require HTTPS.",
      remediation:
        "Add Strict-Transport-Security with a long max-age and consider includeSubDomains after validation.",
      deductionReasons: ["Missing Strict-Transport-Security header on HTTPS response."],
      rawEvidence: {
        scheme: input.scheme,
        headerPresent: false,
      },
    });
  }

  let score = 5;
  let maxAge: number | null = null;
  let includeSubDomains = false;

  try {
    const lower = canonicalValue.toLowerCase();
    const maxAgeMatch = lower.match(/max-age\s*=\s*(\d+)/);

    if (!maxAgeMatch) {
      reasons.push("HSTS exists but max-age could not be parsed.");
    } else {
      maxAge = Number.parseInt(maxAgeMatch[1], 10);

      if (Number.isNaN(maxAge)) {
        maxAge = null;
        reasons.push("HSTS max-age appears malformed.");
      } else if (maxAge < 86400) {
        score = 6;
        reasons.push("HSTS max-age is short.");
      } else if (maxAge >= 31536000) {
        score = 16;
      } else if (maxAge >= 15552000) {
        score = 14;
      } else {
        score = 10;
        reasons.push("HSTS max-age is present but not long-term.");
      }
    }

    includeSubDomains = /\bincludesubdomains\b/.test(lower);
    if (includeSubDomains) score += 2;

    if ((maxAge ?? 0) >= 31536000 && includeSubDomains) {
      score += 2;
    } else {
      reasons.push("HSTS is not preload-compatible yet.");
    }
  } catch {
    reasons.push("HSTS parsing failed; partial result shown.");
  }

  const status =
    score >= 16 ? "good" : score >= 8 ? "needs_improvement" : "missing_or_weak";

  const severity: Severity =
    score >= 16 ? "info" : score >= 8 ? "moderate" : "critical";

  return makeFinding({
    key: "strict_transport_security",
    title: "Strict-Transport-Security",
    category: "tier1",
    status,
    severity,
    scoreEarned: score,
    scorePossible: SCORES.HSTS,
    observedValues,
    shortExplanation:
      score >= 16
        ? "HSTS is present with a strong policy."
        : score >= 8
        ? "HSTS is present but could be stronger."
        : "HSTS appears weak or malformed.",
    riskInterpretation:
      score >= 16
        ? "The browser receives a strong signal to prefer HTTPS for future visits."
        : "A partial HSTS policy helps, but shorter lifetimes or missing flags reduce protection strength.",
    remediation:
      "Use a long max-age (ideally at least 31536000), validate includeSubDomains, and consider preload compatibility where appropriate.",
    deductionReasons: reasons,
    rawEvidence: {
      canonicalValue,
      maxAge,
      includeSubDomains,
    },
  });
}