import type { AnalyzeHeadersInput, Finding, Severity } from "../types";
import {
  getHeaderValues,
  parseDirectives,
  safeIncludesAny,
  clamp,
} from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzeCsp(input: AnalyzeHeadersInput): Finding {
  const observedValues = getHeaderValues(input.rawHeaders, "content-security-policy");
  const canonicalValue = observedValues.join("; ");
  const reasons: string[] = [];

  if (observedValues.length === 0) {
    return makeFinding({
      key: "content_security_policy",
      title: "Content-Security-Policy",
      category: "tier1",
      status: "missing_or_weak",
      severity: "critical",
      scoreEarned: 0,
      scorePossible: SCORES.CSP,
      observedValues,
      shortExplanation: "No Content-Security-Policy was detected.",
      riskInterpretation:
        "Without CSP, the browser receives fewer signals to constrain script execution, framing, and related content behaviors.",
      remediation:
        "Add a Content-Security-Policy with restrictive defaults and tighten script, object, base-uri, and frame-ancestors directives.",
      deductionReasons: ["Missing Content-Security-Policy header."],
      rawEvidence: {
        headerPresent: false,
      },
    });
  }

  let score = 12;
  let directives = new Map<string, string[]>();

  try {
    directives = parseDirectives(canonicalValue);

    const defaultSrc = directives.get("default-src") ?? [];
    const scriptSrc = directives.get("script-src") ?? [];
    const objectSrc = directives.get("object-src") ?? [];
    const baseUri = directives.get("base-uri") ?? [];
    const frameAncestors = directives.get("frame-ancestors") ?? [];

    const hasDefaultSelf = defaultSrc.includes("'self'");
    const hasScriptNonceOrHash = scriptSrc.some((token) =>
      /^'nonce-|^'sha(256|384|512)-/.test(token)
    );
    const hasUnsafeInline = safeIncludesAny(canonicalValue, ["'unsafe-inline'"]);
    const hasUnsafeEval = safeIncludesAny(canonicalValue, ["'unsafe-eval'"]);
    const hasWildcard = /\*/.test(canonicalValue);
    const objectNone = objectSrc.includes("'none'");
    const baseUriRestricted =
      baseUri.includes("'self'") || baseUri.includes("'none'");
    const frameAncestorsPresent = frameAncestors.length > 0;
    const frameAncestorsRestrictive =
      frameAncestors.includes("'self'") ||
      frameAncestors.includes("'none'") ||
      frameAncestors.includes("https:");

    if (hasDefaultSelf) score += 5;
    else reasons.push("CSP does not clearly set default-src 'self'.");

    if (hasScriptNonceOrHash) score += 5;
    else reasons.push("CSP does not show nonce/hash-based script trust.");

    if (objectNone) score += 3;
    else reasons.push("CSP is missing object-src 'none'.");

    if (baseUriRestricted) score += 2;
    else reasons.push("CSP is missing a restrictive base-uri.");

    if (frameAncestorsPresent && frameAncestorsRestrictive) score += 3;
    else reasons.push("CSP is missing or weakening frame-ancestors.");

    if (!hasUnsafeInline) score += 2;
    else {
      score -= 8;
      reasons.push("CSP includes unsafe-inline.");
    }

    if (!hasUnsafeEval) score += 2;
    else {
      score -= 6;
      reasons.push("CSP includes unsafe-eval.");
    }

    if (hasWildcard) {
      score -= 6;
      reasons.push("CSP includes broad wildcard source expressions.");
    }

    if (!directives.has("default-src") && !directives.has("script-src")) {
      score -= 4;
      reasons.push("CSP lacks clear restrictive fetch directives.");
    }
  } catch {
    reasons.push("CSP parsing failed; partial heuristic result shown.");
  }

  score = clamp(score, 0, SCORES.CSP);

  const status =
    score >= 23 ? "good" : score >= 13 ? "needs_improvement" : "missing_or_weak";

  const severity: Severity =
    score >= 23 ? "info" : score >= 13 ? "moderate" : "critical";

  return makeFinding({
    key: "content_security_policy",
    title: "Content-Security-Policy",
    category: "tier1",
    status,
    severity,
    scoreEarned: score,
    scorePossible: SCORES.CSP,
    observedValues,
    shortExplanation:
      score >= 23
        ? "CSP is present and appears reasonably restrictive."
        : score >= 13
        ? "CSP is present but appears permissive in places."
        : "CSP is missing or appears broadly permissive.",
    riskInterpretation:
      "CSP scoring here is heuristic. Certain directives and source expressions can meaningfully affect browser-side content restrictions.",
    remediation:
      "Prefer restrictive defaults, avoid unsafe-inline and unsafe-eval where possible, add object-src 'none', restrict base-uri, and define frame-ancestors deliberately.",
    deductionReasons: reasons,
    rawEvidence: {
      canonicalValue,
      directives: Object.fromEntries(directives.entries()),
    },
  });
}