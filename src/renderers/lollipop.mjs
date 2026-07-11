// lollipop renderer: a winding "road" (same S-curve geometry approach as
// road.mjs — build-time-only, no client JS) where every milestone is marked
// by a thin stem rising or dropping from a point on the road to a large
// circular "candy" badge carrying the year/date label. Unlike road (numbered
// drop-pins + a text-heavy narrative block), lollipop keeps the text light
// (title + subtitle only, no description) so the badges themselves read as
// the timeline's spine — a "one glance, N years" roadmap rather than a
// story you read top to bottom.
//
// The geometry (anchor points alternating left/right across a narrow track,
// joined by cubic beziers, viewBox wired 1:1 to CSS px) is deliberately
// copied from road.mjs rather than imported: each renderer here is
// self-contained by project convention, so this is intentional duplication,
// not drift.

import { escapeHtml, wrapDocument, creditFooter } from "./shared.mjs";

const TRACK_WIDTH = 200;
const ROW_HEIGHT = 200;
const PIN_MARGIN = 34; // keeps the road stroke + badges clear of the track edges
const ROAD_STROKE_WIDTH = 22;
const STEM_LENGTH = 46; // vertical distance from a road anchor to its badge center
const STEM_WIDTH = 2;
const BADGE_RADIUS = 30;
const ANCHOR_DOT_RADIUS = 4;

// Same fixed 8-color palette as metro.mjs. All eight are dark enough that
// white badge text stays legible, so (unlike metro) there is no
// theme.accent override for the first color — lollipop just cycles.
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

function fmt(n) {
  return Math.round(n * 100) / 100;
}

function colorForIndex(index) {
  return PALETTE[index % PALETTE.length];
}

/**
 * Computes the road's vertex points (one per item, alternating left/right
 * across the track) and the SVG path string connecting them. This is the
 * same construction as road.mjs's buildGeometry (see that file for why
 * same-x control points turn an alternating zigzag into a smooth S-curve).
 * @param {number} count - number of items (>= 1)
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
    path = `M ${fmt(center)} 0 L ${fmt(center)} ${fmt(height)}`;
  } else {
    const parts = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
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
 * Badge center for each item: directly above (even index) or below (odd
 * index) its road anchor, joined by a straight vertical stem. The anchor's
 * x already alternates left/right (buildGeometry), so pairing that with an
 * alternating vertical stem direction is what keeps consecutive lollipops
 * from stacking on top of each other — each one leans toward a different
 * corner of its row.
 */
function computeBadgeCenters(points) {
  return points.map((point, index) => {
    const dir = index % 2 === 0 ? -1 : 1; // even = stem up, odd = stem down
    return { x: point.x, y: point.y + dir * STEM_LENGTH };
  });
}

/**
 * Renders the SVG background layer: road surface, dashed centerline, and
 * one stem + anchor dot per item (colored to match that item's badge, so
 * the pairing stays visually obvious even before reading the label).
 */
function renderTrack(items) {
  const { width, height, path, points } = buildGeometry(items.length);
  const badgeCenters = computeBadgeCenters(points);

  const stemsHtml = points
    .map((point, index) => {
      const color = colorForIndex(index);
      const badge = badgeCenters[index];
      return `
        <line class="lollipop-stem" x1="${fmt(point.x)}" y1="${fmt(point.y)}" x2="${fmt(badge.x)}" y2="${fmt(badge.y)}" stroke="${color}" stroke-width="${STEM_WIDTH}" />
        <circle class="lollipop-anchor" cx="${fmt(point.x)}" cy="${fmt(point.y)}" r="${ANCHOR_DOT_RADIUS}" fill="${color}" />`;
    })
    .join("");

  const svg = `
    <div class="lollipop-track" aria-hidden="true">
      <svg class="lollipop-track-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <path class="lollipop-surface" d="${path}" />
        <path class="lollipop-centerline" d="${path}" />
        ${stemsHtml}
      </svg>
    </div>`;

  return { svg, badgeCenters };
}

/**
 * Shared inner markup for one badge "candy", used both for the desktop
 * absolutely-positioned marker and the mobile inline badge: a photo (image
 * items get a white-background circular thumbnail with the year tucked
 * underneath, small) or a solid palette-color disc carrying the
 * displayLabel in white text.
 */
function renderBadgeInner(item, color, circleClass, textClass, imageClass, imageLabelClass) {
  const label = escapeHtml(item.displayLabel);
  if (item.image) {
    return `
          <span class="${circleClass} ${imageClass}">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
          </span>
          <span class="${imageLabelClass}">${label}</span>`;
  }
  return `<span class="${circleClass}" style="background:${color}"><span class="${textClass}">${label}</span></span>`;
}

/**
 * Desktop marker: absolutely positioned at the badge center computed by
 * computeBadgeCenters, in the same coordinate space as the SVG track (both
 * boxes are TRACK_WIDTH px wide, wired 1:1 to CSS pixels, same trick as
 * road.mjs's track div).
 *
 * The marker box is sized exactly to the badge circle, so the image item's
 * displayLabel (absolutely positioned outside that box, see
 * .lollipop-badge-image-label) can escape on the side AWAY from the stem:
 * even-index badges sit above the road with the stem below them, so the
 * label goes on top; odd-index badges the reverse. That keeps the label
 * clear of the circle, the stem line, and the anchor dot in both stem
 * directions.
 */
function renderMarker(item, index, center, color) {
  const labelSide = index % 2 === 0 ? "top" : "bottom";
  const inner = renderBadgeInner(
    item,
    color,
    "lollipop-badge-circle",
    "lollipop-badge-text",
    "lollipop-badge-circle--image",
    "lollipop-badge-image-label"
  );
  // tabindex=-1 (no aria-hidden): this marker sits on top of the same href
  // as the text block's link below, so it is skipped in keyboard tab order,
  // but its displayLabel/image alt text — which appear nowhere else in the
  // row — stay reachable to a screen reader's linear/virtual-cursor reading.
  const content = item.link
    ? `<a class="lollipop-badge-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" tabindex="-1">${inner}</a>`
    : inner;

  return `
      <div class="lollipop-badge lollipop-badge--label-${labelSide}" style="left:${fmt(center.x)}px; top:${fmt(center.y)}px;">${content}
      </div>`;
}

function renderMarkers(items, badgeCenters) {
  const markersHtml = items
    .map((item, index) => renderMarker(item, index, badgeCenters[index], colorForIndex(index)))
    .join("");
  return `
    <div class="lollipop-markers">${markersHtml}
    </div>`;
}

/**
 * Mobile-only inline badge (see the <640px block in buildStyle): the
 * desktop absolute marker is hidden entirely below that breakpoint, so this
 * is the only visible badge on small screens, alternating left/right of the
 * text block per row.
 */
function renderMobileBadge(item, color) {
  const inner = renderBadgeInner(
    item,
    color,
    "lollipop-mobile-badge-circle",
    "lollipop-mobile-badge-text",
    "lollipop-mobile-badge-circle--image",
    "lollipop-mobile-badge-image-label"
  );
  if (item.link) {
    return `
      <a class="lollipop-mobile-badge-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" tabindex="-1">${inner}
      </a>`;
  }
  return `
      <div class="lollipop-mobile-badge">${inner}
      </div>`;
}

function renderItemBody(item) {
  const subtitle = item.subtitle
    ? `<p class="lollipop-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  // description is intentionally never rendered — see module header: the
  // badges are the point of this layout, not a narrative text block.
  const inner = `
          <h3 class="lollipop-title">${escapeHtml(item.title)}</h3>
          ${subtitle}`;

  if (item.link) {
    return `
        <a class="lollipop-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>`;
  }

  return `
        <div class="lollipop-content">${inner}
        </div>`;
}

function renderRow(item, index, color) {
  const side = index % 2 === 0 ? "left" : "right";
  const mobileBadgeHtml = renderMobileBadge(item, color);

  return `
    <li class="lollipop-row lollipop-row--${side}" id="${escapeHtml(item.id)}">
      <div class="lollipop-mobile-badge-slot">${mobileBadgeHtml}
      </div>
      <div class="lollipop-text lollipop-text--${side}">${renderItemBody(item)}
      </div>
    </li>`;
}

function buildStyle(theme) {
  const badgeSize = BADGE_RADIUS * 2;

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

    .lollipop-wrap {
      position: relative;
    }

    .lollipop-track,
    .lollipop-markers {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: ${TRACK_WIDTH}px;
      pointer-events: none;
    }

    .lollipop-track-svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .lollipop-surface {
      fill: none;
      stroke: var(--hm-text);
      stroke-opacity: 0.82;
      stroke-width: ${ROAD_STROKE_WIDTH};
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .lollipop-centerline {
      fill: none;
      stroke: #ffffff;
      stroke-width: 3;
      stroke-dasharray: 12 12;
      stroke-linecap: round;
    }

    .lollipop-stem {
      stroke-linecap: round;
    }

    .lollipop-anchor {
      stroke: #ffffff;
      stroke-width: 1.5;
    }

    /* The badge box is exactly the circle: translate(-50%,-50%) centers it
       on the stem endpoint computed by computeBadgeCenters, and the image
       label lives OUTSIDE this box (absolute, side chosen per stem
       direction) so it can never overlap the circle, the stem, or the
       anchor dot. */
    .lollipop-badge {
      position: absolute;
      transform: translate(-50%, -50%);
      width: ${badgeSize}px;
      height: ${badgeSize}px;
      pointer-events: auto;
    }

    .lollipop-badge-link {
      display: block;
      width: 100%;
      height: 100%;
      text-decoration: none;
      color: inherit;
    }

    .lollipop-badge-circle {
      width: ${badgeSize}px;
      height: ${badgeSize}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
    }

    .lollipop-badge-circle--image {
      background: #ffffff;
      border: 1px solid var(--hm-line);
      padding: 6px;
      overflow: hidden;
    }

    .lollipop-badge-circle--image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .lollipop-badge-text {
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      line-height: 1.15;
      text-align: center;
      padding: 0 4px;
    }

    /* Image-badge year label: escapes the badge box on the side away from
       the stem (top for even-index badges whose stem drops to the road
       below, bottom for odd-index ones). The background pill keeps it
       readable even where it crosses the road surface. Absolute positioning
       resolves against .lollipop-badge (the link wrapper is static), whose
       box is exactly the circle. */
    .lollipop-badge-image-label {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      color: var(--hm-text);
      text-align: center;
      background: var(--hm-background);
      padding: 1px 7px;
      border-radius: 999px;
      border: 1px solid var(--hm-line);
    }

    .lollipop-badge--label-top .lollipop-badge-image-label {
      bottom: calc(100% + 5px);
    }

    .lollipop-badge--label-bottom .lollipop-badge-image-label {
      top: calc(100% + 5px);
    }

    .lollipop-list {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    .lollipop-row {
      position: relative;
      display: grid;
      grid-template-columns: 1fr ${TRACK_WIDTH}px 1fr;
      align-items: center;
      column-gap: 24px;
      height: ${ROW_HEIGHT}px;
    }

    .lollipop-mobile-badge-slot {
      display: none;
    }

    .lollipop-text {
      max-width: 320px;
    }

    .lollipop-row--left .lollipop-text {
      grid-column: 1;
      justify-self: end;
      text-align: right;
    }

    .lollipop-row--right .lollipop-text {
      grid-column: 3;
      justify-self: start;
      text-align: left;
    }

    .lollipop-title {
      font-size: 17px;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .lollipop-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0;
    }

    .lollipop-content,
    .lollipop-link {
      display: block;
    }

    .lollipop-link {
      color: inherit;
      text-decoration: none;
    }

    .lollipop-link:hover .lollipop-title {
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

      .lollipop-track,
      .lollipop-markers {
        display: none;
      }

      .lollipop-list {
        position: relative;
        padding-left: 0;
      }

      .lollipop-list::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 22px;
        width: 2px;
        background: var(--hm-line);
        opacity: 0.7;
      }

      .lollipop-row {
        display: flex;
        align-items: flex-start;
        height: auto;
        gap: 16px;
        margin: 0 0 32px 8px;
      }

      .lollipop-row:last-child {
        margin-bottom: 0;
      }

      .lollipop-row--left {
        flex-direction: row;
      }

      .lollipop-row--right {
        flex-direction: row-reverse;
      }

      .lollipop-mobile-badge-slot {
        display: flex;
        flex: none;
      }

      .lollipop-mobile-badge,
      .lollipop-mobile-badge-link {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-decoration: none;
        color: inherit;
      }

      .lollipop-mobile-badge-circle {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
      }

      .lollipop-mobile-badge-circle--image {
        background: #ffffff;
        border: 1px solid var(--hm-line);
        padding: 4px;
        overflow: hidden;
      }

      .lollipop-mobile-badge-circle--image img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .lollipop-mobile-badge-text {
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
        line-height: 1.1;
        text-align: center;
      }

      .lollipop-mobile-badge-image-label {
        font-size: 10px;
        font-weight: 700;
        opacity: 0.85;
        text-align: center;
        margin-top: 2px;
      }

      .lollipop-text,
      .lollipop-row--left .lollipop-text,
      .lollipop-row--right .lollipop-text {
        grid-column: auto;
        justify-self: auto;
        text-align: left;
        max-width: 100%;
        flex: 1 1 auto;
      }
    }`;
}

/**
 * Renders the lollipop-road timeline as a complete self-contained HTML
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

  const { svg: trackHtml, badgeCenters } = renderTrack(items);
  const markersHtml = renderMarkers(items, badgeCenters);
  const rowsHtml = items
    .map((item, index) => renderRow(item, index, colorForIndex(index)))
    .join("\n");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <div class="lollipop-wrap">${trackHtml}${markersHtml}
    <ol class="lollipop-list">${rowsHtml}
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
