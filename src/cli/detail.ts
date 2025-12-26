import { program } from 'commander';
import prettyMs from 'pretty-ms';
import { mean, median, standardDeviation } from 'simple-statistics';

import { Evaluations, PositionStats } from '@/evaluation';
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

program
  .name('detail')
  .description('Show detailed analysis for specified conditions')
  .option('-m, --model <name>', 'Filter by model name')
  .option('-z, --maze <pattern>', 'Filter by maze name')
  .option('-s, --strategy <name>', 'Filter by strategy name')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    const { model, maze, strategy } = options;
    const evaluations = await Evaluations.find({ model, maze, strategy });

    if (evaluations.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ error: `No evaluations found for: model=${model}, maze=${maze}, strategy=${strategy}` }));
      } else {
        logger.error(`No evaluations found for: model=${model}, maze=${maze}, strategy=${strategy}`);
      }
      return;
    }

    const mazeFile = evaluations[0].mazeFile;
    const stats = new PositionStats();
    for (const e of evaluations) {
      stats.addEvaluation(e);
    }

    if (options.json) {
      const output = buildJsonOutput(model, maze, strategy, stats);
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`\n=== Detail Analysis ===`);
    console.log(`Model: ${model}`);
    console.log(`Maze: ${maze}`);
    console.log(`Strategy: ${strategy}`);
    console.log(`Files: ${evaluations.length}`);

    printStatistics(stats);
    await printAccuracyGrid(mazeFile, stats);
    await printTimingGrid(mazeFile, stats);
    printPositionDetails(stats);
  });

program.parse();

function printStatistics(stats: PositionStats): void {
  const { times, correct, total } = stats.overallStats();
  if (times.length === 0) {
    console.log('\nNo timing data available.');
    return;
  }

  const sum = times.reduce((a, b) => a + b, 0);
  const accuracy = (correct / total) * 100;

  console.log(`\n--- Statistics (${stats.trialCount} trials) ---`);
  console.log(`Total positions: ${total} (${total / stats.trialCount} per trial)`);
  console.log(`Correct: ${correct}/${total} (${accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${prettyMs(sum)}`);
  console.log(`Average: ${prettyMs(mean(times))}`);
  console.log(`Median: ${prettyMs(median(times))}`);
  console.log(`Min: ${prettyMs(Math.min(...times))}`);
  console.log(`Max: ${prettyMs(Math.max(...times))}`);
  console.log(`Std Dev: ${prettyMs(standardDeviation(times))}`);
}

async function printAccuracyGrid(mazeFile: string, stats: PositionStats): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log(`\n--- Accuracy Grid (${stats.trialCount} trials) ---`);
  renderAccuracyGrid(maze.layout, stats.toAccuracyData());
}

async function printTimingGrid(mazeFile: string, stats: PositionStats): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log('');
  renderTimingGrid(maze.layout, stats.toTimingData(), stats.trialCount);
}

function printPositionDetails(stats: PositionStats): void {
  console.log(`\n--- Position Details (sorted by avg time) ---`);
  console.log(`${'Position'.padEnd(12)}${'Accuracy'.padEnd(12)}${'Avg Time'.padEnd(12)}${'Min'.padEnd(10)}${'Max'.padEnd(10)}${'StdDev'.padEnd(10)}`);
  console.log('-'.repeat(66));

  const entries: { key: string; avgTime: number; accuracy: number; min: number; max: number; stdDev: number }[] = [];

  for (const [key, posData] of stats.entries()) {
    if (posData.times.length > 0) {
      entries.push({
        key,
        avgTime: mean(posData.times),
        accuracy: posData.correct / posData.total,
        min: Math.min(...posData.times),
        max: Math.max(...posData.times),
        stdDev: standardDeviation(posData.times),
      });
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
    const std = prettyMs(entry.stdDev).padEnd(10);
    console.log(`${pos}${acc}${avgTime}${min}${max}${std}`);
  }
}

function buildJsonOutput(model: string, maze: string, strategy: string, stats: PositionStats): JsonOutput {
  const { times, correct, total } = stats.overallStats();

  const positions: JsonOutput['positions'] = [];
  for (const [key, posData] of stats.entries()) {
    if (posData.times.length > 0) {
      const [x, y] = key.split(',').map(Number);
      positions.push({
        x,
        y,
        accuracy: posData.correct / posData.total,
        avgTimeMs: Math.round(mean(posData.times)),
        minTimeMs: Math.min(...posData.times),
        maxTimeMs: Math.max(...posData.times),
        stdDevMs: Math.round(standardDeviation(posData.times)),
      });
    }
  }
  positions.sort((a, b) => b.avgTimeMs - a.avgTimeMs);

  return {
    model,
    maze,
    strategy,
    trials: stats.trialCount,
    accuracy: (correct / total) * 100,
    totalPositions: total / stats.trialCount,
    correctCount: correct,
    avgTimeMs: Math.round(mean(times)),
    medianTimeMs: Math.round(median(times)),
    minTimeMs: Math.min(...times),
    maxTimeMs: Math.max(...times),
    stdDevMs: Math.round(standardDeviation(times)),
    positions,
  };
}
