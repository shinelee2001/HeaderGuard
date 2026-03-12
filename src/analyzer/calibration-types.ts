export type CalibrationMethod = "zscore" | "percentile";

export type CalibrationProfile = {
  profile: string;
  method: CalibrationMethod;
  stats: {
    count: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
  };
  sortedRawScores: number[];
  target?: {
    mean: number;
    std: number;
  };
};