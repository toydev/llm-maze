// src/runner/outputParser.ts
import { z } from 'zod';

export const MoveActionSchema = z.object({
  move: z.enum(['up', 'down', 'left', 'right']),
});

export type MoveAction = z.infer<typeof MoveActionSchema>;

// TODO: 他の出力形式もここで定義・パースする
// 例: 座標のリストを直接返す形式
// export const PathSchema = z.array(z.object({ x: z.number(), y: z.number() }));
