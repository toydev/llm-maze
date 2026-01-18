---
title: 2D Spatial Recognition with Local LLM: Comparing Prompt Strategies
tags: LLM, Ollama, LocalLLM, PromptEngineering, gpt-oss
---

## 1. Introduction

My GPU was occupied by LLM experiments throughout the 2025-2026 winter break, but it's finally free now!

I investigated the **2D spatial recognition ability** of a local LLM (gpt-oss:20b) using mazes as the subject.

- Motivation: Wanted to understand how LLMs perceive space for autonomous navigation
- Method: Ask "which direction next?" for each cell with structured output
- Prompts: Tried multiple strategies since I didn't know what works best
- Source & Results: Published on [GitHub](https://github.com/toydev/llm-maze-solver/tree/article-2026-01)

Result: The prompt I initially thought of turned out to be the worst.

### Key Findings

- **Local LLM can handle 2D spatial recognition** - gpt-oss:20b achieved sufficient accuracy
- **Prompt strategy makes a big difference** - Response time varies by several times

---

## 2. Experiment Setup

### Environment

- OS: Windows 11 / WSL2 (Ubuntu)
- CPU: AMD Ryzen 7 7700
- GPU: GeForce RTX 4070 (12GB VRAM)
- LLM Runtime: Ollama
- Experiment Code: Node.js + TypeScript + @langchain/ollama 1.1.0

### Model

Used [gpt-oss:20b](https://ollama.com/library/gpt-oss). Recommended VRAM is 16GB, but it runs on 12GB with CPU offloading (24% CPU / 76% GPU).

### Prompt Strategies

Compared 4 strategies (see links for prompt output examples):

**[simple](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/simple.test.ts)** - ASCII visualization of maze
```
#####
#S#G#
# # #
#   #
#####
```

**[matrix](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/matrix.test.ts)** - Binary matrix for walls/paths
```
[[1,1,1,1,1],[1,0,1,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]]
```

**[list](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/list.test.ts)** - List of walkable coordinates
```
["(1,1)","(3,1)","(1,2)","(3,2)","(1,3)","(2,3)","(3,3)"]
```

**[graph](https://github.com/toydev/llm-maze-solver/blob/article-2026-01/src/prompt/strategies/graph.test.ts)** - Adjacency list format
```
{"1,1":["1,2"],"1,2":["1,1","1,3"],"1,3":["1,2","2,3"],...}
```

### Mazes

Used 4 sizes (5x5 to 15x15) x 2 categories ([maze list](https://github.com/toydev/llm-maze-solver/tree/article-2026-01/mazes)):

**corridor** - Walled passages

![corridor](11x11_corridor_straight.png) ![corridor](11x11_corridor_branch.png) ![corridor](11x11_corridor_dead-end.png) ![corridor](11x11_corridor_loop.png) ![corridor](11x11_corridor_spiral.png)

**open** - Open spaces with obstacles

![open](11x11_open_empty.png) ![open](11x11_open_pass.png) ![open](11x11_open_detour.png)

*Black=wall, White=path, Green=Start, Red=Goal*

### History Option

History refers to the path taken to reach the current cell (e.g., `(1,1) -> (1,2) -> (2,2)`).

- With: Include history in prompt
- Without: Exclude history from prompt

### Evaluation Method

For each cell in the maze, ask "which direction should I go next?" and record success/failure and response time.

A correct answer is defined as **any direction that gets closer to the goal**. It doesn't need to be the shortest route.

---

## 3. Results

Each combination was run once. Consider this as reference data for observing trends.

Detailed data is available in the [repository](https://github.com/toydev/llm-maze-solver/tree/article-2026-01).

### Scale Verification

Results from testing all sizes x all strategies on representative mazes (corridor_straight / open_empty), with history enabled.

**Accuracy (%)**

| Size | simple | matrix | list | graph |
|------|--------|--------|------|-------|
| 5x5 | 100 | 100 | 100 | 100 |
| 7x7 | 97 | 100 | 100 | 100 |
| 11x11 | 82 | 96 | 98 | 95 |
| 15x15 | - | - | 95 | 89 |

**Response Time (sec/cell)**

| Size | simple | matrix | list | graph |
|------|--------|--------|------|-------|
| 5x5 | 29 | 19 | 12 | 12 |
| 7x7 | 77 | 31 | 16 | 17 |
| 11x11 | 313 | 75 | 31 | 64 |
| 15x15 | - | - | 41 | 190 |

*15x15 matrix/simple were abandoned due to time constraints.*

**list is fastest and most accurate**. The gap widens as size increases. simple degraded to 313 sec/cell (5+ minutes) at 11x11.

### Effect of History

Comparing history on/off with list strategy at 11x11 (category averages).

**Accuracy (%)**

| Category | No History | With History |
|----------|------------|--------------|
| corridor | 82 | 86 |
| open | 99 | 100 |

**Response Time (sec/cell)**

| Category | No History | With History |
|----------|------------|--------------|
| corridor | 230 | 110 |
| open | 29 | 26 |

For corridor types, **history enabled is about 2x faster**. Open types show little difference.

---

## 4. Conclusion

### gpt-oss:20b's 2D Spatial Recognition Ability

gpt-oss:20b has sufficient 2D spatial recognition ability to navigate mazes.
With 80%+ accuracy, it can reach the goal within about 1.5x the shortest route.

Response time with list strategy is around 30 sec/cell at 11x11.
Not suitable for real-time processing, but practical for casual use with local LLM.

For comparison, I briefly tested two other models:

| Model | Impression |
|-------|------------|
| gemma3:12b | ~50% accuracy, not practical |
| deepseek-r1:14b | Not as good as gpt-oss:20b, but promising |

I believe the Reasoning capability common to gpt-oss:20b and deepseek-r1:14b plays a significant role.

Interestingly, in my environment deepseek-r1:14b runs at 100% GPU, but gpt-oss:20b at 76% GPU is faster with better accuracy.

### list + history = best

Prompt strategy significantly affects both accuracy and response time.

My first strategy was simple - I thought it would be intuitive for humans, but it was the worst.

Next I tried graph, a structured format for pathfinding.
It was faster than simple for small mazes, giving me hope, but response time degraded as size increased.
I believe this is due to the increase in adjacency information.

matrix is a structured version of simple, but didn't produce good results either.

I never expected list - a coordinate list that humans can't even interpret as a maze - to be the best.

Regarding history, I think the information about "how I got here" simply helps in deciding the next direction.
It's especially helpful for corridor types.
However, since it means more tokens to process, if only the last few steps are effective, there might be room for optimization.

---

This article and code were created in collaboration with Claude Code.
I also asked Claude Code to create the mazes for the experiment, but it struggled to create them accurately in simple format, so I had to manually adjust them quite a bit.
If even Claude Code struggles with simple format, perhaps it's no surprise that local LLMs do too.

Source code and experiment data are available on [GitHub](https://github.com/toydev/llm-maze-solver/tree/article-2026-01). Feel free to try it out if you're interested.
