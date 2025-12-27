import { Maze, Position } from '@/maze/maze';

export interface PromptStrategy {
  buildPrompt(maze: Maze, history: Position[]): string;
}

export const INTRODUCTION = `You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.`;

export const NEXT_MOVE_QUESTION = `What is your next move from your current position?`;

export const COORDINATE_SYSTEM_NOTE = `Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1`;

export const RESPONSE_FORMAT_INSTRUCTION = `Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}`;

export function formatVisitHistory(history: Position[]): string {
  return `You have visited the following positions in order:
${history.map((p) => `(${p.x},${p.y})`).join(' -> ')}`;
}
