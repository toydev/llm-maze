import { GraphPromptStrategy } from '@/prompt/strategies/graph';
import { ListPromptStrategy } from '@/prompt/strategies/list';
import { MatrixPromptStrategy } from '@/prompt/strategies/matrix';
import { SimplePromptStrategy } from '@/prompt/strategies/simple';
import type { PromptStrategy } from '@/prompt/strategy';

const registry = new Map<string, PromptStrategy>([
  ['simple', new SimplePromptStrategy()],
  ['graph', new GraphPromptStrategy()],
  ['matrix', new MatrixPromptStrategy()],
  ['list', new ListPromptStrategy()],
]);

export class Strategies {
  static all(): [string, PromptStrategy][] {
    return Array.from(registry.entries());
  }

  static find(pattern?: string): [string, PromptStrategy][] {
    if (!pattern) return this.all();
    const strategy = registry.get(pattern);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${pattern}. Available: ${this.names().join(', ')}`);
    }
    return [[pattern, strategy]];
  }

  static names(): string[] {
    return Array.from(registry.keys());
  }
}
