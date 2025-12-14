import { Maze } from '@/maze/Maze';
import { Position, Move } from '@/maze/types';

// ... (既存の solveWithAStar 関数はそのまま) ...

/**
 * ゴールからの距離を格納するマップの型
 * key: "x,y", value: 距離
 */
type DistanceMap = Map<string, number>;

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
 * 迷路の各マスからゴールに向かうための最適な次の一手（模範解答）のマップを生成します。
 * @param maze 迷路オブジェクト
 * @returns 各マスの模範解答をマッピングしたOptimalMoveMap
 */
export function createOptimalMoveMap(maze: Maze): OptimalMoveMap {
  const distances = calculateDistancesFromEnd(maze);
  const optimalMoves: OptimalMoveMap = new Map();

  for (const [posKey, distance] of distances.entries()) {
    const [x, y] = posKey.split(',').map(Number);
    const moves: Move[] = [];

    // Up
    const upPos = { x, y: y - 1 };
    if (distances.get(`${upPos.x},${upPos.y}`) === distance - 1) {
      moves.push('up');
    }
    // Down
    const downPos = { x, y: y + 1 };
    if (distances.get(`${downPos.x},${downPos.y}`) === distance - 1) {
      moves.push('down');
    }
    // Left
    const leftPos = { x: x - 1, y };
    if (distances.get(`${leftPos.x},${leftPos.y}`) === distance - 1) {
      moves.push('left');
    }
    // Right
    const rightPos = { x: x + 1, y };
    if (distances.get(`${rightPos.x},${rightPos.y}`) === distance - 1) {
      moves.push('right');
    }

    if (moves.length > 0) {
      optimalMoves.set(posKey, moves);
    }
  }

  return optimalMoves;
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
