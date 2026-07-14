# Embedding via iframe

## Basic

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

## Origin allowlist (optional)

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

## Astro

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

## React

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

You can also load `embed.js` as a regular `<script>` tag once instead of
wiring the `message` listener manually — either approach works.

## Embedding a specific layout

To always show one layout regardless of the data file's default, point the
`src` directly at the layout subpath:

```html
<iframe
  data-historymap
  src="https://your-user.github.io/your-repo/tree/"
  style="width: 100%; border: 0;"
  title="Product History"
></iframe>
```

See [layout-switching.md](layout-switching.md) for the full `?layout=`
query-parameter and header-switcher documentation.
