import path from 'path';

import { defineCommand, runMain } from 'citty';

import { EvaluationResult, loadResults } from '@/evaluation';
import { createLogger } from '@/logger/Logger';
import { Maze } from '@/maze/Maze';

const logger = createLogger('summary');

type AggregatedResult = {
  totalRuns: number;
  totalCorrectMoves: number;
  totalPositions: number;
  averageAccuracy: number;
  totalTimeMs: number;
  averageTimePerPositionMs: number;
  positionalCorrectCounts: Map<string, number>; // key: "x,y"
  positionalTotalCounts: Map<string, number>; // key: "x,y"
  mazeLayout: string[];
};

type Summary = Map<string, Map<string, Map<string, AggregatedResult>>>;

async function calculateSummary(results: EvaluationResult[]): Promise<Summary> {
  const summary: Summary = new Map();

  for (const res of results) {
    if (!summary.has(res.modelName)) {
      summary.set(res.modelName, new Map());
    }
    const modelSummary = summary.get(res.modelName)!;

    if (!modelSummary.has(res.strategyName)) {
      modelSummary.set(res.strategyName, new Map());
    }
    const strategySummary = modelSummary.get(res.strategyName)!;

    const mazeFilePath = res.mazeFile.replace(/\\/g, '/');
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
    agg.totalCorrectMoves += res.correctMoves;
    agg.totalPositions += res.totalPositions;
    agg.totalTimeMs += res.totalTimeMs ?? 0;

    for (const posRes of res.results) {
      const key = `${posRes.position.x},${posRes.position.y}`;
      agg.positionalTotalCounts.set(key, (agg.positionalTotalCounts.get(key) ?? 0) + 1);
      if (posRes.isCorrect) {
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

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainSec = Math.round(sec % 60);
  return `${min}m${remainSec}s`;
}

function printSummaryTable(summary: Summary): void {
  const models = Array.from(summary.keys()).sort();
  const allStrategies = new Set<string>();
  summary.forEach((modelMap) => modelMap.forEach((_, strategy) => allStrategies.add(strategy)));
  const strategies = Array.from(allStrategies).sort();

  let header = 'Model'.padEnd(25);
  strategies.forEach((stg) => (header += stg.padEnd(25)));
  console.log(header);

  models.forEach((model) => {
    let row = model.padEnd(25);
    const modelMap = summary.get(model)!;
    strategies.forEach((stg) => {
      const strategyMap = modelMap.get(stg);
      if (strategyMap) {
        let totalCorrect = 0;
        let totalPositions = 0;
        let totalTimeMs = 0;
        strategyMap.forEach((agg) => {
          totalCorrect += agg.totalCorrectMoves;
          totalPositions += agg.totalPositions;
          totalTimeMs += agg.totalTimeMs;
        });
        const overallAccuracy = totalPositions > 0 ? (totalCorrect / totalPositions) * 100 : 0;
        const avgTimePerPos = totalPositions > 0 ? totalTimeMs / totalPositions : 0;
        row += `${overallAccuracy.toFixed(1)}% (${formatTime(avgTimePerPos)}/pos)`.padEnd(25);
      } else {
        row += 'N/A'.padEnd(25);
      }
    });
    console.log(row);
  });
}

const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

function colorize(text: string, color: string): string {
  return `${color}${text}${colors.reset}`;
}

function printGridPerformance(summary: Summary): void {
  const models = Array.from(summary.keys()).sort();
  models.forEach((model) => {
    console.log(`\n=== ${model} ===`);
    const modelMap = summary.get(model)!;
    const strategies = Array.from(modelMap.keys()).sort();
    strategies.forEach((stg) => {
      console.log(`\n  --- ${stg} ---`);
      const strategyMap = modelMap.get(stg)!;
      const mazeFiles = Array.from(strategyMap.keys()).sort();
      mazeFiles.forEach((mazeFile) => {
        const agg = strategyMap.get(mazeFile)!;
        const mazeName = path.basename(mazeFile, '.txt');
        console.log(`\n    ${mazeName}:`);

        const grid: string[][] = agg.mazeLayout.map((row) => row.split('').map((char) => (char === '#' ? colorize('·', colors.gray) : char)));

        for (let y = 0; y < grid.length; y++) {
          for (let x = 0; x < agg.mazeLayout[y].length; x++) {
            const key = `${x},${y}`;
            if (agg.positionalTotalCounts.has(key)) {
              const total = agg.positionalTotalCounts.get(key)!;
              const correct = agg.positionalCorrectCounts.get(key) ?? 0;
              const rate = correct / total;

              if (rate === 1) {
                grid[y][x] = colorize('●', colors.cyan);
              } else if (rate >= 0.9) {
                grid[y][x] = colorize('9', colors.green);
              } else if (rate >= 0.7) {
                grid[y][x] = colorize(Math.floor(rate * 10).toString(), colors.yellow);
              } else if (rate >= 0.5) {
                grid[y][x] = colorize(Math.floor(rate * 10).toString(), colors.yellow);
              } else {
                grid[y][x] = colorize(Math.floor(rate * 10).toString(), colors.red);
              }
            }
          }
        }
        console.log(grid.map((row) => '    ' + row.join('')).join('\n'));
      });
    });
  });
}

const main = defineCommand({
  meta: {
    name: 'summary',
    description: 'Aggregate and display evaluation results',
  },
  args: {
    model: {
      type: 'positional',
      default: 'all',
      description: 'Filter by model name (default: all)',
    },
    maze: {
      type: 'positional',
      default: 'all',
      description: 'Filter by maze name (default: all)',
    },
    strategy: {
      type: 'positional',
      default: 'all',
      description: 'Filter by strategy name (default: all)',
    },
  },
  async run({ args }) {
    const { model, maze, strategy } = args;

    logger.info('Starting evaluation summary...');
    let results = await loadResults();
    if (results.length === 0) {
      logger.warn('No result files found in output directory.');
      return;
    }

    if (model.toLowerCase() !== 'all') {
      results = results.filter((r) => r.modelName.includes(model));
    }
    if (maze.toLowerCase() !== 'all') {
      results = results.filter((r) => r.mazeFile.includes(maze));
    }
    if (strategy.toLowerCase() !== 'all') {
      results = results.filter((r) => r.strategyName === strategy);
    }

    if (results.length === 0) {
      logger.warn('No results match the filter criteria.');
      return;
    }

    const summary = await calculateSummary(results);

    console.log('\n--- Overall Accuracy Summary ---');
    printSummaryTable(summary);

    console.log('\n--- Positional Accuracy Details ---');
    printGridPerformance(summary);
  },
});

runMain(main);
