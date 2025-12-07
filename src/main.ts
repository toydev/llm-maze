// src/main.ts

import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { createLogger } from './logger/Logger';
import { Maze } from './maze/Maze';

const logger = createLogger('main');
import { solveWithAStar } from './maze/solver';
import LLM from './llm/LLM';
import { SimplePromptStrategy } from './runner/promptBuilder';
import { MazeRunner } from './runner/MazeRunner';

async function main() {
  logger.info('Maze Exploration Experiment Start!');

  // 1. 迷路ファイルを読み込む
  const mazeFilePath = path.join(process.cwd(), 'mazes', '5x5_simple.txt');
  let mazeLayout: string[];
  try {
    const fileContent = await fs.readFile(mazeFilePath, 'utf-8');
    mazeLayout = fileContent.trim().split('\n');
  } catch (error) {
    logger.error(`Failed to read maze file: ${mazeFilePath}`, error);
    return;
  }

  // 2. 迷路オブジェクトを作成
  const maze = new Maze(mazeLayout);
  logger.info('Maze loaded:');
  logger.info('\n' + maze.toString());

  // 3. A*ソルバーで正解経路を計算（現在は未実装）
  const correctPath = solveWithAStar(maze);
  if (correctPath) {
    logger.info('Optimal path by A*:', correctPath);
  } else {
    logger.warn('Could not find path with A*.');
  }

  // 4. LLMランナーを実行
  const llmTarget = process.env.DEFAULT_LLM_TARGET;
  if (!llmTarget) {
    logger.error('DEFAULT_LLM_TARGET is not defined in .env file.');
    return;
  }
  const llm = LLM.get(llmTarget);
  if (!llm) {
    logger.error(`Failed to get LLM for target: ${llmTarget}`);
    return;
  }

  const promptStrategy = new SimplePromptStrategy();
  const runner = new MazeRunner(maze, llm, promptStrategy);

  const llmPath = await runner.run();

  // 5. 結果を比較・表示
  logger.info('----- Run Finished -----');
  if (llmPath) {
    logger.info('Path found by LLM:', llmPath.map(p => `(${p.x}, ${p.y})`).join(' -> '));
  } else {
    logger.error('LLM failed to find a path.');
  }

  if (correctPath && llmPath) {
    const isCorrect = JSON.stringify(correctPath) === JSON.stringify(llmPath);
    logger.info(`Is the path correct? ${isCorrect}`);
  }
}

main().catch(error => {
  logger.error('An unexpected error occurred:', error);
});
