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

// ANSIカラーコード
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

function colorize(text: string, color: string): string {
  return `${color}${text}${colors.reset}`;
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
 * 複数の結果を集約する
 */
function aggregateResults(results: EvaluationResult[]): {
  totalTrials: number;
  positionStats: Map<string, { times: number[]; correctCount: number; totalCount: number }>;
  overallStats: { times: number[]; correctCount: number; totalCount: number };
} {
  const positionStats = new Map<string, { times: number[]; correctCount: number; totalCount: number }>();
  const overallStats = { times: [] as number[], correctCount: 0, totalCount: 0 };

  for (const result of results) {
    for (const posRes of result.results) {
      const key = `${posRes.position.x},${posRes.position.y}`;
      if (!positionStats.has(key)) {
        positionStats.set(key, { times: [], correctCount: 0, totalCount: 0 });
      }
      const stats = positionStats.get(key)!;
      if (posRes.timeMs) {
        stats.times.push(posRes.timeMs);
        overallStats.times.push(posRes.timeMs);
      }
      if (posRes.isCorrect) {
        stats.correctCount++;
        overallStats.correctCount++;
      }
      stats.totalCount++;
      overallStats.totalCount++;
    }
  }

  return { totalTrials: results.length, positionStats, overallStats };
}

/**
 * 集約した統計を表示する
 */
function printAggregatedStatistics(agg: ReturnType<typeof aggregateResults>): void {
  const { times, correctCount, totalCount } = agg.overallStats;
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

  const variance = times.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  const accuracy = (correctCount / totalCount) * 100;

  console.log(`\n--- Statistics (${agg.totalTrials} trials) ---`);
  console.log(`Total positions: ${totalCount} (${totalCount / agg.totalTrials} per trial)`);
  console.log(`Correct: ${correctCount}/${totalCount} (${accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${formatTime(sum)}`);
  console.log(`Average: ${formatTime(avg)}`);
  console.log(`Median: ${formatTime(median)}`);
  console.log(`Min: ${formatTime(min)}`);
  console.log(`Max: ${formatTime(max)}`);
  console.log(`Std Dev: ${formatTime(stdDev)}`);
}

/**
 * 集約したタイミンググリッドを表示する
 */
async function printAggregatedTimingGrid(
  mazeFile: string,
  agg: ReturnType<typeof aggregateResults>,
): Promise<void> {
  const mazeLayout = (await fs.readFile(mazeFile, 'utf-8')).split('\n').filter((line) => line.length > 0);

  let minAvgTime = Infinity;
  let maxAvgTime = 0;

  const avgTimeMap = new Map<string, number>();

  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const avgTime = stats.times.reduce((a, b) => a + b, 0) / stats.times.length;
      avgTimeMap.set(key, avgTime);
      minAvgTime = Math.min(minAvgTime, avgTime);
      maxAvgTime = Math.max(maxAvgTime, avgTime);
    }
  }

  // 時間レベル(0-9)に応じた色を返す
  const getTimeLevelWithColor = (ms: number): string => {
    if (maxAvgTime === minAvgTime) return colorize('5', colors.yellow);
    const normalized = (ms - minAvgTime) / (maxAvgTime - minAvgTime);
    const level = Math.floor(normalized * 9);
    const char = level.toString();
    // 0: 水色(最速), 1-2: 緑(速い), 3-5: 黄(普通), 6-9: 赤(遅い)
    if (level === 0) return colorize(char, colors.cyan);
    if (level <= 2) return colorize(char, colors.green);
    if (level <= 5) return colorize(char, colors.yellow);
    return colorize(char, colors.red);
  };

  console.log(`\n--- Timing Grid (avg of ${agg.totalTrials} trials) ---`);
  console.log(`Min avg: ${formatTime(minAvgTime)}, Max avg: ${formatTime(maxAvgTime)}`);
  console.log(`Legend: ${colorize('0', colors.cyan)}=fastest, ${colorize('1-2', colors.green)}=fast, ${colorize('3-5', colors.yellow)}=mid, ${colorize('6-9', colors.red)}=slow\n`);

  const grid: string[][] = mazeLayout.map((row) =>
    row.split('').map((char) => (char === '#' ? colorize('·', colors.gray) : char)),
  );

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < mazeLayout[y].length; x++) {
      const key = `${x},${y}`;
      if (avgTimeMap.has(key)) {
        grid[y][x] = getTimeLevelWithColor(avgTimeMap.get(key)!);
      }
    }
  }
  console.log(grid.map((row) => row.join('')).join('\n'));
}

/**
 * 集約した正解率グリッドを表示する
 */
async function printAggregatedAccuracyGrid(
  mazeFile: string,
  agg: ReturnType<typeof aggregateResults>,
): Promise<void> {
  const mazeLayout = (await fs.readFile(mazeFile, 'utf-8')).split('\n').filter((line) => line.length > 0);

  console.log(`\n--- Accuracy Grid (${agg.totalTrials} trials) ---`);
  console.log(`Legend: ${colorize('●', colors.cyan)}=100%, ${colorize('9', colors.green)}=90%+, ${colorize('7-8', colors.yellow)}=70%+, ${colorize('5-6', colors.yellow)}=50%+, ${colorize('0-4', colors.red)}=<50%\n`);

  const grid: string[][] = mazeLayout.map((row) =>
    row.split('').map((char) => (char === '#' ? colorize('·', colors.gray) : char)),
  );

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < mazeLayout[y].length; x++) {
      const key = `${x},${y}`;
      const stats = agg.positionStats.get(key);
      if (stats && stats.totalCount > 0) {
        const rate = stats.correctCount / stats.totalCount;
        if (rate === 1) {
          grid[y][x] = colorize('●', colors.cyan);
        } else if (rate >= 0.9) {
          grid[y][x] = colorize('9', colors.green);
        } else if (rate >= 0.7) {
          grid[y][x] = colorize(Math.floor(rate * 10).toString(), colors.yellow);
        } else if (rate >= 0.5) {
          grid[y][x] = colorize(Math.floor(rate * 10).toString(), colors.yellow);
        } else {
          grid[y][x] = colorize(Math.floor(rate * 10).toString(), colors.red);
        }
      }
    }
  }
  console.log(grid.map((row) => row.join('')).join('\n'));
}

/**
 * 位置ごとの詳細を表示する（処理時間順）
 */
function printAggregatedPositionDetails(agg: ReturnType<typeof aggregateResults>): void {
  console.log(`\n--- Position Details (sorted by avg time) ---`);
  console.log(`${'Position'.padEnd(12)}${'Accuracy'.padEnd(12)}${'Avg Time'.padEnd(12)}${'Min'.padEnd(10)}${'Max'.padEnd(10)}${'StdDev'.padEnd(10)}`);
  console.log('-'.repeat(66));

  const entries: { key: string; avgTime: number; accuracy: number; min: number; max: number; stdDev: number }[] = [];

  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const times = stats.times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const variance = times.reduce((acc, t) => acc + Math.pow(t - avgTime, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      const accuracy = stats.correctCount / stats.totalCount;
      entries.push({ key, avgTime, accuracy, min, max, stdDev });
    }
  }

  entries.sort((a, b) => b.avgTime - a.avgTime);

  for (const entry of entries) {
    const [x, y] = entry.key.split(',');
    const pos = `(${x},${y})`.padEnd(12);
    const acc = `${(entry.accuracy * 100).toFixed(0)}%`.padEnd(12);
    const avgTime = formatTime(entry.avgTime).padEnd(12);
    const min = formatTime(entry.min).padEnd(10);
    const max = formatTime(entry.max).padEnd(10);
    const stdDev = formatTime(entry.stdDev).padEnd(10);
    console.log(`${pos}${acc}${avgTime}${min}${max}${stdDev}`);
  }
}

type JsonOutput = {
  model: string;
  maze: string;
  strategy: string;
  trials: number;
  accuracy: number;
  totalPositions: number;
  correctCount: number;
  avgTimeMs: number;
  medianTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  stdDevMs: number;
  positions: {
    x: number;
    y: number;
    accuracy: number;
    avgTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    stdDevMs: number;
  }[];
};

function buildJsonOutput(
  model: string,
  maze: string,
  strategy: string,
  agg: ReturnType<typeof aggregateResults>,
): JsonOutput {
  const { times, correctCount, totalCount } = agg.overallStats;
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const median = times[Math.floor(times.length / 2)] || 0;
  const min = times[0] || 0;
  const max = times[times.length - 1] || 0;
  const variance = times.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  const positions: JsonOutput['positions'] = [];
  for (const [key, stats] of agg.positionStats) {
    if (stats.times.length > 0) {
      const [x, y] = key.split(',').map(Number);
      const posTimes = stats.times;
      const posAvg = posTimes.reduce((a, b) => a + b, 0) / posTimes.length;
      const posMin = Math.min(...posTimes);
      const posMax = Math.max(...posTimes);
      const posVariance = posTimes.reduce((acc, t) => acc + Math.pow(t - posAvg, 2), 0) / posTimes.length;
      const posStdDev = Math.sqrt(posVariance);
      positions.push({
        x,
        y,
        accuracy: stats.correctCount / stats.totalCount,
        avgTimeMs: Math.round(posAvg),
        minTimeMs: posMin,
        maxTimeMs: posMax,
        stdDevMs: Math.round(posStdDev),
      });
    }
  }
  // 処理時間降順でソート
  positions.sort((a, b) => b.avgTimeMs - a.avgTimeMs);

  return {
    model,
    maze,
    strategy,
    trials: agg.totalTrials,
    accuracy: (correctCount / totalCount) * 100,
    totalPositions: totalCount / agg.totalTrials,
    correctCount,
    avgTimeMs: Math.round(avg),
    medianTimeMs: Math.round(median),
    minTimeMs: min,
    maxTimeMs: max,
    stdDevMs: Math.round(stdDev),
    positions,
  };
}

const main = defineCommand({
  meta: {
    name: 'detail',
    description: '指定条件の結果ファイルを集約して詳細を表示する',
  },
  args: {
    model: {
      type: 'positional',
      required: true,
      description: 'モデル名',
    },
    maze: {
      type: 'positional',
      required: true,
      description: '迷路名',
    },
    strategy: {
      type: 'positional',
      required: true,
      description: '戦略名',
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'JSON形式で出力（エージェント向け）',
    },
  },
  async run({ args }) {
    const { model, maze, strategy, json } = args;

    const outputDir = './output';
    const yamlFiles = await findYamlFiles(outputDir);
    if (yamlFiles.length === 0) {
      if (json) {
        console.log(JSON.stringify({ error: 'No result files found' }));
      } else {
        logger.error('No result files found in output directory.');
      }
      return;
    }

    // 条件に一致するファイルを読み込む
    const matchingResults: EvaluationResult[] = [];
    let mazeFile = '';

    for (const file of yamlFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const result = yaml.parse(content) as EvaluationResult;

        if (
          result.modelName.includes(model) &&
          result.mazeFile.includes(maze) &&
          result.strategyName === strategy
        ) {
          matchingResults.push(result);
          mazeFile = result.mazeFile;
        }
      } catch {
        // skip invalid files
      }
    }

    if (matchingResults.length === 0) {
      if (json) {
        console.log(JSON.stringify({ error: `No results found for: model=${model}, maze=${maze}, strategy=${strategy}` }));
      } else {
        logger.error(`No results found for: model=${model}, maze=${maze}, strategy=${strategy}`);
      }
      return;
    }

    const agg = aggregateResults(matchingResults);

    if (json) {
      const output = buildJsonOutput(model, maze, strategy, agg);
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`\n=== Detail Analysis ===`);
    console.log(`Model: ${model}`);
    console.log(`Maze: ${maze}`);
    console.log(`Strategy: ${strategy}`);
    console.log(`Files: ${matchingResults.length}`);

    printAggregatedStatistics(agg);
    await printAggregatedAccuracyGrid(mazeFile, agg);
    await printAggregatedTimingGrid(mazeFile, agg);
    printAggregatedPositionDetails(agg);
  },
});

runMain(main);
