# LLM Maze Solver

An experimental tool for evaluating local LLM's 2D spatial recognition ability using mazes.

## Requirements

- Node.js 24+
- [Ollama](https://ollama.com/)
- [gpt-oss:20b](https://ollama.com/library/gpt-oss) (`ollama pull gpt-oss:20b`)

## Install & Run

```bash
git clone https://github.com/toydev/llm-maze-solver.git
cd llm-maze-solver
npm install
npm run execute -- -m gpt-oss:20b -z 5x5_corridor_straight -s list
```

## Prompt Strategies

4 strategies implemented (see links for prompt output examples). The maze representation significantly affects response time.

| Strategy | Description |
|----------|-------------|
| [simple](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/simple.test.ts) | ASCII visualization of maze |
| [matrix](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/matrix.test.ts) | Binary matrix for walls/paths |
| [list](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/list.test.ts) | List of walkable coordinates |
| [graph](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/graph.test.ts) | Adjacency list format |

## Maze Types

2 categories with multiple types.

### corridor

Walled passages with branches and dead-ends.

| Type | Description |
|------|-------------|
| straight | Simple single path |
| branch | Two paths to goal |
| loop | Contains loops |
| dead-end | Has dead-ends |
| spiral | Spiral shape (goal at center) |

### open

Open spaces with varying obstacles.

| Type | Description |
|------|-------------|
| empty | No obstacles |
| pass | Central passage |
| detour | Requires detour |

## Commands

| Command | Description |
|---------|-------------|
| `npm run execute -- -m <model> [-z maze] [-s strategy] [-H\|-N]` | Run LLM and save results |
| `npm run analyze -- [-m model] [-z maze] [-s strategy] [-H\|-N]` | Per-cell detailed analysis |
| `npm run export-stats -- [-o output]` | Export CSV (for Excel pivot / [Miller](https://miller.readthedocs.io/) analysis) |
| `npm run reasoning-test -- -z <maze> -s <strategy> -p <x,y> [-m model] [-t think] [-H]` | Verify reasoning capability effect |

Omit options to target all. `-H` includes history, `-N` excludes it (execute: run mode, analyze: filter).

### Examples

```bash
# Run 5x5 corridor_straight with list strategy
npm run execute -- -m gpt-oss:20b -z 5x5_corridor_straight -s list

# Show overall analysis
npm run analyze

# Show analysis for specific maze
npm run analyze -- -z 11x11_corridor_straight

# Export CSV (stdout)
npm run export-stats > stats.csv

# View Reasoning thinking content
npm run reasoning-test -- -z 5x5_corridor_straight -s list -p 2,3

# With think level (low/medium/high for gpt-oss)
npm run reasoning-test -- -z 5x5_corridor_straight -s list -p 2,3 -t high
```

## Directory Structure

```
mazes/          # Maze definitions (text files)
output/         # Execution output (default)
samples/        # Sample results and reports
src/            # Source code
```

## License

MIT
