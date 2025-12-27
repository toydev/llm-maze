import { CellType, Maze, Position } from '@/maze/maze';
import {
  COORDINATE_SYSTEM_NOTE,
  INTRODUCTION,
  NEXT_MOVE_QUESTION,
  PromptStrategy,
  RESPONSE_FORMAT_INSTRUCTION,
  formatVisitHistory,
} from '@/prompt/strategy';

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
${INTRODUCTION}

Matrix (1 = wall, 0 = path):
[${matrixString}]

Positions:
- Start: (${maze.startPosition.x},${maze.startPosition.y})
- Goal: (${maze.goalPosition.x},${maze.goalPosition.y})
- Current: (${currentPosition.x},${currentPosition.y})

${formatVisitHistory(history)}

${NEXT_MOVE_QUESTION}

${COORDINATE_SYSTEM_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
