import { describe, it, expect } from 'vitest';
import { Maze, type Direction } from '@/maze/maze';

const DOWN: Direction = { dx: 0, dy: 1 };
const RIGHT: Direction = { dx: 1, dy: 0 };

describe('Maze.getDirectionsToGoal', () => {
  it('returns directions that approach the goal', () => {
    const layout = [
      '#####',
      '#S  #',
      '# # #',
      '#  G#',
      '#####',
    ];
    const maze = new Maze(layout);

    // Distance from goal(3,3):
    // (1,1)=4, (2,1)=3, (3,1)=2
    // (1,2)=3,        , (3,2)=1
    // (1,3)=2, (2,3)=1, (3,3)=0

    expect(maze.getDirectionsToGoal({ x: 1, y: 1 })).toEqual(expect.arrayContaining([DOWN, RIGHT]));
    expect(maze.getDirectionsToGoal({ x: 2, y: 1 })).toEqual([RIGHT]);
    expect(maze.getDirectionsToGoal({ x: 3, y: 1 })).toEqual([DOWN]);
    expect(maze.getDirectionsToGoal({ x: 1, y: 2 })).toEqual([DOWN]);
    expect(maze.getDirectionsToGoal({ x: 3, y: 2 })).toEqual([DOWN]);
    expect(maze.getDirectionsToGoal({ x: 1, y: 3 })).toEqual([RIGHT]);
    expect(maze.getDirectionsToGoal({ x: 2, y: 3 })).toEqual([RIGHT]);
    expect(maze.getDirectionsToGoal({ x: 3, y: 3 })).toEqual([]);
  });

  it('returns multiple directions when equidistant paths exist', () => {
    const layout = [
      '#####',
      '#S  #',
      '#   #',
      '#  G#',
      '#####',
    ];
    const maze = new Maze(layout);

    // Distance from goal(3,3):
    // (1,1)=4, (2,1)=3, (3,1)=2
    // (1,2)=3, (2,2)=2, (3,2)=1
    // (1,3)=2, (2,3)=1, (3,3)=0

    expect(maze.getDirectionsToGoal({ x: 2, y: 2 })).toEqual(expect.arrayContaining([DOWN, RIGHT]));
    expect(maze.getDirectionsToGoal({ x: 1, y: 2 })).toEqual(expect.arrayContaining([DOWN, RIGHT]));
  });
});

describe('Maze.getPathFromStart', () => {
  it('returns path from start to each position', () => {
    const layout = [
      '#####',
      '#S  #',
      '# # #',
      '#  G#',
      '#####',
    ];
    const maze = new Maze(layout);

    // Path to start itself
    expect(maze.getPathFromStart({ x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);

    // Path to goal
    const pathToGoal = maze.getPathFromStart({ x: 3, y: 3 });
    expect(pathToGoal[0]).toEqual({ x: 1, y: 1 }); // starts from start
    expect(pathToGoal[pathToGoal.length - 1]).toEqual({ x: 3, y: 3 }); // ends at goal
  });

  it('prioritizes axis with greater distance to goal', () => {
    const layout = [
      '#####',
      '#S  #',
      '#   #',
      '#  G#',
      '#####',
    ];
    const maze = new Maze(layout);

    const pathToGoal = maze.getPathFromStart({ x: 3, y: 3 });
    // Reduces dependency on maze orientation
    // Expected: (1,1) -> (1,2) -> (2,2) -> (2,3) -> (3,3)
    expect(pathToGoal).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });
});
