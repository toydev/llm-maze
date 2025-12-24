# ソースレビュー

## 目的
実験データ取得前にコードの品質・正確性を確認する。

## レビュー対象

### 実験データ取得関連（優先）
| ファイル | 役割 | 状態 |
|----------|------|------|
| src/maze/types.ts | 型定義 | [x] OK |
| src/maze/Maze.ts | 迷路クラス | [x] OK |
| src/maze/solver.ts | 経路計算・最適手判定 | [x] OK（修正済） |
| src/runner/prompt/*.ts | プロンプト戦略 | [x] OK |
| src/runner/outputParser.ts | 出力パーサー | [x] OK |
| src/llm/ | LLM接続 | [x] OK |
| src/execute.ts | 実行メイン | [x] OK |

### レポート系（動作確認のみ）
| ファイル | 役割 | 状態 |
|----------|------|------|
| src/summary.ts | 全体統計 | [x] 動作確認済 |
| src/detail.ts | マス毎詳細 | [x] 動作確認済 |

---

## レビュー詳細

### src/maze/types.ts
- CellType, Position, Move の定義
- 問題なし

### src/maze/Maze.ts
- レイアウト文字列からグリッド構築
- S/E の複数定義チェックあり
- isTraversable で壁判定
- 問題なし

### src/maze/solver.ts
- `calculateDistancesFromEnd`: E からの BFS 距離計算
- `createOptimalMoveMap`: 各位置での最適手（距離が減る or 同じ移動）
- `createPathMapFromStart`: S からの経路（ジグザグ化実装済み）
- `solveWithAStar`: A* 最短経路（実験では未使用）

**修正点**:
- 4行目の古いコメント `// ... (既存の solveWithAStar 関数はそのまま) ...` を削除

### src/runner/prompt/*.ts
- SimplePromptStrategy: 迷路を絵文字グリッドで表示
- ListPromptStrategy: walkable 位置のリスト
- GraphPromptStrategy: 隣接リスト（JSON）
- MatrixSepPromptStrategy: 0/1 マトリクス

すべて同一形式のプロンプト構造:
1. 迷路表現
2. S, E, Current 位置
3. history（訪問履歴）
4. 座標系説明
5. JSON 出力形式指定

問題なし

### src/runner/outputParser.ts
- Zod による move スキーマ定義
- 問題なし

### src/llm/
- LLM.ts: ollama/gemini の切り替え、withStructuredOutput
- LLMConfig.ts: モデル設定
- 問題なし

### src/execute.ts
- executeStrategy: 各位置で LLM 呼び出し、正解判定
- saveResult: YAML で結果保存
- 進捗表示、エラーハンドリングあり
- 問題なし

---

## 修正実施

### solver.ts 古いコメント削除
- [x] 完了
