import type { Evaluation, Trial } from '@/evaluation/result';

export type AccuracyData = Map<string, { correct: number; total: number }>;
export type TimingData = Map<string, number>;

type PositionData = { correct: number; total: number; times: number[] };

export class PositionStats {
  private positions = new Map<string, PositionData>();
  private _trialCount = 0;

  addTrial(trial: Trial): this {
    const key = `${trial.position.x},${trial.position.y}`;
    if (!this.positions.has(key)) {
      this.positions.set(key, { correct: 0, total: 0, times: [] });
    }
    const data = this.positions.get(key)!;
    if (trial.isCorrect) {
      data.correct++;
    }
    data.total++;
    if (trial.timeMs !== undefined) {
      data.times.push(trial.timeMs);
    }
    return this;
  }

  addEvaluation(evaluation: Evaluation): this {
    for (const trial of evaluation.trials) {
      this.addTrial(trial);
    }
    this._trialCount++;
    return this;
  }

  merge(other: PositionStats): this {
    for (const [key, otherData] of other.positions) {
      if (!this.positions.has(key)) {
        this.positions.set(key, { correct: 0, total: 0, times: [] });
      }
      const data = this.positions.get(key)!;
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

  positionAt(key: string): PositionData | undefined {
    return this.positions.get(key);
  }

  entries(): IterableIterator<[string, PositionData]> {
    return this.positions.entries();
  }

  overallStats(): { correct: number; total: number; times: number[] } {
    let correct = 0;
    let total = 0;
    const times: number[] = [];
    for (const data of this.positions.values()) {
      correct += data.correct;
      total += data.total;
      times.push(...data.times);
    }
    return { correct, total, times };
  }

  toAccuracyData(): AccuracyData {
    const data = new Map<string, { correct: number; total: number }>();
    for (const [key, pos] of this.positions) {
      data.set(key, { correct: pos.correct, total: pos.total });
    }
    return data;
  }

  toTimingData(): TimingData {
    const data = new Map<string, number>();
    for (const [key, pos] of this.positions) {
      if (pos.times.length > 0) {
        data.set(key, pos.times.reduce((a, b) => a + b, 0) / pos.times.length);
      }
    }
    return data;
  }
}
