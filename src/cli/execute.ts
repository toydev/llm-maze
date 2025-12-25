import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { program } from 'commander';

import { runEvaluation, Results } from '@/evaluation';
import { createLogger } from '@/logger/logger';
import { Mazes } from '@/maze';
import { Strategies, type PromptStrategy } from '@/prompt';
import { createProgressReporter } from '@/view';

const logger = createLogger('execute');

program
  .name('execute')
  .description('Evaluate LLM maze-solving ability')
  .argument('<model>', 'Ollama model name (e.g., gpt-oss, gemma3:latest)')
  .argument('[maze]', 'Maze file path or "all"', 'all')
  .argument('[strategy]', `Strategy name or "all". Available: ${Strategies.names().join(', ')}`, 'all')
  .option('-t, --times <number>', 'Number of runs per combination', parseInt, 1)
  .option('--no-warmup', 'Skip warmup (for external API services)')
  .action(async (model, maze, strategy, options) => {
    if (options.warmup) await warmupLLM(model);
    await runAllEvaluations(model, options.times, await Mazes.find(maze), Strategies.find(strategy));
  });

program.parse();

async function runAllEvaluations(model: string, times: number, mazeFiles: string[], strategies: [string, PromptStrategy][]): Promise<void> {
  logger.info(`Model: ${model}`);
  logger.info(`Mazes: ${mazeFiles.join(', ')}`);
  logger.info(`Strategies: ${strategies.map(([name]) => name).join(', ')}`);
  logger.info(`Times to run for each combination: ${times}`);

  for (let i = 0; i < times; i++) {
    for (const mazeFile of mazeFiles) {
      for (const [strategyName, strategy] of strategies) {
        const mazeName = path.basename(mazeFile, '.txt');
        const runInfo = `[${i + 1}/${times}] ${model} / ${mazeName} / ${strategyName}`;
        process.stdout.write(`\n${runInfo}\n`);

        try {
          let progress: ReturnType<typeof createProgressReporter>;
          const result = await runEvaluation({
            mazeFile,
            strategyName,
            strategy,
            modelName: model,
            logger,
            onStart: (total) => {
              progress = createProgressReporter(total);
            },
            onProgress: (isCorrect) => progress.record(isCorrect),
            onFinish: () => progress.finish(),
          });
          const savedPath = await Results.save(result);
          logger.info(`Saved: ${savedPath}`);
        } catch (error) {
          logger.error(`Failed: ${runInfo}`, error);
        }
      }
    }
  }
}

async function warmupLLM(model: string): Promise<void> {
  process.stdout.write('Warming up LLM...');
  const llm = new ChatOllama({ model });
  try {
    await llm.invoke('Hello');
    process.stdout.write(' done.\n');
  } catch (error) {
    process.stdout.write(' failed (continuing anyway).\n');
    logger.warn('Warmup failed:', error);
  }
}
