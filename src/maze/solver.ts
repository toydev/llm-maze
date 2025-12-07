// src/maze/solver.ts

import { Maze } from './Maze';
import { Position } from './types';

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
      const existingNode = openList.find(node => node.position.x === nextPos.x && node.position.y === nextPos.y);
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
