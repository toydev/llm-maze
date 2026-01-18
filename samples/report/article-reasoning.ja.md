---
title: 魔法じゃない、愚直な思考 ― LLM の Reasoning を覗く
tags: LLM Ollama ローカルLLM Reasoning 生成AI
---

# 1. はじめに

LLM の Reasoning 機能をご存じですか？
つい先日まで私は全く知りませんでした！これがすごいのです。

Reasoning とは、LLM が回答を生成する前に段階的に「考える」機能です。

通常、Chain of Thought のような段階的推論をさせるには、複数回の問い合わせを行う思考ループをアプリケーション側で実装する必要があります。
Reasoning 機能を持つモデルでは、これを1回の問い合わせで自動的に行ってくれます。

本記事では、以下の迷路実験を題材に Reasoning の思考内容を覗いてみます。

- [ローカルLLMの2D空間認識能力 ― プロンプト戦略の比較](https://qiita.com/toydev/items/cba8622f898c9156d042)

上記の記事は Ollama で gpt-oss:20b を中心にローカル LLM の 2D 空間認識能力を迷路で調査したものです。
複数モデルを試した結果、以下のような迷路探索能力の差がありました。

| モデル | Reasoning | 探索結果 |
|--------|:---------:|----------|
| gpt-oss:20b | ○ | 正解率 80%以上 |
| deepseek-r1:14b | ○ | 良好（時間の関係で参考程度の試行） |
| gemma3:12b | × | 正解率 50%程度 |

上記の違いは Reasoning 機能の有無なのではないかと私は予測しました。
ならばどういった思考をしているか実際にみて見ようじゃないかという試みの結果を紹介します。
百聞は一見に如かず、Reasoning 機能の働きをハッキリと理解できました。

----

# 2. Reasoning の使い方

迷路実験の結果を見る前に、Reasoning の基本的な使い方を確認しましょう。

以下は Reasoning の思考内容を閲覧するコード例です。
私は Node.js を好んで使っていますが、Python でも同じことができます。

**Node.js**

```js
import { Ollama } from 'ollama';

const ollama = new Ollama();
const response = await ollama.chat({
  model: 'gpt-oss:20b',
  messages: [{ role: 'user', content: '太郎は花子より年上で、花子は次郎より年上です。太郎と次郎はどちらが年上ですか？' }],
  // gpt-oss:20b は 'low', 'medium', 'high' を指定する。無効にはできない。
  // deepseek-r1:14b などは true / false を指定する。
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
    messages=[{'role': 'user', 'content': '太郎は花子より年上で、花子は次郎より年上です。太郎と次郎はどちらが年上ですか？'}],
    # gpt-oss:20b は 'low', 'medium', 'high' を指定する。無効にはできない。
    # deepseek-r1:14b などは True / False を指定する。
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

上記のサンプルを動かした結果の一例は以下の通りです。

```
=== thinking ===
The user asks: "太郎は花子より年上で、花子は次郎より年上です。太郎と次郎はどちらが年上ですか？" in Japanese. The answer: Taro > Hanako > Jiro. So Taro is older than Jiro. So the answer: 太郎. Also maybe explanation. The user might want a short answer. So respond: 太郎. Provide reasoning in Japanese: 太郎 > 花子 > 次郎. So answer: 太郎.
=== content ===
太郎です。
太郎 > 花子 > 次郎　という順序から、太郎が最も年上になります。
```

----

# 3. 迷路実験で思考を覗く

では、迷路実験での Reasoning を見ていきましょう。

以下の迷路を題材に Reasoning の結果例を紹介します。
S はスタート、G はゴール、# は壁です。

```
#####
#S#G#
# # #
#   #
#####
```

元記事の迷路実験では複数のプロンプト戦略の比較を行っています。
本記事ではプロンプト戦略が Reasoning にもたらす影響がわかりやすいように以下の 3 つのプロンプト戦略の結果を紹介します。

| プロンプト戦略 | 概要 | 元記事での結果 |
| --- | --- | --- |
| list | 歩ける座標のリスト | ◎ 最速・高精度 |
| graph | 隣接リスト形式 | △ 小サイズのみ有効 |
| simple | 迷路を文字で視覚化 | × 全サイズで遅い |

私が最初に考えた戦略は simple であり、人間的にはわかりやすいと思いましたが最悪でした。
一方で人間が見ても迷路の構造が理解できない list が最速・高精度になるとは全く思っていませんでした。

プロンプトと思考内容を示します。
なぜそのような結果になるのか、その一端が見えてくると思います。

紹介する例は、何度か試して理解しやすいものを選んでいます。ご了承ください。

## list の Reasoning 結果
### プロンプト
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

### 思考内容
```
We have a maze positions: (1,1),(3,1),(1,2),(3,2),(1,3),(2,3),(3,3). Start at (1,1) visited sequence: (1,1)->(1,2)->(1,3)->(2,3). Current (2,3). Goal is (3,1). We need to decide next move. We have visited positions in order; need to find path to goal. Let's examine adjacency.

Allowed moves: up/down/left/right if resulting coordinate in walkable list.

From (2,3): possible moves: up: (2,2). Not in list. Down: (2,4). Not. Left: (1,3). That is in list. Right: (3,3). That is in list. We have visited (1,3) already. So next should go to (3,3) perhaps to get closer to goal.

From (3,3): possible moves: up (3,2) (walkable). left (2,3) visited. right (4,3) not. down (3,4) not.

From (3,2): possible moves: up (3,1) goal. left (2,2) not. right (4,2) not. down (3,3) visited.

So path: (2,3)->(3,3)->(3,2)->(3,1).

Thus next move from (2,3) should be right to (3,3). So answer: {"move": "right"}.
```

## graph の Reasoning 結果
### プロンプト
```
... 省略 ...

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

... 省略 ...
```

### 思考内容
```
We need to find next move from current position (2,3). Maze positions: graph edges show adjacency. Current at (2,3) has adjacent: "1,3" and "3,3". We have visited: (1,1)->(1,2)->(1,3)->(2,3). So visited positions set includes those. We want next move that hasn't been visited yet? Usually path search avoiding revisiting. So from (2,3) options: (1,3) visited, (3,3) unvisited. So next move: go right to (3,3). That will bring closer to goal (3,1). So answer: {"move":"right"}. Ensure JSON.
```

## simple の Reasoning 結果
### プロンプト
```
... 省略 ...

Legend: 'S' = Start, 'G' = Goal, '#' = Wall, ' ' = Path, 'C' = Current position

Maze:
#####
#S#G#
# # #
# C #
#####

... 省略 ...
```

### 思考内容
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

# 4. 魔法じゃない、愚直な思考

私は Reasoning の思考内容を見るまでは魔法のような何かが行われていると勘違いしていました。
しかし、思考内容を見た今、Reasoning は魔法ではありません。
文章で愚直に思考して結果を導く機能であることがハッキリとわかりました。

各戦略の思考内容を振り返ってみましょう。

list は歩ける座標のリストを使って四方の通過可否を判断しています。
graph は隣接リストがあるので判断が簡潔です。
simple は迷路の文字列を1文字ずつ解析し、2D座標系を自分で構築してから攻略に着手しています。

特に simple の思考は印象的です。
人間なら一目で分かる迷路の構造を、LLM は文字列として愚直に解析しています。
「U字型」といった形状の表現を見かけたこともあったので、図的な感覚も多少は持っているようです。
ただ、それを言葉にしながら考える以上、人間が形を見ながら考えるのとは違うのではないかと感じています。

Reasoning は魔法ではなく、言葉を使った愚直な思考。
それが分かっていれば、LLM に何を伝えれば良いのか予測が立つのではないでしょうか。
もちろん思った通りにならないこともあるでしょう。
そのときは今回のように思考内容を観察することで得られるものがあるはずです。

Reasoning 機能を持ったモデルを選ぶことで、自前で思考ロジックを組まなくてもかなり高度なことができるとわかりました。

Reasoning 機能をローカル LLM で気軽に試せる時代になっています。
私は AMD Ryzen 7 7700 / GeForce RTX 4070 (12GB VRAM) という構成で Ollama の gpt-oss:20b を動かしています。
24% CPU / 76% GPU の CPU オフロード設定で、遊びとして試すには十分な速度が出ています。

本記事で使用した迷路実験のコードは以下のリポジトリで公開しています。
興味があれば実際に動かして、Reasoning の思考内容を覗いてみてください。

- https://github.com/toydev/llm-maze-solver

----

# 余談

実際の思考内容を見ることで、プロンプト戦略が与える影響や list が最速・高精度な理由の理解が進みました。

2D 空間認識能力を見るために迷路実験を行ったのに対して、その中身が愚直な言葉での探索であったことは少々残念です。それはもっと魔法的な何かを私が期待してしまっていたからです。

一方でそうであるとわかれば目的に応じたプロンプトの表現方法を考える余地があるかもしれません。
また、目的地点への単純なルート探索については、経路探索アルゴリズムをツールとして提供する（Function Calling / Tool Use）といった方法も使えます。
もちろん、目的によってはそれ以外のツールを与えることもできるでしょう。
単純な探索に LLM の能力を使うのはナンセンスであり、求めるのは状況に応じた柔軟な判断能力だからです。
