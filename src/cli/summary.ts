import path from 'path';

import { program } from 'commander';

import { Results, aggregateForSummary, toAccuracyDataFromSummary, type Summary } from '@/evaluation';
import { createLogger } from '@/logger/logger';
import { formatDuration, renderAccuracyGrid } from '@/view';

const logger = createLogger('summary');

program
  .name('summary')
  .description('Aggregate and display evaluation results')
  .argument('[model]', 'Filter by model name', 'all')
  .argument('[maze]', 'Filter by maze name', 'all')
  .argument('[strategy]', 'Filter by strategy name', 'all')
  .action(async (model, maze, strategy) => {
    logger.info('Starting evaluation summary...');

    const results = await Results.find({ model, maze, strategy });
    if (results.length === 0) {
      logger.warn('No results found.');
      return;
    }

    const summary = await aggregateForSummary(results);

    console.log('\n--- Overall Accuracy Summary ---');
    printSummaryTable(summary);

    console.log('\n--- Positional Accuracy Details ---');
    printGridPerformance(summary);
  });

program.parse();

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
        row += `${overallAccuracy.toFixed(1)}% (${formatDuration(avgTimePerPos)}/pos)`.padEnd(25);
      } else {
        row += 'N/A'.padEnd(25);
      }
    });
    console.log(row);
  });
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
        renderAccuracyGrid(agg.mazeLayout, toAccuracyDataFromSummary(agg), '    ');
      });
    });
  });
}
