import { Maze, Position } from '@/maze/maze';

export interface PromptStrategy {
  buildPrompt(maze: Maze, current: Position, history: Position[] | null): string;
}

// Prompt components in order of appearance:

export const INTRODUCTION = `You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.`;

export function formatPositions(maze: Maze, current: Position): string {
  return `Positions:
- Start: (${maze.startPosition.x},${maze.startPosition.y})
- Goal: (${maze.goalPosition.x},${maze.goalPosition.y})
- Current: (${current.x},${current.y})`;
}

export function formatVisitHistory(history: Position[] | null): string {
  if (!history) return '';
  return `You have visited the following positions in order:
${history.map((p) => `(${p.x},${p.y})`).join(' -> ')}`;
}

export const NEXT_MOVE_QUESTION = `What is your next move from your current position?`;

export const COORDINATE_SYSTEM_NOTE = `Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1`;

export const RESPONSE_FORMAT_INSTRUCTION = `Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}`;
