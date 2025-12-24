import fs from 'fs/promises';
import path from 'path';

import { defineCommand, runMain } from 'citty';
import yaml from 'yaml';

import LLM from '@/llm/LLM';
import { createLogger } from '@/logger/Logger';
import { Maze } from '@/maze/Maze';
import { createValidMoveMap, createPathMapFromStart } from '@/maze/solver';
import { Move, Position } from '@/maze/types';
import { PromptStrategy, SimplePromptStrategy, GraphPromptStrategy, MatrixEmbedPromptStrategy, MatrixSepPromptStrategy, ListPromptStrategy } from '@/prompt';
import { MoveActionSchema } from '@/prompt/schema';

const logger = createLogger('execute');

type PositionResult = {
  position: Position;
  isCorrect: boolean;
  llmMove: Move | 'error';
  validMoves: Move[];
  timeMs: number;
};

type EvaluationResult = {
  mazeFile: string;
  modelName: string;
  strategyName: string;
  totalPositions: number;
  correctMoves: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimePerPositionMs: number;
  results: PositionResult[];
};

async function executeStrategy(mazeFile: string, strategyName: string, strategy: PromptStrategy, modelName: string): Promise<EvaluationResult> {
  logger.info(`Executing for maze: ${mazeFile}, strategy: ${strategyName}, model: ${modelName}`);

  const mazeLayout = (await fs.readFile(mazeFile, 'utf-8')).split('\n').filter((line) => line.length > 0);
  const maze = new Maze(mazeLayout);
  const validMoveMap = createValidMoveMap(maze);
  const pathMap = createPathMapFromStart(maze);

  const llm = LLM.get(modelName);
  if (!llm) {
    throw new Error(`Failed to get LLM instance for model: ${modelName}`);
  }
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  const evaluationPositions = Array.from(validMoveMap.keys());
  const positionResults: PositionResult[] = [];
  const totalCount = evaluationPositions.length;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressChars: string[] = [];
  const startTime = Date.now();

  const updateProgress = () => {
    const remaining = ' '.repeat(totalCount - progressChars.length);
    const elapsed = Date.now() - startTime;
    const completed = progressChars.length;
    const correctCount = progressChars.filter((c) => c === '.').length;
    const incorrectCount = progressChars.filter((c) => c === 'X').length;

    let etaStr = '--:--';
    if (completed > 0) {
      const avgTime = elapsed / completed;
      const remainingTime = avgTime * (totalCount - completed);
      etaStr = formatTime(remainingTime);
    }

    process.stdout.write(
      `\r[${progressChars.join('')}${remaining}] ${completed}/${totalCount} .:${correctCount} X:${incorrectCount} | ${formatTime(elapsed)} ETA: ${etaStr}`,
    );
  };

  const progressInterval = setInterval(updateProgress, 1000);
  updateProgress();

  for (const posKey of evaluationPositions) {
    const [x, y] = posKey.split(',').map(Number);
    const currentPos: Position = { x, y };
    const correctMoveSet = new Set(validMoveMap.get(posKey)!);

    const history = pathMap.get(posKey) ?? [currentPos];
    const prompt = strategy.build(maze, history);

    const posStartTime = Date.now();
    try {
      const llmResponse = MoveActionSchema.parse(await structuredLlm.invoke(prompt));
      const llmMove = llmResponse.move;
      const isCorrect = correctMoveSet.has(llmMove);
      const posTimeMs = Date.now() - posStartTime;

      positionResults.push({
        position: currentPos,
        isCorrect,
        llmMove,
        validMoves: Array.from(correctMoveSet),
        timeMs: posTimeMs,
      });

      progressChars.push(isCorrect ? '.' : 'X');
      updateProgress();
    } catch (error) {
      const posTimeMs = Date.now() - posStartTime;
      logger.error(`[${posKey}] Error during LLM invocation:`, error);
      positionResults.push({
        position: currentPos,
        isCorrect: false,
        llmMove: 'error',
        validMoves: Array.from(correctMoveSet),
        timeMs: posTimeMs,
      });

      progressChars.push('X');
      updateProgress();
    }
  }

  clearInterval(progressInterval);
  updateProgress(); // 最終状態を表示
  process.stdout.write('\n');

  const correctMoves = positionResults.filter((r) => r.isCorrect).length;
  const totalPositions = evaluationPositions.length;
  const accuracy = totalPositions > 0 ? (correctMoves / totalPositions) * 100 : 0;
  const totalTimeMs = Date.now() - startTime;
  const averageTimePerPositionMs = totalPositions > 0 ? totalTimeMs / totalPositions : 0;

  return {
    mazeFile: mazeFile.replace(/\\/g, '/'),
    modelName,
    strategyName,
    totalPositions,
    correctMoves,
    accuracy,
    totalTimeMs,
    averageTimePerPositionMs,
    results: positionResults,
  };
}

async function saveResult(result: EvaluationResult): Promise<void> {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const modelId = result.modelName.replace(/[:/]/g, '_'); // ollama:gemma3:latest -> ollama_gemma3_latest
  const mazeName = path.basename(result.mazeFile, '.txt');
  const outputDir = path.join('output', modelId, result.strategyName, mazeName);
  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `${timestamp}.yaml`);
  const yamlData = yaml.stringify(result);

  await fs.writeFile(filePath, yamlData);
  logger.info(`Evaluation result saved to: ${filePath}`);
}

const strategiesMap = new Map<string, PromptStrategy>([
  ['simple', new SimplePromptStrategy()],
  ['graph', new GraphPromptStrategy()],
  ['matrix-embed', new MatrixEmbedPromptStrategy()],
  ['matrix-sep', new MatrixSepPromptStrategy()],
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
      description: 'LLM model name (e.g., gemini:gemini-2.5-flash, ollama:gemma3:latest)',
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
      const llm = LLM.get(model);
      if (llm) {
        try {
          await llm.invoke('Hello');
          process.stdout.write(' done.\n');
        } catch (error) {
          process.stdout.write(' failed (continuing anyway).\n');
          logger.warn('Warmup failed:', error);
        }
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
            await saveResult(result);
          } catch (error) {
            logger.error(`Failed: ${runInfo}`, error);
          }
        }
      }
    }
  },
});

runMain(main);
