import { Maze } from '@/maze/Maze';
import { CellType, Position } from '@/maze/types';
import { PromptStrategy } from '@/runner/prompt/PromptStrategy';

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

You have visited the following positions in order:
${history.map((p) => `(${p.x},${p.y})`).join(' -> ')}

What is your next move from your current position?
You can only move to an adjacent walkable position (not diagonal).

Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1

Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
`;
  }
}
