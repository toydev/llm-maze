import { formatElapsed } from '@/view/format';

export type ProgressReporter = {
  update: () => void;
  record: (success: boolean) => void;
  finish: () => void;
};

const BAR_WIDTH = 20;

export function createProgressReporter(total: number): ProgressReporter {
  const startTime = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let completed = 0;
  let correct = 0;

  const render = () => {
    const elapsed = Date.now() - startTime;
    const progress = completed / total;
    const filledWidth = Math.floor(progress * BAR_WIDTH);
    const bar = '='.repeat(filledWidth) + (filledWidth < BAR_WIDTH ? '>' : '') + ' '.repeat(Math.max(0, BAR_WIDTH - filledWidth - 1));

    let eta = '--:--';
    if (completed > 0) {
      const avgTime = elapsed / completed;
      const remainingTime = avgTime * (total - completed);
      eta = formatElapsed(remainingTime);
    }

    const incorrect = completed - correct;
    process.stdout.write(`\r[${bar}] ${completed}/${total} .:${correct} X:${incorrect} | ${formatElapsed(elapsed)} ETA: ${eta}`);
  };

  intervalId = setInterval(render, 1000);
  render();

  return {
    update: render,
    record: (success: boolean) => {
      completed++;
      if (success) correct++;
      render();
    },
    finish: () => {
      if (intervalId) clearInterval(intervalId);
      render();
      process.stdout.write('\n');
    },
  };
}
