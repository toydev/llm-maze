import fs from 'fs/promises';

import { Position, CellType } from '@/maze/types';

export class Maze {
  private readonly grid: CellType[][];
  public readonly layout: string[];
  public readonly startPosition: Position;
  public readonly endPosition: Position;
  public readonly height: number;
  public readonly width: number;

  static async fromFile(filePath: string): Promise<Maze> {
    const content = await fs.readFile(filePath, 'utf-8');
    const layout = content.split('\n').filter((line) => line.length > 0);
    return new Maze(layout);
  }

  constructor(layout: string[]) {
    this.layout = layout;
    if (layout.length === 0) {
      throw new Error('Maze layout cannot be empty.');
    }

    this.height = layout.length;
    this.width = layout[0].length;
    this.grid = [];

    let start: Position | null = null;
    let end: Position | null = null;

    for (let y = 0; y < this.height; y++) {
      const row: CellType[] = [];
      for (let x = 0; x < this.width; x++) {
        const char = layout[y][x];
        let cell: CellType;

        switch (char) {
          case '#':
            cell = CellType.Wall;
            break;
          case 'S':
            cell = CellType.Start;
            if (start) throw new Error('Multiple start positions found.');
            start = { x, y };
            break;
          case 'E':
            cell = CellType.End;
            if (end) throw new Error('Multiple end positions found.');
            end = { x, y };
            break;
          case ' ':
          default:
            cell = CellType.Path;
            break;
        }
        row.push(cell);
      }
      this.grid.push(row);
    }

    if (!start) throw new Error('No start position found.');
    if (!end) throw new Error('No end position found.');
    this.startPosition = start;
    this.endPosition = end;
  }

  public toString(currentPosition?: Position): string {
    return this.grid
      .map((row, y) =>
        row
          .map((cell, x) => {
            if (currentPosition && currentPosition.x === x && currentPosition.y === y) {
              return CellType.Current;
            }
            return cell;
          })
          .join(''),
      )
      .join('\n');
  }

  public getCellType(position: Position): CellType | undefined {
    if (position.y < 0 || position.y >= this.height || position.x < 0 || position.x >= this.width) {
      return undefined;
    }
    return this.grid[position.y][position.x];
  }

  public isTraversable(position: Position): boolean {
    const cellType = this.getCellType(position);
    return cellType !== undefined && cellType !== CellType.Wall;
  }
}
