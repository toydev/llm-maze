import { Maze } from '@/maze/Maze';
import { CellType, Position } from '@/maze/types';
import { PromptStrategy } from '@/runner/prompt/PromptStrategy';

export class MatrixEmbedPromptStrategy implements PromptStrategy {
  private generateMatrix(maze: Maze, currentPosition: Position): string[][] {
    const matrix: string[][] = [];

    for (let y = 0; y < maze.height; y++) {
      const row: string[] = [];
      for (let x = 0; x < maze.width; x++) {
        const pos = { x, y };
        const cellType = maze.getCellType(pos);

        if (currentPosition.x === x && currentPosition.y === y) {
          row.push('C');
        } else if (cellType === CellType.Start) {
          row.push('S');
        } else if (cellType === CellType.End) {
          row.push('E');
        } else if (cellType === CellType.Wall) {
          row.push('1');
        } else {
          row.push('0');
        }
      }
      matrix.push(row);
    }
    return matrix;
  }

  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const matrix = this.generateMatrix(maze, currentPosition);
    const matrixString = matrix.map((row) => JSON.stringify(row)).join(',\n');

    return `
You are a bot in a 2D maze. Your goal is to find the path from Start to End.

The maze is represented as a 2D matrix where:
- "1" = wall (impassable)
- "0" = path (walkable)
- "S" = start position
- "E" = end position
- "C" = your current position

Maze Matrix:
[${matrixString}]

You have visited the following positions in order:
${history.map((p) => `(${p.x}, ${p.y})`).join(' -> ')}

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
