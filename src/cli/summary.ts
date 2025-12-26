import path from 'path';

import { program } from 'commander';
import prettyMs from 'pretty-ms';

import { Executions, type Execution } from '@/execution/execution';
import { PositionStats } from '@/execution/position-stats';
import { createLogger } from '@/logger/logger';
import { Maze } from '@/maze/maze';
import { renderAccuracyGrid } from '@/view/grid';

type MazeStats = { mazeFile: string; stats: PositionStats };
type StrategyMap = Map<string, MazeStats[]>;
type ModelMap = Map<string, StrategyMap>;

const logger = createLogger('summary');

program
  .name('summary')
  .description('Aggregate and display execution results')
  .option('-m, --model <name>', 'Filter by model name')
  .option('-z, --maze <pattern>', 'Filter by maze name')
  .option('-s, --strategy <name>', 'Filter by strategy name')
  .action(async (options) => {
    logger.info('Starting execution summary...');

    const executions = await Executions.find({ model: options.model, maze: options.maze, strategy: options.strategy });
    if (executions.length === 0) {
      logger.warn('No executions found.');
      return;
    }

    const summary = groupExecutions(executions);

    console.log('\n--- Overall Accuracy Summary ---');
    printSummaryTable(summary);

    console.log('\n--- Positional Accuracy Details ---');
    await printGridPerformance(summary);
  });

program.parse();

function groupExecutions(executions: Execution[]): ModelMap {
  const summary: ModelMap = new Map();

  for (const execution of executions) {
    const { modelName: model, strategyName: strategy, mazeFile } = execution;

    if (!summary.has(model)) {
      summary.set(model, new Map());
    }
    const modelMap = summary.get(model)!;

    if (!modelMap.has(strategy)) {
      modelMap.set(strategy, []);
    }
    const mazeList = modelMap.get(strategy)!;

    let mazeStats = mazeList.find((m) => m.mazeFile === mazeFile);
    if (!mazeStats) {
      mazeStats = { mazeFile, stats: new PositionStats() };
      mazeList.push(mazeStats);
    }
    mazeStats.stats.addExecution(execution);
  }

  return summary;
}

function printSummaryTable(summary: ModelMap): void {
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
      const mazeList = modelMap.get(stg);
      if (mazeList) {
        let totalCorrect = 0;
        let totalPositions = 0;
        let totalTimeMs = 0;
        mazeList.forEach(({ stats }) => {
          const overall = stats.overallStats();
          totalCorrect += overall.correct;
          totalPositions += overall.total;
          totalTimeMs += overall.times.reduce((a, b) => a + b, 0);
        });
        const overallAccuracy = totalPositions > 0 ? (totalCorrect / totalPositions) * 100 : 0;
        const avgTimePerPos = totalPositions > 0 ? totalTimeMs / totalPositions : 0;
        row += `${overallAccuracy.toFixed(1)}% (${prettyMs(avgTimePerPos)}/pos)`.padEnd(25);
      } else {
        row += 'N/A'.padEnd(25);
      }
    });
    console.log(row);
  });
}

async function printGridPerformance(summary: ModelMap): Promise<void> {
  const models = Array.from(summary.keys()).sort();
  for (const model of models) {
    console.log(`\n=== ${model} ===`);
    const modelMap = summary.get(model)!;
    const strategies = Array.from(modelMap.keys()).sort();
    for (const stg of strategies) {
      console.log(`\n  --- ${stg} ---`);
      const mazeList = modelMap.get(stg)!;
      const sortedMazes = [...mazeList].sort((a, b) => a.mazeFile.localeCompare(b.mazeFile));
      for (const { mazeFile, stats } of sortedMazes) {
        const mazeName = path.basename(mazeFile, '.txt');
        const maze = await Maze.fromFile(mazeFile);
        console.log(`\n    ${mazeName}:`);
        renderAccuracyGrid(maze.layout, stats.toAccuracyData(), '    ');
      }
    }
  }
}
