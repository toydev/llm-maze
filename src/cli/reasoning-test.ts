import { program } from 'commander';
import { Ollama } from 'ollama';

import { MOVES } from '@/execution/execution';
import { Maze } from '@/maze/maze';
import { Strategies } from '@/prompt/strategies';

const MoveSchema = {
  type: 'object',
  properties: { move: { type: 'string', enum: MOVES } },
  required: ['move'],
} as const;

program
  .name('reasoning-test')
  .requiredOption('-z, --maze <file>', '迷路ファイル (例: 5x5_corridor_straight)')
  .requiredOption('-s, --strategy <name>', '戦略名 (例: list)')
  .requiredOption('-p, --position <x,y>', '現在位置 (例: 1,1)')
  .option('-m, --model <name>', 'モデル名', 'gpt-oss:20b')
  .option('-t, --think <value>', 'thinking 設定 (true/false/low/medium/high)', 'true')
  .option('-H, --history', '履歴を含める')
  .parse();

const opts = program.opts();

type ThinkValue = boolean | 'low' | 'medium' | 'high';

function parseThink(value: string): ThinkValue {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value as 'low' | 'medium' | 'high';
}

async function main() {
  const ollama = new Ollama();
  const maze = await Maze.fromFile(`mazes/${opts.maze}.txt`);
  const strategy = Strategies.find(opts.strategy)[opts.strategy];
  const [x, y] = opts.position.split(',').map(Number);
  const position = { x, y };
  const history = opts.history ? maze.getPathFromStart(position) : null;

  const prompt = strategy.buildPrompt(maze, position, history);

  console.log('=== 条件 ===');
  console.log(`モデル: ${opts.model}`);
  console.log(`迷路: ${opts.maze}`);
  console.log(`戦略: ${opts.strategy}`);
  console.log(`位置: (${x},${y})`);
  console.log(`履歴: ${opts.history ? 'あり' : 'なし'}`);
  console.log(`think: ${opts.think}`);
  console.log('');

  console.log('=== プロンプト ===');
  console.log(prompt);
  console.log('');

  const thinkValue = parseThink(opts.think);
  console.log('=== 実行中... ===');
  const response = await ollama.chat({
    model: opts.model,
    messages: [{ role: 'user', content: prompt }],
    think: thinkValue,
    format: MoveSchema,
    stream: false,
  });

  console.log('');
  console.log('=== thinking ===');
  console.log(response.message.thinking);
  console.log('');
  console.log('=== content ===');
  console.log(response.message.content);
}

main();
