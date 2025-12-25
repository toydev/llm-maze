import { Maze } from '@/maze/maze';
import { Position } from '@/maze/types';
import { PromptStrategy } from '@/prompt/prompt-strategy';
import { COORDINATE_SYSTEM_NOTE, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/prompt-template';

export class SimplePromptStrategy implements PromptStrategy {
  private renderMaze(maze: Maze, currentPosition: Position): string {
    return maze.layout
      .map((row, y) =>
        row
          .split('')
          .map((char, x) => (x === currentPosition.x && y === currentPosition.y ? 'C' : char))
          .join(''),
      )
      .join('\n');
  }

  public build(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const mazeString = this.renderMaze(maze, currentPosition);

    return `
You are a bot in a 2D maze. Your goal is to find the path from 'S' to 'E'.
'S' is the start, 'E' is the end, '#' are walls, and ' ' are walkable paths.
'C' is your current position.

Maze:
${mazeString}

${formatVisitHistory(history)}

What is your next move? You can only move to adjacent (not diagonal) walkable paths.

${COORDINATE_SYSTEM_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
