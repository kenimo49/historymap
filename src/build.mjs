#!/usr/bin/env node
// Entry point: data.yaml -> validate -> normalize -> render -> dist/index.html

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { validate, parseItemDate } from "./validate.mjs";
import { resolveTheme } from "./themes.mjs";
import { render as renderZigzag } from "./renderers/zigzag.mjs";

// Renderer registry: v1 ships zigzag only. Adding `tree` / `metro` / `heatmap`
// later just means registering another render(data, theme) function here.
const RENDERERS = {
  zigzag: renderZigzag,
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
 * @returns {{ html: string, outPath: string, data: object }}
 */
export function buildSite(options = {}) {
  const dataPath = path.resolve(options.dataPath || path.join(REPO_ROOT, "data.yaml"));
  const outDir = path.resolve(options.outDir || path.join(REPO_ROOT, "dist"));
  const dataDir = path.dirname(dataPath);

  const raw = readYaml(dataPath);
  const data = validate(raw);

  const renderer = RENDERERS[data.layout];
  if (!renderer) {
    throw new Error(`historymap: no renderer registered for layout "${data.layout}".`);
  }

  const theme = resolveTheme(data.theme);
  const items = normalizeItems(data.items).map((item) => resolveImage(item, { dataDir, outDir }));
  const renderData = { ...data, items };

  const html = renderer(renderData, theme);

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "index.html");
  fs.writeFileSync(outPath, html, "utf8");

  return { html, outPath, data: renderData };
}

function isMainModule() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const { outPath } = buildSite();
    console.log(`historymap: built ${outPath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  }
}
