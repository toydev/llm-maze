export type { PositionResult, EvaluationResult } from '@/evaluation/result';
export type { RunnerOptions, ProgressCallback } from '@/evaluation/runner';
export { runEvaluation } from '@/evaluation/runner';
export type { Stats, DetailAggregation, SummaryAggregation, Summary, AccuracyData, TimingData } from '@/evaluation/aggregator';
export {
  calculateStats,
  aggregateForDetail,
  aggregateForSummary,
  toAccuracyDataFromDetail,
  toAccuracyDataFromSummary,
  toTimingData,
} from '@/evaluation/aggregator';
export type { ResultFilter } from '@/evaluation/results';
export { Results } from '@/evaluation/results';
