import type { CellResult, Execution } from '@/execution/execution';

export type AccuracyData = Map<string, { correct: number; total: number }>;
export type TimingData = Map<string, number>;

type CellData = { correct: number; total: number; times: number[] };

export class CellStats {
  private cells = new Map<string, CellData>();
  private _trialCount = 0;

  addCellResult(cellResult: CellResult): this {
    const key = `${cellResult.position.x},${cellResult.position.y}`;
    if (!this.cells.has(key)) {
      this.cells.set(key, { correct: 0, total: 0, times: [] });
    }
    const data = this.cells.get(key)!;
    if (cellResult.isCorrect) {
      data.correct++;
    }
    data.total++;
    if (cellResult.timeMs !== undefined) {
      data.times.push(cellResult.timeMs);
    }
    return this;
  }

  addExecution(execution: Execution): this {
    for (const cellResult of execution.cellResults) {
      this.addCellResult(cellResult);
    }
    this._trialCount++;
    return this;
  }

  merge(other: CellStats): this {
    for (const [key, otherData] of other.cells) {
      if (!this.cells.has(key)) {
        this.cells.set(key, { correct: 0, total: 0, times: [] });
      }
      const data = this.cells.get(key)!;
      data.correct += otherData.correct;
      data.total += otherData.total;
      data.times.push(...otherData.times);
    }
    this._trialCount += other._trialCount;
    return this;
  }

  get trialCount(): number {
    return this._trialCount;
  }

  cellAt(key: string): CellData | undefined {
    return this.cells.get(key);
  }

  entries(): IterableIterator<[string, CellData]> {
    return this.cells.entries();
  }

  overallStats(): { correct: number; total: number; times: number[] } {
    let correct = 0;
    let total = 0;
    const times: number[] = [];
    for (const data of this.cells.values()) {
      correct += data.correct;
      total += data.total;
      times.push(...data.times);
    }
    return { correct, total, times };
  }

  toAccuracyData(): AccuracyData {
    const data = new Map<string, { correct: number; total: number }>();
    for (const [key, cell] of this.cells) {
      data.set(key, { correct: cell.correct, total: cell.total });
    }
    return data;
  }

  toTimingData(): TimingData {
    const data = new Map<string, number>();
    for (const [key, cell] of this.cells) {
      if (cell.times.length > 0) {
        data.set(key, cell.times.reduce((a, b) => a + b, 0) / cell.times.length);
      }
    }
    return data;
  }
}
