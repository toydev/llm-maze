import path from 'path';

import { ChatOllama } from '@langchain/ollama';
import { program } from 'commander';

import { Executions, MoveActionSchema, toMove, type CellResult, type Execution, type Move } from '@/execution/execution';
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
    await runAllExecutions(options.model, options.times, await Mazes.find(options.maze), Strategies.find(options.strategy));
  });

program.parse();

async function runAllExecutions(model: string, times: number, mazeFiles: string[], strategies: [string, PromptStrategy][]): Promise<void> {
  logger.info(`Model: ${model}`);
  logger.info(`Mazes: ${mazeFiles.join(', ')}`);
  logger.info(`Strategies: ${strategies.map(([name]) => name).join(', ')}`);
  logger.info(`Times to run for each combination: ${times}`);

  for (let i = 0; i < times; i++) {
    for (const mazeFile of mazeFiles) {
      for (const [strategyName, strategy] of strategies) {
        await runSingleExecution(model, mazeFile, strategyName, strategy, i + 1, times);
      }
    }
  }
}

async function runSingleExecution(
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
    const execution = await runExecution(mazeFile, strategyName, strategy, model);
    const savedPath = await Executions.save(execution);
    logger.info(`Saved: ${savedPath}`);
  } catch (error) {
    logger.error(`Failed: ${runInfo}`, error);
  }
}

type StructuredLLM = ReturnType<ChatOllama['withStructuredOutput']>;

async function runExecution(mazeFile: string, strategyName: string, strategy: PromptStrategy, model: string): Promise<Execution> {
  const maze = await Maze.fromFile(mazeFile);
  const llm = new ChatOllama({ model }).withStructuredOutput(MoveActionSchema);

  const cells = maze.getWalkableCells();
  const cellResults: CellResult[] = [];
  const startTime = Date.now();
  const progress = new ProgressReporter(cells.length);

  for (const cell of cells) {
    const result = await evaluateCell(cell, maze, strategy, llm);
    cellResults.push(result);
    progress.record(result.isCorrect);
  }

  progress.finish();

  const correctCount = cellResults.filter((r) => r.isCorrect).length;
  const totalTimeMs = Date.now() - startTime;

  return {
    mazeFile: mazeFile.replace(/\\/g, '/'),
    modelName: model,
    strategyName,
    totalCells: cells.length,
    correctMoves: correctCount,
    accuracy: cells.length > 0 ? (correctCount / cells.length) * 100 : 0,
    totalTimeMs,
    averageTimePerCellMs: cells.length > 0 ? totalTimeMs / cells.length : 0,
    cellResults,
  };
}

async function evaluateCell(cell: Position, maze: Maze, strategy: PromptStrategy, llm: StructuredLLM): Promise<CellResult> {
  const correctMoves = maze.getGoalwardDirections(cell).map(toMove);
  const prompt = strategy.build(maze, maze.getPathFromStart(cell));

  const startTime = Date.now();
  let llmMove: Move | null = null;

  try {
    const response = MoveActionSchema.parse(await llm.invoke(prompt));
    llmMove = response.move;
  } catch (error) {
    logger.error(`[${cell.x},${cell.y}] Error during LLM invocation:`, error);
  }

  return {
    position: cell,
    isCorrect: llmMove !== null && correctMoves.includes(llmMove),
    llmMove,
    validMoves: correctMoves,
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
