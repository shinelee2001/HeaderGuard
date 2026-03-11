import type { AnalyzeHeadersInput, Finding } from "../types";
import { getHeaderValues, getCanonicalHeaderValue } from "../normalize";
import { SCORES } from "../scoring";
import { makeFinding } from "./_shared";

export function analyzeXContentTypeOptions(input: AnalyzeHeadersInput): Finding {
  const observedValues = getHeaderValues(input.rawHeaders, "x-content-type-options");
  const canonicalValue = getCanonicalHeaderValue(
    input.rawHeaders,
    "x-content-type-options"
  ).toLowerCase();

  if (observedValues.length === 0) {
    return makeFinding({
      key: "x_content_type_options",
      title: "X-Content-Type-Options",
      category: "tier2",
      status: "missing_or_weak",
      severity: "moderate",
      scoreEarned: 0,
      scorePossible: SCORES.XCTO,
      observedValues,
      shortExplanation: "X-Content-Type-Options is missing.",
      riskInterpretation:
        "Without nosniff, browser MIME handling may be less constrained for certain resource interpretations.",
      remediation: "Set X-Content-Type-Options: nosniff.",
      deductionReasons: ["Missing X-Content-Type-Options header."],
      rawEvidence: {},
    });
  }

  const good = canonicalValue.includes("nosniff");

  return makeFinding({
    key: "x_content_type_options",
    title: "X-Content-Type-Options",
    category: "tier2",
    status: good ? "good" : "missing_or_weak",
    severity: good ? "info" : "moderate",
    scoreEarned: good ? SCORES.XCTO : 0,
    scorePossible: SCORES.XCTO,
    observedValues,
    shortExplanation: good
      ? "X-Content-Type-Options is set to nosniff."
      : "X-Content-Type-Options is present but not set to nosniff.",
    riskInterpretation:
      "nosniff helps reduce some MIME confusion behaviors in browsers.",
    remediation: "Use X-Content-Type-Options: nosniff.",
    deductionReasons: good ? [] : ["Header value is not nosniff."],
    rawEvidence: {
      canonicalValue,
    },
  });
}