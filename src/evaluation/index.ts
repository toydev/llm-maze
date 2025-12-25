export type { PositionResult, EvaluationResult } from '@/evaluation/result';
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
