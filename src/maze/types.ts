// src/maze/types.ts

/**
 * 各マスの種類を定義
 * Path: 道
 * Wall: 壁
 * Start: 開始地点
 * End: 終了地点
 */
export enum CellType {
  Path = '⬜️',
  Wall = '⬛️',
  Start = 'S',
  End = 'E',
  Current = 'C',
}

/**
 * 位置を表現するインターフェース
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * LLMの行動選択肢
 */
export type Move = 'up' | 'down' | 'left' | 'right';
