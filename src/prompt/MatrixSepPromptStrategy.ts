import { Maze } from '@/maze/Maze';
import { CellType, Position } from '@/maze/types';
import { PromptStrategy } from '@/prompt/PromptStrategy';

export class MatrixSepPromptStrategy implements PromptStrategy {
  private generateMatrix(maze: Maze): number[][] {
    const matrix: number[][] = [];

    for (let y = 0; y < maze.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < maze.width; x++) {
        const cellType = maze.getCellType({ x, y });
        row.push(cellType === CellType.Wall ? 1 : 0);
      }
      matrix.push(row);
    }
    return matrix;
  }

  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const matrix = this.generateMatrix(maze);
    const matrixString = matrix.map((row) => JSON.stringify(row)).join(',\n');

    return `
You are a bot in a 2D maze. Your goal is to find the path from Start to End.

The maze is represented as a 2D matrix where:
- 1 = wall (impassable)
- 0 = path (walkable)

Maze Matrix:
[${matrixString}]

Positions:
- Start: (${maze.startPosition.x},${maze.startPosition.y})
- End: (${maze.endPosition.x},${maze.endPosition.y})
- Current: (${currentPosition.x},${currentPosition.y})

You have visited the following positions in order:
${history.map((p) => `(${p.x},${p.y})`).join(' -> ')}

What is your next move from your current position?

Note: In this coordinate system, y increases downward. Matrix indexing is [y][x].
- up: y-1
- down: y+1
- left: x-1
- right: x+1

Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
`;
  }
}
