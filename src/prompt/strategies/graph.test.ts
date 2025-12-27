import { describe, it, expect } from 'vitest';
import { Maze, Position } from '@/maze/maze';
import { GraphPromptStrategy } from './graph';

const layout = ['#####', '#S  #', '# # #', '#  G#', '#####'];
const maze = new Maze(layout);
const history: Position[] = [{ x: 1, y: 1 }];

describe('GraphPromptStrategy', () => {
  it('builds prompt with adjacency list', () => {
    const strategy = new GraphPromptStrategy();
    const prompt = strategy.buildPrompt(maze, history);

    expect(prompt).toBe(`
You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

The maze is represented as a graph data structure (adjacency list).
Each key is a "node" representing a walkable coordinate "x,y".
The value is an array of "edges" to adjacent walkable coordinates.

- Start position: "1,1"
- Goal position: "3,3"
- Your current position: "1,1"

Maze Graph:
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

You have visited the following positions in order:
(1,1)

Based on the graph, what is your next move from your current position?
You can only move to an adjacent node connected by an edge.

Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1

Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
`);
  });
});
