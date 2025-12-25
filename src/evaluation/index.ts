export type { Trial, Evaluation } from '@/evaluation/result';
export type { Stats, DetailAggregation, SummaryAggregation, Summary, AccuracyData, TimingData } from '@/evaluation/aggregator';
export {
  calculateStats,
  aggregateForDetail,
  aggregateForSummary,
  toAccuracyDataFromDetail,
  toAccuracyDataFromSummary,
  toTimingData,
} from '@/evaluation/aggregator';
export type { EvaluationFilter } from '@/evaluation/evaluations';
export { Evaluations } from '@/evaluation/evaluations';
