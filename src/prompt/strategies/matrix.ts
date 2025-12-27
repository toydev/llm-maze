import { CellType, Maze, Position } from '@/maze/maze';
import {
  COORDINATE_SYSTEM_NOTE,
  INTRODUCTION,
  NEXT_MOVE_QUESTION,
  PromptStrategy,
  RESPONSE_FORMAT_INSTRUCTION,
  formatPositions,
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

  private formatMatrix(maze: Maze): string {
    const matrix = this.generateMatrix(maze);
    const matrixString = matrix.map((row) => JSON.stringify(row)).join(',\n');
    return `Matrix (1 = wall, 0 = path):\n[${matrixString}]`;
  }

  public buildPrompt(maze: Maze, current: Position, history: Position[] | null): string {
    return [
      INTRODUCTION,
      this.formatMatrix(maze),
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
