export type Stats = {
  avg: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
};

export function calculateStats(times: number[]): Stats {
  if (times.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  }
  const sorted = [...times].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = sorted.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  return { avg, median, min, max, stdDev };
}
