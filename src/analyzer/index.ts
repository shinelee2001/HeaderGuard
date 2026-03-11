import type { AnalysisResult, AnalyzeHeadersInput, Finding } from "./types";
import { computeTotalScore, toGrade } from "./scoring";
import { buildSummary, buildTopRisks } from "./summary";
import { analyzeCsp } from "./rules/csp";
import { analyzeHsts } from "./rules/hsts";
import { analyzeClickjacking } from "./rules/xfo";
import { analyzeReferrerPolicy } from "./rules/referrer";
import { analyzePermissionsPolicy } from "./rules/permissions";
import { analyzeXContentTypeOptions } from "./rules/xcto";
import { analyzeCrossOriginIsolation } from "./rules/cross-origin";

function runAllRules(input: AnalyzeHeadersInput): Finding[] {
  return [
    analyzeCsp(input),
    analyzeHsts(input),
    analyzeClickjacking(input),
    analyzeReferrerPolicy(input),
    analyzePermissionsPolicy(input),
    analyzeXContentTypeOptions(input),
    analyzeCrossOriginIsolation(input),
  ];
}

export function analyzeHeaders(input: AnalyzeHeadersInput): AnalysisResult {
  const findings = runAllRules(input);
  const score = computeTotalScore(findings);
  const grade = toGrade(score);
  const summary = buildSummary(score, findings);
  const topRisks = buildTopRisks(findings);

  return {
    version: input.version,
    analyzedAt: input.analyzedAt,
    tabId: input.tabId,
    url: input.url,
    origin: input.origin,
    scheme: input.scheme,
    score,
    grade,
    summary,
    topRisks,
    findings,
    rawHeaders: input.rawHeaders,
    meta: {
      mainFrameOnly: true,
      localOnly: true,
      notes: input.notes,
    },
  };
}

export type { AnalyzeHeadersInput } from "./types";