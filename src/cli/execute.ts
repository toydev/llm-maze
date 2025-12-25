import fs from 'fs/promises';
import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { defineCommand, runMain } from 'citty';

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

const main = defineCommand({
  meta: {
    name: 'execute',
    description: 'Evaluate LLM maze-solving ability',
  },
  args: {
    model: {
      type: 'positional',
      required: true,
      description: 'Ollama model name (e.g., gpt-oss, gemma3:latest)',
    },
    maze: {
      type: 'positional',
      default: 'all',
      description: 'Maze file path or "all" (default: all)',
    },
    strategy: {
      type: 'positional',
      default: 'all',
      description: `Strategy name or "all" (default: all). Available: ${Array.from(strategiesMap.keys()).join(', ')}`,
    },
    times: {
      type: 'string',
      default: '1',
      description: 'Number of runs per combination (default: 1)',
    },
    'no-warmup': {
      type: 'boolean',
      default: false,
      description: 'Skip warmup (for external API services)',
    },
  },
  async run({ args }) {
    const { model, maze: mazePathArg, strategy: strategyArg, times: timesStr, 'no-warmup': noWarmup } = args;
    const times = parseInt(timesStr, 10);
    if (isNaN(times) || times < 1) {
      logger.error('times must be a positive integer');
      return;
    }

    if (!noWarmup) {
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

    let mazeFiles: string[] = [];
    if (mazePathArg.toLowerCase() === 'all') {
      const mazeDir = './mazes';
      mazeFiles = (await fs.readdir(mazeDir)).filter((file) => file.endsWith('.txt')).map((file) => path.join(mazeDir, file));
    } else {
      mazeFiles = [mazePathArg];
    }
    if (mazeFiles.length === 0) {
      logger.warn('No maze files found to execute.');
      return;
    }

    let strategiesToExecute: [string, PromptStrategy][] = [];
    if (strategyArg.toLowerCase() === 'all') {
      strategiesToExecute = Array.from(strategiesMap.entries());
    } else {
      const selectedStrategy = strategiesMap.get(strategyArg);
      if (selectedStrategy) {
        strategiesToExecute = [[strategyArg, selectedStrategy]];
      } else {
        logger.error(`Unknown strategy: ${strategyArg}. Available: ${Array.from(strategiesMap.keys()).join(', ')}`);
        return;
      }
    }

    logger.info(`Model: ${model}`);
    logger.info(`Mazes: ${mazeFiles.join(', ')}`);
    logger.info(`Strategies: ${strategiesToExecute.map(([name]) => name).join(', ')}`);
    logger.info(`Times to run for each combination: ${times}`);

    for (let i = 0; i < times; i++) {
      for (const mazeFile of mazeFiles) {
        for (const [strategyName, strategy] of strategiesToExecute) {
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
  },
});

runMain(main);
