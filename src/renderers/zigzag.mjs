// zigzag renderer: a central vertical guide axis with cards alternating
// left/right. Cards include the book cover image, title, year badge, and
// description. Year-divider markers appear on the axis when the year changes.
// Returns a complete, self-contained HTML document string.

import { escapeHtml, buildHeightScript } from "./shared.mjs";

const CONNECTOR_WIDTH = 28;
// Vertical distance from card top edge to the connector/dot on the centre axis.
// Set to half the card-image height (200px ÷ 2) so the line meets the cover.
const CONNECTOR_TOP = 100;

function extractYear(displayLabel) {
  return String(displayLabel).split(/[.\-\/]/)[0];
}

function renderCardImage(item) {
  if (!item.image) return "";
  return `
      <div class="item-card-image">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
      </div>`;
}

function renderItem(item, index) {
  const side = index % 2 === 0 ? "left" : "right";

  const subtitle = item.subtitle
    ? `<p class="item-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const description = item.description
    ? `<p class="item-description">${escapeHtml(item.description)}</p>`
    : "";

  const cardBody = `
      <div class="item-card-body">
        <h3 class="item-title">${escapeHtml(item.title)}</h3>
        <span class="item-year">${escapeHtml(item.displayLabel)}</span>
        ${subtitle}
        ${description}
      </div>`;

  const cardInner = `${renderCardImage(item)}${cardBody}`;

  const card = item.link
    ? `<a class="item-card item-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${cardInner}
      </a>`
    : `<div class="item-card">${cardInner}
      </div>`;

  return `
    <li class="item item--${side}" id="${escapeHtml(item.id)}">${card}
      <div class="item-spacer" aria-hidden="true"></div>
    </li>`;
}

function renderItems(items) {
  const parts = [];
  let lastYear = null;
  items.forEach((item, index) => {
    const year = extractYear(item.displayLabel);
    if (year !== lastYear) {
      parts.push(`
    <li class="year-marker" role="presentation">
      <span class="year-label">${escapeHtml(year)}</span>
    </li>`);
      lastYear = year;
    }
    parts.push(renderItem(item, index));
  });
  return parts.join("\n");
}

function buildObserverScript() {
  return `
(function(){
  if(typeof IntersectionObserver==="undefined") {
    document.querySelectorAll(".item").forEach(function(el){ el.classList.add("visible"); });
    return;
  }
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("visible"); io.unobserve(e.target); } });
  },{threshold:0.08});
  document.querySelectorAll(".item").forEach(function(el){ io.observe(el); });
})();`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --hm-connector-width: ${CONNECTOR_WIDTH}px;
      --hm-connector-top: ${CONNECTOR_TOP}px;
      --hm-dot-size: 12px;
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

    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    .timeline::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 0;
      border-left: 2px dashed var(--hm-line);
      transform: translateX(-50%);
    }

    /* ── Year divider ── */
    .year-marker {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      list-style: none;
      margin: 0 0 32px;
      z-index: 1;
    }

    .year-label {
      background: var(--hm-background);
      border: 2px solid var(--hm-accent);
      color: var(--hm-accent);
      font-size: 13px;
      font-weight: 700;
      padding: 4px 18px;
      border-radius: 20px;
      letter-spacing: 0.06em;
    }

    /* ── Timeline item ── */
    .item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: calc(var(--hm-connector-width) * 2);
      margin: 0 0 56px;
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }

    .item.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .item:last-child {
      margin-bottom: 0;
    }

    /* Centre-axis dot */
    .item::after {
      content: "";
      position: absolute;
      top: calc(var(--hm-connector-top) - var(--hm-dot-size) / 2);
      left: 50%;
      transform: translateX(-50%);
      width: var(--hm-dot-size);
      height: var(--hm-dot-size);
      border-radius: 50%;
      background: var(--hm-accent);
      border: 2px solid var(--hm-background);
      z-index: 2;
    }

    .item-card,
    .item-spacer {
      flex: 1 1 0;
      max-width: calc(50% - var(--hm-connector-width));
    }

    .item--left {
      flex-direction: row;
    }

    .item--right {
      flex-direction: row-reverse;
    }

    /* ── Card ── */
    .item-card {
      display: block;
      position: relative;
      background: var(--hm-background);
      border: 1px solid var(--hm-line);
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      color: inherit;
      text-decoration: none;
      transition: transform 0.22s ease, box-shadow 0.22s ease;
    }

    .item-link:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
    }

    /* Connector line from card edge to centre axis */
    .item--left .item-card::after,
    .item--right .item-card::after {
      content: "";
      position: absolute;
      top: var(--hm-connector-top);
      width: var(--hm-connector-width);
      height: 1px;
      background: var(--hm-line);
    }

    .item--left .item-card::after {
      right: calc(-1 * var(--hm-connector-width) - 1px);
    }

    .item--right .item-card::after {
      left: calc(-1 * var(--hm-connector-width) - 1px);
    }

    /* ── Card image ── */
    .item-card-image {
      width: 100%;
      height: 200px;
      background: #f4f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      border-bottom: 1px solid var(--hm-line);
    }

    .item-card-image img {
      max-width: 100%;
      max-height: 160px;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 3px 14px rgba(0, 0, 0, 0.18);
    }

    /* ── Card body ── */
    .item-card-body {
      padding: 16px 20px 20px;
    }

    .item-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 6px;
      line-height: 1.45;
    }

    .item-year {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: var(--hm-accent);
      opacity: 0.85;
      margin-bottom: 8px;
      letter-spacing: 0.04em;
    }

    .item-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0 0 8px;
    }

    .item-description {
      font-size: 13px;
      line-height: 1.75;
      margin: 0;
      opacity: 0.85;
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
      .hm-page {
        padding: 32px 16px 24px;
      }

      .timeline::before {
        left: 20px;
        transform: none;
      }

      .item,
      .item--left,
      .item--right {
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        margin-bottom: 32px;
        padding-left: 48px;
      }

      .item::after {
        left: 20px;
        transform: translateX(-50%);
      }

      .item-card,
      .item-spacer {
        max-width: 100%;
        width: 100%;
      }

      .item-spacer {
        display: none;
      }

      .item--left .item-card::after,
      .item--right .item-card::after {
        display: none;
      }

      .item-card-image {
        height: 160px;
      }

      .item-card-image img {
        max-height: 130px;
      }

      .year-marker {
        justify-content: flex-start;
        padding-left: 48px;
      }
    }`;
}

/**
 * Renders the zigzag timeline as a complete self-contained HTML document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalised (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";
  const itemsHtml = renderItems(data.items);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />\n` : ""}<style>${buildStyle(theme)}
</style>
</head>
<body>
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <ol class="timeline">${itemsHtml}
  </ol>
  <footer class="hm-footer">
    <a class="hm-credit" href="https://github.com/kenimo49/historymap" target="_blank" rel="noopener">Generated with historymap</a>
  </footer>
</div>
<script>${buildHeightScript()}
${buildObserverScript()}
</script>
</body>
</html>
`;
}
