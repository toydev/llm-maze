// src/evaluate.ts

import fs from 'fs/promises';
import { Maze } from '@/maze/Maze';
import { createOptimalMoveMap } from '@/maze/solver';
import { Position } from '@/maze/types';
import LLM from '@/llm/LLM';
import { PromptStrategy, SimplePromptStrategy, GraphPromptStrategy } from '@/runner/promptBuilder';
import { MoveActionSchema } from '@/runner/outputParser';
import { createLogger } from '@/logger/Logger';

const logger = createLogger('evaluate');

/**
 * LLMの判断と模範解答を比較し、正解率を評価する関数
 * @param mazeFile 評価対象の迷路ファイルパス
 * @param strategy 使用するプロンプト戦略
 * @param modelName 使用するLLMのモデル名
 */
async function evaluateStrategy(mazeFile: string, strategy: PromptStrategy, modelName: string) {
  logger.info(`Starting evaluation for maze: ${mazeFile}`);
  logger.info(`Using prompt strategy: ${strategy.constructor.name}`);
  logger.info(`Using model: ${modelName}`);

  // 1. 迷路の読み込みと準備
  const mazeLayout = (await fs.readFile(mazeFile, 'utf-8')).split('\n').filter(line => line.length > 0);
  const maze = new Maze(mazeLayout);
  const optimalMoveMap = createOptimalMoveMap(maze);

  const llm = LLM.get(modelName);
  if (!llm) {
    logger.error(`Failed to get LLM instance for model: ${modelName}`);
    return;
  }
  const structuredLlm = llm.withStructuredOutput(MoveActionSchema);

  let totalPositions = 0;
  let correctMoves = 0;

  // 2. 評価ループ
  const evaluationPositions = Array.from(optimalMoveMap.keys());
  totalPositions = evaluationPositions.length;

  logger.info(`Evaluating ${totalPositions} positions...`);

  for (const posKey of evaluationPositions) {
    const [x, y] = posKey.split(',').map(Number);
    const currentPos: Position = { x, y };
    const correctMoveSet = new Set(optimalMoveMap.get(posKey));

    // LLMに判断させるための履歴を作成（ここでは現在の位置のみ）
    const history: Position[] = [currentPos];

    // 3. LLMの推論を実行
    const prompt = strategy.build(maze, history);
    try {
      const llmResponse = MoveActionSchema.parse(await structuredLlm.invoke(prompt));
      const llmMove = llmResponse.move;

      // 4. 結果の比較
      if (correctMoveSet.has(llmMove)) {
        correctMoves++;
        logger.debug(`[${posKey}] Correct: LLM chose '${llmMove}' from [${Array.from(correctMoveSet).join(', ')}]`);
      } else {
        logger.warn(
          `[${posKey}] Incorrect: LLM chose '${llmMove}', but optimal was [${Array.from(correctMoveSet).join(', ')}]`,
        );
      }
    } catch (error) {
      logger.error(`[${posKey}] Error during LLM invocation:`, error);
    }
  }

  // 5. 結果の表示
  const accuracy = totalPositions > 0 ? (correctMoves / totalPositions) * 100 : 0;
  logger.info('--- Evaluation Summary ---');
  logger.info(`Maze: ${mazeFile}`);
  logger.info(`Model: ${modelName}`);
  logger.info(`Prompt Strategy: ${strategy.constructor.name}`);
  logger.info(`Total positions evaluated: ${totalPositions}`);
  logger.info(`Correct moves: ${correctMoves}`);
  logger.info(`Accuracy: ${accuracy.toFixed(2)}%`);
  logger.info('--------------------------');
}

/**
 * メイン実行関数
 */
async function main() {
  const modelName = process.argv[2];
  if (!modelName) {
    logger.warn('No model name provided. Defaulting to "ollama:gemma3:latest"');
    process.argv[2] = 'ollama:gemma3:latest';
  }

  let mazeFiles: string[] = [];
  const mazeFilePath = process.argv[3];

  if (mazeFilePath) {
    mazeFiles = [mazeFilePath];
  } else {
    const mazeDir = './mazes';
    try {
      mazeFiles = (await fs.readdir(mazeDir))
        .filter(file => file.endsWith('.txt'))
        .map(file => `${mazeDir}/${file}`);
    } catch (error) {
      logger.error('Could not read the "mazes" directory.', error);
      return;
    }
  }

  if (mazeFiles.length === 0) {
    logger.warn('No maze files found to evaluate.');
    return;
  }

  const strategies: PromptStrategy[] = [new SimplePromptStrategy(), new GraphPromptStrategy()];

  for (const mazeFile of mazeFiles) {
    for (const strategy of strategies) {
      await evaluateStrategy(mazeFile, strategy, process.argv[2]);
    }
  }
}

main().catch(error => {
  logger.error('An unexpected error occurred:', error);
  process.exit(1);
});
