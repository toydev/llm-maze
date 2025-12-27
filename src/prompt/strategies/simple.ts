import { Maze, Position } from '@/maze/maze';
import { COORDINATE_SYSTEM_NOTE, INTRODUCTION, NEXT_MOVE_QUESTION, PromptStrategy, RESPONSE_FORMAT_INSTRUCTION, formatVisitHistory } from '@/prompt/strategy';

export class SimplePromptStrategy implements PromptStrategy {
  private renderMaze(maze: Maze, current: Position): string {
    return maze.layout
      .map((row, y) =>
        row
          .split('')
          .map((char, x) => (x === current.x && y === current.y ? 'C' : char))
          .join(''),
      )
      .join('\n');
  }

  public buildPrompt(maze: Maze, current: Position, history: Position[] | null): string {
    return [
      INTRODUCTION,
      `Legend: 'S' = Start, 'G' = Goal, '#' = Wall, ' ' = Path, 'C' = Current position\n\nMaze:\n${this.renderMaze(maze, current)}`,
      formatVisitHistory(history),
      NEXT_MOVE_QUESTION,
      COORDINATE_SYSTEM_NOTE,
      RESPONSE_FORMAT_INSTRUCTION,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
