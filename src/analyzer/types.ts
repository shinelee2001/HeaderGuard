export type HeaderMap = Record<string, string[]>;

export type FindingStatus =
  | "good"
  | "needs_improvement"
  | "missing_or_weak"
  | "informational";

export type Severity = "critical" | "moderate" | "info";

export type FindingCategory = "tier1" | "tier2" | "informational";

export type Grade = "A" | "B" | "C" | "D" | "F";

export type ScoreMode = "raw" | "calibrated";

export type ScoreCalibrationMeta = {
  profile: string;
  method: "zscore" | "percentile";
  baselineMean: number;
  baselineStd?: number;
  percentile?: number;
};

export type ScoreResult = {
  rawScore: number;
  calibratedScore: number;
  grade: Grade;
  mode: ScoreMode;
  calibrationMeta?: ScoreCalibrationMeta;
};

export type Finding = {
  key: string;
  title: string;
  category: FindingCategory;
  status: FindingStatus;
  severity: Severity;
  scoreEarned: number;
  scorePossible: number;
  observedValues: string[];
  shortExplanation: string;
  riskInterpretation: string;
  remediation: string;
  deductionReasons: string[];
  rawEvidence?: Record<string, unknown>;
};

export type AnalysisMeta = {
  mainFrameOnly: true;
  localOnly: true;
  notes: string[];
};

export type AnalysisResult = {
  version: string;
  analyzedAt: string;
  tabId: number;
  url: string;
  origin: string;
  scheme: "http" | "https" | "other";
  score: number;
  rawScore: number;
  grade: Grade;
  scoreMode: ScoreMode;
  calibrationMeta?: ScoreCalibrationMeta;
  summary: string;
  topRisks: string[];
  findings: Finding[];
  rawHeaders: HeaderMap;
  meta: AnalysisMeta;
};

export type AnalyzeHeadersInput = {
  version: string;
  analyzedAt: string;
  tabId: number;
  url: string;
  origin: string;
  scheme: "http" | "https" | "other";
  rawHeaders: HeaderMap;
  notes: string[];
};