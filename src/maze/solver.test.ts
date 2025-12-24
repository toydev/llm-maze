import { describe, it, expect } from 'vitest';
import { Maze } from './Maze';
import { createValidMoveMap, createPathMapFromStart } from './solver';

describe('createValidMoveMap', () => {
  it('returns moves that approach the goal', () => {
    const layout = [
      '#####',
      '#S  #',
      '# # #',
      '#  E#',
      '#####',
    ];
    const maze = new Maze(layout);
    const moveMap = createValidMoveMap(maze);

    // Distance from goal(3,3):
    // (1,1)=4, (2,1)=3, (3,1)=2
    // (1,2)=3,        , (3,2)=1
    // (1,3)=2, (2,3)=1, (3,3)=0

    expect(moveMap.get('1,1')?.sort()).toEqual(['down', 'right']);
    expect(moveMap.get('2,1')).toEqual(['right']);
    expect(moveMap.get('3,1')).toEqual(['down']);
    expect(moveMap.get('1,2')).toEqual(['down']);
    expect(moveMap.get('3,2')).toEqual(['down']);
    expect(moveMap.get('1,3')).toEqual(['right']);
    expect(moveMap.get('2,3')).toEqual(['right']);
    expect(moveMap.has('3,3')).toBe(false);
  });

  it('allows lateral moves that maintain distance', () => {
    const layout = [
      '#####',
      '#S  #',
      '#   #',
      '#  E#',
      '#####',
    ];
    const maze = new Maze(layout);
    const moveMap = createValidMoveMap(maze);

    // Distance from goal(3,3):
    // (1,1)=4, (2,1)=3, (3,1)=2
    // (1,2)=3, (2,2)=2, (3,2)=1
    // (1,3)=2, (2,3)=1, (3,3)=0

    expect(moveMap.get('2,2')?.sort()).toEqual(['down', 'right']);
    expect(moveMap.get('1,2')?.sort()).toEqual(['down', 'right']);
  });
});

describe('createPathMapFromStart', () => {
  it('returns path from start to each position', () => {
    const layout = [
      '#####',
      '#S  #',
      '# # #',
      '#  E#',
      '#####',
    ];
    const maze = new Maze(layout);
    const pathMap = createPathMapFromStart(maze);

    // Path to start itself
    expect(pathMap.get('1,1')).toEqual([{ x: 1, y: 1 }]);

    // Path to goal
    const pathToGoal = pathMap.get('3,3');
    expect(pathToGoal?.[0]).toEqual({ x: 1, y: 1 }); // starts from start
    expect(pathToGoal?.[pathToGoal.length - 1]).toEqual({ x: 3, y: 3 }); // ends at goal
  });

  it('produces zigzag paths in open space', () => {
    const layout = [
      '#####',
      '#S  #',
      '#   #',
      '#  E#',
      '#####',
    ];
    const maze = new Maze(layout);
    const pathMap = createPathMapFromStart(maze);

    const pathToGoal = pathMap.get('3,3')!;
    // Zigzag: alternates vertical/horizontal moves toward goal
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
