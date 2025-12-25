import { colors, colorize, formatDuration } from '@/cli/view/format';

export type AccuracyData = Map<string, { correct: number; total: number }>;
export type TimingData = Map<string, number>;

function buildBaseGrid(layout: string[]): string[][] {
  return layout.map((row) => row.split('').map((char) => (char === '#' ? colorize('·', colors.gray) : char)));
}

function getAccuracyDisplay(rate: number): string {
  if (rate === 1) return colorize('●', colors.cyan);
  if (rate >= 0.9) return colorize('9', colors.green);
  if (rate >= 0.5) return colorize(Math.floor(rate * 10).toString(), colors.yellow);
  return colorize(Math.floor(rate * 10).toString(), colors.red);
}

export function renderAccuracyGrid(layout: string[], data: AccuracyData, indent = ''): void {
  console.log(
    `${indent}Legend: ${colorize('●', colors.cyan)}=100%, ${colorize('9', colors.green)}=90%+, ${colorize('5-8', colors.yellow)}=50%+, ${colorize('0-4', colors.red)}=<50%\n`,
  );

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
    if (maxTime === minTime) return colorize('5', colors.yellow);
    const normalized = (ms - minTime) / (maxTime - minTime);
    const level = Math.floor(normalized * 9);
    const char = level.toString();
    if (level === 0) return colorize(char, colors.cyan);
    if (level <= 2) return colorize(char, colors.green);
    if (level <= 5) return colorize(char, colors.yellow);
    return colorize(char, colors.red);
  };

  console.log(`${indent}--- Timing Grid (avg of ${trials} trials) ---`);
  console.log(`${indent}Min avg: ${formatDuration(minTime)}, Max avg: ${formatDuration(maxTime)}`);
  console.log(
    `${indent}Legend: ${colorize('0', colors.cyan)}=fastest, ${colorize('1-2', colors.green)}=fast, ${colorize('3-5', colors.yellow)}=mid, ${colorize('6-9', colors.red)}=slow\n`,
  );

  const grid = buildBaseGrid(layout);

  for (const [key, time] of data) {
    const [x, y] = key.split(',').map(Number);
    grid[y][x] = getTimingDisplay(time);
  }

  console.log(grid.map((row) => indent + row.join('')).join('\n'));
}
