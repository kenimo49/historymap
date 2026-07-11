#!/usr/bin/env node
// Entry point: data.yaml -> validate -> normalize -> render -> dist/index.html

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { validate, parseItemDate } from "./validate.mjs";
import { resolveTheme } from "./themes.mjs";
import { render as renderZigzag } from "./renderers/zigzag.mjs";
import { render as renderTree } from "./renderers/tree.mjs";
import { render as renderMetro } from "./renderers/metro.mjs";
import { render as renderHeatmap } from "./renderers/heatmap.mjs";
import { render as renderSnake } from "./renderers/snake.mjs";
import { render as renderRoad } from "./renderers/road.mjs";
import { render as renderSkyline } from "./renderers/skyline.mjs";
import { render as renderSteps } from "./renderers/steps.mjs";
import { render as renderBeads } from "./renderers/beads.mjs";
import { render as renderLollipop } from "./renderers/lollipop.mjs";

// Renderer registry: one render(data, theme) function per layout value.
const RENDERERS = {
  zigzag: renderZigzag,
  tree: renderTree,
  metro: renderMetro,
  heatmap: renderHeatmap,
  snake: renderSnake,
  road: renderRoad,
  skyline: renderSkyline,
  steps: renderSteps,
  beads: renderBeads,
  lollipop: renderLollipop,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`historymap: data file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return yaml.load(raw);
  } catch (err) {
    throw new Error(`historymap: failed to parse YAML at ${filePath}: ${err.message}`);
  }
}

function normalizeItems(items) {
  const withSortKey = items.map((item, index) => {
    const { date, year, hasMonth } = parseItemDate(item.date, `data.yaml: items[${index}]`);
    const id = item.id && String(item.id).trim() !== "" ? String(item.id) : `item-${index + 1}`;
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return {
      ...item,
      id,
      displayLabel: hasMonth ? `${year}.${month}` : String(year),
      _sortDate: date,
    };
  });

  assertUniqueIds(withSortKey);

  // Stable sort: ties (identical date) keep their original data.yaml order.
  withSortKey.sort((a, b) => a._sortDate.getTime() - b._sortDate.getTime());

  return withSortKey.map(({ _sortDate, ...rest }) => rest);
}

/**
 * Ensures item ids are unique after normalization (explicit ids and
 * auto-generated `item-N` ids alike). Anchors (`#id`) and any future
 * `relations` feature depend on ids being unique, so a collision fails the
 * build rather than silently rendering ambiguous anchors.
 * @param {Array<{id: string}>} items
 */
function assertUniqueIds(items) {
  const seen = new Map(); // id -> first index seen at
  const duplicates = new Set();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    } else {
      seen.set(item.id, index);
    }
  });

  if (duplicates.size > 0) {
    throw new Error(
      `data.yaml: duplicate item id(s) after normalization: ${[...duplicates].join(", ")}. Each item's "id" (or auto-generated "item-N") must be unique.`
    );
  }
}

/**
 * Returns true when `absPath` is equal to, or a descendant of, `baseDir`.
 * Used to reject any local path (image src, or its copy destination) that
 * escapes the directory it is supposed to be confined to.
 * @param {string} absPath - already-resolved absolute path to check
 * @param {string} baseDir - already-resolved absolute directory it must stay within
 */
function isWithinDir(absPath, baseDir) {
  return absPath === baseDir || absPath.startsWith(baseDir + path.sep);
}

function resolveImage(item, { dataDir, outDir }) {
  if (!item.image) return item;
  const src = item.image;

  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) {
    return item;
  }

  // Reject absolute paths (POSIX `/etc/passwd`-style) and Windows drive
  // letters (`C:\...`) up front: local `image` values must be relative
  // paths under the data file's directory, never an absolute filesystem path.
  if (path.isAbsolute(src) || /^[A-Za-z]:/.test(src)) {
    throw new Error(
      `historymap: "image" for item "${item.title}" must be a URL or a path relative to the data file's directory; absolute paths are not allowed: "${src}"`
    );
  }

  // Local/relative path: copy the file into dist/ so the page keeps
  // working once deployed, and keep the same relative path as the src ref.
  const dataDirResolved = path.resolve(dataDir);
  const absSrc = path.resolve(dataDirResolved, src);
  if (!isWithinDir(absSrc, dataDirResolved)) {
    throw new Error(
      `historymap: "image" for item "${item.title}" resolves outside of the data directory: "${src}" (resolved to ${absSrc})`
    );
  }
  if (!fs.existsSync(absSrc)) {
    throw new Error(
      `historymap: image not found for item "${item.title}": "${src}" (resolved to ${absSrc})`
    );
  }

  const relDest = src.replace(/^\/+/, "");
  const outDirResolved = path.resolve(outDir);
  const absDest = path.resolve(outDirResolved, relDest);
  if (!isWithinDir(absDest, outDirResolved)) {
    throw new Error(
      `historymap: "image" for item "${item.title}" copy destination resolves outside of the output directory: "${src}"`
    );
  }

  fs.mkdirSync(path.dirname(absDest), { recursive: true });
  fs.copyFileSync(absSrc, absDest);
  return { ...item, image: relDest };
}

/**
 * Builds the historymap site: reads + validates data.yaml, normalizes items
 * (sort by date, assign ids, resolve local image paths), renders the HTML,
 * and writes dist/index.html.
 *
 * @param {object} [options]
 * @param {string} [options.dataPath] - path to the YAML data file (default: <repo>/data.yaml)
 * @param {string} [options.outDir] - output directory (default: <repo>/dist)
 * @param {string} [options.layoutOverride] - render with this layout instead of
 *   the data file's own `layout:` value. Must be a key of RENDERERS; used
 *   internally by buildAllLayouts to render every layout from one data file.
 *   Not derived from user input, so it is trusted as-is (no re-validation).
 * @returns {{ html: string, outPath: string, data: object }}
 */
export function buildSite(options = {}) {
  const dataPath = path.resolve(options.dataPath || path.join(REPO_ROOT, "data.yaml"));
  const outDir = path.resolve(options.outDir || path.join(REPO_ROOT, "dist"));
  const dataDir = path.dirname(dataPath);

  const raw = readYaml(dataPath);
  const data = validate(raw);

  const layout = options.layoutOverride || data.layout;
  const renderer = RENDERERS[layout];
  if (!renderer) {
    throw new Error(`historymap: no renderer registered for layout "${layout}".`);
  }

  const theme = resolveTheme(data.theme);
  const items = normalizeItems(data.items).map((item) => resolveImage(item, { dataDir, outDir }));
  const renderData = { ...data, layout, items };

  const html = renderer(renderData, theme);

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "index.html");
  fs.writeFileSync(outPath, html, "utf8");

  return { html, outPath, data: renderData };
}

/**
 * Builds every registered layout from a single data file:
 *  - the data file's own default layout (its `layout:` value, or `zigzag`
 *    if unset) is written to `<outDir>/index.html`
 *  - every registered layout (including the default) is additionally
 *    written to `<outDir>/<layout>/index.html`, so any layout can be
 *    reached directly (e.g. for an iframe pointed at a specific subpath)
 *
 * The root `<outDir>/index.html` also gets a small inline script injected
 * before `</head>` that reads `?layout=<name>` from the page URL and, when
 * `<name>` is present in the build-time allowlist of registered layouts and
 * differs from the default, redirects to `./<name>/` (preserving the query
 * string and hash). Any value not in the allowlist is silently ignored so
 * the page still renders with the default layout. The redirect target is
 * always taken from the allowlist array itself (matched by exact equality),
 * never by concatenating the raw query parameter into the path, so a
 * malicious `?layout=` value cannot be used to build an arbitrary path.
 *
 * Every page written here (root plus each `<layout>/` subdirectory) also
 * gets the layout-switcher UI script injected: a `<select>` in the header
 * that lets a visitor jump straight to another layout. On the root page
 * this is injected *after* the redirect stub above, so the stub still runs
 * first. `buildSite` on its own (single-layout build, no subdirectories)
 * never gets either script.
 *
 * @param {object} [options]
 * @param {string} [options.dataPath] - path to the YAML data file (default: <repo>/data.yaml)
 * @param {string} [options.outDir] - output directory (default: <repo>/dist)
 * @returns {{ outDir: string, defaultLayout: string, layouts: string[] }}
 */
export function buildAllLayouts(options = {}) {
  const dataPath = path.resolve(options.dataPath || path.join(REPO_ROOT, "data.yaml"));
  const outDir = path.resolve(options.outDir || path.join(REPO_ROOT, "dist"));
  const layouts = Object.keys(RENDERERS);

  // Default build lands at <outDir>/index.html and tells us the data file's
  // own resolved layout (validate() already defaults an unset layout to
  // "zigzag", so data.layout here is always one of `layouts`).
  const { data: defaultData } = buildSite({ dataPath, outDir });
  const defaultLayout = defaultData.layout;

  // One subdirectory per registered layout, default included, so every
  // layout is reachable at a stable, direct path regardless of what the
  // data file's own default is. Each subdirectory page is not the root, so
  // it only gets the layout-switcher UI script (no redirect stub: there is
  // no `?layout=` handling to do once you're already at a specific layout).
  for (const layout of layouts) {
    const { outPath } = buildSite({ dataPath, outDir: path.join(outDir, layout), layoutOverride: layout });
    const html = fs.readFileSync(outPath, "utf8");
    const patched = injectBeforeHeadClose(
      html,
      buildLayoutSwitcherUiScript({ currentLayout: layout, layouts, isRoot: false })
    );
    fs.writeFileSync(outPath, patched, "utf8");
  }

  const rootOutPath = path.join(outDir, "index.html");
  const rootHtml = fs.readFileSync(rootOutPath, "utf8");
  const withRedirectStub = injectBeforeHeadClose(
    rootHtml,
    buildLayoutSwitcherScript({ defaultLayout, layouts })
  );
  const patchedHtml = injectBeforeHeadClose(
    withRedirectStub,
    buildLayoutSwitcherUiScript({ currentLayout: defaultLayout, layouts, isRoot: true })
  );
  fs.writeFileSync(rootOutPath, patchedHtml, "utf8");

  return { outDir, defaultLayout, layouts };
}

/**
 * Builds the `<script>` block that redirects `<outDir>/index.html` to
 * `<outDir>/<layout>/index.html` based on a `?layout=` query parameter.
 * `defaultLayout` and `layouts` are build-time values (never user input),
 * but are still passed through JSON.stringify rather than interpolated as
 * raw strings, matching this codebase's existing convention for embedding
 * values into generated `<script>`/`<style>` blocks.
 * @param {{ defaultLayout: string, layouts: string[] }} params
 * @returns {string}
 */
function buildLayoutSwitcherScript({ defaultLayout, layouts }) {
  return `<script>
(function () {
  var ALLOWED_LAYOUTS = ${JSON.stringify(layouts)};
  var DEFAULT_LAYOUT = ${JSON.stringify(defaultLayout)};
  try {
    var params = new URLSearchParams(location.search);
    var wanted = params.get("layout");
    if (wanted) {
      var index = ALLOWED_LAYOUTS.indexOf(wanted);
      // Redirect target always comes from the allowlist entry itself
      // (never the raw "wanted" value) so an unexpected query value can
      // never be concatenated into the path.
      if (index !== -1 && ALLOWED_LAYOUTS[index] !== DEFAULT_LAYOUT) {
        location.replace("./" + ALLOWED_LAYOUTS[index] + "/" + location.search + location.hash);
      }
    }
  } catch (e) {
    // Malformed URL/query string: fall through and keep showing the default layout.
  }
})();
</script>
`;
}

/**
 * Builds the `<script>` block for the on-page layout-switcher `<select>`.
 * Injected into the root page and every `<layout>/` subdirectory page by
 * `buildAllLayouts` (never into a plain `buildSite` single-layout build,
 * which has no subdirectories to switch between).
 *
 * Behavior, run once on `DOMContentLoaded` (or immediately if the document
 * has already finished loading):
 *  - inside an iframe (`window.self !== window.top`) it does nothing, so an
 *    embedded page never grows a switcher the embedding site didn't ask for
 *  - if the page has no `.hm-header` (every renderer emits one; this is a
 *    defensive fallback, not a real code path) it does nothing
 *  - otherwise it appends a `<style>` element (navy-mono: absolute
 *    top-right on desktop, static + centered under 640px) and a `<label
 *    class="hm-layout-switcher">` with a `<select>` listing every allowlisted
 *    layout, current layout preselected
 *  - on `change`, the navigation target is always read back out of
 *    `ALLOWED_LAYOUTS` by `select.selectedIndex` (never `select.value`
 *    concatenated into the path), mirroring the redirect stub's convention.
 *    query string and hash are intentionally dropped: a carried-over
 *    `?layout=` would just re-trigger the redirect stub, and hash anchors
 *    are specific to the layout being left
 *
 * `currentLayout` and `layouts` are build-time values (never user input),
 * but are still passed through JSON.stringify rather than interpolated as
 * raw strings, matching this codebase's existing convention for embedding
 * values into generated `<script>`/`<style>` blocks.
 * @param {{ currentLayout: string, layouts: string[], isRoot: boolean }} params
 * @returns {string}
 */
function buildLayoutSwitcherUiScript({ currentLayout, layouts, isRoot }) {
  return `<script>
(function () {
  var ALLOWED_LAYOUTS = ${JSON.stringify(layouts)};
  var CURRENT_LAYOUT = ${JSON.stringify(currentLayout)};
  var IS_ROOT = ${JSON.stringify(isRoot)};

  function init() {
    // Never grow a switcher inside an embedding iframe.
    if (window.self !== window.top) return;

    var header = document.querySelector(".hm-header");
    if (!header) return; // every renderer emits .hm-header; no fallback spot is worth guessing at

    // Fixed to the viewport (not the header): each renderer's header
    // container has a different max-width (720-960px), so an absolute
    // position inside it lands somewhere different on every layout and
    // the select jumps around when switching. Viewport-fixed keeps it at
    // the exact same spot on all layouts.
    var style = document.createElement("style");
    style.textContent =
      ".hm-layout-switcher { position: fixed; top: 16px; right: 16px; z-index: 10; font-size: 12px; color: var(--hm-text, #333); background: var(--hm-background, #fff); border: 1px solid var(--hm-line, #ccc); border-radius: 4px; padding: 4px 8px; }" +
      ".hm-layout-switcher select { margin-left: 4px; font-size: 12px; border: none; background: transparent; color: inherit; }" +
      "@media (max-width: 640px) { .hm-layout-switcher { position: static; display: block; text-align: center; margin-top: 8px; background: transparent; border: none; padding: 0; } .hm-layout-switcher select { border: 1px solid var(--hm-line, #ccc); border-radius: 4px; background: var(--hm-background, #fff); padding: 2px 4px; } }";
    document.head.appendChild(style);

    var label = document.createElement("label");
    label.className = "hm-layout-switcher";
    label.appendChild(document.createTextNode("Layout "));

    var select = document.createElement("select");
    select.setAttribute("aria-label", "Layout");
    for (var i = 0; i < ALLOWED_LAYOUTS.length; i++) {
      var option = document.createElement("option");
      option.value = ALLOWED_LAYOUTS[i];
      option.textContent = ALLOWED_LAYOUTS[i];
      if (ALLOWED_LAYOUTS[i] === CURRENT_LAYOUT) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener("change", function () {
      // Navigation target always comes from the allowlist entry itself,
      // looked up by the select's index (never select.value concatenated
      // directly into the path), same convention as the redirect stub above.
      var index = select.selectedIndex;
      var prefix = IS_ROOT ? "./" : "../";
      location.href = prefix + ALLOWED_LAYOUTS[index] + "/";
    });

    label.appendChild(select);
    header.appendChild(label);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
</script>
`;
}

/**
 * Inserts `snippet` immediately before the first `</head>` in `html`.
 * Every renderer's document shell has exactly one `</head>`, so the first
 * match is the only match.
 * @param {string} html
 * @param {string} snippet
 * @returns {string}
 */
function injectBeforeHeadClose(html, snippet) {
  const marker = "</head>";
  const index = html.indexOf(marker);
  if (index === -1) {
    throw new Error("historymap: could not find </head> in generated HTML to inject the layout-switcher script.");
  }
  return html.slice(0, index) + snippet + html.slice(index);
}

function isMainModule() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    if (process.argv.includes("--all")) {
      const { outDir, layouts } = buildAllLayouts();
      console.log(
        `historymap: built ${layouts.length} layouts into ${outDir} (root index.html + ${layouts
          .map((layout) => `${layout}/`)
          .join(", ")})`
      );
    } else {
      const { outPath } = buildSite();
      console.log(`historymap: built ${outPath}`);
    }
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  }
}
