// src/execute.ts

import fs from 'fs/promises';
import path from 'path';

import yaml from 'yaml';

import LLM from '@/llm/LLM';
import { createLogger } from '@/logger/Logger';
import { Maze } from '@/maze/Maze';
import { createOptimalMoveMap } from '@/maze/solver';
import { Move, Position } from '@/maze/types';
import { MoveActionSchema } from '@/runner/outputParser';
import { PromptStrategy, SimplePromptStrategy, GraphPromptStrategy } from '@/runner/prompt';

const logger = createLogger('execute');

// 結果を保存するための型定義
type PositionResult = {
  position: Position;
  isCorrect: boolean;
  llmMove: Move | 'error';
  optimalMoves: Move[];
};

type EvaluationResult = {
  mazeFile: string;
  modelName: string;
  strategyName: string;
  totalPositions: number;
  correctMoves: number;
  accuracy: number;
  results: PositionResult[];
};

/**
 * LLMの判断と模範解答を比較し、評価結果を返す関数
 * @param mazeFile 評価対象の迷路ファイルパス
 * @param strategy 使用するプロンプト戦略
 * @param modelName 使用するLLMのモデル名
 * @returns 評価結果オブジェクト
 */
async function executeStrategy(mazeFile: string, strategy: PromptStrategy, modelName: string): Promise<EvaluationResult> {
  logger.info(`Executing for maze: ${mazeFile}, strategy: ${strategy.constructor.name}, model: ${modelName}`);

  const mazeLayout = (await fs.readFile(mazeFile, 'utf-8')).split('\n').filter((line) => line.length > 0);
  const maze = new Maze(mazeLayout);
  const optimalMoveMap = createOptimalMoveMap(maze);

  const llm = LLM.get(modelName);
  if (!llm) {
    throw new Error(`Failed to get LLM instance for model: ${modelName}`);
  }
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  const evaluationPositions = Array.from(optimalMoveMap.keys());
  const positionResults: PositionResult[] = [];

  for (const posKey of evaluationPositions) {
    const [x, y] = posKey.split(',').map(Number);
    const currentPos: Position = { x, y };
    const correctMoveSet = new Set(optimalMoveMap.get(posKey)!);

    const history: Position[] = [currentPos];
    const prompt = strategy.build(maze, history);

    try {
      const llmResponse = MoveActionSchema.parse(await structuredLlm.invoke(prompt));
      const llmMove = llmResponse.move;
      const isCorrect = correctMoveSet.has(llmMove);

      positionResults.push({
        position: currentPos,
        isCorrect,
        llmMove,
        optimalMoves: Array.from(correctMoveSet),
      });
      if (!isCorrect) {
        logger.warn(`[${posKey}] Incorrect: LLM chose '${llmMove}', but optimal was [${Array.from(correctMoveSet).join(', ')}]`);
      }
    } catch (error) {
      logger.error(`[${posKey}] Error during LLM invocation:`, error);
      // エラーが発生した場合は不正解として記録
      positionResults.push({
        position: currentPos,
        isCorrect: false,
        llmMove: 'error', // or some other indicator
        optimalMoves: Array.from(correctMoveSet),
      });
    }
  }

  const correctMoves = positionResults.filter((r) => r.isCorrect).length;
  const totalPositions = evaluationPositions.length;
  const accuracy = totalPositions > 0 ? (correctMoves / totalPositions) * 100 : 0;

  return {
    mazeFile,
    modelName,
    strategyName: strategy.constructor.name,
    totalPositions,
    correctMoves,
    accuracy,
    results: positionResults,
  };
}

/**
 * 評価結果をYAMLファイルに保存する関数
 * @param result 評価結果
 */
async function saveResult(result: EvaluationResult): Promise<void> {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const modelId = result.modelName.replace(/[:/]/g, '_'); // ollama:gemma3:latest -> ollama_gemma3_latest
  const outputDir = path.join('output', modelId, result.strategyName);
  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `${timestamp}.yaml`);
  const yamlData = yaml.stringify(result);

  await fs.writeFile(filePath, yamlData);
  logger.info(`Evaluation result saved to: ${filePath}`);
}

/**
 * メイン実行関数
 */
async function main() {
  const args = process.argv.slice(2);
  const modelName = args[0];
  const mazePathArg = args[1] ?? 'all';
  const strategyArg = args[2] ?? 'all';
  const timesArg = args.find((arg) => arg.startsWith('--times='));
  const times = timesArg ? parseInt(timesArg.split('=')[1], 10) : 1;

  if (!modelName) {
    logger.error('Usage: <modelName> [mazePath|all] [strategyName|all] [--times=N]');
    process.exit(1);
  }

  // 迷路ファイルの決定
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

  // 戦略の決定
  const strategiesMap = new Map<string, PromptStrategy>([
    ['SimplePromptStrategy', new SimplePromptStrategy()],
    ['GraphPromptStrategy', new GraphPromptStrategy()],
  ]);
  let strategiesToExecute: PromptStrategy[] = [];
  if (strategyArg.toLowerCase() === 'all') {
    strategiesToExecute = Array.from(strategiesMap.values());
  } else {
    const selectedStrategy = strategiesMap.get(strategyArg);
    if (selectedStrategy) {
      strategiesToExecute = [selectedStrategy];
    } else {
      logger.error(`Unknown strategy: ${strategyArg}. Available: ${Array.from(strategiesMap.keys()).join(', ')}`);
      return;
    }
  }

  logger.info(`Model: ${modelName}`);
  logger.info(`Mazes: ${mazeFiles.join(', ')}`);
  logger.info(`Strategies: ${strategiesToExecute.map((s) => s.constructor.name).join(', ')}`);
  logger.info(`Times to run for each combination: ${times}`);

  // 実行ループ
  for (const mazeFile of mazeFiles) {
    for (const strategy of strategiesToExecute) {
      for (let i = 0; i < times; i++) {
        logger.info(`--- Execution ${i + 1}/${times} ---`);
        try {
          const result = await executeStrategy(mazeFile, strategy, modelName);
          await saveResult(result);
        } catch (error) {
          logger.error(`Failed to execute strategy for maze ${mazeFile} and strategy ${strategy.constructor.name}`, error);
        }
      }
    }
  }
}

main().catch((error) => {
  logger.error('An unexpected error occurred:', error);
  process.exit(1);
});
