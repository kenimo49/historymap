// metro renderer — a vertical subway/route map. `tags` become parallel
// "lines" running top-to-bottom in date order; items with 2+ tags render as
// interchange stations that straddle every line they belong to. Items with
// no tags at all collapse onto a single implicit line so the layout never
// breaks on the default schema (tags is optional everywhere else).
// Returns a complete, self-contained HTML document string.

import { escapeHtml, creditFooter, wrapDocument } from "./shared.mjs";

// Fixed 8-color palette, assigned to lines in order of first appearance.
// The first line always prefers theme.accent (see colorForLineIndex); from
// the 9th line onward the palette cycles.
const PALETTE = [
  "#0f2a43", // navy
  "#2f6f6a", // teal
  "#b98a2f", // ochre
  "#a4502e", // rust
  "#6e4a6e", // plum
  "#5a6b7a", // slate
  "#5f7a3f", // moss
  "#7a3b47", // wine
];

/**
 * Collects unique tag names in order of first appearance across items
 * (items are already date-sorted, so this doubles as "line order = the
 * order each route is first mentioned in time").
 */
function collectLines(items) {
  const names = [];
  const seen = new Set();
  for (const item of items) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    for (const tag of tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        names.push(tag);
      }
    }
  }
  return names;
}

function colorForLineIndex(index, theme) {
  return index === 0 ? theme.accent : PALETTE[index % PALETTE.length];
}

/**
 * Lane index (or indices) an item belongs to. Items without tags default to
 * lane 0 — either the sole fallback line (no item anywhere has tags) or,
 * in a mixed dataset, the first named line — so every row always has a
 * station to render.
 */
function laneIndicesFor(item, lineIndexByName) {
  const tags = Array.isArray(item.tags) ? item.tags.filter((t) => lineIndexByName.has(t)) : [];
  if (tags.length === 0) return [0];
  return tags.map((t) => lineIndexByName.get(t));
}

/**
 * For each lane, the [min, max] row index across which it is "active" — the
 * line is drawn continuously between its first and last station, passing
 * behind rows where other lines have their own stations.
 */
function computeActiveRanges(perItemLanes, lineCount) {
  const ranges = Array.from({ length: lineCount }, () => ({ min: Infinity, max: -Infinity }));
  perItemLanes.forEach((lanes, rowIndex) => {
    lanes.forEach((li) => {
      const range = ranges[li];
      range.min = Math.min(range.min, rowIndex);
      range.max = Math.max(range.max, rowIndex);
    });
  });
  return ranges;
}

function renderLegend(lineNames, colors) {
  if (lineNames.length === 0) return "";
  const itemsHtml = lineNames
    .map(
      (name, i) => `
    <li class="metro-legend-item">
      <span class="metro-legend-swatch" style="background:${colors[i]}"></span>
      <span class="metro-legend-label">${escapeHtml(name)}</span>
    </li>`
    )
    .join("");
  return `
  <ul class="metro-legend">${itemsHtml}
  </ul>`;
}

function renderContent(item) {
  const subtitle = item.subtitle ? `<p class="metro-subtitle">${escapeHtml(item.subtitle)}</p>` : "";
  const inner = `
        <span class="metro-year">${escapeHtml(item.displayLabel)}</span>
        <h3 class="metro-title">${escapeHtml(item.title)}</h3>
        ${subtitle}`;

  if (item.link) {
    return `
      <div class="metro-content">
        <a class="metro-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>
      </div>`;
  }

  return `
      <div class="metro-content">${inner}
      </div>`;
}

function renderStripes(lineCount, activeRanges, colors, rowIndex) {
  const stripes = [];
  for (let li = 0; li < lineCount; li++) {
    const range = activeRanges[li];
    if (rowIndex >= range.min && rowIndex <= range.max) {
      stripes.push(
        `<span class="metro-stripe" style="left:calc(var(--metro-lane-width) * ${li} + var(--metro-lane-width) / 2 - var(--metro-stripe-width) / 2); background:${colors[li]}"></span>`
      );
    }
  }
  return stripes.join("");
}

function renderStation(laneIndices, colors) {
  if (laneIndices.length <= 1) {
    const li = laneIndices[0];
    return `<span class="metro-station metro-station--single" style="left:calc(var(--metro-lane-width) * ${li} + var(--metro-lane-width) / 2 - var(--metro-station-size) / 2); top:calc(50% - var(--metro-station-size) / 2); border-color:${colors[li]}"></span>`;
  }

  const minIdx = Math.min(...laneIndices);
  const maxIdx = Math.max(...laneIndices);
  return `<span class="metro-station metro-station--interchange" style="left:calc(var(--metro-lane-width) * ${minIdx} + var(--metro-lane-width) / 2 - var(--metro-interchange-size) / 2); width:calc(var(--metro-lane-width) * ${maxIdx - minIdx} + var(--metro-interchange-size)); top:calc(50% - var(--metro-interchange-size) / 2);"></span>`;
}

function renderRow(item, rowIndex, laneIndices, lineCount, activeRanges, colors) {
  const stripesHtml = renderStripes(lineCount, activeRanges, colors, rowIndex);
  const stationHtml = renderStation(laneIndices, colors);
  const contentHtml = renderContent(item);

  return `
    <li class="metro-row" id="${escapeHtml(item.id)}">
      <div class="metro-lanes" style="width:calc(var(--metro-lane-width) * ${lineCount})">${stripesHtml}${stationHtml}
      </div>${contentHtml}
    </li>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --metro-lane-width: 32px;
      --metro-stripe-width: 2px;
      --metro-station-size: 14px;
      --metro-interchange-size: 22px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--hm-background);
      color: var(--hm-text);
      font-family: ${theme.fontStack};
      line-height: 1.6;
    }

    .hm-page {
      max-width: 960px;
      margin: 0 auto;
      padding: 56px 24px 32px;
    }

    .hm-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .hm-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px;
      letter-spacing: 0.02em;
    }

    .hm-description {
      font-size: 15px;
      color: var(--hm-text);
      opacity: 0.75;
      margin: 0;
    }

    .metro-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 24px;
      list-style: none;
      margin: 0 0 48px;
      padding: 14px 20px;
      border: 1px solid var(--hm-line);
    }

    .metro-legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      opacity: 0.9;
    }

    .metro-legend-swatch {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex: none;
    }

    .metro-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    /* Rows must carry zero vertical margin: the line stripes are drawn
       inside each row's box (top:0 / bottom:0), so any space between row
       boxes would break the lines into dashes. Visual spacing between
       stations comes from .metro-content's vertical padding instead — the
       lanes column stretches (align-items: stretch) to the full row height,
       so adjacent rows' stripes connect seamlessly. */
    .metro-row {
      display: flex;
      align-items: stretch;
      gap: 20px;
      min-height: 56px;
      margin: 0;
    }

    .metro-lanes {
      position: relative;
      flex: none;
    }

    .metro-stripe {
      position: absolute;
      top: 0;
      bottom: 0;
      width: var(--metro-stripe-width);
    }

    .metro-station {
      position: absolute;
      background: #ffffff;
      border-style: solid;
      border-width: 3px;
    }

    .metro-station--single {
      width: var(--metro-station-size);
      height: var(--metro-station-size);
      border-radius: 50%;
    }

    .metro-station--interchange {
      height: var(--metro-interchange-size);
      border-radius: 999px;
      border-color: var(--hm-line);
    }

    .metro-content {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 14px 0;
    }

    .metro-link {
      color: inherit;
      text-decoration: none;
      display: block;
    }

    .metro-link:hover .metro-title {
      text-decoration: underline;
    }

    .metro-year {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: var(--hm-accent);
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .metro-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 2px;
    }

    .metro-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0;
    }

    .hm-footer {
      text-align: center;
      margin-top: 64px;
    }

    .hm-credit {
      font-size: 10px;
      color: var(--hm-text);
      opacity: 0.45;
      text-decoration: none;
    }

    .hm-credit:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      :root {
        --metro-lane-width: 16px;
        --metro-station-size: 10px;
        --metro-interchange-size: 14px;
      }

      .hm-page {
        padding: 32px 16px 24px;
      }

      .metro-legend {
        gap: 8px 16px;
        margin-bottom: 32px;
      }

      .metro-row {
        gap: 12px;
      }

      .metro-content {
        padding: 10px 0;
      }

      .metro-year {
        font-size: 15px;
      }

      .metro-title {
        font-size: 14px;
      }
    }`;
}

/**
 * Renders the metro route-map timeline as a complete self-contained HTML
 * document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const items = data.items;
  const description = data.description || "";

  const lineNames = collectLines(items);
  const usesFallback = lineNames.length === 0;
  const effectiveLineNames = usesFallback ? ["single"] : lineNames;
  const lineCount = effectiveLineNames.length;
  const colors = effectiveLineNames.map((_, i) => colorForLineIndex(i, theme));
  const lineIndexByName = new Map(effectiveLineNames.map((name, i) => [name, i]));

  const perItemLanes = items.map((item) => laneIndicesFor(item, lineIndexByName));
  const activeRanges = computeActiveRanges(perItemLanes, lineCount);

  const legendHtml = usesFallback ? "" : renderLegend(lineNames, colors);
  const rowsHtml = items
    .map((item, rowIndex) => renderRow(item, rowIndex, perItemLanes[rowIndex], lineCount, activeRanges, colors))
    .join("\n");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>${legendHtml}
  <ol class="metro-list">${rowsHtml}
  </ol>
  ${creditFooter()}
</div>`;

  return wrapDocument({
    lang: data.lang || "en",
    title: data.title,
    description,
    styleCss: buildStyle(theme),
    bodyHtml,
  });
}
