import { Maze, Position } from '@/maze/maze';
import {
  COORDINATE_SYSTEM_NOTE,
  INTRODUCTION,
  NEXT_MOVE_QUESTION,
  PromptStrategy,
  RESPONSE_FORMAT_INSTRUCTION,
  formatPositions,
  formatVisitHistory,
} from '@/prompt/strategy';

type AdjacencyList = Record<string, string[]>;

export class GraphPromptStrategy implements PromptStrategy {
  private generateGraph(maze: Maze): AdjacencyList {
    const graph: AdjacencyList = {};
    const { width, height } = maze;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentPos = { x, y };
        if (!maze.isWalkable(currentPos)) {
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
          if (maze.isWalkable(neighbor)) {
            graph[posKey].push(`${neighbor.x},${neighbor.y}`);
          }
        }
      }
    }
    return graph;
  }

  private formatGraph(maze: Maze): string {
    const graph = this.generateGraph(maze);
    const graphString = JSON.stringify(graph, null, 2);
    return `Graph (adjacency list): each key "x,y" maps to adjacent walkable positions.\n${graphString}`;
  }

  public buildPrompt(maze: Maze, current: Position, history: Position[] | null): string {
    return [
      INTRODUCTION,
      this.formatGraph(maze),
      formatPositions(maze, current),
      formatVisitHistory(history),
      NEXT_MOVE_QUESTION,
      COORDINATE_SYSTEM_NOTE,
      RESPONSE_FORMAT_INSTRUCTION,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
