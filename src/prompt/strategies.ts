import { GraphPromptStrategy } from '@/prompt/strategies/graph';
import { ListPromptStrategy } from '@/prompt/strategies/list';
import { MatrixPromptStrategy } from '@/prompt/strategies/matrix';
import { SimplePromptStrategy } from '@/prompt/strategies/simple';
import type { PromptStrategy } from '@/prompt/strategy';

const STRATEGIES: Record<string, PromptStrategy> = {
  simple: new SimplePromptStrategy(),
  graph: new GraphPromptStrategy(),
  matrix: new MatrixPromptStrategy(),
  list: new ListPromptStrategy(),
};

export class Strategies {
  static all(): Record<string, PromptStrategy> {
    return { ...STRATEGIES };
  }

  static find(name?: string): Record<string, PromptStrategy> {
    if (!name) return this.all();
    const strategy = STRATEGIES[name];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${name}. Available: ${Object.keys(STRATEGIES).join(', ')}`);
    }
    return { [name]: strategy };
  }
}
