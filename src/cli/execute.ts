import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { program } from 'commander';

import { Results } from '@/evaluation';
import { MoveActionSchema, type EvaluationResult, type PositionResult } from '@/evaluation/result';
import { createGoalwardMoveMap, createPathMap } from '@/evaluation/solver';
import { createLogger } from '@/logger/logger';
import { Maze, Mazes, type Position } from '@/maze';
import { Strategies, type PromptStrategy } from '@/prompt';
import { ProgressReporter } from '@/view';

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
        await runSingleEvaluation(model, mazeFile, strategyName, strategy, i + 1, times);
      }
    }
  }
}

async function runSingleEvaluation(
  model: string,
  mazeFile: string,
  strategyName: string,
  strategy: PromptStrategy,
  runIndex: number,
  totalRuns: number,
): Promise<void> {
  const mazeName = path.basename(mazeFile, '.txt');
  const runInfo = `[${runIndex}/${totalRuns}] ${model} / ${mazeName} / ${strategyName}`;
  process.stdout.write(`\n${runInfo}\n`);

  try {
    const result = await runEvaluation(mazeFile, strategyName, strategy, model);
    const savedPath = await Results.save(result);
    logger.info(`Saved: ${savedPath}`);
  } catch (error) {
    logger.error(`Failed: ${runInfo}`, error);
  }
}

async function runEvaluation(mazeFile: string, strategyName: string, strategy: PromptStrategy, model: string): Promise<EvaluationResult> {
  const maze = await Maze.fromFile(mazeFile);
  const goalwardMoveMap = createGoalwardMoveMap(maze);
  const pathMap = createPathMap(maze, maze.startPosition);

  const llm = new ChatOllama({ model });
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  const evaluationPositions = Array.from(goalwardMoveMap.keys());
  const positionResults: PositionResult[] = [];
  const progress = new ProgressReporter(evaluationPositions.length);
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
        llmMove: null,
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
    modelName: model,
    strategyName,
    totalPositions,
    correctMoves,
    accuracy,
    totalTimeMs,
    averageTimePerPositionMs: totalPositions > 0 ? totalTimeMs / totalPositions : 0,
    results: positionResults,
  };
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
