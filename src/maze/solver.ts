import { Maze } from '@/maze/Maze';
import { Position, Move } from '@/maze/types';

type DistanceMap = Map<string, number>;
export type PathMap = Map<string, Position[]>;
export type ValidMoveMap = Map<string, Move[]>;

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

export function createValidMoveMap(maze: Maze): ValidMoveMap {
  const distances = calculateDistancesFromEnd(maze);
  const validMoves: ValidMoveMap = new Map();

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
      validMoves.set(posKey, moves);
    }
  }

  return validMoves;
}

export function createPathMapFromStart(maze: Maze): PathMap {
  const pathMap: PathMap = new Map();
  const parentMap = new Map<string, Position | null>();
  const queue: Position[] = [maze.startPosition];
  const startKey = `${maze.startPosition.x},${maze.startPosition.y}`;
  const end = maze.endPosition;

  parentMap.set(startKey, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const dx = Math.abs(end.x - current.x);
    const dy = Math.abs(end.y - current.y);

    // Zigzag: vertical-first when dy >= dx, horizontal-first otherwise
    const neighbors: Position[] =
      dy >= dx
        ? [
            { x: current.x, y: current.y - 1 }, // up
            { x: current.x, y: current.y + 1 }, // down
            { x: current.x - 1, y: current.y }, // left
            { x: current.x + 1, y: current.y }, // right
          ]
        : [
            { x: current.x - 1, y: current.y }, // left
            { x: current.x + 1, y: current.y }, // right
            { x: current.x, y: current.y - 1 }, // up
            { x: current.x, y: current.y + 1 }, // down
          ];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (maze.isTraversable(neighbor) && !parentMap.has(neighborKey)) {
        parentMap.set(neighborKey, current);
        queue.push(neighbor);
      }
    }
  }

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

interface Node {
  position: Position;
  parent: Node | null;
  g: number;
  h: number;
  f: number;
}

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

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
    let lowestIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[lowestIndex].f) {
        lowestIndex = i;
      }
    }
    const currentNode = openList.splice(lowestIndex, 1)[0];
    const posKey = `${currentNode.position.x},${currentNode.position.y}`;
    closedList.add(posKey);

    if (currentNode.position.x === maze.endPosition.x && currentNode.position.y === maze.endPosition.y) {
      const path: Position[] = [];
      let temp: Node | null = currentNode;
      while (temp !== null) {
        path.unshift(temp.position);
        temp = temp.parent;
      }
      return path;
    }

    const neighbors: Position[] = [
      { x: currentNode.position.x, y: currentNode.position.y - 1 }, // up
      { x: currentNode.position.x, y: currentNode.position.y + 1 }, // down
      { x: currentNode.position.x - 1, y: currentNode.position.y }, // left
      { x: currentNode.position.x + 1, y: currentNode.position.y }, // right
    ];

    for (const nextPos of neighbors) {
      const nextPosKey = `${nextPos.x},${nextPos.y}`;
      if (!maze.isTraversable(nextPos) || closedList.has(nextPosKey)) {
        continue;
      }

      const gScore = currentNode.g + 1;
      const hScore = heuristic(nextPos, maze.endPosition);
      const fScore = gScore + hScore;
      const existingNode = openList.find((node) => node.position.x === nextPos.x && node.position.y === nextPos.y);
      if (existingNode && gScore >= existingNode.g) {
        continue;
      }

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
        existingNode.parent = currentNode;
        existingNode.g = gScore;
        existingNode.f = fScore;
      }
    }
  }

  return null;
}
