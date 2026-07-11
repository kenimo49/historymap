// snake renderer — a serpentine "curriculum roadmap" style track: items run
// in rows of N left-to-right, then U-turn and continue right-to-left on the
// next row, and so on, like a pipe winding down the page. Returns a complete,
// self-contained HTML document string (no external CDN dependencies; images
// may reference external URLs or local files build.mjs has already copied
// into dist/).

import { escapeHtml, creditFooter, wrapDocument } from "./shared.mjs";

// How many items sit on one row before the track U-turns to the next row.
// 960px page width / 4 columns keeps each milestone card comfortably wide.
const ROW_SIZE = 4;

// Layout constants (px). Kept in one place because the U-turn connector's
// geometry is derived from them (see buildStyle for the math).
const ROW_HEIGHT = 220; // per-row band; the node sits at the vertical center
const ROW_HALF = ROW_HEIGHT / 2;
const NODE_SIZE = 60;
const TRACK_THICKNESS = 14;
const TURN_GAP = 64; // in-flow spacer height between two rows
const TURN_SIZE = 56; // horizontal reach of the U-turn bracket

function chunkRows(pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += ROW_SIZE) {
    rows.push(pairs.slice(i, i + ROW_SIZE));
  }
  return rows;
}

function renderNode(item) {
  const visual = item.image
    ? `<div class="snake-node snake-node--image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" /></div>`
    : `<div class="snake-node" aria-hidden="true"></div>`;

  // Decorative duplicate link, same destination as the label below it.
  // aria-hidden + tabindex=-1 keep it out of the tab order so keyboard users
  // don't land on the same link twice (same pattern as zigzag's image link).
  if (item.link) {
    return `<a class="snake-node-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${visual}</a>`;
  }
  return visual;
}

function renderLabel(item) {
  const subtitle = item.subtitle
    ? `<span class="snake-label-subtitle">${escapeHtml(item.subtitle)}</span>`
    : "";
  const inner = `<span class="snake-label-year">${escapeHtml(item.displayLabel)}</span><span class="snake-label-title">${escapeHtml(item.title)}</span>${subtitle}`;

  if (item.link) {
    return `<a class="snake-label-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}</a>`;
  }
  return `<span class="snake-label-static">${inner}</span>`;
}

function renderCell(item, globalIndex) {
  // Labels dodge above/below the track in an alternating pattern, keyed off
  // the item's position in the overall (date-ascending) sequence rather than
  // its position within its row, so the dodge stays consistent across the
  // row-size boundary too.
  const labelPos = globalIndex % 2 === 0 ? "bottom" : "top";
  return `
        <div class="snake-cell" id="${escapeHtml(item.id)}">
          ${renderNode(item)}
          <div class="snake-label snake-label--${labelPos}">${renderLabel(item)}</div>
        </div>`;
}

function renderRow(rowPairs, rowIndex) {
  const reverseClass = rowIndex % 2 === 1 ? " snake-row--reverse" : "";
  const cellsHtml = rowPairs.map(({ item, index }) => renderCell(item, index)).join("");
  return `
      <div class="snake-row${reverseClass}" style="grid-template-columns: repeat(${rowPairs.length}, 1fr);">
        <div class="snake-track-line" aria-hidden="true"></div>${cellsHtml}
      </div>`;
}

function renderTurn(rowIndex) {
  // Row 0 flows left-to-right and ends physically on the right, so the first
  // U-turn bends right; row 1 is visually reversed (see .snake-row--reverse)
  // and ends physically on the left, so the next U-turn bends left, and so on.
  const side = rowIndex % 2 === 0 ? "right" : "left";
  return `
      <div class="snake-turn snake-turn--${side}" aria-hidden="true">
        <div class="snake-turn-arc"></div>
      </div>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
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
      margin-bottom: 48px;
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

    .snake-track {
      position: relative;
    }

    .snake-row {
      position: relative;
      display: grid;
      align-items: stretch;
      column-gap: 8px;
      height: ${ROW_HEIGHT}px;
    }

    .snake-row--reverse {
      direction: rtl;
    }

    .snake-track-line {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: ${TRACK_THICKNESS}px;
      transform: translateY(-50%);
      background: var(--hm-line);
      opacity: 0.55;
      border-radius: 999px;
      z-index: 0;
    }

    .snake-cell {
      position: relative;
      direction: ltr;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }

    .snake-node,
    .snake-node-link {
      display: flex;
      flex-shrink: 0;
    }

    .snake-node {
      width: ${NODE_SIZE}px;
      height: ${NODE_SIZE}px;
      border-radius: 50%;
      background: var(--hm-accent);
      border: 3px solid var(--hm-background);
      box-shadow: 0 0 0 1.5px var(--hm-line);
      z-index: 2;
    }

    .snake-node--image {
      background: var(--hm-background);
      border: 2px solid var(--hm-line);
      box-shadow: none;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 6px;
    }

    .snake-node--image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .snake-label {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 150px;
      text-align: center;
      z-index: 2;
    }

    .snake-label--bottom {
      top: calc(50% + ${NODE_SIZE / 2}px + 10px);
    }

    .snake-label--top {
      bottom: calc(50% + ${NODE_SIZE / 2}px + 10px);
    }

    .snake-label-link,
    .snake-label-static {
      display: block;
      color: inherit;
      text-decoration: none;
    }

    .snake-label-link:hover .snake-label-title {
      text-decoration: underline;
    }

    .snake-label-year {
      display: block;
      font-size: 22px;
      font-weight: 700;
      color: var(--hm-accent);
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .snake-label-title {
      display: block;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .snake-label-subtitle {
      display: block;
      font-size: 12px;
      opacity: 0.7;
    }

    .snake-turn {
      position: relative;
      height: ${TURN_GAP}px;
    }

    .snake-turn-arc {
      position: absolute;
      top: -${ROW_HALF}px;
      width: ${TURN_SIZE}px;
      height: ${ROW_HEIGHT + TURN_GAP}px;
      border: ${TRACK_THICKNESS}px solid var(--hm-line);
      opacity: 0.55;
      box-sizing: border-box;
    }

    .snake-turn--right .snake-turn-arc {
      right: 0;
      border-left-color: transparent;
      border-radius: 0 999px 999px 0;
    }

    .snake-turn--left .snake-turn-arc {
      left: 0;
      border-right-color: transparent;
      border-radius: 999px 0 0 999px;
    }

    .hm-footer {
      text-align: center;
      margin-top: 56px;
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
      .hm-page {
        padding: 32px 16px 24px;
      }

      .snake-track {
        padding-left: 8px;
      }

      .snake-turn {
        display: none;
      }

      .snake-track-line {
        display: none;
      }

      .snake-track::before {
        content: "";
        position: absolute;
        left: ${NODE_SIZE / 2}px;
        top: 0;
        bottom: 0;
        width: 8px;
        transform: translateX(-50%);
        background: var(--hm-line);
        opacity: 0.55;
        border-radius: 999px;
      }

      .snake-row,
      .snake-row--reverse {
        display: flex !important;
        flex-direction: column !important;
        direction: ltr !important;
        height: auto !important;
        gap: 36px;
        margin-bottom: 36px;
      }

      .snake-cell {
        flex-direction: row;
        justify-content: flex-start;
        gap: 16px;
        width: 100%;
      }

      .snake-label {
        position: static;
        transform: none;
        width: auto;
        text-align: left;
        top: auto;
        bottom: auto;
      }
    }`;
}

/**
 * Renders the snake (serpentine) timeline as a complete self-contained HTML
 * document: rows of ROW_SIZE items connected by a continuous pipe-like
 * track that U-turns at the end of each row.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";

  const pairs = data.items.map((item, index) => ({ item, index }));
  const rows = chunkRows(pairs);
  const rowsHtml = rows
    .map((rowPairs, rowIndex) => {
      const row = renderRow(rowPairs, rowIndex);
      const turn = rowIndex < rows.length - 1 ? renderTurn(rowIndex) : "";
      return row + turn;
    })
    .join("\n");

  const bodyHtml = `<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <div class="snake-track">${rowsHtml}
  </div>${creditFooter()}
</div>`;

  return wrapDocument({
    lang,
    title: data.title,
    description,
    styleCss: buildStyle(theme),
    bodyHtml,
  });
}
