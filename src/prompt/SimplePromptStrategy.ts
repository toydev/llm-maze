import { Maze } from '@/maze/Maze';
import { Position } from '@/maze/types';
import { PromptStrategy } from '@/prompt/PromptStrategy';

export class SimplePromptStrategy implements PromptStrategy {
  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const mazeString = maze.toString(currentPosition);

    return `
You are a bot in a 2D maze. Your goal is to find the path from 'S' to 'E'.
'S' is the start, 'E' is the end, '⬛️' are walls, and '⬜️' are walkable paths.
'C' is your current position.

Maze:
${mazeString}

You have visited the following positions in order:
${history.map((p) => `(${p.x},${p.y})`).join(' -> ')}

What is your next move? You can only move to adjacent (not diagonal) walkable paths.

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
