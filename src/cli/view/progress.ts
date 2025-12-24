import { formatElapsed } from './format';

export type ProgressReporter = {
  update: () => void;
  record: (success: boolean) => void;
  finish: () => void;
};

export function createProgressReporter(total: number): ProgressReporter {
  const chars: string[] = [];
  const startTime = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const render = () => {
    const remaining = ' '.repeat(total - chars.length);
    const elapsed = Date.now() - startTime;
    const completed = chars.length;
    const correct = chars.filter((c) => c === '.').length;
    const incorrect = chars.filter((c) => c === 'X').length;

    let eta = '--:--';
    if (completed > 0) {
      const avgTime = elapsed / completed;
      const remainingTime = avgTime * (total - completed);
      eta = formatElapsed(remainingTime);
    }

    process.stdout.write(`\r[${chars.join('')}${remaining}] ${completed}/${total} .:${correct} X:${incorrect} | ${formatElapsed(elapsed)} ETA: ${eta}`);
  };

  intervalId = setInterval(render, 1000);
  render();

  return {
    update: render,
    record: (success: boolean) => {
      chars.push(success ? '.' : 'X');
      render();
    },
    finish: () => {
      if (intervalId) clearInterval(intervalId);
      render();
      process.stdout.write('\n');
    },
  };
}
