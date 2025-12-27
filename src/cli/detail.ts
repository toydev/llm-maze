import { program } from 'commander';
import prettyMs from 'pretty-ms';
import { mean, median, standardDeviation } from 'simple-statistics';

import { CellStats } from '@/execution/cell-stats';
import { DEFAULT_OUTPUT_DIR, Executions } from '@/execution/execution';
import { createLogger } from '@/logger/logger';
import { Maze } from '@/maze/maze';
import { renderAccuracyGrid, renderTimingGrid } from '@/view/grid';

type JsonOutput = {
  model: string;
  maze: string;
  strategy: string;
  trials: number;
  accuracy: number;
  totalCells: number;
  correctCount: number;
  avgTimeMs: number;
  medianTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  stdDevMs: number;
  cells: {
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
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-H, --history', 'Filter by history included')
  .option('-N, --no-history', 'Filter by history excluded')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    const { model, maze, strategy } = options;
    const includeHistory = options.history === true ? true : options.history === false ? false : undefined;
    const executions = await Executions.find({ model, maze, strategy, includeHistory }, options.output);

    if (executions.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ error: `No executions found for: model=${model}, maze=${maze}, strategy=${strategy}` }));
      } else {
        logger.error(`No executions found for: model=${model}, maze=${maze}, strategy=${strategy}`);
      }
      return;
    }

    const mazeFile = executions[0].mazeFile;
    const stats = new CellStats();
    for (const e of executions) {
      stats.addExecution(e);
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
    console.log(`Files: ${executions.length}`);

    printStatistics(stats);
    await printAccuracyGrid(mazeFile, stats);
    await printTimingGrid(mazeFile, stats);
    printCellDetails(stats);
  });

program.parse();

function printStatistics(stats: CellStats): void {
  const { times, correct, total } = stats.overallStats();
  if (times.length === 0) {
    console.log('\nNo timing data available.');
    return;
  }

  const sum = times.reduce((a, b) => a + b, 0);
  const accuracy = (correct / total) * 100;

  console.log(`\n--- Statistics (${stats.trialCount} trials) ---`);
  console.log(`Total cells: ${total} (${total / stats.trialCount} per trial)`);
  console.log(`Correct: ${correct}/${total} (${accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${prettyMs(sum)}`);
  console.log(`Average: ${prettyMs(mean(times))}`);
  console.log(`Median: ${prettyMs(median(times))}`);
  console.log(`Min: ${prettyMs(Math.min(...times))}`);
  console.log(`Max: ${prettyMs(Math.max(...times))}`);
  console.log(`Std Dev: ${prettyMs(standardDeviation(times))}`);
}

async function printAccuracyGrid(mazeFile: string, stats: CellStats): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log(`\n--- Accuracy Grid (${stats.trialCount} trials) ---`);
  renderAccuracyGrid(maze.layout, stats.toAccuracyData());
}

async function printTimingGrid(mazeFile: string, stats: CellStats): Promise<void> {
  const maze = await Maze.fromFile(mazeFile);
  console.log('');
  renderTimingGrid(maze.layout, stats.toTimingData(), stats.trialCount);
}

function printCellDetails(stats: CellStats): void {
  console.log(`\n--- Cell Details (sorted by avg time) ---`);
  console.log(`${'Cell'.padEnd(12)}${'Accuracy'.padEnd(12)}${'Avg Time'.padEnd(12)}${'Min'.padEnd(10)}${'Max'.padEnd(10)}${'StdDev'.padEnd(10)}`);
  console.log('-'.repeat(66));

  const entries: { key: string; avgTime: number; accuracy: number; min: number; max: number; stdDev: number }[] = [];

  for (const [key, cellData] of stats.entries()) {
    if (cellData.times.length > 0) {
      entries.push({
        key,
        avgTime: mean(cellData.times),
        accuracy: cellData.correct / cellData.total,
        min: Math.min(...cellData.times),
        max: Math.max(...cellData.times),
        stdDev: standardDeviation(cellData.times),
      });
    }
  }

  entries.sort((a, b) => b.avgTime - a.avgTime);

  for (const entry of entries) {
    const [x, y] = entry.key.split(',');
    const cell = `(${x},${y})`.padEnd(12);
    const acc = `${(entry.accuracy * 100).toFixed(0)}%`.padEnd(12);
    const avgTime = prettyMs(entry.avgTime).padEnd(12);
    const min = prettyMs(entry.min).padEnd(10);
    const max = prettyMs(entry.max).padEnd(10);
    const std = prettyMs(entry.stdDev).padEnd(10);
    console.log(`${cell}${acc}${avgTime}${min}${max}${std}`);
  }
}

function buildJsonOutput(model: string, maze: string, strategy: string, stats: CellStats): JsonOutput {
  const { times, correct, total } = stats.overallStats();

  const cells: JsonOutput['cells'] = [];
  for (const [key, cellData] of stats.entries()) {
    if (cellData.times.length > 0) {
      const [x, y] = key.split(',').map(Number);
      cells.push({
        x,
        y,
        accuracy: cellData.correct / cellData.total,
        avgTimeMs: Math.round(mean(cellData.times)),
        minTimeMs: Math.min(...cellData.times),
        maxTimeMs: Math.max(...cellData.times),
        stdDevMs: Math.round(standardDeviation(cellData.times)),
      });
    }
  }
  cells.sort((a, b) => b.avgTimeMs - a.avgTimeMs);

  return {
    model,
    maze,
    strategy,
    trials: stats.trialCount,
    accuracy: (correct / total) * 100,
    totalCells: total / stats.trialCount,
    correctCount: correct,
    avgTimeMs: Math.round(mean(times)),
    medianTimeMs: Math.round(median(times)),
    minTimeMs: Math.min(...times),
    maxTimeMs: Math.max(...times),
    stdDevMs: Math.round(standardDeviation(times)),
    cells,
  };
}
