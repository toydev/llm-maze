export enum CellType {
  Path = ' ',
  Wall = '#',
  Start = 'S',
  End = 'E',
}

export interface Position {
  x: number;
  y: number;
}

export type Move = 'up' | 'down' | 'left' | 'right';
