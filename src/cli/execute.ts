import fs from 'fs/promises';
import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { program } from 'commander';

import { runEvaluation, saveResult } from '@/evaluation';
import { createLogger } from '@/logger/logger';
import { PromptStrategy, SimplePromptStrategy, GraphPromptStrategy, MatrixPromptStrategy, ListPromptStrategy } from '@/prompt';
import { createProgressReporter } from '@/view';

const logger = createLogger('execute');

const strategiesMap = new Map<string, PromptStrategy>([
  ['simple', new SimplePromptStrategy()],
  ['graph', new GraphPromptStrategy()],
  ['matrix', new MatrixPromptStrategy()],
  ['list', new ListPromptStrategy()],
]);

program
  .name('execute')
  .description('Evaluate LLM maze-solving ability')
  .argument('<model>', 'Ollama model name (e.g., gpt-oss, gemma3:latest)')
  .argument('[maze]', 'Maze file path or "all"', 'all')
  .argument('[strategy]', `Strategy name or "all". Available: ${Array.from(strategiesMap.keys()).join(', ')}`, 'all')
  .option('-t, --times <number>', 'Number of runs per combination', parseInt, 1)
  .option('--no-warmup', 'Skip warmup (for external API services)')
  .action(async (model, maze, strategy, options) => {
    if (!options.warmup) await warmupLLM(model);
    await runAllEvaluations(model, options.times, await resolveMazeFiles(maze), resolveStrategies(strategy));
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
          const savedPath = await saveResult(result);
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

async function resolveMazeFiles(maze: string): Promise<string[]> {
  if (maze.toLowerCase() === 'all') {
    const mazeDir = './mazes';
    const files = (await fs.readdir(mazeDir)).filter((file) => file.endsWith('.txt')).map((file) => path.join(mazeDir, file));
    if (files.length === 0) throw new Error('No maze files found');
    return files;
  }
  return [maze];
}

function resolveStrategies(strategy: string): [string, PromptStrategy][] {
  if (strategy.toLowerCase() === 'all') {
    return Array.from(strategiesMap.entries());
  }
  const selected = strategiesMap.get(strategy);
  if (!selected) {
    throw new Error(`Unknown strategy: ${strategy}. Available: ${Array.from(strategiesMap.keys()).join(', ')}`);
  }
  return [[strategy, selected]];
}
