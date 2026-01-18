# LLM Maze Solver

ローカル LLM の 2D 空間認識能力を迷路で検証する実験用ツール。

## Requirements

- Node.js 24+
- [Ollama](https://ollama.com/)
- [gpt-oss:20b](https://ollama.com/library/gpt-oss)（`ollama pull gpt-oss:20b`）

## Install & Run

```bash
git clone https://github.com/toydev/llm-maze-solver.git
cd llm-maze-solver
npm install
npm run execute -- -m gpt-oss:20b -z 5x5_corridor_straight -s list
```

## Prompt Strategies

4 種類の戦略を実装（各リンク先でプロンプト出力例を確認できる）。迷路をどう表現するかで、特に応答時間に大きな差が出る。

| 戦略 | 説明 |
|------|------|
| [simple](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/simple.test.ts) | 迷路を文字で視覚化 |
| [matrix](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/matrix.test.ts) | 壁/通路を二値行列で表現 |
| [list](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/list.test.ts) | 歩ける座標のリスト |
| [graph](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/graph.test.ts) | 隣接リスト形式 |

## Maze Types

2 カテゴリ × 複数タイプの迷路を用意。

### corridor（通路型）

壁に囲まれた通路。分岐や行き止まりがある。

| タイプ | 説明 |
|--------|------|
| straight | 単純な一本道 |
| branch | ゴールへの道が2つ |
| loop | ループあり |
| dead-end | 行き止まりあり |
| spiral | 渦巻き状（ゴールが中央） |

### open（広場型）

広い空間。障害物の有無で難易度が変わる。

| タイプ | 説明 |
|--------|------|
| empty | 障害物なし |
| pass | 中央に通路 |
| detour | 迂回が必要 |

## Commands

| コマンド | 説明 |
|----------|------|
| `npm run execute -- -m <model> [-z maze] [-s strategy] [-H\|-N]` | LLM 実行・結果保存 |
| `npm run analyze -- [-m model] [-z maze] [-s strategy] [-H\|-N]` | マス毎の詳細分析 |
| `npm run export-stats -- [-o output]` | CSV エクスポート（Excel ピボット / [Miller](https://miller.readthedocs.io/) 分析用） |
| `npm run reasoning-test -- -z <maze> -s <strategy> -p <x,y> [-m model] [-t think] [-H]` | Reasoning 機能の効果確認用 |

オプション省略時は全件対象。`-H` は履歴あり、`-N` は履歴なし（execute: 実行モード、analyze: フィルタ）。

### 例

```bash
# 5x5 corridor_straight を list 戦略で実行
npm run execute -- -m gpt-oss:20b -z 5x5_corridor_straight -s list

# 全体の分析を表示
npm run analyze

# 特定の迷路の分析を表示
npm run analyze -- -z 11x11_corridor_straight

# CSV エクスポート（標準出力）
npm run export-stats > stats.csv

# Reasoning の思考内容を確認
npm run reasoning-test -- -z 5x5_corridor_straight -s list -p 2,3

# think レベル指定（gpt-oss は low/medium/high）
npm run reasoning-test -- -z 5x5_corridor_straight -s list -p 2,3 -t high
```

## Directory Structure

```
mazes/          # 迷路定義（テキストファイル）
output/         # 実行結果の出力先（デフォルト）
samples/        # 参考用の実験結果とレポート
src/            # ソースコード
```

## License

MIT
