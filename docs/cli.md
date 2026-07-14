# CLI reference

## Basic usage

```bash
# HTML output (default)
node src/cli.mjs --data ./roadmap.yaml --layout skyline --out ./dist

# PNG output (requires puppeteer — see below)
node src/cli.mjs --data ./roadmap.yaml --layout skyline --format png --width 1400

# All 10 layouts at once
node src/cli.mjs --all --data ./roadmap.yaml --out ./dist

# Help
node src/cli.mjs --help
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--data <path>` | `<repo>/data.yaml` | Path to YAML data file |
| `--out <dir>` | `<repo>/dist` | Output directory |
| `--layout <name>` | from YAML | Override layout (`zigzag`, `skyline`, `steps`, …) |
| `--format html\|png` | `html` | Output format |
| `--width <px>` | `1400` | Viewport width for PNG (use 1400+ for Japanese text) |
| `--all` | off | Build all 10 layouts into subdirectories |

Unknown flags exit with an error and print the help text.

## PNG output & puppeteer

PNG export uses [Puppeteer](https://pptr.dev/) to screenshot the generated HTML.
Puppeteer is an `optionalDependency`, so a plain `npm install` skips it.
Install it separately when you need PNG:

```bash
npm install puppeteer
```

If your CI uses `npm install --omit=optional`, install puppeteer explicitly:

```bash
npm install --omit=optional && npm install puppeteer
```

If Chrome is already on your system, skip the Puppeteer download and point to it:

```bash
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
  node src/cli.mjs --format png --data ./roadmap.yaml
```

> **Note:** The MCP `generate_timeline` tool also supports `format: "png"` and
> uses the same Puppeteer dependency. See [mcp.md](mcp.md) for MCP setup.
