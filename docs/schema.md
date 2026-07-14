# data.yaml schema

## Site-level fields

| Field | Required | Default | Description |
|---|---|---|---|
| `title` | yes | — | Page `<h1>` and `<title>` |
| `description` | no | `""` | `<meta description>` and header subtitle |
| `lang` | no | `en` | `<html lang>` |
| `layout` | no | `zigzag` | One of `zigzag`, `tree`, `metro`, `heatmap`, `snake`, `road`, `skyline`, `steps`, `beads`, `lollipop`; any other value fails the build |
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

## Item fields (`items:`, one or more required)

| Field | Required | Description |
|---|---|---|
| `id` | no | Slug for future `relations` use. Auto-generated (`item-1`, `item-2`, ...) if omitted. Must be unique across all items after normalization — duplicates fail the build |
| `date` | yes | `YYYY-MM-DD` or `YYYY`. The full date is the sort key |
| `title` | yes | Item heading |
| `subtitle` | no | Small line under the year (model number, series name, etc.) |
| `description` | no | 2–3 lines of body text |
| `image` | no | URL, or a path relative to the **directory containing `data.yaml`** (not the repo root). Rendered as a circular photo |
| `link` | no | Makes the whole card a link (`target="_blank" rel="noopener"`) |
| `tags` | no | Used by the `metro` layout (one line per tag, multi-tag items become interchange stations); elements must be non-empty strings. Not rendered by other layouts |
| `relations` | no | `parent: <id>` is used by the `tree` layout to build the genealogy. The `tree` build fails on a reference to a non-existent id or a circular chain. Ignored by other layouts |

## Sorting & date display

Items are sorted by `date` ascending (oldest first, top to bottom). A
year-only date such as `2026` is treated as `2026-01-01` for sorting. The
displayed year label uses month precision (`YYYY.MM`) when the source date
carries a month, and falls back to `YYYY` for year-only dates.

## Path & URL validation

`image` local paths are resolved relative to the directory that contains
`data.yaml`, then copied into `dist/` at build time. Absolute paths (e.g.
`/etc/passwd`, `C:\...`), and any relative path that resolves outside that
directory (e.g. `../../secret.png`), fail the build.

`link` only accepts `http:`, `https:`, `mailto:`, and `tel:` URLs
(case-insensitive). A relative URL (no scheme) or any other scheme —
`javascript:`, `data:`, etc. — fails the build, since `link` is rendered as
a raw `href` on the page.

## Minimal example

```yaml
title: My Product History
layout: skyline

items:
  - date: "2023-04-01"
    title: v1.0 Launch
    description: Initial release.

  - date: "2024-11-15"
    title: v2.0
    subtitle: Major rewrite
    description: New rendering engine, 10 layouts.
    link: https://example.com/v2
```
