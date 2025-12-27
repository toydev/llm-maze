import { Maze, Position } from '@/maze/maze';
import { PromptStrategy } from '@/prompt/strategy';
import { COORDINATE_SYSTEM_NOTE, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/template';

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

  public buildPrompt(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const graph = this.generateGraph(maze);
    const graphString = JSON.stringify(graph, null, 2);

    return `
You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

The maze is represented as a graph data structure (adjacency list).
Each key is a "node" representing a walkable coordinate "x,y".
The value is an array of "edges" to adjacent walkable coordinates.

- Start position: "${maze.startPosition.x},${maze.startPosition.y}"
- Goal position: "${maze.goalPosition.x},${maze.goalPosition.y}"
- Your current position: "${currentPosition.x},${currentPosition.y}"

Maze Graph:
${graphString}

${formatVisitHistory(history)}

Based on the graph, what is your next move from your current position?
You can only move to an adjacent node connected by an edge.

${COORDINATE_SYSTEM_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
