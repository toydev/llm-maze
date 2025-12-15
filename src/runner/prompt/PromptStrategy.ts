import { Maze } from '@/maze/Maze';
import { Position } from '@/maze/types';

export interface PromptStrategy {
  build(maze: Maze, history: Position[]): string;
}
