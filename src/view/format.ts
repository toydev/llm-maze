import prettyMs from 'pretty-ms';

export function formatDuration(ms: number): string {
  return prettyMs(ms);
}

export function formatElapsed(ms: number): string {
  return prettyMs(ms, { colonNotation: true });
}
