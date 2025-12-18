// src/detail.ts

import fs from 'fs/promises';
import path from 'path';

import { defineCommand, runMain } from 'citty';
import yaml from 'yaml';

import { createLogger } from '@/logger/Logger';
import { Move, Position } from '@/maze/types';

const logger = createLogger('detail');

// execute.ts と共通の型定義
type PositionResult = {
  position: Position;
  isCorrect: boolean;
  llmMove: Move | 'error';
  optimalMoves: Move[];
  timeMs?: number;
};

type EvaluationResult = {
  mazeFile: string;
  modelName: string;
  strategyName: string;
  totalPositions: number;
  correctMoves: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimePerPositionMs: number;
  results: PositionResult[];
};

/**
 * outputディレクトリから最新のYAMLファイルを検索する
 * @param dir 検索を開始するディレクトリ
 * @returns YAMLファイルのパスの配列（更新日時降順）
 */
async function findYamlFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(await findYamlFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`Error reading directory ${dir}:`, error);
    }
  }
  return files;
}

/**
 * 時間をフォーマットする
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainSec = Math.round(sec % 60);
  return `${min}m${remainSec}s`;
}

/**
 * 迷路レイアウトに処理時間を重ねて表示する
 */
async function printTimingGrid(result: EvaluationResult): Promise<void> {
  const mazeLayout = (await fs.readFile(result.mazeFile, 'utf-8')).split('\n').filter((line) => line.length > 0);

  // 各マスの処理時間を取得
  const timeMap = new Map<string, number>();
  const correctMap = new Map<string, boolean>();
  let minTime = Infinity;
  let maxTime = 0;

  for (const posRes of result.results) {
    const key = `${posRes.position.x},${posRes.position.y}`;
    const time = posRes.timeMs ?? 0;
    timeMap.set(key, time);
    correctMap.set(key, posRes.isCorrect);
    if (time > 0) {
      minTime = Math.min(minTime, time);
      maxTime = Math.max(maxTime, time);
    }
  }

  // 時間をレベル（0-9）に変換
  const getTimeLevel = (ms: number): string => {
    if (maxTime === minTime) return '5';
    const normalized = (ms - minTime) / (maxTime - minTime);
    return Math.floor(normalized * 9).toString();
  };

  console.log(`\n--- Timing Grid ---`);
  console.log(`Min: ${formatTime(minTime)}, Max: ${formatTime(maxTime)}`);
  console.log(`Legend: 0=fastest ... 9=slowest, X=incorrect\n`);

  const grid = mazeLayout.map((row) => row.split(''));
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const key = `${x},${y}`;
      if (timeMap.has(key)) {
        const isCorrect = correctMap.get(key)!;
        if (!isCorrect) {
          grid[y][x] = 'X';
        } else {
          grid[y][x] = getTimeLevel(timeMap.get(key)!);
        }
      }
    }
  }
  console.log(grid.map((row) => row.join('')).join('\n'));
}

/**
 * マス毎の詳細を表示する
 */
function printPositionDetails(result: EvaluationResult): void {
  console.log(`\n--- Position Details ---`);
  console.log(`${'Position'.padEnd(12)}${'Result'.padEnd(10)}${'LLM Move'.padEnd(12)}${'Optimal'.padEnd(20)}${'Time'.padEnd(10)}`);
  console.log('-'.repeat(64));

  // 処理時間でソート（降順）
  const sorted = [...result.results].sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0));

  for (const posRes of sorted) {
    const pos = `(${posRes.position.x},${posRes.position.y})`.padEnd(12);
    const resultStr = (posRes.isCorrect ? 'O' : 'X').padEnd(10);
    const llmMove = String(posRes.llmMove).padEnd(12);
    const optimal = posRes.optimalMoves.join(',').padEnd(20);
    const time = formatTime(posRes.timeMs ?? 0).padEnd(10);
    console.log(`${pos}${resultStr}${llmMove}${optimal}${time}`);
  }
}

/**
 * 統計サマリーを表示する
 */
function printStatistics(result: EvaluationResult): void {
  const times = result.results.map((r) => r.timeMs ?? 0).filter((t) => t > 0);
  if (times.length === 0) {
    console.log('\nNo timing data available.');
    return;
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  // 標準偏差
  const variance = times.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  console.log(`\n--- Statistics ---`);
  console.log(`Total positions: ${result.results.length}`);
  console.log(`Correct: ${result.correctMoves} (${result.accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${formatTime(result.totalTimeMs)}`);
  console.log(`Average: ${formatTime(avg)}`);
  console.log(`Median: ${formatTime(median)}`);
  console.log(`Min: ${formatTime(min)}`);
  console.log(`Max: ${formatTime(max)}`);
  console.log(`Std Dev: ${formatTime(stdDev)}`);
}

const main = defineCommand({
  meta: {
    name: 'detail',
    description: '個別の結果ファイルの詳細を表示する',
  },
  args: {
    file: {
      type: 'positional',
      description: '結果ファイルのパス（省略時は最新のファイル）',
    },
  },
  async run({ args }) {
    const { file } = args;

    let targetFile: string;

    if (file) {
      targetFile = file;
    } else {
      // 最新のファイルを検索
      const outputDir = './output';
      const yamlFiles = await findYamlFiles(outputDir);
      if (yamlFiles.length === 0) {
        logger.error('No result files found in output directory.');
        return;
      }

      // ファイル名はタイムスタンプなのでソートして最新を取得
      yamlFiles.sort().reverse();
      targetFile = yamlFiles[0];
      logger.info(`Using latest result file: ${targetFile}`);
    }

    try {
      const content = await fs.readFile(targetFile, 'utf-8');
      const result = yaml.parse(content) as EvaluationResult;

      console.log(`\n=== ${path.basename(targetFile)} ===`);
      console.log(`Model: ${result.modelName}`);
      console.log(`Strategy: ${result.strategyName}`);
      console.log(`Maze: ${result.mazeFile}`);

      printStatistics(result);
      await printTimingGrid(result);
      printPositionDetails(result);
    } catch (error) {
      logger.error(`Failed to read or parse file ${targetFile}:`, error);
    }
  },
});

runMain(main);
