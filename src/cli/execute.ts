import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { program } from 'commander';

import { DEFAULT_OUTPUT_DIR, Executions, MoveActionSchema, directionToMove, type CellResult, type Execution, type Move, type MoveAction } from '@/execution/execution';
import { createLogger } from '@/logger/logger';
import { CellType, Maze, type Position } from '@/maze/maze';
import { Mazes } from '@/maze/mazes';
import { Strategies } from '@/prompt/strategies';
import { type PromptStrategy } from '@/prompt/strategy';
import { ProgressReporter } from '@/view/progress';

import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { Runnable } from '@langchain/core/runnables';

const logger = createLogger('execute');

program
  .name('execute')
  .description('Evaluate LLM maze-solving ability')
  .requiredOption('-m, --model <name>', 'Ollama model name (e.g., gpt-oss:20b)')
  .option('-z, --maze <pattern>', 'Maze file pattern (omit for all)')
  .option('-s, --strategy <name>', `Strategy name. Available: ${Object.keys(Strategies.all()).join(', ')}`)
  .option('-t, --times <number>', 'Number of runs per combination', parseInt, 1)
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('--no-history', 'Exclude visit history from prompts')
  .option('--no-warmup', 'Skip warmup')
  .action(async (options) => {
    if (options.warmup) await warmupLLM(options.model);
    await runAllExecutions(options.model, options.times, await Mazes.find(options.maze), Strategies.find(options.strategy), options.history, options.output);
  });

program.parse();

async function runAllExecutions(
  model: string,
  times: number,
  mazeFiles: string[],
  strategies: Record<string, PromptStrategy>,
  includeHistory: boolean,
  outputDir: string,
): Promise<void> {
  logger.info(`Model: ${model}`);
  logger.info(`Mazes: ${mazeFiles.join(', ')}`);
  logger.info(`Strategies: ${Object.keys(strategies).join(', ')}`);
  logger.info(`Times to run for each combination: ${times}`);
  logger.info(`Include history: ${includeHistory}`);
  logger.info(`Output directory: ${outputDir}`);

  for (let i = 0; i < times; i++) {
    for (const mazeFile of mazeFiles) {
      for (const [strategyName, strategy] of Object.entries(strategies)) {
        const mazeName = path.basename(mazeFile, '.txt');
        const runInfo = `[${i + 1}/${times}] ${model} / ${mazeName} / ${strategyName}`;
        process.stdout.write(`\n${runInfo}\n`);

        try {
          const execution = await runExecution(mazeFile, strategyName, strategy, model, includeHistory);
          const savedPath = await Executions.save(execution, outputDir);
          logger.info(`Saved: ${savedPath}`);
        } catch (error) {
          logger.error(`Failed: ${runInfo}`, error);
        }
      }
    }
  }
}

type StructuredLLM = Runnable<BaseLanguageModelInput, MoveAction>;

async function runExecution(mazeFile: string, strategyName: string, strategy: PromptStrategy, model: string, includeHistory: boolean): Promise<Execution> {
  const maze = await Maze.fromFile(mazeFile);
  const llm = new ChatOllama({ model }).withStructuredOutput(MoveActionSchema);

  const cellResults: CellResult[] = [];
  const progress = new ProgressReporter(1 + maze.pathCount); // Start(1) + Path

  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const type = maze.getCellType({ x, y });
      if (type !== CellType.Start && type !== CellType.Path) continue;

      const result = await evaluateCell({ x, y }, maze, strategy, llm, includeHistory);
      cellResults.push(result);
      progress.record(result.isCorrect);
    }
  }

  progress.finish();

  return {
    mazeFile: mazeFile.replace(/\\/g, '/'),
    modelName: model,
    strategyName,
    includeHistory,
    cellResults,
  };
}

async function evaluateCell(cell: Position, maze: Maze, strategy: PromptStrategy, llm: StructuredLLM, includeHistory: boolean): Promise<CellResult> {
  const correctMoves = maze.getDirectionsToGoal(cell).map(directionToMove);
  const history = includeHistory ? maze.getPathFromStart(cell) : null;
  const prompt = strategy.buildPrompt(maze, cell, history);

  const startTime = Date.now();
  let llmMove: Move | null = null;

  try {
    const response = await llm.invoke(prompt);
    llmMove = response.move;
  } catch (error) {
    logger.error(`[${cell.x},${cell.y}] Error during LLM invocation:`, error);
  }

  return {
    position: cell,
    isCorrect: llmMove !== null && correctMoves.includes(llmMove),
    llmMove,
    correctMoves,
    timeMs: Date.now() - startTime,
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
