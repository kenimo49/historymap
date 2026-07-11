// zigzag renderer: a central vertical guide axis with items alternating
// left/right, in the style of a corporate product-history timeline.
// Returns a complete, self-contained HTML document string (no external
// CDN dependencies; images may reference external URLs or local files
// that build.mjs has already copied into dist/).

import { escapeHtml, buildHeightScript } from "./shared.mjs";

const CONNECTOR_WIDTH = 28;

function renderImage(item) {
  if (!item.image) return "";
  const circle = `
        <div class="item-image-circle">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
        </div>`;
  // Same destination as the text card; aria-hidden + tabindex=-1 keep it out of
  // the tab order so keyboard users don't hit the same link twice.
  const inner = item.link
    ? `
      <a class="item-image-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${circle}
      </a>`
    : circle;
  return `
      <div class="item-image">${inner}
      </div>`;
}

function renderContent(item) {
  const subtitle = item.subtitle
    ? `<p class="item-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const description = item.description
    ? `<p class="item-description">${escapeHtml(item.description)}</p>`
    : "";

  const inner = `
        <span class="item-year">${escapeHtml(item.displayLabel)}</span>
        <h3 class="item-title">${escapeHtml(item.title)}</h3>
        ${subtitle}
        ${description}`;

  if (item.link) {
    return `
      <div class="item-content">
        <a class="item-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>
      </div>`;
  }

  return `
      <div class="item-content">${inner}
      </div>`;
}

function renderItem(item, index) {
  const side = index % 2 === 0 ? "left" : "right";
  const contentHtml = renderContent(item);
  const imageHtml = renderImage(item);

  return `
    <li class="item item--${side}" id="${escapeHtml(item.id)}">${contentHtml}
      <div class="item-image-slot">${imageHtml}</div>
    </li>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --hm-connector-width: ${CONNECTOR_WIDTH}px;
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

    .item {
      position: relative;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: calc(var(--hm-connector-width) * 2);
      margin: 0 0 64px;
    }

    .item:last-child {
      margin-bottom: 0;
    }

    .item-content,
    .item-image-slot {
      flex: 1 1 0;
      max-width: calc(50% - var(--hm-connector-width));
    }

    .item--left {
      flex-direction: row;
    }

    .item--right {
      flex-direction: row-reverse;
    }

    .item-content {
      position: relative;
      padding: 2px 0;
    }

    .item-link {
      color: inherit;
      text-decoration: none;
      display: block;
    }

    .item-link:hover .item-title {
      text-decoration: underline;
    }

    .item--left .item-content {
      text-align: right;
    }

    .item--right .item-content {
      text-align: left;
    }

    .item--left .item-content::before {
      content: "";
      position: absolute;
      top: 22px;
      right: calc(-1 * var(--hm-connector-width));
      width: var(--hm-connector-width);
      height: 1px;
      background: var(--hm-line);
    }

    .item--right .item-content::before {
      content: "";
      position: absolute;
      top: 22px;
      left: calc(-1 * var(--hm-connector-width));
      width: var(--hm-connector-width);
      height: 1px;
      background: var(--hm-line);
    }

    .item-year {
      display: block;
      font-size: 36px;
      font-weight: 700;
      color: var(--hm-accent);
      line-height: 1.1;
      margin-bottom: 6px;
    }

    .item-title {
      font-size: 17px;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .item-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0 0 8px;
    }

    .item-description {
      font-size: 14px;
      line-height: 1.8;
      margin: 0;
      opacity: 0.9;
    }

    .item-image-slot {
      display: flex;
      justify-content: center;
    }

    .item-image {
      display: flex;
    }

    .item-image-link {
      display: block;
    }

    .item-image-link:hover .item-image-circle {
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
    }

    .item-image-circle {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid var(--hm-line);
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }

    .item-image-circle img {
      width: 100%;
      height: 100%;
      object-fit: contain;
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
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 40px;
        padding-left: 48px;
      }

      .item-content,
      .item-image-slot {
        max-width: 100%;
        width: 100%;
      }

      .item--left .item-content,
      .item--right .item-content {
        text-align: left;
      }

      .item--left .item-content::before,
      .item--right .item-content::before {
        left: -28px;
        right: auto;
        top: 22px;
      }

      .item-image-slot {
        justify-content: flex-start;
      }

      .item-image-circle {
        width: 100px;
        height: 100px;
      }
    }`;
}

/**
 * Renders the zigzag timeline as a complete self-contained HTML document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";
  const itemsHtml = data.items.map((item, index) => renderItem(item, index)).join("\n");

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
</script>
</body>
</html>
`;
}
