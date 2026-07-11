// skyline renderer — a horizontal "skyline" timeline: a single central axis
// (arrows on both ends) runs left-to-right, and items alternate as vertical
// bars sprouting up/down from it in date order — the classic slide-deck
// "central axis + alternating vertical bars + period labels" pattern.
// Returns a complete, self-contained HTML document string.

import { escapeHtml, creditFooter, wrapDocument } from "./shared.mjs";

// Same fixed 8-color palette as the metro renderer, cycled in item-appearance
// order (no tag/line grouping here — skyline has no notion of routes, so
// unlike metro there is no "first color prefers theme.accent" special case).
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

function colorForIndex(index) {
  return PALETTE[index % PALETTE.length];
}

function renderContent(item) {
  const subtitle = item.subtitle ? `<p class="skyline-subtitle">${escapeHtml(item.subtitle)}</p>` : "";
  const inner = `
          <h3 class="skyline-title">${escapeHtml(item.title)}</h3>
          ${subtitle}`;

  if (item.link) {
    return `
        <div class="skyline-content">
          <a class="skyline-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
          </a>
        </div>`;
  }

  return `
        <div class="skyline-content">${inner}
        </div>`;
}

function renderLabel(item) {
  return `
        <span class="skyline-label">${escapeHtml(item.displayLabel)}</span>`;
}

function renderBar() {
  return `
        <div class="skyline-bar" aria-hidden="true"></div>`;
}

/**
 * Each item is split into a "top half" (rendered first in the DOM) and a
 * "bottom half" (rendered second). Both halves are aligned toward the axis:
 * .skyline-half--top uses justify-content: flex-end (its last child touches
 * the axis-adjacent edge) and .skyline-half--bottom uses flex-start (its
 * first child touches the axis-adjacent edge). This lets the mobile media
 * query flip .skyline-item / .skyline-items from column to row layout
 * (top half -> left half, bottom half -> right half) without changing any
 * markup: "near the axis" stays "near the axis" under either orientation.
 *
 * variant "up": bar (+ title/subtitle beyond its tip) lives in the top half,
 *   the bare displayLabel lives in the bottom half, right against the axis.
 * variant "down": the mirror image.
 */
function renderItem(item, index) {
  const variant = index % 2 === 0 ? "up" : "down";
  const color = colorForIndex(index);
  const contentHtml = renderContent(item);
  const labelHtml = renderLabel(item);
  const barHtml = renderBar();

  const topHalf =
    variant === "up"
      ? `
      <div class="skyline-half skyline-half--top">${contentHtml}${barHtml}
      </div>`
      : `
      <div class="skyline-half skyline-half--top">${labelHtml}
      </div>`;

  const bottomHalf =
    variant === "up"
      ? `
      <div class="skyline-half skyline-half--bottom">${labelHtml}
      </div>`
      : `
      <div class="skyline-half skyline-half--bottom">${barHtml}${contentHtml}
      </div>`;

  return `
    <li class="skyline-item skyline-item--${variant}" id="${escapeHtml(item.id)}" style="--skyline-color: ${color}">${topHalf}${bottomHalf}
    </li>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --skyline-track-height: 360px;
      --skyline-item-width: 176px;
      --skyline-bar-thickness: 9px;
      --skyline-bar-length: 64px;
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
      margin-bottom: 40px;
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

    /* The scroll container is the only element allowed to overflow
       horizontally — the page body itself never scrolls sideways. */
    .skyline-scroll {
      width: 100%;
      overflow-x: auto;
    }

    .skyline-track {
      position: relative;
      height: var(--skyline-track-height);
    }

    .skyline-axis {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--hm-text);
      transform: translateY(-50%);
    }

    .skyline-axis::before,
    .skyline-axis::after {
      content: "";
      position: absolute;
      top: 50%;
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
    }

    .skyline-axis::before {
      left: 0;
      border-right: 8px solid var(--hm-text);
      transform: translate(-100%, -50%);
    }

    .skyline-axis::after {
      right: 0;
      border-left: 8px solid var(--hm-text);
      transform: translate(100%, -50%);
    }

    .skyline-items {
      position: relative;
      z-index: 1;
      list-style: none;
      margin: 0;
      padding: 0 32px;
      height: 100%;
      display: flex;
      flex-direction: row;
      align-items: stretch;
    }

    .skyline-item {
      flex: 0 0 auto;
      min-width: var(--skyline-item-width);
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 0 12px;
    }

    .skyline-half {
      flex: 1 1 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .skyline-half--top {
      justify-content: flex-end;
    }

    .skyline-half--bottom {
      justify-content: flex-start;
    }

    .skyline-bar {
      flex: 0 0 auto;
      width: var(--skyline-bar-thickness);
      height: var(--skyline-bar-length);
      background: var(--skyline-color);
    }

    .skyline-content {
      max-width: 190px;
      padding: 6px 0;
    }

    .skyline-link {
      color: inherit;
      text-decoration: none;
      display: block;
    }

    .skyline-link:hover .skyline-title {
      text-decoration: underline;
    }

    .skyline-title {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .skyline-subtitle {
      font-size: 12px;
      opacity: 0.7;
      margin: 0;
    }

    .skyline-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--hm-accent);
      letter-spacing: 0.02em;
      padding: 6px 0;
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

      .skyline-scroll {
        overflow-x: visible;
      }

      .skyline-track {
        height: auto;
      }

      .skyline-axis {
        top: 0;
        bottom: 0;
        left: 50%;
        right: auto;
        width: 2px;
        height: auto;
        transform: translateX(-50%);
      }

      .skyline-axis::before,
      .skyline-axis::after {
        top: auto;
        left: 50%;
        right: auto;
        border-top: none;
        border-bottom: none;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
      }

      .skyline-axis::before {
        top: 0;
        border-bottom: 8px solid var(--hm-text);
        transform: translate(-50%, -100%);
      }

      .skyline-axis::after {
        bottom: 0;
        top: auto;
        border-top: 8px solid var(--hm-text);
        transform: translate(-50%, 100%);
      }

      .skyline-items {
        flex-direction: column;
        height: auto;
        padding: 32px 0;
        width: 100%;
      }

      .skyline-item {
        flex-direction: row;
        width: 100%;
        min-width: 0;
        height: auto;
        padding: 14px 0;
      }

      .skyline-bar {
        width: var(--skyline-bar-length);
        height: var(--skyline-bar-thickness);
      }

      .skyline-content {
        max-width: none;
      }
    }`;
}

/**
 * Renders the skyline horizontal-axis timeline as a complete self-contained
 * HTML document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const description = data.description || "";
  const itemsHtml = data.items.map((item, index) => renderItem(item, index)).join("\n");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <div class="skyline-scroll">
    <div class="skyline-track">
      <div class="skyline-axis" aria-hidden="true"></div>
      <ol class="skyline-items">${itemsHtml}
      </ol>
    </div>
  </div>
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
