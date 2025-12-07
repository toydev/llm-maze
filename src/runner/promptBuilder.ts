// src/runner/promptBuilder.ts

import { Maze } from '@/maze/Maze';
import { Position } from '@/maze/types';

export interface PromptStrategy {
  build(maze: Maze, history: Position[]): string;
}

/**
 * シンプルなプロンプト戦略の例。
 * 迷路全体と現在位置をそのままテキストで渡す。
 */
export class SimplePromptStrategy implements PromptStrategy {
  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const mazeString = maze.toString(currentPosition);

    return `
You are a bot in a 2D maze. Your goal is to find the path from 'S' to 'E'.
'S' is the start, 'E' is the end, '⬛️' are walls, and '⬜️' are walkable paths.
'C' is your current position.

Maze:
${mazeString}

You have visited the following positions in order:
${history.map(p => `(${p.x}, ${p.y})`).join(' -> ')}

What is your next move? You can only move to adjacent (not diagonal) walkable paths.
Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
`;
  }
}

// TODO: ここに他のプロンプト戦略を追加していく
// 例：
// - 迷路全体を見せず、現在位置の周辺情報だけを見せる戦略
// - これまでの失敗履歴を渡して、同じ間違いを繰り返さないように促す戦略
