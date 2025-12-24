import { describe, it, expect } from 'vitest';
import { Maze } from './Maze';
import { createValidMoveMap } from './solver';

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
