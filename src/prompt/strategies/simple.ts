import { Maze, Position } from '@/maze/maze';
import { COORDINATE_SYSTEM_NOTE, PromptStrategy, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/strategy';

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

  public buildPrompt(maze: Maze, history: Position[]): string {
    const currentPosition = history[history.length - 1];
    const mazeString = this.renderMaze(maze, currentPosition);

    return `
You are a bot in a 2D maze. Your goal is to find the path from 'S' (Start) to 'G' (Goal).
'S' is the start, 'G' is the goal, '#' are walls, and ' ' are walkable paths.
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
