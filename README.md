# historymap

Turn a YAML file into a company-style "product history" timeline — a static,
self-contained HTML page you can host on GitHub Pages and embed anywhere via
`<iframe>`.

Visual reference: the zigzag layout follows a classic corporate product
history timeline — a central vertical axis, items alternating left/right,
big year labels, and circular product photos.

[![historymap zigzag timeline — live demo](docs/screenshot-zigzag.png)](https://kenimoto.dev/products/historymap/)

*Live demo: <https://kenimoto.dev/products/historymap/> (the author's tech-book
publishing history, generated from [`data.yaml`](data.yaml))*

## v1 scope

- One layout: **zigzag** (a vertical zigzag timeline). The renderer is
  isolated behind a plugin boundary so future layouts (`tree`, `metro`,
  `heatmap`) can be added without touching this one.
- Output is a **single self-contained `dist/index.html`** file — CSS and JS
  inlined, no external CDN dependencies. Images may reference external URLs.
- The generated page notifies its embedding parent of its height via
  `postMessage`, so it can be sized correctly inside an `<iframe>`.

## Quick start (template usage)

1. Click **"Use this template"** on GitHub (or fork this repo).
2. Edit `data.yaml` at the repo root with your own product history.
3. Commit and push to `main`.
4. In your new repo's **Settings → Pages**, set **Source: GitHub Actions**.
5. GitHub Actions builds `dist/` and deploys it to GitHub Pages automatically
   on every push to `main` (see `.github/workflows/deploy.yml`).

Your page will be live at `https://<your-user>.github.io/<your-repo>/`.

## Local development

```bash
npm install
npm run build   # writes dist/index.html
npm test        # runs the test suite (node:test)
```

Open `dist/index.html` directly in a browser to preview.

## `data.yaml` schema

### Site-level fields

| Field | Required | Default | Description |
|---|---|---|---|
| `title` | yes | — | Page `<h1>` and `<title>` |
| `description` | no | `""` | `<meta description>` and header subtitle |
| `lang` | no | `en` | `<html lang>` |
| `layout` | no | `zigzag` | v1 only supports `zigzag`; any other value fails the build |
| `theme.preset` | no | `navy-mono` | `navy-mono` or `plain` |
| `theme.accent` | no | preset value | Accent color (year labels, links) |
| `theme.background` | no | preset value | Page background color |
| `theme.text` | no | preset value | Body text color |
| `theme.line` | no | preset value | Axis/rule line color |
| `theme.font` | no | system font stack | CSS `font-family` string |

`theme.accent`, `theme.background`, `theme.text`, and `theme.line` must be a
hex color (`#rgb`, `#rrggbb`, or `#rrggbbaa`); any other value fails the
build. `theme.font` only accepts letters, digits, spaces, and `, . ' " -`
(an allowlist, since the value is inlined into the generated `<style>`
block); anything else — including HTML/CSS metacharacters like `< > { } ; \`
— fails the build. `theme.preset` must be one of the known presets
(`navy-mono` or `plain`); any other value fails the build.

### Item fields (`items:`, one or more required)

| Field | Required | Description |
|---|---|---|
| `id` | no | Slug for future `relations` use. Auto-generated (`item-1`, `item-2`, ...) if omitted. Must be unique across all items after normalization — duplicates fail the build |
| `date` | yes | `YYYY-MM-DD` or `YYYY`. The full date is the sort key |
| `title` | yes | Item heading |
| `subtitle` | no | Small line under the year (model number, series name, etc.) |
| `description` | no | 2–3 lines of body text |
| `image` | no | URL, or a path relative to the **directory containing `data.yaml`** (not the repo root). Rendered as a circular photo |
| `link` | no | Makes the whole card a link (`target="_blank" rel="noopener"`) |
| `tags` | no | Reserved for the future `metro` layout; not rendered in v1 |
| `relations` | no | Reserved field (e.g. `parent: <id>`); only schema-validated in v1, otherwise ignored |

Items are sorted by `date` ascending (oldest first, top to bottom). A
year-only date such as `2026` is treated as `2026-01-01` for sorting. The
displayed year label uses month precision (`YYYY.MM`) when the source date
carries a month, and falls back to `YYYY` for year-only dates.

`image` local paths are resolved relative to the directory that contains
`data.yaml`, then copied into `dist/` at build time. Absolute paths (e.g.
`/etc/passwd`, `C:\...`), and any relative path that resolves outside that
directory (e.g. `../../secret.png`), fail the build.

`link` only accepts `http:`, `https:`, `mailto:`, and `tel:` URLs
(case-insensitive). A relative URL (no scheme) or any other scheme —
`javascript:`, `data:`, etc. — fails the build, since `link` is rendered as
a raw `href` on the page.

## Embedding via iframe

Add `embed.js` to the **parent page** (the site that hosts the iframe), and
mark the iframe with `data-historymap`:

```html
<iframe
  data-historymap
  src="https://your-user.github.io/your-repo/"
  style="width: 100%; border: 0;"
  title="Product History"
></iframe>
<script src="embed.js"></script>
```

The generated page posts `{ type: "historymap:height", height }` to its
parent whenever its content size changes (on load, and via `ResizeObserver`
afterwards). `embed.js` listens for that message and resizes the matching
iframe by comparing `event.source` to each iframe's `contentWindow` — this
works even with multiple historymap embeds on the same page.

Received heights are sanity-checked before being applied: only finite,
non-negative values are used; a value above `100000` is clamped down to
`100000`, and a non-finite value (`NaN`/`Infinity`) is ignored outright.

By default `embed.js` accepts messages from any origin so it works out of
the box. If you want to restrict it to your own historymap deployment(s),
define an origin allowlist **before** loading `embed.js`:

```html
<script>
  window.HISTORYMAP_ALLOWED_ORIGINS = ["https://your-user.github.io"];
</script>
<script src="embed.js"></script>
```

When `HISTORYMAP_ALLOWED_ORIGINS` is set to a non-empty array, `embed.js`
ignores any message whose `event.origin` is not in the list. Leaving it
undefined (the default) preserves the original any-origin behavior.

### Astro

```astro
---
// src/components/HistoryMap.astro
---
<iframe
  data-historymap
  src="https://your-user.github.io/your-repo/"
  style="width: 100%; border: 0;"
  title="Product History"
/>
<script src="/embed.js" is:inline></script>
```

Copy `embed.js` into your Astro project's `public/` directory so it's served
at `/embed.js`.

### React

```jsx
import { useEffect } from "react";

export function HistoryMapEmbed() {
  useEffect(() => {
    function onMessage(event) {
      const data = event.data;
      if (!data || data.type !== "historymap:height") return;
      const iframe = document.querySelector('iframe[data-historymap]');
      if (iframe && iframe.contentWindow === event.source) {
        iframe.style.height = `${data.height}px`;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      data-historymap
      src="https://your-user.github.io/your-repo/"
      style={{ width: "100%", border: 0 }}
      title="Product History"
    />
  );
}
```

(Or simply load `embed.js` as a regular `<script>` tag once, as shown above —
either approach works.)

## Project structure

```
historymap/
├── DESIGN.md             # full v1 design spec
├── package.json
├── data.yaml              # the data you edit
├── embed.js               # parent-page iframe resize snippet
├── src/
│   ├── build.mjs          # entry point
│   ├── validate.mjs       # schema validation
│   ├── themes.mjs         # theme presets
│   └── renderers/
│       └── zigzag.mjs     # zigzag layout renderer
├── test/
│   └── build.test.mjs
└── .github/workflows/
    └── deploy.yml          # build + deploy to GitHub Pages
```

## Not in v1

- Additional layouts (`tree`, `metro`, `heatmap`)
- Build-time rendering into Astro/React components (no-iframe integration)
- Publishing as an npm CLI (`npx historymap build`)

See `DESIGN.md` for the full spec.

## License

MIT
