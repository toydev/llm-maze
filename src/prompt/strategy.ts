import { Maze, Position } from '@/maze/maze';

export interface PromptStrategy {
  buildPrompt(maze: Maze, history: Position[]): string;
}
