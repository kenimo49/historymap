// road renderer: a winding "road" infographic (S-curve carriageway with a
// dashed centerline and numbered drop pins for each milestone), the classic
// business-infographic roadmap look, reworked flat and navy-mono.
//
// The road path is entirely build-time geometry: a fixed row height times the
// item count decides the SVG viewBox, and each item gets one vertex that
// alternates left/right across a narrow center "track" column. Consecutive
// vertices are joined with cubic beziers whose control points are offset
// vertically (not horizontally) from the anchors, which is what turns a
// zigzag polyline into a smooth S-curve. No client-side layout JS.

import { escapeHtml, wrapDocument, creditFooter } from "./shared.mjs";

// All geometry constants are in SVG user-space units, which are wired 1:1 to
// CSS pixels (the track div is TRACK_WIDTH px wide, and each row is exactly
// ROW_HEIGHT px tall), so there is no runtime scaling to fight with.
const TRACK_WIDTH = 200;
const ROW_HEIGHT = 260;
const PIN_MARGIN = 34; // keeps the road stroke + pin bulb clear of the track edges
const ROAD_STROKE_WIDTH = 22;
const PIN_BULB_RADIUS = 17;
const PIN_INNER_RADIUS = 11;
const PIN_TIP_DROP = 32; // vertical distance from the tip (on the road) up to the bulb center
const PIN_ARM_ANGLE = (35 * Math.PI) / 180; // opening angle of the pin's two straight "arms"

function fmt(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Computes the road's vertex points (one per item, alternating left/right
 * across the track) and the SVG path string that smoothly connects them.
 * @param {number} count - number of items (>= 1)
 * @returns {{width:number, height:number, path:string, points:Array<{x:number,y:number}>}}
 */
function buildGeometry(count) {
  const width = TRACK_WIDTH;
  const height = ROW_HEIGHT * count;
  const center = width / 2;
  const amplitude = center - PIN_MARGIN;
  const leftX = center - amplitude;
  const rightX = center + amplitude;

  const points = [];
  for (let i = 0; i < count; i++) {
    const y = ROW_HEIGHT * i + ROW_HEIGHT / 2;
    const x = count === 1 ? center : i % 2 === 0 ? leftX : rightX;
    points.push({ x, y });
  }

  let path;
  if (count === 1) {
    // A single milestone has nothing to curve toward; a short straight
    // segment through the row keeps the "road" visual honest without a
    // meaningless wiggle.
    path = `M ${fmt(center)} 0 L ${fmt(center)} ${fmt(height)}`;
  } else {
    const parts = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      // Control points sit directly above/below their anchor (same x), which
      // is the standard trick for turning alternating anchors into a smooth
      // S-curve instead of a sharp zigzag.
      const c1y = p0.y + ROW_HEIGHT / 2;
      const c2y = p1.y - ROW_HEIGHT / 2;
      parts.push(
        `C ${fmt(p0.x)} ${fmt(c1y)}, ${fmt(p1.x)} ${fmt(c2y)}, ${fmt(p1.x)} ${fmt(p1.y)}`
      );
    }
    path = parts.join(" ");
  }

  return { width, height, path, points };
}

/**
 * Renders one numbered "drop pin" marker: a teardrop bulb (two straight arms
 * meeting a large arc) in accent color, a white inner circle, and the
 * milestone number centered inside it.
 */
function renderPin(point, number) {
  const bulbCenterY = point.y - PIN_TIP_DROP;
  const dx = PIN_BULB_RADIUS * Math.sin(PIN_ARM_ANGLE);
  const dy = PIN_BULB_RADIUS * Math.cos(PIN_ARM_ANGLE);
  const armY = bulbCenterY + dy;
  const bulbPath =
    `M ${fmt(point.x)} ${fmt(point.y)} ` +
    `L ${fmt(point.x - dx)} ${fmt(armY)} ` +
    `A ${PIN_BULB_RADIUS} ${PIN_BULB_RADIUS} 0 1 1 ${fmt(point.x + dx)} ${fmt(armY)} Z`;

  return `
      <g class="road-pin">
        <path class="road-pin-bulb" d="${bulbPath}" />
        <circle class="road-pin-circle" cx="${fmt(point.x)}" cy="${fmt(bulbCenterY)}" r="${PIN_INNER_RADIUS}" />
        <text class="road-pin-number" x="${fmt(point.x)}" y="${fmt(bulbCenterY)}" text-anchor="middle" dominant-baseline="central">${number}</text>
      </g>`;
}

function renderTrack(items) {
  const { width, height, path, points } = buildGeometry(items.length);
  const pinsHtml = points.map((point, index) => renderPin(point, index + 1)).join("");

  return `
    <div class="road-track" aria-hidden="true">
      <svg class="road-track-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <path class="road-surface" d="${path}" />
        <path class="road-centerline" d="${path}" />
        ${pinsHtml}
      </svg>
    </div>`;
}

function renderItemBody(item, index) {
  const number = index + 1;
  const subtitle = item.subtitle
    ? `<p class="road-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const description = item.description
    ? `<p class="road-description">${escapeHtml(item.description)}</p>`
    : "";

  // The number badge repeats the SVG pin's number next to the text, so the
  // pin <-> text-block correspondence stays legible even where the SVG
  // itself is hidden (mobile), or when a reader's eye is on the text first.
  const inner = `
          <span class="road-badge">${number}</span>
          <span class="road-year">${escapeHtml(item.displayLabel)}</span>
          <h3 class="road-title">${escapeHtml(item.title)}</h3>
          ${subtitle}
          ${description}`;

  if (item.link) {
    return `
        <a class="road-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>`;
  }

  return `
        <div class="road-content">${inner}
        </div>`;
}

function renderRow(item, index) {
  const side = index % 2 === 0 ? "left" : "right";
  return `
    <li class="road-row road-row--${side}" id="${escapeHtml(item.id)}">
      <div class="road-text road-text--${side}">${renderItemBody(item, index)}
      </div>
    </li>`;
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

    .road-wrap {
      position: relative;
    }

    .road-track {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: ${TRACK_WIDTH}px;
      pointer-events: none;
    }

    .road-track-svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .road-surface {
      fill: none;
      stroke: var(--hm-text);
      stroke-opacity: 0.82;
      stroke-width: ${ROAD_STROKE_WIDTH};
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .road-centerline {
      fill: none;
      stroke: #ffffff;
      stroke-width: 3;
      stroke-dasharray: 12 12;
      stroke-linecap: round;
    }

    .road-pin-bulb {
      fill: var(--hm-accent);
    }

    .road-pin-circle {
      fill: #ffffff;
    }

    .road-pin-number {
      fill: var(--hm-accent);
      font-size: 15px;
      font-weight: 700;
      font-family: ${theme.fontStack};
    }

    .road-list {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    .road-row {
      position: relative;
      display: grid;
      grid-template-columns: 1fr ${TRACK_WIDTH}px 1fr;
      align-items: center;
      column-gap: 24px;
      height: ${ROW_HEIGHT}px;
    }

    .road-text {
      max-width: 320px;
    }

    .road-row--left .road-text {
      grid-column: 1;
      justify-self: end;
      text-align: right;
    }

    .road-row--right .road-text {
      grid-column: 3;
      justify-self: start;
      text-align: left;
    }

    .road-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--hm-accent);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .road-year {
      display: block;
      font-size: 32px;
      font-weight: 700;
      color: var(--hm-accent);
      line-height: 1.1;
      margin: 4px 0 6px;
    }

    .road-title {
      font-size: 17px;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .road-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0 0 8px;
    }

    .road-description {
      font-size: 14px;
      line-height: 1.8;
      margin: 0;
      opacity: 0.9;
    }

    .road-content,
    .road-link {
      display: block;
    }

    .road-link {
      color: inherit;
      text-decoration: none;
    }

    .road-link:hover .road-title {
      text-decoration: underline;
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

      .road-track {
        display: none;
      }

      .road-list {
        padding-left: 40px;
      }

      .road-list::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 12px;
        width: 8px;
        border-radius: 4px;
        background: var(--hm-text);
        opacity: 0.82;
      }

      .road-list::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 15.5px;
        width: 0;
        border-left: 2px dashed #ffffff;
      }

      .road-row {
        display: block;
        height: auto;
        margin-bottom: 40px;
      }

      .road-row:last-child {
        margin-bottom: 0;
      }

      .road-text,
      .road-row--left .road-text,
      .road-row--right .road-text {
        grid-column: auto;
        justify-self: start;
        text-align: left;
        max-width: 100%;
      }
    }`;
}

/**
 * Renders the winding-road timeline as a complete self-contained HTML
 * document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";
  const items = data.items;

  const rowsHtml = items.map((item, index) => renderRow(item, index)).join("\n");
  const trackHtml = renderTrack(items);

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <div class="road-wrap">${trackHtml}
    <ol class="road-list">${rowsHtml}
    </ol>
  </div>
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
