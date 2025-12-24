import fs from 'fs/promises';
import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { defineCommand, runMain } from 'citty';

import { createProgressReporter } from '@/cli/view';
import { EvaluationResult, PositionResult, saveResult } from '@/evaluation';
import { createLogger } from '@/logger/Logger';
import { Maze } from '@/maze/Maze';
import { createGoalwardMoveMap, createUnbiasedPathMap } from '@/maze/solver';
import { Position } from '@/maze/types';
import { PromptStrategy, SimplePromptStrategy, GraphPromptStrategy, MatrixPromptStrategy, ListPromptStrategy } from '@/prompt';
import { MoveActionSchema } from '@/prompt/schema';

const logger = createLogger('execute');

async function executeStrategy(mazeFile: string, strategyName: string, strategy: PromptStrategy, modelName: string): Promise<EvaluationResult> {
  logger.info(`Executing for maze: ${mazeFile}, strategy: ${strategyName}, model: ${modelName}`);

  const maze = await Maze.fromFile(mazeFile);
  const goalwardMoveMap = createGoalwardMoveMap(maze);
  const pathMap = createUnbiasedPathMap(maze);

  const llm = new ChatOllama({ model: modelName });
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  const evaluationPositions = Array.from(goalwardMoveMap.keys());
  const positionResults: PositionResult[] = [];

  const progress = createProgressReporter(evaluationPositions.length);
  const startTime = Date.now();

  for (const posKey of evaluationPositions) {
    const [x, y] = posKey.split(',').map(Number);
    const currentPos: Position = { x, y };
    const correctMoveSet = new Set(goalwardMoveMap.get(posKey)!);

    const history = pathMap.get(posKey) ?? [currentPos];
    const prompt = strategy.build(maze, history);

    const posStartTime = Date.now();
    try {
      const llmResponse = MoveActionSchema.parse(await structuredLlm.invoke(prompt));
      const llmMove = llmResponse.move;
      const isCorrect = correctMoveSet.has(llmMove);

      positionResults.push({
        position: currentPos,
        isCorrect,
        llmMove,
        validMoves: Array.from(correctMoveSet),
        timeMs: Date.now() - posStartTime,
      });

      progress.record(isCorrect);
    } catch (error) {
      logger.error(`[${posKey}] Error during LLM invocation:`, error);
      positionResults.push({
        position: currentPos,
        isCorrect: false,
        llmMove: 'error',
        validMoves: Array.from(correctMoveSet),
        timeMs: Date.now() - posStartTime,
      });

      progress.record(false);
    }
  }

  progress.finish();

  const correctMoves = positionResults.filter((r) => r.isCorrect).length;
  const totalPositions = evaluationPositions.length;
  const accuracy = totalPositions > 0 ? (correctMoves / totalPositions) * 100 : 0;
  const totalTimeMs = Date.now() - startTime;

  return {
    mazeFile: mazeFile.replace(/\\/g, '/'),
    modelName,
    strategyName,
    totalPositions,
    correctMoves,
    accuracy,
    totalTimeMs,
    averageTimePerPositionMs: totalPositions > 0 ? totalTimeMs / totalPositions : 0,
    results: positionResults,
  };
}

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
            const result = await executeStrategy(mazeFile, strategyName, strategy, model);
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
