# 予備実験結果

実験設計前に実施した予備実験の結果サマリー。
この結果をもとに実験設計を行った。

## 全体サマリー

| Model | graph | list | matrix-embed | matrix-sep | simple |
|-------|-------|------|--------------|------------|--------|
| gpt-oss:20b | 93.6% (32.9s/pos) | 90.0% (45.1s/pos) | 90.4% (1m59s/pos) | 93.3% (1m38s/pos) | 96.2% (2m14s/pos) |

## 主な知見

- **速度**: graph > list > matrix-sep > matrix-embed > simple
- **精度**: simple > graph > matrix-sep > matrix-embed > list
- **matrix-embed vs matrix-sep**: sepの方が精度・速度ともに良い → embedは除外

## 迷路一覧（予備実験時）

- 5x5_simple
- 10x7_corridor
- 10x10_branch
- 11x11_open_asym
- 11x11_open_asym_rot90
- 11x11_open_center
- 11x11_open_sym
- 11x11_branch
- 15x15_open_asym
- 15x15_open_asym_rot90

## 備考

- 2024年12月時点の予備実験
- 本実験では迷路セットを再設計し、新規データを取得予定
