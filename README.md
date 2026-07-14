# historymap

Turn a YAML file into a company-style "product history" timeline — a static,
self-contained HTML page you can host on GitHub Pages and embed anywhere via
`<iframe>`. Ten layouts from the same data file: `zigzag`, `tree`, `metro`,
`heatmap`, `snake`, `road`, `skyline`, `steps`, `beads`, and `lollipop`.

Visual reference: the zigzag layout follows a classic corporate product
history timeline — a central vertical axis, items alternating left/right,
big year labels, and circular product photos.

[![historymap zigzag timeline — live demo](docs/screenshot-zigzag.png)](https://kenimoto.dev/products/historymap/)

*Live demo: <https://kenimoto.dev/products/historymap/> (the author's tech-book
publishing history, generated from [`data.yaml`](data.yaml))*

## Scope

- Ten layouts selected by the `layout:` field, all rendered from the same
  `data.yaml` schema (each renderer lives behind a plugin boundary):
  - **zigzag** — vertical timeline, central axis, items alternating left/right
  - **tree** — derivation genealogy driven by `relations.parent` (product family trees)
  - **metro** — subway-map style lines driven by `tags` (one colored line per tag, interchange stations for multi-tag items)
  - **heatmap** — GitHub-contributions-style year × month activity grid with a per-year listing below
  - **snake** — serpentine curriculum-map track that U-turns at the end of each row
  - **road** — winding SVG road with a dashed centerline and numbered milestone pins
  - **skyline** — horizontal axis with color-cycled bars rising and falling alternately
  - **steps** — numbered circles + stadium-shaped pill cards, process-style
  - **beads** — vertical axis with large year rings threaded on it like beads
  - **lollipop** — winding road with stemmed circular year badges (road's sibling, overview-oriented)
- **[See the pattern gallery](docs/patterns/README.md)** — a screenshot of
  every layout plus guidance on when to use which.
- Try them: each layout has a fictional demo file under `demo/`
  (`demo/tree.yaml`, `demo/metro.yaml`, ...) you can copy as a starting point.
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

## CLI

```bash
node src/cli.mjs --data ./roadmap.yaml --layout skyline --format png --width 1400
node src/cli.mjs --all --data ./roadmap.yaml   # all 10 layouts
node src/cli.mjs --help
```

| Flag | Default | Description |
|------|---------|-------------|
| `--data <path>` | `<repo>/data.yaml` | Path to YAML data file |
| `--out <dir>` | `<repo>/dist` | Output directory |
| `--layout <name>` | from YAML | Override layout |
| `--format html\|png` | `html` | Output format |
| `--width <px>` | `1400` | Viewport width for PNG |
| `--all` | off | Build all 10 layouts |

PNG output uses [Puppeteer](https://pptr.dev/) (`optionalDependency` — install
separately with `npm install puppeteer`).
**→ [Full CLI reference & puppeteer setup](docs/cli.md)**

## MCP server

historymap can run as an [MCP](https://modelcontextprotocol.io/) server so LLM
agents (Claude Code, Claude Desktop, etc.) can generate timelines directly.

| Tool | Description |
|------|-------------|
| `generate_timeline` | Generate HTML or PNG from inline `yaml` or a file path `yamlPath` |
| `list_layouts` | List all 10 layouts with "when to use" guidance |

```json
{
  "mcpServers": {
    "historymap": {
      "command": "node",
      "args": ["/absolute/path/to/historymap/mcp/server.mjs"]
    }
  }
}
```

**→ [Full MCP setup (Claude Code + Claude Desktop)](docs/mcp.md)**

## Layout switching

`npm run build:all` builds all 10 layouts into `dist/<layout>/` subdirectories.
`dist/index.html` also handles `?layout=<name>` redirects, and every page gets
a header `<select>` so visitors can switch layouts without knowing the URL.

**→ [Full layout switching & URL parameter docs](docs/layout-switching.md)**

## Local development

```bash
npm install
npm run build   # writes dist/index.html
npm test        # runs the test suite (node:test)
```

Open `dist/index.html` directly in a browser to preview.

## data.yaml schema

Key fields at a glance:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Page `<h1>` and `<title>` |
| `layout` | no | One of the 10 layout names (default: `zigzag`) |
| `items[].date` | yes | `YYYY-MM-DD` or `YYYY` |
| `items[].title` | yes | Item heading |
| `items[].description` | no | 2–3 lines of body text |
| `items[].image` | no | URL or path relative to `data.yaml` |
| `items[].link` | no | `http:`/`https:`/`mailto:`/`tel:` only |
| `items[].tags` | no | Used by the `metro` layout |
| `items[].relations` | no | `parent: <id>` used by the `tree` layout |

**→ [Full schema reference (all fields + validation rules)](docs/schema.md)**

## Embedding via iframe

```html
<iframe
  data-historymap
  src="https://your-user.github.io/your-repo/"
  style="width: 100%; border: 0;"
  title="Product History"
></iframe>
<script src="embed.js"></script>
```

`embed.js` auto-resizes the iframe via `postMessage`. Works with multiple
embeds on the same page.

**→ [Full embedding docs (Astro, React, origin allowlist)](docs/embedding.md)**

## Project structure

```
historymap/
├── DESIGN.md             # full v1 design spec
├── CHANGELOG.md          # version history
├── package.json
├── data.yaml             # the data you edit
├── embed.js              # parent-page iframe resize snippet
├── src/
│   ├── cli.mjs           # CLI entry point
│   ├── build.mjs         # core build logic
│   ├── validate.mjs      # schema validation
│   ├── screenshot.mjs    # HTML → PNG (Puppeteer)
│   ├── themes.mjs        # theme presets
│   └── renderers/        # one file per layout renderer
├── mcp/
│   ├── server.mjs        # MCP server entry point
│   └── handlers.mjs      # tool logic (testable separately)
├── docs/
│   ├── cli.md            # CLI flags & puppeteer setup
│   ├── mcp.md            # MCP server setup
│   ├── schema.md         # data.yaml full schema reference
│   ├── embedding.md      # iframe embedding (Astro, React, allowlist)
│   ├── layout-switching.md  # ?layout= URL param & header switcher
│   ├── patterns/         # layout screenshot gallery
│   └── changelog/        # images referenced from CHANGELOG.md
├── demo/                 # fictional sample data, one per layout
├── test/                 # node:test suite
└── .github/workflows/
    └── deploy.yml        # build + deploy to GitHub Pages
```

### About `worker/` (kenimoto.dev deployment only)

`worker/` and the `main` / `assets.binding` entries in `wrangler.jsonc` are glue for
the author's deployment at `kenimoto.dev/products/historymap/`: the Worker injects a
site-wide support/analytics overlay script into served HTML. It is **host-gated** —
injection only runs when the request hostname is exactly `kenimoto.dev`, so a fork
deployed anywhere else serves plain static files with no injection and no external
requests. If you fork this repo, deleting `worker/` (and those two `wrangler.jsonc`
entries) is still recommended for clarity.

## Not implemented

- Build-time rendering into Astro/React components (no-iframe integration)
- Publishing as an npm package (`npx historymap` without cloning)

See `DESIGN.md` for the full spec.

## License

MIT
