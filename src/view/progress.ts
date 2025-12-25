import prettyMs from 'pretty-ms';

const BAR_WIDTH = 20;

function formatTime(ms: number): string {
  return prettyMs(ms, { colonNotation: true, secondsDecimalDigits: 0 }).padStart(5, '0');
}

export class ProgressReporter {
  private readonly total: number;
  private readonly startTime: number;
  private readonly intervalId: ReturnType<typeof setInterval>;
  private completed = 0;
  private correct = 0;

  constructor(total: number) {
    this.total = total;
    this.startTime = Date.now();
    this.intervalId = setInterval(() => this.render(), 1000);
    this.render();
  }

  record(success: boolean): void {
    this.completed++;
    if (success) this.correct++;
    this.render();
  }

  finish(): void {
    clearInterval(this.intervalId);
    this.render();
    process.stdout.write('\n');
  }

  private render(): void {
    const elapsed = Date.now() - this.startTime;
    const progress = this.completed / this.total;
    const filledWidth = Math.floor(progress * BAR_WIDTH);
    const bar = '='.repeat(filledWidth) + (filledWidth < BAR_WIDTH ? '>' : '') + ' '.repeat(Math.max(0, BAR_WIDTH - filledWidth - 1));

    let eta = '--:--';
    if (this.completed > 0) {
      const avgTime = elapsed / this.completed;
      const remainingTime = avgTime * (this.total - this.completed);
      eta = formatTime(remainingTime);
    }

    const incorrect = this.completed - this.correct;
    process.stdout.write(`\r[${bar}] ${this.completed}/${this.total} OK:${this.correct} NG:${incorrect} | ${formatTime(elapsed)} ETA: ${eta}`);
  }
}
