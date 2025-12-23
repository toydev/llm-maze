# タスクリスト

## フェーズ1: 実験設計

### 1.1 戦略の選定
- [x] 既存結果の確認: matrix-embed, matrix-sep の gpt-oss 結果を分析
- [x] embed/sep の違い → sepの方が正解率・速度ともに良い
- [x] 実験対象: **simple, list, graph, matrix-sep** の4戦略
  - matrix-embedは除外（sepより劣る）

### 1.2 迷路の設計
目的（2D空間認識の評価）に対して最適な迷路を検討する。

- [x] 形状の議論
  - **open**: オープン空間（主軸）- 空間全体の認識
    - empty: 障害物なし
    - pass: 中央ブロックあり、通過可能
    - detour: 中央ブロックあり、回り込み必須
  - **corridor**: 1マス通路系 - 局所的判断、戦略差
    - straight: 直線型 - 分岐なし
    - branch: 分岐型 - 複数経路
    - dead-end: 袋小路型 - 行き止まりあり
    - loop: ループ型 - 周回可能、距離判断
    - spiral: 螺旋型 - 回り込み耐性
  - ~~回転バリエーション~~ → ジグザグ化で方向バイアス軽減
- [x] サイズの議論: 5x5, 7x7, 11x11, 15x15
  | 形状 | 5x5 | 7x7 | 11x11 | 15x15 |
  |------|-----|-----|-------|-------|
  | open/empty | ○ | ○ | ○ | ○ |
  | open/pass | - | - | ○ | ○ |
  | open/detour | - | - | ○ | ○ |
  | corridor/straight | ○ | ○ | ○ | ○ |
  | corridor/branch | - | ○ | ○ | ○ |
  | corridor/dead-end | - | ○ | ○ | ○ |
  | corridor/loop | - | - | ○ | ○ |
  | corridor/spiral | - | - | ○ | ○ |
  - 5x5: 内部3x3、empty/straight以外は構造破綻
  - 7x7: 内部5x5、pass/detourは窮屈、loop/spiralは不可
  - 15x15: listは全形状、simple/matrix-sep/graphはopen/empty + spiralのみ
- [ ] 最終的な迷路セットの決定・作成

### 1.3 その他パラメータ
- [x] historyの有無: 両方やる
  - 良い影響: 後ずさり予防、順方向精度向上
  - 悪い影響: ゴール越え地点から戻るケースで精度低下
  - パス生成アルゴリズムの改善: ジグザグ化
  - 概念: `dy >= dx ? [up, down, left, right] : [left, right, up, down]`

### 1.4 時間見積もり
- 戦略別方針:
  | 戦略 | 回数 | サイズ上限 | 目的 |
  |------|------|-----------|------|
  | simple | 2 (有無各1) | 〜11x11 | 遅さの証明 |
  | matrix-sep | 2 (有無各1) | 〜11x11 | 遅さの証明 |
  | list | 5 (有無各1+残3分配) | 〜15x15 | 精度検証（主力） |
  | graph | 5 (有無各1+残3分配) | 〜7x7 | 精度検証（サイズ制限） |
- 15x15の方針:
  - list: 速い・現実的なら全形状やる
  - simple/matrix-sep/graph: open/empty + spiral のみ（「無理」確認でスキップ可）
- 総見積もり: 約60-80h（2.5-3日）

## フェーズ2: 実験前の準備（実験に影響する部分）

- [ ] historyのパス生成アルゴリズム改善（もし使うなら）
- [ ] 間引き実行機能（全マスではなく1/2や1/3でサンプリング）
- [ ] 迷路ファイルの作成・整理
- [x] 既存outputの整理 → docs/preliminary_results.md に保存後削除

## フェーズ3: データ取得

- [ ] 実験設計に基づいてデータ取得
- [ ] 進捗管理（長時間になる可能性）

## フェーズ4: 分析・記事執筆

### 4.1 レポート機能の検討（実験と並行可）
- [ ] summary/detailの出力形式の見直し
- [ ] 記事用の可視化（Accuracy Grid等）

### 4.2 分析
- [ ] 結果の集約・可視化
- [ ] 仮説の検証

### 4.3 記事執筆
- [ ] 日本語版（Qiita）
- [ ] 英語版（dev.to）

## フェーズ5: 公開準備

- [ ] データディレクトリの整備
  - output/ は .gitignore（作業用）
  - 別ディレクトリ（例: data/results/）に参考データをコミット
  - summary/detail コマンドが両方を読めるように対応
- [ ] README.md（英語）作成
- [ ] README.ja.md（日本語）作成
- [ ] CLAUDE.md 削除
- [ ] 最終チェック

---

## 未決定事項

| 項目 | 選択肢 | 決定 |
|------|--------|------|
| 戦略数 | 4 | simple, list, graph, matrix-sep |
| graph の上限サイズ | 7x7 | 決定 |
| history | 有無両方 | 各1回ずつ |
| 試行回数 | 5 | history有無で分配 |
