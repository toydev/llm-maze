import { z } from 'zod';

import { Position } from '@/maze/maze';

export const MOVES = ['up', 'down', 'left', 'right'] as const;
export type Move = (typeof MOVES)[number];

export const MoveActionSchema = z.object({
  move: z.enum(MOVES),
});
export type MoveAction = z.infer<typeof MoveActionSchema>;

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
