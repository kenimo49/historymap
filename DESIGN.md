# historymap — DESIGN (v1)

データ(YAML)を入れると企業サイト風「プロダクトヒストリー年表」の静的ページを生成し、
GitHub Pagesで配信、iframeで任意のサイトに埋め込めるツール。

参考ビジュアル: 日立産機のPLC製品ヒストリー（中央縦軸＋年ごとに左右交互＋丸抜き製品写真）。

## v1スコープ

- レイアウトは **zigzag（ジグザグ縦軸年表）1種のみ**。ただしレンダラーはプラグイン境界で分離し、
  将来 `tree` / `metro` / `heatmap` を追加できる構造にする
- 生成物は **self-contained な dist/index.html 1ファイル**（CSS/JSインライン、外部CDN依存なし。画像はURL参照可）
- iframe埋め込み用の **高さ自動通知（postMessage）** を生成ページに内蔵、親サイト用スニペット `embed.js` を同梱
- テンプレートリポジトリUX: fork/Use this template → `data.yaml` 編集 → push → Actions が Pages にデプロイ

## 技術方針

- Node 20+、依存は `js-yaml` のみ。フレームワーク・バンドラ不使用
- ESM (`"type": "module"`)
- `npm run build` = `node src/build.mjs` → `dist/index.html` を出力
- `npm test` = スキーマ必須項目欠落・不正layout値でビルドが分かりやすく失敗すること、
  正常データでHTMLが生成され必須マーカー（各itemのtitle、postMessageコード）を含むことを node:test で検証

## ファイル構成

```
historymap/
├── DESIGN.md
├── README.md            # 使い方（英語。テンプレ利用手順、埋め込み手順、スキーマ表）
├── package.json
├── data.yaml            # ルートのデータ = ビルド対象（テンプレ利用者が編集するファイル）
├── embed.js             # 親サイト用: iframe高さ自動リサイズスニペット
├── src/
│   ├── build.mjs        # エントリ: data.yaml読込→バリデーション→レンダラー選択→dist出力
│   ├── validate.mjs     # スキーマ検証（必須項目、型、layout値）
│   ├── themes.mjs       # テーマプリセット定義
│   └── renderers/
│       └── zigzag.mjs   # render(data, theme) => 完全なHTML文字列
├── test/
│   └── build.test.mjs
└── .github/workflows/
    └── deploy.yml       # push時: build → GitHub Pages deploy（actions/deploy-pages公式手順）
```

## data.yaml スキーマ

```yaml
# ---- サイト全体 ----
title: "Product History"        # 必須。ページ<h1>兼<title>
description: ""                 # 任意。<meta description>とサブタイトル
lang: ja                        # 任意。デフォルト en
layout: zigzag                  # 任意。v1はzigzagのみ。他の値はエラーで落とす
theme:
  preset: navy-mono             # 任意。navy-mono(デフォルト) | plain。これ以外はエラーで落とす
  # 以下presetの個別上書き（任意）
  accent: "#0f2a43"
  background: "#f7f7f5"
  text: "#1a1a1a"
  line: "#c8c8c4"                # 任意。軸・罫線色
  font: ""                      # 任意。CSS font-family文字列。空ならシステムフォントスタック

# ---- 年表アイテム ----
items:                          # 必須。1件以上
  - id: my-product-v1           # 任意。将来のrelations用スラッグ。省略時はindexから自動生成。正規化後（自動生成分含む）に重複があればエラー
    date: 2026-03-15            # 必須。YYYY-MM-DD または YYYY。ソートキーは全体、表示は月精度があればYYYY.MM、年のみならYYYY
    title: "My Product v1"      # 必須
    subtitle: ""                # 任意。型番・シリーズ名など小さく添える
    description: ""             # 任意。2-3行の説明
    image: "https://…"          # 任意。URL または data.yaml があるディレクトリからの相対パス。丸抜き表示される
    link: "https://…"           # 任意。カード全体のリンク先（target=_blank rel=noopener）。許可スキームはhttp:/https:/mailto:/tel:のみ
    tags: []                    # 任意。v1では非表示。将来metroの路線分けに使う
    relations: {}               # 予約フィールド。v1では検証だけして無視（parent: <id> を想定）
```

- ソートは date 昇順（古→新、上→下）。同年複数は日付順
- date が年のみ（`2026`）も許容。`2026` は `2026-01-01` としてソート
- 年ラベル表示: 月精度がある date は `YYYY.MM`、年のみは `YYYY`（同一年アイテム連続時の単調さ回避）

### スキーマ検証（セキュリティ関連）

- `items[].link`: trim後のURLスキームを検証し、`http:` `https:` `mailto:` `tel:` のみ許可（大文字小文字無視）。
  スキームなし（相対URL等）やそれ以外のスキーム（`javascript:`, `data:` 等）はビルドエラーで落とす。
  `link` はページ上で生の `href` としてレンダリングされるため、任意スキームを許すとXSSにつながる
- `theme.accent` / `background` / `text` / `line`: hex色（`#rgb` / `#rrggbb` / `#rrggbbaa`）のみ許可。それ以外はエラー
- `theme.font`: allowlist正規表現 `^[A-Za-z0-9 ,.'"-]*$` のみ許可。
  値は生成HTMLの `<style>` ブロック内にそのまま埋め込まれるため、`</style>` などで抜け出せる値はエラーで拒否する
- `theme.preset`: 既知のpreset（`navy-mono` / `plain`）以外はエラー
- `items[].id`: 正規化後（自動生成id含む）に重複があればエラー。アンカーや将来の`relations`機能がidの一意性に依存するため
- `items[].image` のローカルパス: 絶対パス（`/etc/passwd` 等）とWindowsドライブレター（`C:\...`）は即エラー。
  `path.resolve` した結果が `data.yaml` のあるディレクトリの外に出るパス（`../../secret.png` 等）もエラー。
  コピー先（`dist/` 配下）についても同様に出力ディレクトリの外に出ないことを検証する

## zigzag レンダラーの見た目仕様

日立風の骨格を踏襲しつつ navy-mono に寄せる:

- 中央に縦のガイド軸（シェブロン▼の連続 or 破線。CSSで表現、画像不使用）
- アイテムは左右交互。**年号を大きく**（32-40px、テーマaccent色）、その下にtitle（太字）、subtitle（小）、description（14px、行間広め）
- image があるアイテムは **円形クリップ（白背景・薄いborder・軽いshadow）** でテキスト側と反対側の列に配置。
  書影のような縦長画像は `object-fit: contain` + 白パディングで円内に収める（顔写真的なcoverで切らない）
- 年号と軸の接続に短い水平コネクタ線
- モバイル（<640px）は単列: 軸を左端に寄せ、全アイテム右側配置に折りたたむ
- navy-mono プリセット: 背景 #f7f7f5 / 本文 #1a1a1a / accent #0f2a43 / 軸・罫線 #c8c8c4。
  装飾グラデーション・絵文字・角丸過多を使わない（AI Slop排除。フラット、余白広め、線は細く）
- ページ末尾に `Generated with historymap` の小さなクレジット（リンク付き、10px、薄グレー）

## iframe 高さ自動通知

- 生成ページ内スクリプト: `ResizeObserver` で `document.documentElement.scrollHeight` を監視し、
  変化時に `parent.postMessage({ type: 'historymap:height', height }, '*')` を送出。load時にも1回送る
- `embed.js`（親サイト側）: `message` イベントで `type === 'historymap:height'` を受けたら、
  `data-historymap` 属性を持つ iframe のうち **event.source が一致するもの** の height を更新する
  （複数埋め込み対応）
  - height の値は `Number.isFinite(h) && h >= 0` を満たす場合のみ適用。`100000` を超える値は `100000` にclamp、
    非有限（`NaN`/`Infinity`）は無視してiframeを更新しない
  - origin allowlist: 親ページが `window.HISTORYMAP_ALLOWED_ORIGINS = ['https://example.github.io']` のように
    非空配列を定義している場合、`event.origin` がリストにないメッセージは無視する。未定義（デフォルト）なら
    従来どおり全origin許可（`event.source` 照合は常に維持）
- READMEに素のHTML埋め込み例とAstro/Reactでの利用例、および `HISTORYMAP_ALLOWED_ORIGINS` の使い方を記載

## GitHub Actions (deploy.yml)

- trigger: push to main + workflow_dispatch
- steps: checkout → setup-node 20 → `npm ci` → `npm run build` → upload-pages-artifact(dist) → deploy-pages
- テンプレ利用者は Settings→Pages→Source: GitHub Actions にするだけ（READMEに明記）
- permissionsは最小権限（job単位）: `build` job は `contents: read` のみ、`deploy` job にだけ
  `pages: write` + `id-token: write`（+ `contents: read`）を付与する。workflowトップレベルには置かない

## 将来（v1では実装しない）

- レイアウト追加: tree（派生系譜）、metro（テーマ路線図）、heatmap
- 同一data.yamlからAstroコンポーネント等でのビルド時レンダリング（iframeなし自サイト統合）
- npm CLI公開（`npx historymap build`）
