import { describe, it, expect } from 'vitest';
import { Maze, Position } from '@/maze/maze';
import { MatrixPromptStrategy } from './matrix';

const layout = ['#####', '#S  #', '# # #', '#  G#', '#####'];
const maze = new Maze(layout);
const current: Position = { x: 1, y: 1 };
const history: Position[] = [current];

describe('MatrixPromptStrategy', () => {
  it('builds prompt with binary matrix', () => {
    const strategy = new MatrixPromptStrategy();
    const prompt = strategy.buildPrompt(maze, current, history);

    expect(prompt).toBe(`You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

Matrix (1 = wall, 0 = path):
[[1,1,1,1,1],
[1,0,0,0,1],
[1,0,1,0,1],
[1,0,0,0,1],
[1,1,1,1,1]]

Positions:
- Start: (1,1)
- Goal: (3,3)
- Current: (1,1)

You have visited the following positions in order:
(1,1)

What is your next move from your current position?

Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1

Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}`);
  });
});
