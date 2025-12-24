import { defineCommand, runMain } from 'citty';

import { EvaluationResult, loadResults } from '@/evaluation';
import { createLogger } from '@/logger/Logger';
import { Maze } from '@/maze/Maze';

import { formatDuration, renderAccuracyGrid, renderTimingGrid } from './view';

const logger = createLogger('detail');

type AggregatedStats = {
  totalTrials: number;
  positionStats: Map<string, { times: number[]; correctCount: number; totalCount: number }>;
  overallStats: { times: number[]; correctCount: number; totalCount: number };
};

function aggregateResults(results: EvaluationResult[]): AggregatedStats {
  const positionStats = new Map<string, { times: number[]; correctCount: number; totalCount: number }>();
  const overallStats = { times: [] as number[], correctCount: 0, totalCount: 0 };

  for (const result of results) {
    for (const posRes of result.results) {
      const key = `${posRes.position.x},${posRes.position.y}`;
      if (!positionStats.has(key)) {
        positionStats.set(key, { times: [], correctCount: 0, totalCount: 0 });
      }
      const stats = positionStats.get(key)!;
      if (posRes.timeMs) {
        stats.times.push(posRes.timeMs);
        overallStats.times.push(posRes.timeMs);
      }
      if (posRes.isCorrect) {
        stats.correctCount++;
        overallStats.correctCount++;
      }
      stats.totalCount++;
      overallStats.totalCount++;
    }
  }

  return { totalTrials: results.length, positionStats, overallStats };
}

function printStatistics(agg: AggregatedStats): void {
  const { times, correctCount, totalCount } = agg.overallStats;
  if (times.length === 0) {
    console.log('\nNo timing data available.');
    return;
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  const variance = times.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  const accuracy = (correctCount / totalCount) * 100;

  console.log(`\n--- Statistics (${agg.totalTrials} trials) ---`);
  console.log(`Total positions: ${totalCount} (${totalCount / agg.totalTrials} per trial)`);
  console.log(`Correct: ${correctCount}/${totalCount} (${accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${formatDuration(sum)}`);
  console.log(`Average: ${formatDuration(avg)}`);
  console.log(`Median: ${formatDuration(median)}`);
  console.log(`Min: ${formatDuration(min)}`);
  console.log(`Max: ${formatDuration(max)}`);
  console.log(`Std Dev: ${formatDuration(stdDev)}`);
}

function toAccuracyData(agg: AggregatedStats): Map<string, { correct: number; total: number }> {
  const data = new Map<string, { correct: number; total: number }>();
  for (const [key, stats] of agg.positionStats) {
    data.set(key, { correct: stats.correctCount, total: stats.totalCount });
  }
  return data;
}

function toTimingData(agg: AggregatedStats): Map<string, number> {
  const data = new Map<string, number>();
  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      data.set(key, stats.times.reduce((a, b) => a + b, 0) / stats.times.length);
    }
  }
  return data;
}

async function printAccuracyGrid(mazeFile: string, agg: AggregatedStats): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log(`\n--- Accuracy Grid (${agg.totalTrials} trials) ---`);
  renderAccuracyGrid(maze.layout, toAccuracyData(agg));
}

async function printTimingGrid(mazeFile: string, agg: AggregatedStats): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log('');
  renderTimingGrid(maze.layout, toTimingData(agg), agg.totalTrials);
}

function printPositionDetails(agg: AggregatedStats): void {
  console.log(`\n--- Position Details (sorted by avg time) ---`);
  console.log(`${'Position'.padEnd(12)}${'Accuracy'.padEnd(12)}${'Avg Time'.padEnd(12)}${'Min'.padEnd(10)}${'Max'.padEnd(10)}${'StdDev'.padEnd(10)}`);
  console.log('-'.repeat(66));

  const entries: { key: string; avgTime: number; accuracy: number; min: number; max: number; stdDev: number }[] = [];

  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const times = stats.times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const variance = times.reduce((acc, t) => acc + Math.pow(t - avgTime, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      const accuracy = stats.correctCount / stats.totalCount;
      entries.push({ key, avgTime, accuracy, min, max, stdDev });
    }
  }

  entries.sort((a, b) => b.avgTime - a.avgTime);

  for (const entry of entries) {
    const [x, y] = entry.key.split(',');
    const pos = `(${x},${y})`.padEnd(12);
    const acc = `${(entry.accuracy * 100).toFixed(0)}%`.padEnd(12);
    const avgTime = formatDuration(entry.avgTime).padEnd(12);
    const min = formatDuration(entry.min).padEnd(10);
    const max = formatDuration(entry.max).padEnd(10);
    const stdDev = formatDuration(entry.stdDev).padEnd(10);
    console.log(`${pos}${acc}${avgTime}${min}${max}${stdDev}`);
  }
}

type JsonOutput = {
  model: string;
  maze: string;
  strategy: string;
  trials: number;
  accuracy: number;
  totalPositions: number;
  correctCount: number;
  avgTimeMs: number;
  medianTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  stdDevMs: number;
  positions: {
    x: number;
    y: number;
    accuracy: number;
    avgTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    stdDevMs: number;
  }[];
};

function buildJsonOutput(model: string, maze: string, strategy: string, agg: AggregatedStats): JsonOutput {
  const { times, correctCount, totalCount } = agg.overallStats;
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const median = times[Math.floor(times.length / 2)] || 0;
  const min = times[0] || 0;
  const max = times[times.length - 1] || 0;
  const variance = times.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  const positions: JsonOutput['positions'] = [];
  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const [x, y] = key.split(',').map(Number);
      const posTimes = stats.times;
      const posAvg = posTimes.reduce((a, b) => a + b, 0) / posTimes.length;
      const posMin = Math.min(...posTimes);
      const posMax = Math.max(...posTimes);
      const posVariance = posTimes.reduce((acc, t) => acc + Math.pow(t - posAvg, 2), 0) / posTimes.length;
      const posStdDev = Math.sqrt(posVariance);
      positions.push({
        x,
        y,
        accuracy: stats.correctCount / stats.totalCount,
        avgTimeMs: Math.round(posAvg),
        minTimeMs: posMin,
        maxTimeMs: posMax,
        stdDevMs: Math.round(posStdDev),
      });
    }
  }
  positions.sort((a, b) => b.avgTimeMs - a.avgTimeMs);

  return {
    model,
    maze,
    strategy,
    trials: agg.totalTrials,
    accuracy: (correctCount / totalCount) * 100,
    totalPositions: totalCount / agg.totalTrials,
    correctCount,
    avgTimeMs: Math.round(avg),
    medianTimeMs: Math.round(median),
    minTimeMs: min,
    maxTimeMs: max,
    stdDevMs: Math.round(stdDev),
    positions,
  };
}

const main = defineCommand({
  meta: {
    name: 'detail',
    description: 'Show detailed analysis for specified conditions',
  },
  args: {
    model: {
      type: 'positional',
      required: true,
      description: 'Model name',
    },
    maze: {
      type: 'positional',
      required: true,
      description: 'Maze name',
    },
    strategy: {
      type: 'positional',
      required: true,
      description: 'Strategy name',
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Output in JSON format',
    },
  },
  async run({ args }) {
    const { model, maze, strategy, json } = args;

    const allResults = await loadResults();
    if (allResults.length === 0) {
      if (json) {
        console.log(JSON.stringify({ error: 'No result files found' }));
      } else {
        logger.error('No result files found in output directory.');
      }
      return;
    }

    const matchingResults = allResults.filter((r) => r.modelName.includes(model) && r.mazeFile.includes(maze) && r.strategyName === strategy);

    if (matchingResults.length === 0) {
      if (json) {
        console.log(JSON.stringify({ error: `No results found for: model=${model}, maze=${maze}, strategy=${strategy}` }));
      } else {
        logger.error(`No results found for: model=${model}, maze=${maze}, strategy=${strategy}`);
      }
      return;
    }

    const mazeFile = matchingResults[0].mazeFile;

    const agg = aggregateResults(matchingResults);

    if (json) {
      const output = buildJsonOutput(model, maze, strategy, agg);
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`\n=== Detail Analysis ===`);
    console.log(`Model: ${model}`);
    console.log(`Maze: ${maze}`);
    console.log(`Strategy: ${strategy}`);
    console.log(`Files: ${matchingResults.length}`);

    printStatistics(agg);
    await printAccuracyGrid(mazeFile, agg);
    await printTimingGrid(mazeFile, agg);
    printPositionDetails(agg);
  },
});

runMain(main);
