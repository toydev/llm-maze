import { Position } from '@/maze/types';

export const COORDINATE_SYSTEM_NOTE = `Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1`;

export const MATRIX_INDEXING_NOTE = 'Matrix indexing is [y][x].';

export const RESPONSE_FORMAT_INSTRUCTION = `Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}`;

export function formatVisitHistory(history: Position[]): string {
  return `You have visited the following positions in order:
${history.map((p) => `(${p.x},${p.y})`).join(' -> ')}`;
}
