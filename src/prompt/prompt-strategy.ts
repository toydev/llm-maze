import { Maze } from '@/maze/maze';
import { Position } from '@/maze/types';

export interface PromptStrategy {
  build(maze: Maze, history: Position[]): string;
}
