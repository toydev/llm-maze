import { describe, it, expect } from 'vitest';
import { Maze, Position } from '@/maze/maze';
import { SimplePromptStrategy } from './simple';
import { ListPromptStrategy } from './list';
import { GraphPromptStrategy } from './graph';
import { MatrixPromptStrategy } from './matrix';

const layout = ['#####', '#S  #', '# # #', '#  G#', '#####'];
const maze = new Maze(layout);
const history: Position[] = [{ x: 1, y: 1 }];

describe('SimplePromptStrategy', () => {
  it('builds prompt with maze visualization', () => {
    const strategy = new SimplePromptStrategy();
    const prompt = strategy.build(maze, history);

    expect(prompt).toBe(`
You are a bot in a 2D maze. Your goal is to find the path from 'S' (Start) to 'G' (Goal).
'S' is the start, 'G' is the goal, '#' are walls, and ' ' are walkable paths.
'C' is your current position.

Maze:
#####
#C  #
# # #
#  G#
#####

You have visited the following positions in order:
(1,1)

What is your next move? You can only move to adjacent (not diagonal) walkable paths.

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

describe('ListPromptStrategy', () => {
  it('builds prompt with walkable position list', () => {
    const strategy = new ListPromptStrategy();
    const prompt = strategy.build(maze, history);

    expect(prompt).toBe(`
You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

Walkable positions in the maze:
["(1,1)","(2,1)","(3,1)","(1,2)","(3,2)","(1,3)","(2,3)","(3,3)"]

Positions:
- Start: (1,1)
- Goal: (3,3)
- Current: (1,1)

You have visited the following positions in order:
(1,1)

What is your next move from your current position?
You can only move to an adjacent walkable position (not diagonal).

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

describe('GraphPromptStrategy', () => {
  it('builds prompt with adjacency list', () => {
    const strategy = new GraphPromptStrategy();
    const prompt = strategy.build(maze, history);

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

describe('MatrixPromptStrategy', () => {
  it('builds prompt with binary matrix', () => {
    const strategy = new MatrixPromptStrategy();
    const prompt = strategy.build(maze, history);

    expect(prompt).toBe(`
You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

The maze is represented as a 2D matrix where:
- 1 = wall (impassable)
- 0 = path (walkable)

Maze Matrix:
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
- right: x+1 Matrix indexing is [y][x].

Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
`);
  });
});
