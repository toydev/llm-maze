import { describe, it, expect } from 'vitest';
import { Maze } from './Maze';
import { createOptimalMoveMap } from './solver';

describe('createOptimalMoveMap', () => {
  it('5x5_simple: 各位置から遠ざからない移動を返す', () => {
    const layout = [
      '#####',
      '#S  #',
      '# # #',
      '#  E#',
      '#####',
    ];
    const maze = new Maze(layout);
    const moveMap = createOptimalMoveMap(maze);

    // ゴール(3,3)からの距離:
    // (1,1)=4, (2,1)=3, (3,1)=2
    // (1,2)=3,        , (3,2)=1
    // (1,3)=2, (2,3)=1, (3,3)=0

    // (1,1): down→(1,2)距離3, right→(2,1)距離3 どちらも≤4でOK
    expect(moveMap.get('1,1')?.sort()).toEqual(['down', 'right']);

    // (2,1): right→(3,1)距離2≤3 OK, left→(1,1)距離4>3 NG
    expect(moveMap.get('2,1')).toEqual(['right']);

    // (3,1): down→(3,2)距離1≤2 OK
    expect(moveMap.get('3,1')).toEqual(['down']);

    // (1,2): down→(1,3)距離2≤3 OK, up→(1,1)距離4>3 NG
    expect(moveMap.get('1,2')).toEqual(['down']);

    // (3,2): down→(3,3)距離0≤1 OK, up→(3,1)距離2>1 NG
    expect(moveMap.get('3,2')).toEqual(['down']);

    // (1,3): right→(2,3)距離1≤2 OK, up→(1,2)距離3>2 NG
    expect(moveMap.get('1,3')).toEqual(['right']);

    // (2,3): right→(3,3)距離0≤1 OK, left→(1,3)距離2>1 NG
    expect(moveMap.get('2,3')).toEqual(['right']);

    // ゴール(3,3)は移動先がないので含まれない
    expect(moveMap.has('3,3')).toBe(false);
  });

  it('広い空間: 同距離への横移動も許容される', () => {
    const layout = [
      '#####',
      '#S  #',
      '#   #',
      '#  E#',
      '#####',
    ];
    const maze = new Maze(layout);
    const moveMap = createOptimalMoveMap(maze);

    // ゴール(3,3)からの距離:
    // (1,1)=4, (2,1)=3, (3,1)=2
    // (1,2)=3, (2,2)=2, (3,2)=1
    // (1,3)=2, (2,3)=1, (3,3)=0

    // (2,2): 距離2
    // up→(2,1)距離3>2 NG
    // down→(2,3)距離1≤2 OK
    // left→(1,2)距離3>2 NG
    // right→(3,2)距離1≤2 OK
    expect(moveMap.get('2,2')?.sort()).toEqual(['down', 'right']);

    // (1,2): 距離3
    // up→(1,1)距離4>3 NG
    // down→(1,3)距離2≤3 OK
    // right→(2,2)距離2≤3 OK
    expect(moveMap.get('1,2')?.sort()).toEqual(['down', 'right']);
  });
});
