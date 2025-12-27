import pc from 'picocolors';
import prettyMs from 'pretty-ms';

import { type AccuracyData, type TimingData } from '@/execution/cell-stats';

function buildBaseGrid(layout: string[]): string[][] {
  return layout.map((row) => row.split('').map((char) => (char === '#' ? pc.gray('·') : char)));
}

function getAccuracyDisplay(rate: number): string {
  if (rate === 1) return pc.cyan('●');
  if (rate >= 0.9) return pc.green('9');
  if (rate >= 0.5) return pc.yellow(Math.floor(rate * 10).toString());
  return pc.red(Math.floor(rate * 10).toString());
}

export function renderAccuracyGrid(layout: string[], data: AccuracyData, indent = ''): void {
  console.log(`${indent}Legend: ${pc.cyan('●')}=100%, ${pc.green('9')}=90%+, ${pc.yellow('5-8')}=50%+, ${pc.red('0-4')}=<50%\n`);

  const grid = buildBaseGrid(layout);

  for (const [key, stats] of data) {
    if (stats.total > 0) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x] = getAccuracyDisplay(stats.correct / stats.total);
    }
  }

  console.log(grid.map((row) => indent + row.join('')).join('\n'));
}

export function renderTimingGrid(layout: string[], data: TimingData, trials: number, indent = ''): void {
  let minTime = Infinity;
  let maxTime = 0;

  for (const time of data.values()) {
    minTime = Math.min(minTime, time);
    maxTime = Math.max(maxTime, time);
  }

  const getTimingDisplay = (ms: number): string => {
    if (maxTime === minTime) return pc.yellow('5');
    const normalized = (ms - minTime) / (maxTime - minTime);
    const level = Math.floor(normalized * 9);
    const char = level.toString();
    if (level === 0) return pc.cyan(char);
    if (level <= 2) return pc.green(char);
    if (level <= 5) return pc.yellow(char);
    return pc.red(char);
  };

  console.log(`${indent}--- Timing Grid (avg of ${trials} trials) ---`);
  console.log(`${indent}Min avg: ${prettyMs(minTime)}, Max avg: ${prettyMs(maxTime)}`);
  console.log(`${indent}Legend: ${pc.cyan('0')}=fastest, ${pc.green('1-2')}=fast, ${pc.yellow('3-5')}=mid, ${pc.red('6-9')}=slow\n`);

  const grid = buildBaseGrid(layout);

  for (const [key, time] of data) {
    const [x, y] = key.split(',').map(Number);
    grid[y][x] = getTimingDisplay(time);
  }

  console.log(grid.map((row) => indent + row.join('')).join('\n'));
}
