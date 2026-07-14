# Layout switching

## Building all layouts

`npm run build:all` builds **every** registered layout from the same
`data.yaml` in one pass:

```bash
npm run build:all
```

Output structure:

- `dist/index.html` — the data file's own default layout (its `layout:` field,
  or `zigzag` if unset)
- `dist/<layout>/index.html` — every registered layout, one per subdirectory
  (e.g. `dist/tree/index.html`, `dist/metro/index.html`, …), including the
  default

`.github/workflows/deploy.yml` runs `npm run build:all`, so the deployed
GitHub Pages demo supports `?layout=` out of the box. The plain `npm run
build` (single layout, no subdirectories) is still available for local
iteration.

## `?layout=` query parameter

`dist/index.html` contains a small inline script that reads `?layout=<name>`
from the page URL. If `<name>` matches one of the registered layouts and
isn't the default, it redirects to `./<name>/` (query string and hash
preserved). So:

```
https://your-user.github.io/your-repo/?layout=metro
```

takes a visitor straight to the metro rendering of your data, while the
plain URL keeps showing the default. Unrecognized `?layout=` values are
ignored and the default layout is shown.

## Header layout switcher

Every page written by `npm run build:all` (the root `index.html` and each
`<layout>/index.html`) gets a small `<select>` added to its header, so a
visitor can jump to another layout without knowing about `?layout=`. It shows
the current layout preselected; picking a different one navigates to that
layout's own subpath (`./<layout>/` from root, `../<layout>/` from inside a
subdirectory), without carrying over the previous page's query string or hash.

The switcher is skipped entirely when the page is loaded inside an `<iframe>`
(e.g. an embed on someone else's site), so an embedded timeline never grows
UI the embedding site didn't ask for. It only appears at all if the page has
the `.hm-header` element every renderer emits. The plain `npm run build`
(single layout, no subdirectories to switch between) never gets this script.

## Embedding a specific layout directly

To embed one specific layout without relying on the query parameter, point the
`<iframe>` directly at the subpath:

```html
<iframe
  data-historymap
  src="https://your-user.github.io/your-repo/tree/"
  style="width: 100%; border: 0;"
  title="Product History"
></iframe>
```

See [embedding.md](embedding.md) for full iframe integration instructions.
