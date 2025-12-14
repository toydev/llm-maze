// src/runner/MazeRunner.ts

import LLM from '@/llm/LLM';
import { createLogger } from '@/logger/Logger';
import { Maze } from '@/maze/Maze';
import { Position } from '@/maze/types';
import { MoveAction, MoveActionSchema } from '@/runner/outputParser';
import { PromptStrategy } from '@/runner/promptBuilder';

const logger = createLogger('runner');

const MAX_STEPS = 50; // 無限ループを防ぐための最大ステップ数

export class MazeRunner {
  private readonly maze: Maze;
  private readonly llm: LLM;
  private readonly promptStrategy: PromptStrategy;
  private readonly history: Position[] = [];

  constructor(maze: Maze, llm: LLM, promptStrategy: PromptStrategy) {
    this.maze = maze;
    this.llm = llm;
    this.promptStrategy = promptStrategy;
    this.history = [this.maze.startPosition];
  }

  public async run(): Promise<Position[] | null> {
    logger.info('Starting maze run with LLM...');

    for (let step = 0; step < MAX_STEPS; step++) {
      const currentPosition = this.history[this.history.length - 1];

      // ゴールに到達したかチェック
      if (currentPosition.x === this.maze.endPosition.x && currentPosition.y === this.maze.endPosition.y) {
        logger.info(`Goal reached in ${this.history.length - 1} steps!`);
        return this.history;
      }

      // プロンプトを生成
      const prompt = this.promptStrategy.build(this.maze, this.history);
      logger.debug(`Step ${step}: Prompt sent to LLM.`);
      logger.trace(prompt);

      // LLMに次の手を問い合わせる
      const structuredLlm = this.llm.withStructuredOutput(MoveActionSchema);
      const llmResponse = MoveActionSchema.parse(await structuredLlm.invoke(prompt));
      logger.debug(`Step ${step}: LLM response received.`);
      logger.trace(llmResponse);

      // 次の位置を計算
      const nextPosition = this.calculateNextPosition(currentPosition, llmResponse);

      // 次の位置が有効かチェック
      if (!this.isValidMove(nextPosition)) {
        logger.warn(`Invalid move suggested by LLM: to (${nextPosition.x}, ${nextPosition.y}). This is a wall or out of bounds.`);
        // 戦略：単純に終了する
        break;
      }

      this.history.push(nextPosition);
      logger.info(`Step ${step}: Moved to (${nextPosition.x}, ${nextPosition.y})`);
    }

    logger.warn(`Failed to reach the goal within ${MAX_STEPS} steps.`);
    return null;
  }

  private calculateNextPosition(current: Position, action: MoveAction): Position {
    switch (action.move) {
      case 'up':
        return { x: current.x, y: current.y - 1 };
      case 'down':
        return { x: current.x, y: current.y + 1 };
      case 'left':
        return { x: current.x - 1, y: current.y };
      case 'right':
        return { x: current.x + 1, y: current.y };
    }
  }

  private isValidMove(position: Position): boolean {
    return this.maze.isTraversable(position);
  }
}
