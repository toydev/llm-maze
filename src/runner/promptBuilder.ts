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
${history.map((p) => `(${p.x}, ${p.y})`).join(' -> ')}

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

type AdjacencyList = Record<string, string[]>;

/**
 * 迷路をグラフとして表現し、プロンプトを作成する戦略。
 */
export class GraphPromptStrategy implements PromptStrategy {
  private generateGraph(maze: Maze): AdjacencyList {
    const graph: AdjacencyList = {};
    const { width, height } = maze;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentPos = { x, y };
        if (!maze.isTraversable(currentPos)) {
          continue;
        }

        const posKey = `${x},${y}`;
        graph[posKey] = [];

        const neighbors: Position[] = [
          { x, y: y - 1 }, // up
          { x, y: y + 1 }, // down
          { x: x - 1, y }, // left
          { x: x + 1, y }, // right
        ];

        for (const neighbor of neighbors) {
          if (maze.isTraversable(neighbor)) {
            graph[posKey].push(`${neighbor.x},${neighbor.y}`);
          }
        }
      }
    }
    return graph;
  }

  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const graph = this.generateGraph(maze);
    const graphString = JSON.stringify(graph, null, 2);

    return `
You are a bot in a 2D maze. Your goal is to find the path from Start to End.

The maze is represented as a graph data structure (adjacency list).
Each key is a "node" representing a walkable coordinate "x,y".
The value is an array of "edges" to adjacent walkable coordinates.

- Start position: "(${maze.startPosition.x},${maze.startPosition.y})"
- End position: "(${maze.endPosition.x},${maze.endPosition.y})"
- Your current position: "(${currentPosition.x},${currentPosition.y})"

Maze Graph:
${graphString}

You have visited the following positions in order:
${history.map((p) => `(${p.x}, ${p.y})`).join(' -> ')}

Based on the graph, what is your next move from your current position?
You can only move to an adjacent node connected by an edge.
Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
`;
  }
}
