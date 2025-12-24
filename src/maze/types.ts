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

export const MOVES = ['up', 'down', 'left', 'right'] as const;
export type Move = (typeof MOVES)[number];
