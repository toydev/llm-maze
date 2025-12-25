import { Evaluation } from '@/evaluation/result';
import { Maze } from '@/maze/maze';

// Statistics calculation
export type Stats = {
  avg: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
};

export function calculateStats(times: number[]): Stats {
  if (times.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  }
  const sorted = [...times].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = sorted.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  return { avg, median, min, max, stdDev };
}

// Detail aggregation (for single model/maze/strategy combination)
export type DetailAggregation = {
  totalTrials: number;
  positionStats: Map<string, { times: number[]; correctCount: number; totalCount: number }>;
  overallStats: { times: number[]; correctCount: number; totalCount: number };
};

export function aggregateForDetail(evaluations: Evaluation[]): DetailAggregation {
  const positionStats = new Map<string, { times: number[]; correctCount: number; totalCount: number }>();
  const overallStats = { times: [] as number[], correctCount: 0, totalCount: 0 };

  for (const evaluation of evaluations) {
    for (const trial of evaluation.trials) {
      const key = `${trial.position.x},${trial.position.y}`;
      if (!positionStats.has(key)) {
        positionStats.set(key, { times: [], correctCount: 0, totalCount: 0 });
      }
      const stats = positionStats.get(key)!;
      if (trial.timeMs) {
        stats.times.push(trial.timeMs);
        overallStats.times.push(trial.timeMs);
      }
      if (trial.isCorrect) {
        stats.correctCount++;
        overallStats.correctCount++;
      }
      stats.totalCount++;
      overallStats.totalCount++;
    }
  }

  return { totalTrials: evaluations.length, positionStats, overallStats };
}

// Summary aggregation (for multiple models/mazes/strategies)
export type SummaryAggregation = {
  totalRuns: number;
  totalCorrectMoves: number;
  totalPositions: number;
  averageAccuracy: number;
  totalTimeMs: number;
  averageTimePerPositionMs: number;
  positionalCorrectCounts: Map<string, number>;
  positionalTotalCounts: Map<string, number>;
  mazeLayout: string[];
};

export type Summary = Map<string, Map<string, Map<string, SummaryAggregation>>>;

export async function aggregateForSummary(evaluations: Evaluation[]): Promise<Summary> {
  const summary: Summary = new Map();

  for (const evaluation of evaluations) {
    if (!summary.has(evaluation.modelName)) {
      summary.set(evaluation.modelName, new Map());
    }
    const modelSummary = summary.get(evaluation.modelName)!;

    if (!modelSummary.has(evaluation.strategyName)) {
      modelSummary.set(evaluation.strategyName, new Map());
    }
    const strategySummary = modelSummary.get(evaluation.strategyName)!;

    const mazeFilePath = evaluation.mazeFile.replace(/\\/g, '/');
    if (!strategySummary.has(mazeFilePath)) {
      const maze = await Maze.fromFile(mazeFilePath);
      strategySummary.set(mazeFilePath, {
        totalRuns: 0,
        totalCorrectMoves: 0,
        totalPositions: 0,
        averageAccuracy: 0,
        totalTimeMs: 0,
        averageTimePerPositionMs: 0,
        positionalCorrectCounts: new Map(),
        positionalTotalCounts: new Map(),
        mazeLayout: maze.layout,
      });
    }
    const agg = strategySummary.get(mazeFilePath)!;

    agg.totalRuns++;
    agg.totalCorrectMoves += evaluation.correctMoves;
    agg.totalPositions += evaluation.totalPositions;
    agg.totalTimeMs += evaluation.totalTimeMs ?? 0;

    for (const trial of evaluation.trials) {
      const key = `${trial.position.x},${trial.position.y}`;
      agg.positionalTotalCounts.set(key, (agg.positionalTotalCounts.get(key) ?? 0) + 1);
      if (trial.isCorrect) {
        agg.positionalCorrectCounts.set(key, (agg.positionalCorrectCounts.get(key) ?? 0) + 1);
      }
    }
  }

  for (const modelMap of summary.values()) {
    for (const strategyMap of modelMap.values()) {
      for (const agg of strategyMap.values()) {
        agg.averageAccuracy = agg.totalPositions > 0 ? (agg.totalCorrectMoves / agg.totalPositions) * 100 : 0;
        agg.averageTimePerPositionMs = agg.totalPositions > 0 ? agg.totalTimeMs / agg.totalPositions : 0;
      }
    }
  }

  return summary;
}

// Data conversion for view
export type AccuracyData = Map<string, { correct: number; total: number }>;
export type TimingData = Map<string, number>;

export function toAccuracyDataFromDetail(agg: DetailAggregation): AccuracyData {
  const data = new Map<string, { correct: number; total: number }>();
  for (const [key, stats] of agg.positionStats) {
    data.set(key, { correct: stats.correctCount, total: stats.totalCount });
  }
  return data;
}

export function toAccuracyDataFromSummary(agg: SummaryAggregation): AccuracyData {
  const data = new Map<string, { correct: number; total: number }>();
  for (const [key, total] of agg.positionalTotalCounts) {
    const correct = agg.positionalCorrectCounts.get(key) ?? 0;
    data.set(key, { correct, total });
  }
  return data;
}

export function toTimingData(agg: DetailAggregation): TimingData {
  const data = new Map<string, number>();
  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      data.set(key, stats.times.reduce((a, b) => a + b, 0) / stats.times.length);
    }
  }
  return data;
}
