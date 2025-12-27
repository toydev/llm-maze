import { Maze, Position } from '@/maze/maze';
import {
  COORDINATE_SYSTEM_NOTE,
  INTRODUCTION,
  NEXT_MOVE_QUESTION,
  PromptStrategy,
  RESPONSE_FORMAT_INSTRUCTION,
  formatVisitHistory,
} from '@/prompt/strategy';

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
${INTRODUCTION}

Legend: 'S' = Start, 'G' = Goal, '#' = Wall, ' ' = Path, 'C' = Current position

Maze:
${mazeString}

${formatVisitHistory(history)}

${NEXT_MOVE_QUESTION}

${COORDINATE_SYSTEM_NOTE}

${RESPONSE_FORMAT_INSTRUCTION}
`;
  }
}
