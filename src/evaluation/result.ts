import { z } from 'zod';

import type { Direction, Position } from '@/maze/maze';

export const MOVES = ['up', 'down', 'left', 'right'] as const;
export type Move = (typeof MOVES)[number];

export const MoveActionSchema = z.object({
  move: z.enum(MOVES),
});
export type MoveAction = z.infer<typeof MoveActionSchema>;

export function toMove(direction: Direction): Move {
  if (direction.dx === 0 && direction.dy === -1) return 'up';
  if (direction.dx === 0 && direction.dy === 1) return 'down';
  if (direction.dx === -1 && direction.dy === 0) return 'left';
  if (direction.dx === 1 && direction.dy === 0) return 'right';
  throw new Error(`Invalid direction: ${JSON.stringify(direction)}`);
}

export type Trial = {
  position: Position;
  isCorrect: boolean;
  llmMove: Move | null;
  validMoves: Move[];
  timeMs?: number;
};

export type Evaluation = {
  mazeFile: string;
  modelName: string;
  strategyName: string;
  totalPositions: number;
  correctMoves: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimePerPositionMs: number;
  trials: Trial[];
};
