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

export class ListPromptStrategy implements PromptStrategy {
  private generateWalkableList(maze: Maze): string[] {
    const walkable: string[] = [];

    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        const cellType = maze.getCellType({ x, y });
        if (cellType !== CellType.Wall) {
          walkable.push(`(${x},${y})`);
        }
      }
    }
    return walkable;
  }

  public buildPrompt(maze: Maze, current: Position, history: Position[] | null): string {
    return [
      INTRODUCTION,
      `Walkable positions: ${JSON.stringify(this.generateWalkableList(maze))}`,
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
