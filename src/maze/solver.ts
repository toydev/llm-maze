import { Maze } from '@/maze/Maze';
import { Position, Move } from '@/maze/types';

// ... (既存の solveWithAStar 関数はそのまま) ...

/**
 * ゴールからの距離を格納するマップの型
 * key: "x,y", value: 距離
 */
type DistanceMap = Map<string, number>;

/**
 * スタートから各位置への最短経路を格納するマップの型
 * key: "x,y", value: スタートからその位置への経路（Position配列）
 */
export type PathMap = Map<string, Position[]>;

/**
 * 各マスからの最適な次の一手を格納するマップの型
 * key: "x,y", value: ['up', 'down', 'left', 'right'] の配列
 */
export type OptimalMoveMap = Map<string, Move[]>;

/**
 * 幅優先探索(BFS)を用いて、ゴールから全ての到達可能なマスへの最短距離を計算します。
 * @param maze 迷路オブジェクト
 * @returns ゴールからの距離をマッピングしたDistanceMap
 */
function calculateDistancesFromEnd(maze: Maze): DistanceMap {
  const distances: DistanceMap = new Map();
  const queue: Position[] = [maze.endPosition];
  const endKey = `${maze.endPosition.x},${maze.endPosition.y}`;

  distances.set(endKey, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.x},${current.y}`;
    const currentDistance = distances.get(currentKey)!;

    const neighbors: Position[] = [
      { x: current.x, y: current.y - 1 }, // up
      { x: current.x, y: current.y + 1 }, // down
      { x: current.x - 1, y: current.y }, // left
      { x: current.x + 1, y: current.y }, // right
    ];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (maze.isTraversable(neighbor) && !distances.has(neighborKey)) {
        distances.set(neighborKey, currentDistance + 1);
        queue.push(neighbor);
      }
    }
  }

  return distances;
}

/**
 * 迷路の各マスからゴールに向かうための許容される次の一手のマップを生成します。
 * 「許容される」= 移動先の距離 ≦ 移動元の距離（遠ざからない移動）
 * @param maze 迷路オブジェクト
 * @returns 各マスの許容される移動をマッピングしたOptimalMoveMap
 */
export function createOptimalMoveMap(maze: Maze): OptimalMoveMap {
  const distances = calculateDistancesFromEnd(maze);
  const optimalMoves: OptimalMoveMap = new Map();

  for (const [posKey, distance] of distances.entries()) {
    const [x, y] = posKey.split(',').map(Number);
    const moves: Move[] = [];

    // Up
    const upDist = distances.get(`${x},${y - 1}`);
    if (upDist !== undefined && upDist <= distance) {
      moves.push('up');
    }
    // Down
    const downDist = distances.get(`${x},${y + 1}`);
    if (downDist !== undefined && downDist <= distance) {
      moves.push('down');
    }
    // Left
    const leftDist = distances.get(`${x - 1},${y}`);
    if (leftDist !== undefined && leftDist <= distance) {
      moves.push('left');
    }
    // Right
    const rightDist = distances.get(`${x + 1},${y}`);
    if (rightDist !== undefined && rightDist <= distance) {
      moves.push('right');
    }

    if (moves.length > 0) {
      optimalMoves.set(posKey, moves);
    }
  }

  return optimalMoves;
}

/**
 * BFSを用いて、スタートから全ての到達可能なマスへの最短経路を計算します。
 * @param maze 迷路オブジェクト
 * @returns 各位置への最短経路をマッピングしたPathMap
 */
export function createPathMapFromStart(maze: Maze): PathMap {
  const pathMap: PathMap = new Map();
  const parentMap = new Map<string, Position | null>();
  const queue: Position[] = [maze.startPosition];
  const startKey = `${maze.startPosition.x},${maze.startPosition.y}`;

  parentMap.set(startKey, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors: Position[] = [
      { x: current.x, y: current.y - 1 }, // up
      { x: current.x, y: current.y + 1 }, // down
      { x: current.x - 1, y: current.y }, // left
      { x: current.x + 1, y: current.y }, // right
    ];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (maze.isTraversable(neighbor) && !parentMap.has(neighborKey)) {
        parentMap.set(neighborKey, current);
        queue.push(neighbor);
      }
    }
  }

  // 各位置への経路を再構築
  for (const [posKey] of parentMap) {
    const path: Position[] = [];
    const [x, y] = posKey.split(',').map(Number);
    let current: Position | null = { x, y };

    while (current !== null) {
      path.unshift(current);
      const key: string = `${current.x},${current.y}`;
      current = parentMap.get(key) ?? null;
    }

    pathMap.set(posKey, path);
  }

  return pathMap;
}

// A*探索用のノード
interface Node {
  position: Position;
  parent: Node | null;
  g: number; // スタートからのコスト
  h: number; // ゴールまでの推定コスト
  f: number; // g + h
}

/**
 * マンハッタン距離を計算するヒューリスティック関数
 */
function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * A* (A-Star) 探索アルゴリズムを使用して迷路の最短経路を見つけます。
 * @param maze - 迷路オブジェクト
 * @returns 最短経路の座標リスト。経路が見つからない場合はnull。
 */
export function solveWithAStar(maze: Maze): Position[] | null {
  const startNode: Node = {
    position: maze.startPosition,
    parent: null,
    g: 0,
    h: heuristic(maze.startPosition, maze.endPosition),
    f: heuristic(maze.startPosition, maze.endPosition),
  };

  const openList: Node[] = [startNode];
  const closedList: Set<string> = new Set();

  while (openList.length > 0) {
    // openListからfコストが最小のノードを探す
    let lowestIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[lowestIndex].f) {
        lowestIndex = i;
      }
    }
    const currentNode = openList.splice(lowestIndex, 1)[0];

    // closedListに追加
    const posKey = `${currentNode.position.x},${currentNode.position.y}`;
    closedList.add(posKey);

    // ゴールに到達したかチェック
    if (currentNode.position.x === maze.endPosition.x && currentNode.position.y === maze.endPosition.y) {
      // 経路を再構築して返す
      const path: Position[] = [];
      let temp: Node | null = currentNode;
      while (temp !== null) {
        path.unshift(temp.position);
        temp = temp.parent;
      }
      return path;
    }

    // 隣接ノードを取得
    const neighbors: Position[] = [
      { x: currentNode.position.x, y: currentNode.position.y - 1 }, // up
      { x: currentNode.position.x, y: currentNode.position.y + 1 }, // down
      { x: currentNode.position.x - 1, y: currentNode.position.y }, // left
      { x: currentNode.position.x + 1, y: currentNode.position.y }, // right
    ];

    for (const nextPos of neighbors) {
      const nextPosKey = `${nextPos.x},${nextPos.y}`;

      // 移動可能か、またはclosedListに含まれていないか
      if (!maze.isTraversable(nextPos) || closedList.has(nextPosKey)) {
        continue;
      }

      const gScore = currentNode.g + 1; // 移動コストは1
      const hScore = heuristic(nextPos, maze.endPosition);
      const fScore = gScore + hScore;

      // openListに既に存在し、より良い経路でない場合はスキップ
      const existingNode = openList.find((node) => node.position.x === nextPos.x && node.position.y === nextPos.y);
      if (existingNode && gScore >= existingNode.g) {
        continue;
      }

      // 新しいノードまたはより良い経路
      const neighborNode: Node = {
        position: nextPos,
        parent: currentNode,
        g: gScore,
        h: hScore,
        f: fScore,
      };

      if (!existingNode) {
        openList.push(neighborNode);
      } else {
        // 既存のノードを更新
        existingNode.parent = currentNode;
        existingNode.g = gScore;
        existingNode.f = fScore;
      }
    }
  }

  // 経路が見つからなかった場合
  return null;
}
