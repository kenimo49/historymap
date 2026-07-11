// beads renderer — a vertical "bead timeline": a thick central axis strung
// with large ring nodes (the "beads"), one per item in date-ascending order,
// each carrying its displayLabel inside the ring. The first and last beads
// are filled solid (accent background + white label) to read as START /
// FINISH. Content (title/subtitle/description/image) branches off each bead
// through a short connector, alternating left/right down the axis — unlike
// zigzag, the year itself lives inside the ring, not in the content block.
// Returns a complete, self-contained HTML document string.

import { escapeHtml, creditFooter, wrapDocument } from "./shared.mjs";

function renderImage(item) {
  if (!item.image) return "";
  return `
        <div class="beads-image">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
        </div>`;
}

function renderContent(item) {
  const imageHtml = renderImage(item);
  const subtitle = item.subtitle
    ? `<p class="beads-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const description = item.description
    ? `<p class="beads-description">${escapeHtml(item.description)}</p>`
    : "";

  const inner = `${imageHtml}
        <h3 class="beads-title">${escapeHtml(item.title)}</h3>
        ${subtitle}
        ${description}`;

  if (item.link) {
    return `
      <div class="beads-content">
        <a class="beads-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>
      </div>`;
  }

  return `
      <div class="beads-content">${inner}
      </div>`;
}

/**
 * Renders one <li>. DOM order is always: node, content-half, spacer-half —
 * the CSS `order` property (driven by the item--left / item--right modifier)
 * is what visually swaps which half the content lands on. Keeping DOM order
 * fixed means the reading/tab order is always "year, then content"
 * regardless of which side a given item happens to render on.
 */
function renderItem(item, index, total) {
  const side = index % 2 === 0 ? "left" : "right";
  const isStart = index === 0;
  const isEnd = index === total - 1;
  const nodeClasses = ["beads-node", isStart && "beads-node--start", isEnd && "beads-node--end"]
    .filter(Boolean)
    .join(" ");
  const contentHtml = renderContent(item);

  return `
    <li class="beads-item beads-item--${side}" id="${escapeHtml(item.id)}">
      <div class="${nodeClasses}">
        <span class="beads-node-label">${escapeHtml(item.displayLabel)}</span>
      </div>
      <div class="beads-half beads-half--content">${contentHtml}
      </div>
      <div class="beads-half beads-half--spacer" aria-hidden="true"></div>
    </li>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --beads-node-size: 92px;
      --beads-connector: 32px;
      --beads-axis-width: 4px;
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

    .beads-timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    /* The "string": a solid, thicker-than-zigzag axis running the full
       height of the list. Beads sit on top of it (z-index below the ring's
       own halo, see .beads-node's box-shadow) so it visually threads
       through each ring. */
    .beads-timeline::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: var(--beads-axis-width);
      background: var(--hm-line);
      transform: translateX(-50%);
      z-index: 0;
    }

    .beads-item {
      position: relative;
      display: flex;
      align-items: center;
      min-height: calc(var(--beads-node-size) + 8px);
      margin: 0 0 48px;
    }

    .beads-item:last-child {
      margin-bottom: 0;
    }

    .beads-half {
      flex: 1 1 0;
      max-width: 50%;
    }

    .beads-half--content {
      display: flex;
    }

    .beads-item--left .beads-half--content {
      order: 1;
      justify-content: flex-end;
      padding-right: calc(var(--beads-node-size) / 2 + var(--beads-connector));
    }

    .beads-item--left .beads-half--spacer {
      order: 2;
    }

    .beads-item--right .beads-half--content {
      order: 2;
      justify-content: flex-start;
      padding-left: calc(var(--beads-node-size) / 2 + var(--beads-connector));
    }

    .beads-item--right .beads-half--spacer {
      order: 1;
    }

    .beads-content {
      position: relative;
      max-width: 320px;
      padding: 4px 0;
    }

    .beads-item--left .beads-content {
      text-align: right;
    }

    .beads-item--right .beads-content {
      text-align: left;
    }

    /* Short connector: a thin line from the content's inner edge into the
       gap around the ring, ending in a small dot right at the ring's edge. */
    .beads-item--left .beads-content::before,
    .beads-item--right .beads-content::before {
      content: "";
      position: absolute;
      top: 50%;
      width: var(--beads-connector);
      height: 2px;
      background: var(--hm-line);
      transform: translateY(-50%);
    }

    .beads-item--left .beads-content::after,
    .beads-item--right .beads-content::after {
      content: "";
      position: absolute;
      top: 50%;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--hm-accent);
      transform: translateY(-50%);
    }

    .beads-item--left .beads-content::before {
      right: calc(-1 * var(--beads-connector));
    }

    .beads-item--left .beads-content::after {
      right: calc(-1 * var(--beads-connector) - 4px);
    }

    .beads-item--right .beads-content::before {
      left: calc(-1 * var(--beads-connector));
    }

    .beads-item--right .beads-content::after {
      left: calc(-1 * var(--beads-connector) - 4px);
    }

    .beads-link {
      color: inherit;
      text-decoration: none;
      display: block;
    }

    .beads-link:hover .beads-title {
      text-decoration: underline;
    }

    /* The bead itself: a large ring on the axis, its displayLabel set in a
       small bold face so 7-character labels ("2026.03") stay on one line
       inside the ring instead of wrapping. */
    .beads-node {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: var(--beads-node-size);
      height: var(--beads-node-size);
      border-radius: 50%;
      background: #ffffff;
      border: 5px solid var(--hm-accent);
      box-shadow: 0 0 0 6px var(--hm-background);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      z-index: 1;
    }

    .beads-node-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--hm-accent);
      white-space: nowrap;
      letter-spacing: -0.01em;
    }

    .beads-node--start,
    .beads-node--end {
      background: var(--hm-accent);
    }

    .beads-node--start .beads-node-label,
    .beads-node--end .beads-node-label {
      color: #ffffff;
    }

    .beads-image {
      display: flex;
      justify-content: inherit;
      margin-bottom: 10px;
    }

    .beads-item--left .beads-image {
      justify-content: flex-end;
    }

    .beads-item--right .beads-image {
      justify-content: flex-start;
    }

    .beads-image img {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid var(--hm-line);
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
      object-fit: contain;
      padding: 8px;
    }

    .beads-title {
      font-size: 17px;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .beads-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0 0 8px;
    }

    .beads-description {
      font-size: 14px;
      line-height: 1.8;
      margin: 0;
      opacity: 0.9;
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
        --beads-node-size: 56px;
        --beads-connector: 20px;
      }

      .hm-page {
        padding: 32px 16px 24px;
      }

      .beads-timeline::before {
        left: 20px;
        transform: none;
      }

      .beads-item,
      .beads-item--left,
      .beads-item--right {
        flex-direction: column;
        align-items: flex-start;
        min-height: 0;
        margin-bottom: 32px;
        padding-left: 56px;
      }

      .beads-half--content,
      .beads-half--spacer {
        max-width: 100%;
        width: 100%;
      }

      .beads-item--left .beads-half--content,
      .beads-item--right .beads-half--content {
        order: 0;
        justify-content: flex-start;
        padding-left: 0;
        padding-right: 0;
      }

      .beads-item--left .beads-half--spacer,
      .beads-item--right .beads-half--spacer {
        display: none;
      }

      .beads-content,
      .beads-item--left .beads-content,
      .beads-item--right .beads-content {
        text-align: left;
        max-width: 100%;
      }

      .beads-item--left .beads-content::before,
      .beads-item--right .beads-content::before {
        left: -28px;
        right: auto;
      }

      .beads-item--left .beads-content::after,
      .beads-item--right .beads-content::after {
        left: -32px;
        right: auto;
      }

      .beads-item--left .beads-image,
      .beads-item--right .beads-image {
        justify-content: flex-start;
      }

      .beads-image img {
        width: 56px;
        height: 56px;
      }

      .beads-node {
        left: 20px;
        top: 26px;
        transform: translate(-50%, -50%);
      }

      .beads-node-label {
        font-size: 10px;
      }
    }`;
}

/**
 * Renders the beads (vertical bead timeline) as a complete self-contained
 * HTML document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const items = data.items;
  const description = data.description || "";
  const itemsHtml = items.map((item, index) => renderItem(item, index, items.length)).join("\n");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <ol class="beads-timeline">${itemsHtml}
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
