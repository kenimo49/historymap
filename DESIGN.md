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

## v2 パターン拡張（2026-07-11 設計）

v1のzigzagに加え、5レイアウトを追加する: `tree` / `metro` / `heatmap` / `snake` / `road`。
`layout:` の値で切り替える。スキーマ（data.yaml）は既存のまま拡張しない —
tree は予約済み `relations.parent`、metro は予約済み `tags` を初めて実際に使う。

### 全レンダラー共通の契約

- シグネチャ: `render(data, theme) => string`（完全なHTML文書）。`data.items` は
  build.mjs が正規化済み（`id` 一意、`displayLabel` 付与、date昇順ソート、image解決済み）
- **self-contained**: 外部CDN・外部フォント・外部JS禁止。inline SVG は可
- `src/renderers/shared.mjs` の `escapeHtml` / `buildHeightScript` / `wrapDocument` を使う。
  ユーザー由来文字列は全て `escapeHtml` を通す（zigzag と同水準）
- link は `target="_blank" rel="noopener"`（スキーム検証は validate.mjs 済み）
- navy-mono 美学: フラット・細線・余白広め。グラデーション・絵文字・角丸過多・影過多は禁止
- ページ末尾クレジット（zigzag と同一マークアップ）、iframe高さ自動通知スクリプト内蔵
- モバイル（<640px）で破綻しないフォールバックを持つ
- 追加の描画専用検証（例: tree の親参照）はレンダラー内で行い、**明確なメッセージのErrorを投げてビルドを落とす**
- 月精度の再判定が必要な場合は `validate.mjs` の `parseItemDate` を import して使う（displayLabelの文字列判定をしない）
- テスト: `test/<layout>.test.mjs` に node:test で「正常データで必須マーカーを含むHTMLが出る」
  「異常データが明確なエラーで落ちる」を最低限。デモデータは `demo/<layout>.yaml`（架空データ、sample.yaml と同トーン）

### tree — 派生系譜図

- `relations.parent: <id>` で親子を表現。parent の無い item = ルート（複数可）
- 検証（レンダラー内）: parent が存在しない id を参照 → エラー / 循環参照 → エラー
- 描画: 縦ツリー（ルート上、子孫下）。CSSのみ（ネストした ul/li + border による連結線）、JS レイアウト計算なし
- ノード = 年ラベル（accent色・太字）+ title + subtitle（小）+ 円形画像（あれば、zigzag同様 contain）
- 兄弟ノードは date 昇順。複数ルートは縦に並べる
- モバイル: インデント幅を縮めた縦リスト表示に落とす

### metro — 路線図

- `tags` = 路線。tag ごとに固定パレットから出現順に色を割当。パレット8色
  （navy #0f2a43 / teal #2f6f6a / ochre #b98a2f / rust #a4502e / plum #6e4a6e / slate #5a6b7a / moss #5f7a3f / wine #7a3b47）、
  9路線以上は循環。最初の路線は theme.accent を優先
- 全 item が tags 空 → 単一路線（accent色）として成立させる
- 縦型路線図: 路線が縦に平行に走り、駅 = 白丸+路線色の枠。date 昇順に上から下へ
- 複数 tags を持つ item = 乗換駅（大きめの白丸を該当路線すべてに跨がせる）
- 駅の右側に年ラベル + title + subtitle。ヘッダー下に凡例（tag名と路線色）
- モバイル: 路線間隔を詰める（横スクロールさせない）

### heatmap — 活動密度グリッド

- GitHub contributions 風。行 = 年（古→新、上→下）、列 = 1〜12月 + 「月不明」列（年のみ精度のitem用）
- セル色 = そのセルの item 数。0 = 薄グレー、1〜4+ = accent のアルファ段階（4段階）
- セルの title 属性に該当 item の title を列挙。セルはその年セクションへのアンカーリンク
- グリッドの下に年ごとの item 一覧（年見出し + 日付・title・link の行）。ここが実質の本文
- 月精度判定は `parseItemDate` の `hasMonth` を使う
- モバイル: グリッドをそのまま縮小（min-width確保のため横スクロール可、本文一覧は折返し）

### snake — サーペンタインマップ（参考: カリキュラムロードマップ型）

- item を横一行に N 個並べ、行末で U 字に折り返す連続トラック（パイプ状の太い帯、角丸）
- 1行 N=4（960px基準）。<640px は縦一直線トラックに単純化
- DOM順は常に date 昇順。偶数行は左→右、奇数行は右→左（CSS `direction` / `row-reverse` で視覚反転、読み上げ順は維持）
- ノード = トラック上の円（accent塗り・白縁）。画像がある item は円形サムネイル（白背景 contain）をノードにする
- ノードの上下交互にラベル（年 = 大きめ accent、title 太字、subtitle 小）
- トラック色は line 色ベース（薄め）、折り返し半円は border-radius + 透明border で CSS 描画（画像不使用）

### road — ワインディングロード（参考: 道路インフォグラフィック型）

- inline SVG で S 字カーブの道路を描く: 太い路面（濃色）+ 白の破線センターライン（`stroke-dasharray`）
- 道路パスは item 数から機械生成（固定行高 × 行数で viewBox を決め、行ごとに左右へ蛇行する滑らかな三次ベジェ）
- マイルストーン = 道路上のドロップピン（SVG、accent色、白丸の中に 1..N の番号）
- 年 + title + description のテキストブロックは HTML でピン近傍に左右交互配置（SVGは背景レイヤー、テキストはCSS grid）
- モバイル: 縦直線道路 + 左寄せテキストに単純化
- 路面色は `#3a3a3a` 固定ではなく text 色を基準に導出（テーマ変更に追従させる）

### skyline — 水平軸バータイムライン（参考: スライド定番の中央軸+上下バー型）

- 中央に水平軸（両端に矢印、text色ベース）。item は date 昇順に左→右へ等間隔配置
- 各 item は軸から上下交互に伸びる縦バー（太さ8-10px）。バー色は metro と同じ8色パレットを出現順に循環（単調さ回避）
- バー先端側に title（太字）+ subtitle（小）、バーの根元（軸沿い）に displayLabel
- item が多い場合はコンテナを `overflow-x: auto` にして横スクロール（1item あたり最低幅を確保、ページ本体は横に溢れさせない）
- モバイル（<640px）: 軸を縦にした縦組みへフォールバック（バーは左右交互の水平バー）
- description は表示しない（バーラベルは簡潔さが命）

### steps — 番号ステップリスト（参考: 番号円+スタジアム形ピルのプロセス型）

- 大きな番号円（01, 02, …、白地+accent の太縁、2桁ゼロ埋め）を左に、スタジアム形ピル（`border-radius: 999px` の横長カード、薄い枠線）を右に重ねた行の縦リスト
- ピル内: displayLabel（accent・太字）+ title（太字）+ subtitle（小）+ description（14px）
- image がある item はピル右端に円形サムネ（白背景 contain）
- 行間は番号円を貫く細い縦ガイド線で接続（最終行の下には出さない）
- link があれば行全体をリンク化（target=_blank rel=noopener）
- モバイル: 番号円を縮小しピルの padding を詰める。構造は同じ

### beads — 垂直ビーズタイムライン（参考: 製造工程タイムライン型）

- 中央に太めの垂直軸。軸上に大きなリングノード（白抜き円+accent の太縁、内側に displayLabel）を date 昇順に配置
- 最初と最後のノードは塗りつぶし（accent地+白文字）にして START/FINISH 感を出す（ラベルは displayLabel のまま）
- 各ノードから左右交互に短い水平コネクタ（細線+終端ドット）を伸ばし、その先に title（太字）+ subtitle + description のブロック。image があれば円形サムネをブロック側に添える
- zigzag との違い: 年が軸上のリング内に入り軸が主役。コンテンツは各 item 片側のみ（左右交互）
- モバイル: 軸を左端に寄せ全 item 右側配置（zigzag のモバイル戦略と同じ）

### lollipop — ロリポップロード（参考: 道路+ステム付き年バッジ型、p1/p5統合）

- road と同系の inline SVG 蛇行道路（太い路面+白破線センターライン。パス生成ロジックの考え方は road の仕様を参照）
- マイルストーンは道路上のアンカー点から上下（モバイルでは左右）に細いステム（2px線）を伸ばし、先端に大きめの円形バッジ。バッジ内に displayLabel、バッジ色は metro の8色パレット循環（白文字が読めるよう濃色のみ使用）
- image がある item は バッジ内を円形画像（白背景 contain）にし、displayLabel はバッジ直下に小さく出す
- バッジの脇（ステムと反対側の余白）に title（太字）+ subtitle。description は表示しない
- road との違い: road=番号ピン+テキストブロック重視（語り）、lollipop=年バッジが主役（一覧性）。使い分けは gallery README に明記
- モバイル: 縦直線道路+左右交互バッジに単純化

### 共有インフラ（v2で導入）

- `src/renderers/shared.mjs`: `escapeHtml` / `buildHeightScript` / `wrapDocument`（head+body枠+クレジット+高さ通知の共通シェル）。zigzag も移行済み
- `build.mjs` の RENDERERS に6レイアウト登録、`validate.mjs` の VALID_LAYOUTS 拡張
- `tags` の要素は文字列であることを validate.mjs で検証（metro 以外の layout でも一律）
- `relations.parent` は存在する場合、文字列であることを validate.mjs で検証（参照整合と循環は tree レンダラー側）

## ヘッダーレイアウトスイッチャーUI（2026-07-11 設計）

`npm run build:all` で生成する **全ページ**（ルート `index.html` + 各 `<layout>/index.html`）のヘッダーに、レイアウトを切り替える `<select>` を注入する。単一ビルド（`npm run build`）にはサブディレクトリが存在しないため注入しない。

### 挙動

- `buildAllLayouts` が各ページ生成後、`injectBeforeHeadClose` で inline `<script>` を注入する（ルートは既存の `?layout=` リダイレクトstubの**後**に注入。stubが先に実行される順序を保つ）
- スクリプトは `DOMContentLoaded` 後に動作:
  1. `window.self !== window.top`（iframe埋め込み）なら**何もしない**。埋め込み先にスイッチャーは出さない
  2. `document.querySelector(".hm-header")` を探し、無ければ何もしない（全レンダラーが `.hm-header` を持つ規約。防御的なフォールバック位置は作らない）
  3. `<label class="hm-layout-switcher">Layout <select>…</select></label>` をヘッダー末尾に追加。option は allowlist の全レイアウト、現在ページのレイアウトを selected
  4. `change` 時のナビゲーション先は **必ず `ALLOWED_LAYOUTS[index]` から取る**（`select.value` を直接パスに連結しない。リダイレクトstubと同じ規約）。ルートページは `./<layout>/`、サブディレクトリページは `../<layout>/`。query/hash は引き継がない（`?layout=` の再発火防止、hashアンカーはレイアウト固有のため）
- 埋め込む定数（`ALLOWED_LAYOUTS` / `CURRENT_LAYOUT` / `IS_ROOT`）は build 時定数だが、既存規約どおり `JSON.stringify` 経由で埋め込む

### 見た目（navy-mono準拠）

- スクリプトが `<style>` も動的に追加（`.hm-header { position: relative }` + スイッチャー用スタイル）
- ヘッダー右上に absolute 配置（`top/right: 16px` 目安）。ラベル文字は 12px・`var(--hm-text, #333)`、select は `1px solid var(--hm-line, #ccc)` 枠・`var(--hm-background, #fff)` 地・`border-radius: 4px`・小さめフォント
- グラデーション・影・絵文字なし。フラットで細線
- `@media (max-width: 640px)`: absolute をやめ static でヘッダーテキスト下に中央配置（タイトルとの重なり防止）
- select に `aria-label` を付与

### テスト（multibuild.test.mjs に追加）

- build:all のルート+全サブディレクトリページに `hm-layout-switcher` マーカーが存在する
- ルートの CURRENT_LAYOUT はデフォルトレイアウト、サブディレクトリは各自のレイアウト
- 単一ビルド（buildSite 直呼び）の出力には注入されない
- ナビゲーションが allowlist 要素参照であること（生成コードに `ALLOWED_LAYOUTS[` 参照がある）
- iframe ガード（`window.top` 比較）が生成コードに含まれる

## 将来（v2でも実装しない）

- 同一data.yamlからAstroコンポーネント等でのビルド時レンダリング（iframeなし自サイト統合）
- npm CLI公開（`npx historymap build`）
