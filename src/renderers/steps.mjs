// steps renderer — a vertical numbered step list: a large numbered circle
// (01, 02, …) on the left connected to a stadium-shaped pill card on the
// right, in the style of a "process" slide. Returns a complete,
// self-contained HTML document string (no external CDN dependencies;
// images may reference external URLs or local files that build.mjs has
// already copied into dist/).

import { escapeHtml, wrapDocument, creditFooter } from "./shared.mjs";

const CIRCLE_SIZE = 64;
const ROW_GAP = 32;
const MOBILE_CIRCLE_SIZE = 44;
const MOBILE_ROW_GAP = 24;

function renderThumb(item) {
  if (!item.image) return "";
  return `
          <div class="step-thumb">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
          </div>`;
}

function renderPillBody(item) {
  const subtitle = item.subtitle
    ? `<p class="step-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const description = item.description
    ? `<p class="step-description">${escapeHtml(item.description)}</p>`
    : "";

  return `
        <div class="step-pill-body">
          <span class="step-label">${escapeHtml(item.displayLabel)}</span>
          <h3 class="step-title">${escapeHtml(item.title)}</h3>
          ${subtitle}
          ${description}
        </div>`;
}

function renderRowInner(item, index) {
  const number = String(index + 1).padStart(2, "0");
  const pillBodyHtml = renderPillBody(item);
  const thumbHtml = renderThumb(item);
  const imageBlock = thumbHtml
    ? `
        <div class="step-pill-image">${thumbHtml}
        </div>`
    : "";

  return `
      <span class="step-number-col">
        <span class="step-number">${escapeHtml(number)}</span>
      </span>
      <div class="step-pill">${pillBodyHtml}${imageBlock}
      </div>`;
}

function renderItem(item, index) {
  const rowInner = renderRowInner(item, index);

  const rowHtml = item.link
    ? `<a class="step-row" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${rowInner}
      </a>`
    : `<div class="step-row">${rowInner}
      </div>`;

  return `
    <li class="step" id="${escapeHtml(item.id)}">${rowHtml}
    </li>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --step-circle-size: ${CIRCLE_SIZE}px;
      --step-row-gap: ${ROW_GAP}px;
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
      max-width: 720px;
      margin: 0 auto;
      padding: 56px 24px 32px;
    }

    .hm-header {
      text-align: center;
      margin-bottom: 56px;
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

    .steps-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .step {
      margin-bottom: var(--step-row-gap);
    }

    .step:last-child {
      margin-bottom: 0;
    }

    .step-row {
      display: flex;
      align-items: stretch;
      gap: 20px;
      text-decoration: none;
      color: inherit;
    }

    .step-row:hover .step-title {
      text-decoration: underline;
    }

    /* Number column stretches to the pill's height (align-items: stretch on
       .step-row), which is what lets the connector line below reach exactly
       from this circle's bottom to the next circle's top regardless of how
       tall the pill content is. */
    .step-number-col {
      position: relative;
      flex: 0 0 var(--step-circle-size);
      width: var(--step-circle-size);
    }

    .step-number {
      position: absolute;
      top: 0;
      left: 0;
      width: var(--step-circle-size);
      height: var(--step-circle-size);
      border-radius: 50%;
      background: #ffffff;
      border: 3px solid var(--hm-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--hm-accent);
      font-size: calc(var(--step-circle-size) * 0.3);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      z-index: 1;
    }

    /* The vertical guide line: starts right below this row's circle and
       extends through the row-gap into the next row, landing exactly on the
       top of the next circle. Suppressed on the last row so it never spills
       past the final item. */
    .step-number-col::after {
      content: "";
      position: absolute;
      top: var(--step-circle-size);
      bottom: calc(-1 * var(--step-row-gap));
      left: calc(var(--step-circle-size) / 2 - 1px);
      width: 2px;
      background: var(--hm-line);
    }

    .step:last-child .step-number-col::after {
      display: none;
    }

    .step-pill {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid var(--hm-line);
      border-radius: 999px;
      padding: 14px 28px;
      background: var(--hm-background);
    }

    .step-pill-body {
      min-width: 0;
    }

    .step-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--hm-accent);
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }

    .step-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 2px;
    }

    .step-subtitle {
      font-size: 12px;
      opacity: 0.7;
      margin: 0 0 4px;
    }

    .step-description {
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
      opacity: 0.9;
    }

    .step-pill-image {
      flex: 0 0 auto;
    }

    .step-thumb {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid var(--hm-line);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
    }

    .step-thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    @media (max-width: 640px) {
      :root {
        --step-circle-size: ${MOBILE_CIRCLE_SIZE}px;
        --step-row-gap: ${MOBILE_ROW_GAP}px;
      }

      .hm-page {
        padding: 32px 16px 24px;
      }

      .step-row {
        gap: 12px;
      }

      .step-pill {
        padding: 10px 16px;
        gap: 10px;
      }

      .step-thumb {
        width: 44px;
        height: 44px;
      }
    }`;
}

/**
 * Renders the steps layout as a complete self-contained HTML document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";
  const itemsHtml = data.items.map((item, index) => renderItem(item, index)).join("\n");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <ol class="steps-list">${itemsHtml}
  </ol>
  ${creditFooter()}
</div>`;

  return wrapDocument({
    lang,
    title: data.title,
    description,
    styleCss: buildStyle(theme),
    bodyHtml,
  });
}
