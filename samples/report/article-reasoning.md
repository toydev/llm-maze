---
title: Not Magic, Just Diligent Thinking — Peeking into LLM Reasoning
tags: LLM, Ollama, LocalLLM, Reasoning, AI
---

## 1. Introduction

Have you heard of the LLM Reasoning feature?
I had no idea about it until recently — and it's impressive!

Reasoning is a feature where the LLM "thinks" step-by-step before generating an answer.

Normally, to achieve step-by-step reasoning like Chain of Thought, you need to implement thinking loops with multiple API calls in your application.
Models with the Reasoning feature do this automatically in a single request.

In this article, I'll peek into Reasoning's thinking process using the following maze experiment as an example.

- [2D Spatial Recognition in Local LLMs: Comparing Prompt Strategies](https://dev.to/toydev/2d-spatial-recognition-with-local-llm-comparing-prompt-strategies-4h64)

The experiment above investigated local LLMs' 2D spatial recognition ability using mazes, primarily with gpt-oss:20b on Ollama.
Testing multiple models revealed the following differences in maze-solving ability:

| Model | Reasoning | Result |
|-------|:---------:|--------|
| gpt-oss:20b | ✓ | 80%+ accuracy |
| deepseek-r1:14b | ✓ | Good (limited testing due to time) |
| gemma3:12b | ✗ | ~50% accuracy |

I hypothesized that the difference might be due to the presence of the Reasoning feature.
So I decided to actually look at what kind of thinking is happening.
Seeing is believing — I gained a clear understanding of how the Reasoning feature works.

----

## 2. How to Use Reasoning

Before looking at the maze experiment results, let's confirm the basic usage of Reasoning.

Below are code examples for viewing Reasoning's thinking content.
I prefer Node.js, but Python works just as well.

**Node.js**

```js
import { Ollama } from 'ollama';

const ollama = new Ollama();
const response = await ollama.chat({
  model: 'gpt-oss:20b',
  messages: [{ role: 'user', content: 'Alice is older than Bob, and Bob is older than Charlie. Who is older, Alice or Charlie?' }],
  // gpt-oss:20b uses 'low', 'medium', 'high'. Cannot be disabled.
  // deepseek-r1:14b uses true / false.
  think: 'medium'
});

console.log('=== thinking ===');
console.log(response.message.thinking);
console.log('=== content ===');
console.log(response.message.content);
```

```bash
npm install ollama
```

**Python**

```python
from ollama import chat

response = chat(
    'gpt-oss:20b',
    messages=[{'role': 'user', 'content': 'Alice is older than Bob, and Bob is older than Charlie. Who is older, Alice or Charlie?'}],
    # gpt-oss:20b uses 'low', 'medium', 'high'. Cannot be disabled.
    # deepseek-r1:14b uses True / False.
    think='medium'
)

print('=== thinking ===')
print(response.message.thinking)
print('=== content ===')
print(response.message.content)
```

```bash
pip install ollama
```

Here's an example output from running the above sample:

```
=== thinking ===
The user asks: "Alice is older than Bob, and Bob is older than Charlie. Who is older, Alice or Charlie?" So we have Alice > Bob > Charlie. Therefore Alice is older than Charlie. The answer is Alice.
=== content ===
Alice is older.
Since Alice > Bob > Charlie, Alice is the oldest of the three.
```

----

## 3. Peeking into Reasoning During Maze Experiments

Now let's look at Reasoning in the maze experiments.

I'll show Reasoning result examples using the following maze.
S is Start, G is Goal, # is a wall.

```
#####
#S#G#
# # #
#   #
#####
```

The original article compared multiple prompt strategies.
Here I'll show results from 3 strategies to illustrate how prompt strategies affect Reasoning.

| Prompt Strategy | Description | Original Article Result |
| --- | --- | --- |
| list | List of walkable coordinates | ◎ Fastest & most accurate |
| graph | Adjacency list format | △ Only effective for small sizes |
| simple | ASCII visualization | ✗ Slow at all sizes |

The strategy I first thought of was `simple` — it seemed human-readable, but performed the worst.
Meanwhile, I never expected `list` — which is unintelligible to humans as a maze — to be the fastest and most accurate.

I'll show the prompts and thinking content.
You'll begin to see why these results occurred.

Note: The examples shown were selected from multiple runs for clarity.

### Reasoning Result for `list`
#### Prompt
```
You are a bot in a 2D maze. Your goal is to find the path from Start to Goal.

Walkable positions: ["(1,1)","(3,1)","(1,2)","(3,2)","(1,3)","(2,3)","(3,3)"]

Positions:
- Start: (1,1)
- Goal: (3,1)
- Current: (2,3)

You have visited the following positions in order:
(1,1) -> (1,2) -> (1,3) -> (2,3)

What is your next move from your current position?

Note: In this coordinate system, y increases downward.
- up: y-1
- down: y+1
- left: x-1
- right: x+1

Return your answer as a JSON object with a "move" key, which can be one of "up", "down", "left", or "right".
Example: {"move": "up"}
```

#### Thinking Content
```
We have a maze positions: (1,1),(3,1),(1,2),(3,2),(1,3),(2,3),(3,3). Start at (1,1) visited sequence: (1,1)->(1,2)->(1,3)->(2,3). Current (2,3). Goal is (3,1). We need to decide next move. We have visited positions in order; need to find path to goal. Let's examine adjacency.

Allowed moves: up/down/left/right if resulting coordinate in walkable list.

From (2,3): possible moves: up: (2,2). Not in list. Down: (2,4). Not. Left: (1,3). That is in list. Right: (3,3). That is in list. We have visited (1,3) already. So next should go to (3,3) perhaps to get closer to goal.

From (3,3): possible moves: up (3,2) (walkable). left (2,3) visited. right (4,3) not. down (3,4) not.

From (3,2): possible moves: up (3,1) goal. left (2,2) not. right (4,2) not. down (3,3) visited.

So path: (2,3)->(3,3)->(3,2)->(3,1).

Thus next move from (2,3) should be right to (3,3). So answer: {"move": "right"}.
```

### Reasoning Result for `graph`
#### Prompt
```
... omitted ...

Graph (adjacency list): each key "x,y" maps to adjacent walkable positions.
{
  "1,1": [ "1,2" ],
  "3,1": [ "3,2" ],
  "1,2": [ "1,1", "1,3" ],
  "3,2": [ "3,1", "3,3" ],
  "1,3": [ "1,2", "2,3" ],
  "2,3": [ "1,3", "3,3" ],
  "3,3": [ "3,2", "2,3" ]
}

... omitted ...
```

#### Thinking Content
```
We need to find next move from current position (2,3). Maze positions: graph edges show adjacency. Current at (2,3) has adjacent: "1,3" and "3,3". We have visited: (1,1)->(1,2)->(1,3)->(2,3). So visited positions set includes those. We want next move that hasn't been visited yet? Usually path search avoiding revisiting. So from (2,3) options: (1,3) visited, (3,3) unvisited. So next move: go right to (3,3). That will bring closer to goal (3,1). So answer: {"move":"right"}. Ensure JSON.
```

### Reasoning Result for `simple`
#### Prompt
```
... omitted ...

Legend: 'S' = Start, 'G' = Goal, '#' = Wall, ' ' = Path, 'C' = Current position

Maze:
#####
#S#G#
# # #
# C #
#####

... omitted ...
```

#### Thinking Content
```
We need to parse the maze and determine positions. The maze:

Line1: "#####"
Line2: "#S#G#"
Line3: "# # #"
Line4: "# C #"
Line5: "#####"

Coordinates: origin (0,0) at top-left? Let's interpret: The coordinate system with x horizontal increasing to right, y increasing downward. Maze width 5, height 5. Provided visited positions: (1,1) -> (1,2) -> (1,3) -> (2,3). They start at (1,1) presumably start S? Let's map.

Let's create grid mapping. Let's index rows (y) from 0 to 4. Row 0: "#####": columns 0-4. Row 1: "#S#G#". Row2: "# # #". Row3: "# C #". Row4: "#####".

Now find coordinates: (1,1) is x=1, y=1: That is Row1, col1: 'S' indeed. So start at S. (1,2) x=1, y=2: Row2, col1: That's '#'? Wait row2 is "# # #": columns: 0 '#',1 ' ',2 '#',3 ' ',4 '#'. So col1 is space. So path. Good. (1,3) x=1, y=3: Row3, col1: Row3 "# C #": columns: 0 '#',1 ' ',2 'C',3 ' ',4 '#'. So col1 is space. Good. (2,3) x=2, y=3: Row3, col2: That's 'C' current position. So yes current position is at (2,3). Maze positions: Walls '#'.

Goal G is at (3,1) because row1 col3: Let's check: Row1 "#S#G#": columns 0 '#',1 'S',2 '#',3 'G',4 '#'. So goal at (3,1). Starting at (1,1). We visited positions as given. Currently at (2,3). We need to decide next move to continue path to goal. Let's check adjacency: from (2,3), we can move up to (2,2), down to (2,4), left to (1,3), right to (3,3). Need to avoid walls '#'.

Check each coordinate:

(2,2) Row2 col2: Row2 "# # #": col2 '#', so wall. Not allowed.

(2,4) Row4 col2: Row4 "#####": col2 '#', wall.

(1,3) Row3 col1: space. We visited that earlier. But we can consider revisiting? Usually you shouldn't revisit but maybe allowed. But path may need to go left? But left to (1,3) leads back to where we were.

(3,3) Row3 col3: Row3 "# C #": col3 ' '. So open.

Thus only feasible move that is not wall: left (back) or right. But we need to find path to G at (3,1). From (2,3), right to (3,3) leads us closer horizontally. From there, we could go up to (3,2) row2 col3? Let's check row2 col3: Row2 "# # #": col3 ' '. So we could go up. Then from (3,2) up to (3,1) which is G. So path: right, up, up? Wait check from (3,3) up to (3,2) is row2 col3: space. Then up to (3,1) is G. So sequence: right, up, up. So the next move should be right.

Let's double-check if any other path might be considered better. If we go left back to (1,3) we could then go up to (1,2) which we visited, then right to (2,2) which is wall. So that fails. So the only viable route is right. So answer: {"move":"right"}.

Return JSON.
```

----

## 4. Not Magic, Just Diligent Thinking

Until I saw Reasoning's thinking content, I mistakenly believed some kind of magic was happening.
But now that I've seen it, Reasoning is not magic.
It's clearly a feature that diligently thinks through text to derive results.

Let's review the thinking content for each strategy.

`list` uses the list of walkable coordinates to determine passage in all four directions.
`graph` has adjacency information, making the judgment concise.
`simple` parses the maze string character by character, constructs the 2D coordinate system itself, then starts solving.

The `simple` thinking is particularly striking.
While humans can understand the maze structure at a glance, the LLM diligently parses it as a string.
I've also seen expressions like "U-shaped" in other runs, suggesting it does have some sense of shapes.
However, since it thinks by putting things into words, I feel it's different from how humans think while looking at shapes.

Reasoning isn't magic — it's diligent thinking using words.
Understanding this should help predict what to convey to an LLM.
Of course, things won't always go as expected.
When that happens, observing the thinking content as we did here should yield insights.

By choosing a model with Reasoning capability, you can accomplish fairly advanced tasks without implementing your own thinking logic.

We're now in an era where you can easily try Reasoning with local LLMs.
I run Ollama's gpt-oss:20b on an AMD Ryzen 7 7700 / GeForce RTX 4070 (12GB VRAM) setup.
With 24% CPU / 76% GPU offload settings, it runs fast enough for experimental use.

The maze experiment code used in this article is available in the following repository.
If you're interested, try running it and peek into Reasoning's thinking content.

- https://github.com/toydev/llm-maze-solver

----

## Digression

By actually viewing the thinking content, I gained a deeper understanding of how prompt strategies affect results and why `list` is the fastest and most accurate.

I conducted maze experiments to examine 2D spatial recognition, but finding that the core is just diligent word-based exploration was somewhat disappointing — because I had expected something more magical.

On the other hand, knowing this might open possibilities for designing prompt representations suited to specific purposes.
Also, for simple route finding to destinations, you can provide a pathfinding algorithm as a tool (Function Calling / Tool Use).
Depending on the purpose, other tools could be provided as well.
Using LLM capabilities for simple search is nonsensical — what we want is flexible judgment ability adapted to the situation.
