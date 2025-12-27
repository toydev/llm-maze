import { CellType, Maze, Position } from '@/maze/maze';
import { COORDINATE_SYSTEM_NOTE, PromptStrategy, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/strategy';

export class MatrixPromptStrategy implements PromptStrategy {
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

  public buildPrompt(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const matrix = this.generateMatrix(maze);
    const matrixString = matrix.map((row) => JSON.stringify(row)).join(',\n');

    return `
You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

The maze is represented as a 2D matrix where:
- 1 = wall (impassable)
- 0 = path (walkable)

Maze Matrix:
[${matrixString}]

Positions:
- Start: (${maze.startPosition.x},${maze.startPosition.y})
- Goal: (${maze.goalPosition.x},${maze.goalPosition.y})
- Current: (${currentPosition.x},${currentPosition.y})

${formatVisitHistory(history)}

What is your next move from your current position?

${COORDINATE_SYSTEM_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
