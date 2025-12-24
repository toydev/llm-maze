import { z } from 'zod';

export const MoveActionSchema = z.object({
  move: z.enum(['up', 'down', 'left', 'right']),
});

export type MoveAction = z.infer<typeof MoveActionSchema>;
