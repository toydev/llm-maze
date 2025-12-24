import { z } from 'zod';

import { MOVES } from '@/maze/types';

export const MoveActionSchema = z.object({
  move: z.enum(MOVES),
});

export type MoveAction = z.infer<typeof MoveActionSchema>;
