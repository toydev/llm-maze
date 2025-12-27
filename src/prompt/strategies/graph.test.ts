import { describe, it, expect } from 'vitest';
import { Maze, Position } from '@/maze/maze';
import { GraphPromptStrategy } from './graph';

const layout = ['#####', '#S  #', '# # #', '#  G#', '#####'];
const maze = new Maze(layout);
const current: Position = { x: 1, y: 1 };
const history: Position[] = [current];

describe('GraphPromptStrategy', () => {
  it('builds prompt with adjacency list', () => {
    const strategy = new GraphPromptStrategy();
    const prompt = strategy.buildPrompt(maze, current, history);

    expect(prompt).toBe(`You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

Graph (adjacency list): each key "x,y" maps to adjacent walkable positions.
{
  "1,1": [
    "1,2",
    "2,1"
  ],
  "2,1": [
    "1,1",
    "3,1"
  ],
  "3,1": [
    "3,2",
    "2,1"
  ],
  "1,2": [
    "1,1",
    "1,3"
  ],
  "3,2": [
    "3,1",
    "3,3"
  ],
  "1,3": [
    "1,2",
    "2,3"
  ],
  "2,3": [
    "1,3",
    "3,3"
  ],
  "3,3": [
    "3,2",
    "2,3"
  ]
}

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
