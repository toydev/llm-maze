import { ChatOllama } from '@langchain/ollama';
import log from 'loglevel';

import { EvaluationResult, PositionResult } from '@/evaluation/result';
import { createGoalwardMoveMap, createUnbiasedPathMap } from '@/evaluation/solver';
import { Maze, Position } from '@/maze/maze';
import { PromptStrategy } from '@/prompt';
import { MoveActionSchema } from '@/prompt/template';

export type ProgressCallback = (isCorrect: boolean) => void;

export type RunnerOptions = {
  mazeFile: string;
  strategyName: string;
  strategy: PromptStrategy;
  modelName: string;
  logger?: log.Logger;
  onProgress?: ProgressCallback;
  onStart?: (totalPositions: number) => void;
  onFinish?: () => void;
};

export async function runEvaluation(options: RunnerOptions): Promise<EvaluationResult> {
  const { mazeFile, strategyName, strategy, modelName, logger, onProgress, onStart, onFinish } = options;

  logger?.info(`Executing for maze: ${mazeFile}, strategy: ${strategyName}, model: ${modelName}`);

  const maze = await Maze.fromFile(mazeFile);
  const goalwardMoveMap = createGoalwardMoveMap(maze);
  const pathMap = createUnbiasedPathMap(maze);

  const llm = new ChatOllama({ model: modelName });
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  const evaluationPositions = Array.from(goalwardMoveMap.keys());
  const positionResults: PositionResult[] = [];

  onStart?.(evaluationPositions.length);
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

      onProgress?.(isCorrect);
    } catch (error) {
      logger?.error(`[${posKey}] Error during LLM invocation:`, error);
      positionResults.push({
        position: currentPos,
        isCorrect: false,
        llmMove: null,
        validMoves: Array.from(correctMoveSet),
        timeMs: Date.now() - posStartTime,
      });

      onProgress?.(false);
    }
  }

  onFinish?.();

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
