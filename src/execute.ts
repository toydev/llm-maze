// src/execute.ts

import fs from 'fs/promises';
import path from 'path';

import { defineCommand, runMain } from 'citty';
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
  totalTimeMs: number;
  averageTimePerPositionMs: number;
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
  const totalCount = evaluationPositions.length;

  // 時間フォーマット用ヘルパー (mm:ss)
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 進捗表示の初期化
  const progressChars: string[] = [];
  const startTime = Date.now();

  const updateProgress = () => {
    const remaining = '.'.repeat(totalCount - progressChars.length);
    const elapsed = Date.now() - startTime;
    const completed = progressChars.length;
    const correctCount = progressChars.filter((c) => c === 'O').length;
    const incorrectCount = progressChars.filter((c) => c === 'X').length;

    let etaStr = '--:--';
    if (completed > 0) {
      const avgTime = elapsed / completed;
      const remainingTime = avgTime * (totalCount - completed);
      etaStr = formatTime(remainingTime);
    }

    process.stdout.write(
      `\r[${progressChars.join('')}${remaining}] ${completed}/${totalCount} O:${correctCount} X:${incorrectCount} | ${formatTime(elapsed)} 残: ${etaStr}`,
    );
  };

  // 1秒ごとに更新
  const progressInterval = setInterval(updateProgress, 1000);
  updateProgress();

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

      progressChars.push(isCorrect ? 'O' : 'X');
      updateProgress();
    } catch (error) {
      logger.error(`[${posKey}] Error during LLM invocation:`, error);
      // エラーが発生した場合は不正解として記録
      positionResults.push({
        position: currentPos,
        isCorrect: false,
        llmMove: 'error',
        optimalMoves: Array.from(correctMoveSet),
      });

      progressChars.push('X');
      updateProgress();
    }
  }

  // 進捗表示の終了
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
    strategyName: strategy.constructor.name,
    totalPositions,
    correctMoves,
    accuracy,
    totalTimeMs,
    averageTimePerPositionMs,
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
  const mazeName = path.basename(result.mazeFile, '.txt');
  const outputDir = path.join('output', modelId, result.strategyName, mazeName);
  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `${timestamp}.yaml`);
  const yamlData = yaml.stringify(result);

  await fs.writeFile(filePath, yamlData);
  logger.info(`Evaluation result saved to: ${filePath}`);
}

const strategiesMap = new Map<string, PromptStrategy>([
  ['SimplePromptStrategy', new SimplePromptStrategy()],
  ['GraphPromptStrategy', new GraphPromptStrategy()],
]);

const main = defineCommand({
  meta: {
    name: 'execute',
    description: 'LLMの迷路解決能力を評価する',
  },
  args: {
    model: {
      type: 'positional',
      required: true,
      description: 'LLMモデル名 (例: gemini:gemini-2.5-flash, ollama:gemma3:latest)',
    },
    maze: {
      type: 'positional',
      default: 'all',
      description: '迷路ファイルパス、または "all" で全迷路 (デフォルト: all)',
    },
    strategy: {
      type: 'positional',
      default: 'all',
      description: `戦略名、または "all" で全戦略 (デフォルト: all)\n利用可能: ${Array.from(strategiesMap.keys()).join(', ')}`,
    },
    times: {
      type: 'string',
      default: '1',
      description: '各組み合わせの実行回数 (デフォルト: 1)',
    },
  },
  async run({ args }) {
    const { model, maze: mazePathArg, strategy: strategyArg, times: timesStr } = args;
    const times = parseInt(timesStr, 10);

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

    logger.info(`Model: ${model}`);
    logger.info(`Mazes: ${mazeFiles.join(', ')}`);
    logger.info(`Strategies: ${strategiesToExecute.map((s) => s.constructor.name).join(', ')}`);
    logger.info(`Times to run for each combination: ${times}`);

    // 実行ループ（times を外側にしてまんべんなく実行）
    for (let i = 0; i < times; i++) {
      for (const mazeFile of mazeFiles) {
        for (const strategy of strategiesToExecute) {
          const mazeName = path.basename(mazeFile, '.txt');
          const strategyName = strategy.constructor.name;
          const runInfo = `[${i + 1}/${times}] ${mazeName} / ${strategyName}`;
          process.stdout.write(`\n${runInfo}\n`);

          try {
            const result = await executeStrategy(mazeFile, strategy, model);
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
