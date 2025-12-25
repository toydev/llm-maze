import { Move } from '@/evaluation/result';
import { Maze, Position } from '@/maze/maze';

type DistanceMap = Map<string, number>;
export type PathMap = Map<string, Position[]>;
export type GoalwardMoveMap = Map<string, Move[]>;

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

export function createGoalwardMoveMap(maze: Maze): GoalwardMoveMap {
  const distances = calculateDistancesFromEnd(maze);
  const goalwardMoves: GoalwardMoveMap = new Map();

  for (const [posKey, distance] of distances.entries()) {
    const [x, y] = posKey.split(',').map(Number);
    const moves: Move[] = [];

    const upDist = distances.get(`${x},${y - 1}`);
    if (upDist !== undefined && upDist <= distance) {
      moves.push('up');
    }
    const downDist = distances.get(`${x},${y + 1}`);
    if (downDist !== undefined && downDist <= distance) {
      moves.push('down');
    }
    const leftDist = distances.get(`${x - 1},${y}`);
    if (leftDist !== undefined && leftDist <= distance) {
      moves.push('left');
    }
    const rightDist = distances.get(`${x + 1},${y}`);
    if (rightDist !== undefined && rightDist <= distance) {
      moves.push('right');
    }

    if (moves.length > 0) {
      goalwardMoves.set(posKey, moves);
    }
  }

  return goalwardMoves;
}

export function createPathMap(maze: Maze, from: Position): PathMap {
  const pathMap: PathMap = new Map();
  const parentMap = new Map<string, Position | null>();
  const queue: Position[] = [from];
  const fromKey = `${from.x},${from.y}`;
  const end = maze.endPosition;

  parentMap.set(fromKey, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const dx = Math.abs(end.x - current.x);
    const dy = Math.abs(end.y - current.y);

    // Prioritize the axis with greater distance to goal to reduce directional bias
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
