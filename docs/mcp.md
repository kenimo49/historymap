# MCP server

historymap can run as an [MCP](https://modelcontextprotocol.io/) server so LLM
agents (Claude Code, Claude Desktop, etc.) can generate timelines directly.

## Tools exposed

| Tool | Description |
|------|-------------|
| `generate_timeline` | Generate HTML or PNG from inline `yaml` or a file path `yamlPath` |
| `list_layouts` | List all 10 layouts with "when to use" guidance |

### `generate_timeline` parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `yaml` | string | YAML content as an inline string (mutually exclusive with `yamlPath`) |
| `yamlPath` | string | Absolute path to a `.yaml` file on disk (mutually exclusive with `yaml`) |
| `layout` | string | Layout name (`zigzag`, `skyline`, `steps`, …). Defaults to the value in the YAML |
| `format` | `"html"` \| `"png"` | Output format. Defaults to `"png"` |
| `width` | number | Viewport width in px. Defaults to `1400` (recommended for Japanese text) |

Provide either `yaml` or `yamlPath` — not both. With large files (100+ lines)
`yamlPath` is more convenient: the agent edits the file and passes only the
path, avoiding sending the full YAML back in every message.

## Claude Code

Add to your project's `.mcp.json` (or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "historymap": {
      "command": "node",
      "args": ["/absolute/path/to/historymap/mcp/server.mjs"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/google-chrome-stable"
      }
    }
  }
}
```

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

## PNG output via MCP

PNG output requires Puppeteer. Run once inside the historymap repo:

```bash
npm install puppeteer
```

If Chrome is already installed on your system:

```bash
# Set in the "env" block of your MCP config (see above), or export globally:
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

See [cli.md](cli.md) for more detail on Puppeteer installation and CI caveats.
