import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { program } from 'commander';

import { Evaluations } from '@/evaluation/evaluations';
import { MoveActionSchema, toMove, type Evaluation, type Trial } from '@/evaluation/result';
import { createLogger } from '@/logger/logger';
import { Maze, type Position } from '@/maze/maze';
import { Mazes } from '@/maze/mazes';
import { Strategies } from '@/prompt/strategies';
import { type PromptStrategy } from '@/prompt/strategy';
import { ProgressReporter } from '@/view/progress';

const logger = createLogger('execute');

program
  .name('execute')
  .description('Evaluate LLM maze-solving ability')
  .requiredOption('-m, --model <name>', 'Ollama model name (e.g., gpt-oss, gemma3:latest)')
  .option('-z, --maze <pattern>', 'Maze file pattern (omit for all)')
  .option('-s, --strategy <name>', `Strategy name. Available: ${Strategies.names().join(', ')}`)
  .option('-t, --times <number>', 'Number of runs per combination', parseInt, 1)
  .option('--no-warmup', 'Skip warmup (for external API services)')
  .action(async (options) => {
    if (options.warmup) await warmupLLM(options.model);
    await runAllEvaluations(options.model, options.times, await Mazes.find(options.maze), Strategies.find(options.strategy));
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
    const evaluation = await runEvaluation(mazeFile, strategyName, strategy, model);
    const savedPath = await Evaluations.save(evaluation);
    logger.info(`Saved: ${savedPath}`);
  } catch (error) {
    logger.error(`Failed: ${runInfo}`, error);
  }
}

async function runEvaluation(mazeFile: string, strategyName: string, strategy: PromptStrategy, model: string): Promise<Evaluation> {
  const maze = await Maze.fromFile(mazeFile);
  const llm = new ChatOllama({ model });
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  const trials: Trial[] = [];
  let totalPositions = 0;
  const startTime = Date.now();

  // Count total passable positions for progress reporting
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.isTraversable({ x, y })) {
        totalPositions++;
      }
    }
  }

  const progress = new ProgressReporter(totalPositions);

  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (!maze.isTraversable({ x, y })) continue;

      const currentPos: Position = { x, y };
      const correctMoves = maze.getGoalwardDirections(currentPos).map(toMove);
      const correctMoveSet = new Set(correctMoves);

      const history = maze.getPathFromStart(currentPos);
      const prompt = strategy.build(maze, history);

      const posStartTime = Date.now();
      try {
        const llmResponse = MoveActionSchema.parse(await structuredLlm.invoke(prompt));
        const llmMove = llmResponse.move;
        const isCorrect = correctMoveSet.has(llmMove);

        trials.push({
          position: currentPos,
          isCorrect,
          llmMove,
          validMoves: correctMoves,
          timeMs: Date.now() - posStartTime,
        });

        progress.record(isCorrect);
      } catch (error) {
        logger.error(`[${x},${y}] Error during LLM invocation:`, error);
        trials.push({
          position: currentPos,
          isCorrect: false,
          llmMove: null,
          validMoves: correctMoves,
          timeMs: Date.now() - posStartTime,
        });

        progress.record(false);
      }
    }
  }

  progress.finish();

  const correctMoves = trials.filter((t) => t.isCorrect).length;
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
    trials,
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
