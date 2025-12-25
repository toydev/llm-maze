import { Maze } from '@/maze/maze';
import { CellType, Position } from '@/maze/maze';
import { PromptStrategy } from '@/prompt/strategy';
import { COORDINATE_SYSTEM_NOTE, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/template';

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

  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const walkableList = this.generateWalkableList(maze);

    return `
You are a bot in a 2D maze. Your goal is to find the path from Start to End.

Walkable positions in the maze:
${JSON.stringify(walkableList)}

Positions:
- Start: (${maze.startPosition.x},${maze.startPosition.y})
- End: (${maze.endPosition.x},${maze.endPosition.y})
- Current: (${currentPosition.x},${currentPosition.y})

${formatVisitHistory(history)}

What is your next move from your current position?
You can only move to an adjacent walkable position (not diagonal).

${COORDINATE_SYSTEM_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
