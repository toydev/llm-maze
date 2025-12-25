import { Maze } from '@/maze/maze';
import { Position } from '@/maze/maze';

export interface PromptStrategy {
  build(maze: Maze, history: Position[]): string;
}
