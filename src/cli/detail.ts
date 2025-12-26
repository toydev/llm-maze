import { program } from 'commander';
import prettyMs from 'pretty-ms';

import { Evaluations, aggregateForDetail, calculateStats, toAccuracyDataFromDetail, toTimingData, type DetailAggregation } from '@/evaluation';
import { createLogger } from '@/logger/logger';
import { Maze } from '@/maze';
import { renderAccuracyGrid, renderTimingGrid } from '@/view';

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

const logger = createLogger('detail');

const normalize = (value: string) => (value.toLowerCase() === 'all' ? undefined : value);

program
  .name('detail')
  .description('Show detailed analysis for specified conditions')
  .argument('<model>', 'Model name')
  .argument('<maze>', 'Maze name')
  .argument('<strategy>', 'Strategy name')
  .option('--json', 'Output in JSON format', false)
  .action(async (model, maze, strategy, options) => {
    const evaluations = await Evaluations.find({
      model: normalize(model),
      maze: normalize(maze),
      strategy: normalize(strategy),
    });

    if (evaluations.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ error: `No evaluations found for: model=${model}, maze=${maze}, strategy=${strategy}` }));
      } else {
        logger.error(`No evaluations found for: model=${model}, maze=${maze}, strategy=${strategy}`);
      }
      return;
    }

    const mazeFile = evaluations[0].mazeFile;
    const agg = aggregateForDetail(evaluations);

    if (options.json) {
      const output = buildJsonOutput(model, maze, strategy, agg);
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`\n=== Detail Analysis ===`);
    console.log(`Model: ${model}`);
    console.log(`Maze: ${maze}`);
    console.log(`Strategy: ${strategy}`);
    console.log(`Files: ${evaluations.length}`);

    printStatistics(agg);
    await printAccuracyGrid(mazeFile, agg);
    await printTimingGrid(mazeFile, agg);
    printPositionDetails(agg);
  });

program.parse();

function printStatistics(agg: DetailAggregation): void {
  const { times, correctCount, totalCount } = agg.overallStats;
  if (times.length === 0) {
    console.log('\nNo timing data available.');
    return;
  }

  const { avg, median, min, max, stdDev } = calculateStats(times);
  const sum = times.reduce((a, b) => a + b, 0);
  const accuracy = (correctCount / totalCount) * 100;

  console.log(`\n--- Statistics (${agg.totalTrials} trials) ---`);
  console.log(`Total positions: ${totalCount} (${totalCount / agg.totalTrials} per trial)`);
  console.log(`Correct: ${correctCount}/${totalCount} (${accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${prettyMs(sum)}`);
  console.log(`Average: ${prettyMs(avg)}`);
  console.log(`Median: ${prettyMs(median)}`);
  console.log(`Min: ${prettyMs(min)}`);
  console.log(`Max: ${prettyMs(max)}`);
  console.log(`Std Dev: ${prettyMs(stdDev)}`);
}

async function printAccuracyGrid(mazeFile: string, agg: DetailAggregation): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log(`\n--- Accuracy Grid (${agg.totalTrials} trials) ---`);
  renderAccuracyGrid(maze.layout, toAccuracyDataFromDetail(agg));
}

async function printTimingGrid(mazeFile: string, agg: DetailAggregation): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log('');
  renderTimingGrid(maze.layout, toTimingData(agg), agg.totalTrials);
}

function printPositionDetails(agg: DetailAggregation): void {
  console.log(`\n--- Position Details (sorted by avg time) ---`);
  console.log(`${'Position'.padEnd(12)}${'Accuracy'.padEnd(12)}${'Avg Time'.padEnd(12)}${'Min'.padEnd(10)}${'Max'.padEnd(10)}${'StdDev'.padEnd(10)}`);
  console.log('-'.repeat(66));

  const entries: { key: string; avgTime: number; accuracy: number; min: number; max: number; stdDev: number }[] = [];

  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const { avg, min, max, stdDev } = calculateStats(stats.times);
      const accuracy = stats.correctCount / stats.totalCount;
      entries.push({ key, avgTime: avg, accuracy, min, max, stdDev });
    }
  }

  entries.sort((a, b) => b.avgTime - a.avgTime);

  for (const entry of entries) {
    const [x, y] = entry.key.split(',');
    const pos = `(${x},${y})`.padEnd(12);
    const acc = `${(entry.accuracy * 100).toFixed(0)}%`.padEnd(12);
    const avgTime = prettyMs(entry.avgTime).padEnd(12);
    const min = prettyMs(entry.min).padEnd(10);
    const max = prettyMs(entry.max).padEnd(10);
    const stdDev = prettyMs(entry.stdDev).padEnd(10);
    console.log(`${pos}${acc}${avgTime}${min}${max}${stdDev}`);
  }
}

function buildJsonOutput(model: string, maze: string, strategy: string, agg: DetailAggregation): JsonOutput {
  const { times, correctCount, totalCount } = agg.overallStats;
  const { avg, median, min, max, stdDev } = calculateStats(times);

  const positions: JsonOutput['positions'] = [];
  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const [x, y] = key.split(',').map(Number);
      const posStats = calculateStats(stats.times);
      positions.push({
        x,
        y,
        accuracy: stats.correctCount / stats.totalCount,
        avgTimeMs: Math.round(posStats.avg),
        minTimeMs: posStats.min,
        maxTimeMs: posStats.max,
        stdDevMs: Math.round(posStats.stdDev),
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
