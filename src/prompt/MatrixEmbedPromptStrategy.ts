import { Maze } from '@/maze/Maze';
import { CellType, Position } from '@/maze/types';
import { PromptStrategy } from '@/prompt/PromptStrategy';
import { COORDINATE_SYSTEM_NOTE, MATRIX_INDEXING_NOTE, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/promptTemplate';

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

${formatVisitHistory(history)}

What is your next move from your current position?

${COORDINATE_SYSTEM_NOTE} ${MATRIX_INDEXING_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
